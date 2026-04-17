"""
PRL Monitoring Lambda — provides system health, job status, log viewer,
database health, and alert configuration endpoints.

All endpoints (except /health) require `x-admin-password` header matching
the ADMIN_PASSWORD env var.
"""

import json
import os
from datetime import datetime, timedelta, timezone

import boto3
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from mangum import Mangum

app = FastAPI(title="PRL Monitoring")

ECS_CLUSTER = os.environ.get("ECS_CLUSTER_NAME", "prl")
LOG_GROUP = os.environ.get("LOG_GROUP_NAME", "/prl/batch")
REGION = os.environ.get("AWS_REGION_NAME", "us-east-1")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
ALERT_TABLE_NAME = os.environ.get("ALERT_TABLE_NAME", "prl-alert-config")
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")
DB_SECRET_NAME = os.environ.get("DB_SECRET_NAME", "prl/database")

# Lambda function names to monitor
LAMBDA_FUNCTIONS = {
    "pulse-api": os.environ.get("PULSE_API_FUNCTION_NAME", "PrlApiFunction"),
    "search-api": os.environ.get("SEARCH_API_FUNCTION_NAME", "prl-search-api"),
    "admin-api": os.environ.get("ADMIN_API_FUNCTION_NAME", "prl-admin-api"),
}

# Key tables to track row counts
DB_TABLES = {
    "elite.mat_classification_legislator": "elite",
    "elite.officials": "elite",
    "elite.challengers": "elite",
    "elite.tweets_challengers": "elite",
    "elite.classifications_challengers": "elite",
    "surveys.us_labelled": "surveys",
    "pulse.state_profiles": "pulse",
}

# All known batch jobs
BATCH_JOBS = [
    "floor-ingest",
    "twitter-ingest",
    "twitter-media-ingest",
    "twitter-media-annotate",
    "rhetoric-classify",
    "rhetoric-profile",
    "rhetoric-public-s3",
    "ideology-update",
    "efficacy-update",
    "attendance-update",
    "money-update",
    "federal-update",
    "twitter-ids-update",
    "state-sync",
    "state-update",
    "pulse-elites-update",
    "statements-ingest",
    "survey-upload",
    "toplines-generate",
    "regenerate-data",
    "challenger-sync",
    "challenger-twitter-ingest",
    "challenger-rhetoric-classify",
    "pulse-primary-update",
    "campaign-sites-crawl",
    "campaign-sites-crawl-state",
    "statements-press-urls",
]

# Jobs that can be triggered on-demand from the admin console
TRIGGERABLE_JOBS = [
    "toplines-generate",
    "regenerate-data",
    "rhetoric-public-s3",
    "survey-upload",
]


# ---------------------------------------------------------------------------
# Auth middleware
# ---------------------------------------------------------------------------


@app.middleware("http")
async def check_admin_password(request: Request, call_next):
    """Require x-admin-password header on all endpoints except /health."""
    if request.url.path == "/health":
        return await call_next(request)

    password = request.headers.get("x-admin-password", "")
    if not ADMIN_PASSWORD or password != ADMIN_PASSWORD:
        return JSONResponse(
            status_code=401,
            content={
                "detail": "Unauthorized — invalid or missing x-admin-password header"
            },
        )
    return await call_next(request)


# ---------------------------------------------------------------------------
# AWS clients (lazy)
# ---------------------------------------------------------------------------


def _ecs_client():
    return boto3.client("ecs", region_name=REGION)


def _logs_client():
    return boto3.client("logs", region_name=REGION)


def _cw_client():
    return boto3.client("cloudwatch", region_name=REGION)


def _lambda_client():
    return boto3.client("lambda", region_name=REGION)


def _dynamodb_resource():
    return boto3.resource("dynamodb", region_name=REGION)


def _sns_client():
    return boto3.client("sns", region_name=REGION)


def _get_db_connection():
    """Get a pymysql database connection using Secrets Manager creds."""
    import pymysql

    secrets_client = boto3.client("secretsmanager", region_name=REGION)
    secret = json.loads(
        secrets_client.get_secret_value(SecretId=DB_SECRET_NAME)["SecretString"]
    )
    return pymysql.connect(
        host=secret["DB_HOST"],
        port=int(secret["DB_PORT"]),
        user=secret["DB_USER"],
        password=secret["DB_PASSWORD"],
        connect_timeout=10,
    )


# ---------------------------------------------------------------------------
# Health (no auth)
# ---------------------------------------------------------------------------


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Overall status
# ---------------------------------------------------------------------------


@app.get("/status")
def overall_status():
    """Combined system health: jobs + APIs + database."""
    result = {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "jobs": {"status": "unknown"},
        "apis": {"status": "unknown"},
        "database": {"status": "unknown"},
    }

    # Jobs health
    try:
        ecs = _ecs_client()
        running = ecs.list_tasks(cluster=ECS_CLUSTER, desiredStatus="RUNNING")
        running_count = len(running.get("taskArns", []))

        stopped = ecs.list_tasks(cluster=ECS_CLUSTER, desiredStatus="STOPPED")
        stopped_arns = stopped.get("taskArns", [])
        failed_count = 0
        if stopped_arns:
            described = ecs.describe_tasks(cluster=ECS_CLUSTER, tasks=stopped_arns[:10])
            for task in described.get("tasks", []):
                container = task.get("containers", [{}])[0]
                if container.get("exitCode") not in (None, 0):
                    failed_count += 1

        jobs_status = "ok"
        if failed_count > 0:
            jobs_status = "error"
        elif running_count > 0:
            jobs_status = "ok"

        result["jobs"] = {
            "status": jobs_status,
            "running": running_count,
            "recent_failures": failed_count,
        }
    except Exception as e:
        result["jobs"] = {"status": "error", "detail": str(e)}

    # API health
    try:
        lam = _lambda_client()
        cw = _cw_client()
        now = datetime.now(timezone.utc)
        api_statuses = {}

        for name, func_name in LAMBDA_FUNCTIONS.items():
            try:
                lam.get_function(FunctionName=func_name)
                # Check for recent errors
                error_resp = cw.get_metric_statistics(
                    Namespace="AWS/Lambda",
                    MetricName="Errors",
                    Dimensions=[{"Name": "FunctionName", "Value": func_name}],
                    StartTime=now - timedelta(hours=1),
                    EndTime=now,
                    Period=3600,
                    Statistics=["Sum"],
                )
                error_sum = sum(
                    dp.get("Sum", 0) for dp in error_resp.get("Datapoints", [])
                )
                invoc_resp = cw.get_metric_statistics(
                    Namespace="AWS/Lambda",
                    MetricName="Invocations",
                    Dimensions=[{"Name": "FunctionName", "Value": func_name}],
                    StartTime=now - timedelta(hours=1),
                    EndTime=now,
                    Period=3600,
                    Statistics=["Sum"],
                )
                invoc_sum = sum(
                    dp.get("Sum", 0) for dp in invoc_resp.get("Datapoints", [])
                )

                if invoc_sum == 0:
                    api_statuses[name] = {
                        "status": "idle",
                        "errors_1h": 0,
                        "invocations_1h": 0,
                    }
                elif error_sum / invoc_sum > 0.1:
                    api_statuses[name] = {
                        "status": "degraded",
                        "errors_1h": int(error_sum),
                        "invocations_1h": int(invoc_sum),
                    }
                else:
                    api_statuses[name] = {
                        "status": "ok",
                        "errors_1h": int(error_sum),
                        "invocations_1h": int(invoc_sum),
                    }
            except lam.exceptions.ResourceNotFoundException:
                api_statuses[name] = {"status": "not_found"}
            except Exception as e:
                api_statuses[name] = {"status": "error", "detail": str(e)}

        degraded = any(v["status"] == "degraded" for v in api_statuses.values())
        errored = any(
            v["status"] in ("error", "not_found") for v in api_statuses.values()
        )
        apis_overall = "error" if errored else ("degraded" if degraded else "ok")
        result["apis"] = {"status": apis_overall, "functions": api_statuses}
    except Exception as e:
        result["apis"] = {"status": "error", "detail": str(e)}

    # Database health
    try:
        conn = _get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1")
        conn.close()
        result["database"] = {"status": "ok"}
    except Exception as e:
        result["database"] = {"status": "error", "detail": str(e)}

    # Overall status
    statuses = [
        result["jobs"]["status"],
        result["apis"]["status"],
        result["database"]["status"],
    ]
    if "error" in statuses:
        result["status"] = "error"
    elif "degraded" in statuses:
        result["status"] = "degraded"
    else:
        result["status"] = "ok"

    return result


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------


@app.get("/status/jobs")
def list_jobs():
    """List recent ECS task runs."""
    ecs = _ecs_client()
    tasks = []

    for status in ["RUNNING", "STOPPED"]:
        task_arns = ecs.list_tasks(cluster=ECS_CLUSTER, desiredStatus=status).get(
            "taskArns", []
        )

        if task_arns:
            described = ecs.describe_tasks(cluster=ECS_CLUSTER, tasks=task_arns)
            for task in described.get("tasks", []):
                container = task.get("containers", [{}])[0]
                tasks.append(
                    {
                        "task_arn": task["taskArn"],
                        "task_definition": task["taskDefinitionArn"].split("/")[-1],
                        "status": task["lastStatus"],
                        "started_at": task["startedAt"].isoformat()
                        if task.get("startedAt")
                        else None,
                        "stopped_at": task["stoppedAt"].isoformat()
                        if task.get("stoppedAt")
                        else None,
                        "exit_code": container.get("exitCode"),
                        "stop_reason": task.get("stoppedReason"),
                    }
                )

    return {"jobs": tasks}


@app.get("/status/jobs/history")
def job_history():
    """30-day run history per job from CloudWatch log streams."""
    logs = _logs_client()
    now = datetime.now(timezone.utc)
    thirty_days_ago = int((now - timedelta(days=30)).timestamp() * 1000)

    history = {}
    for job_name in BATCH_JOBS:
        try:
            streams = []
            # Note: orderBy="LastEventTime" cannot be used with logStreamNamePrefix.
            # Use default orderBy (LogStreamName) with prefix filter instead.
            kwargs = {
                "logGroupName": LOG_GROUP,
                "logStreamNamePrefix": job_name,
                "descending": True,
            }
            # Paginate up to 100 streams
            for _ in range(2):
                resp = logs.describe_log_streams(**kwargs)
                for s in resp.get("logStreams", []):
                    last_event = s.get("lastEventTimestamp", 0)
                    if last_event >= thirty_days_ago:
                        streams.append(
                            {
                                "stream_name": s["logStreamName"],
                                "first_event": datetime.fromtimestamp(
                                    s.get("firstEventTimestamp", 0) / 1000,
                                    tz=timezone.utc,
                                ).isoformat()
                                if s.get("firstEventTimestamp")
                                else None,
                                "last_event": datetime.fromtimestamp(
                                    last_event / 1000, tz=timezone.utc
                                ).isoformat(),
                            }
                        )
                if "nextToken" in resp and len(resp.get("logStreams", [])) == 50:
                    kwargs["nextToken"] = resp["nextToken"]
                else:
                    break

            # Sort by last event time descending
            streams.sort(key=lambda s: s["last_event"] or "", reverse=True)

            # Get last summary message from most recent stream
            last_message = None
            job_summary = None
            if streams:
                try:
                    log_resp = logs.get_log_events(
                        logGroupName=LOG_GROUP,
                        logStreamName=streams[0]["stream_name"],
                        startFromHead=True,
                        limit=500,
                    )
                    events = log_resp.get("events", [])
                    # Look for JOB_SUMMARY line (search from end)
                    for event in reversed(events):
                        msg = event.get("message", "").strip()
                        if msg.startswith("JOB_SUMMARY: "):
                            try:
                                job_summary = json.loads(msg[len("JOB_SUMMARY: ") :])
                            except (json.JSONDecodeError, ValueError):
                                pass
                            break
                    # Fall back to last non-empty meaningful line
                    for event in reversed(events):
                        msg = event.get("message", "").strip()
                        if msg and len(msg) > 5 and not msg.startswith("JOB_SUMMARY: "):
                            last_message = msg
                            break
                except Exception:
                    pass

            history[job_name] = {
                "run_count": len(streams),
                "runs": streams[:30],  # Cap at 30 most recent
                "last_message": last_message,
                "job_summary": job_summary,
            }
        except Exception as e:
            history[job_name] = {"run_count": 0, "runs": [], "error": str(e)}

    return {"history": history, "period_days": 30}


@app.get("/status/jobs/{name}")
def job_detail(name: str):
    """Details and recent logs for a specific job."""
    logs_client = _logs_client()

    try:
        response = logs_client.filter_log_events(
            logGroupName=LOG_GROUP,
            logStreamNamePrefix=name,
            startTime=int(
                (datetime.now(timezone.utc) - timedelta(hours=24)).timestamp() * 1000
            ),
            limit=100,
            interleaved=True,
        )
        log_events = [
            {
                "timestamp": datetime.fromtimestamp(
                    e["timestamp"] / 1000, tz=timezone.utc
                ).isoformat(),
                "message": e["message"],
            }
            for e in response.get("events", [])
        ]
    except Exception as e:
        log_events = [{"error": str(e)}]

    return {"job_name": name, "recent_logs": log_events}


@app.get("/status/jobs/{name}/logs")
def job_logs(name: str, request: Request):
    """Paginated log viewer with search and filtering."""
    logs_client = _logs_client()

    params = request.query_params
    search = params.get("search")
    start_time = params.get("start_time")
    end_time = params.get("end_time")
    next_token = params.get("next_token")
    limit = min(int(params.get("limit", "100")), 500)

    kwargs = {
        "logGroupName": LOG_GROUP,
        "logStreamNamePrefix": name,
        "limit": limit,
        "interleaved": True,
    }

    if start_time:
        kwargs["startTime"] = int(start_time)
    else:
        kwargs["startTime"] = int(
            (datetime.now(timezone.utc) - timedelta(hours=24)).timestamp() * 1000
        )

    if end_time:
        kwargs["endTime"] = int(end_time)

    if search:
        kwargs["filterPattern"] = search

    if next_token:
        kwargs["nextToken"] = next_token

    try:
        response = logs_client.filter_log_events(**kwargs)
        events = [
            {
                "timestamp": datetime.fromtimestamp(
                    e["timestamp"] / 1000, tz=timezone.utc
                ).isoformat(),
                "message": e["message"],
                "log_stream": e.get("logStreamName", ""),
            }
            for e in response.get("events", [])
        ]
        return {
            "events": events,
            "next_token": response.get("nextForwardToken"),
            "job_name": name,
        }
    except Exception as e:
        return {"events": [], "error": str(e), "job_name": name}


# ---------------------------------------------------------------------------
# API metrics
# ---------------------------------------------------------------------------


@app.get("/status/api")
def api_metrics():
    """Lambda invocation metrics for all monitored APIs."""
    cw = _cw_client()
    lam = _lambda_client()
    now = datetime.now(timezone.utc)

    result = {}
    for api_name, func_name in LAMBDA_FUNCTIONS.items():
        # Check function exists
        try:
            func_info = lam.get_function(FunctionName=func_name)
            func_state = func_info.get("Configuration", {}).get("State", "Unknown")
        except Exception:
            result[api_name] = {"status": "not_found", "metrics": {}}
            continue

        metrics = {}
        for metric_name in ["Invocations", "Errors", "Duration"]:
            response = cw.get_metric_statistics(
                Namespace="AWS/Lambda",
                MetricName=metric_name,
                Dimensions=[{"Name": "FunctionName", "Value": func_name}],
                StartTime=now - timedelta(hours=24),
                EndTime=now,
                Period=3600,
                Statistics=["Sum", "Average"],
            )
            datapoints = sorted(
                response.get("Datapoints", []), key=lambda x: x["Timestamp"]
            )
            metrics[metric_name.lower()] = [
                {
                    "timestamp": dp["Timestamp"].isoformat(),
                    "sum": dp.get("Sum"),
                    "average": dp.get("Average"),
                }
                for dp in datapoints
            ]

        result[api_name] = {
            "status": func_state,
            "function_name": func_name,
            "metrics": metrics,
        }

    return {"api_metrics": result}


# ---------------------------------------------------------------------------
# Database health
# ---------------------------------------------------------------------------


@app.get("/status/db")
def db_health():
    """Database connection test + row counts for key tables."""
    try:
        conn = _get_db_connection()
    except Exception as e:
        return {
            "status": "error",
            "detail": f"Connection failed: {e}",
            "tables": {},
        }

    tables = {}
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1")
            for table_full, db_name in DB_TABLES.items():
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {table_full}")  # noqa: S608
                    row_count = cursor.fetchone()[0]
                    tables[table_full] = {"row_count": row_count}
                except Exception as e:
                    tables[table_full] = {"error": str(e)}
    except Exception as e:
        return {"status": "error", "detail": str(e), "tables": tables}
    finally:
        conn.close()

    return {
        "status": "ok",
        "tables": tables,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Alert configuration
# ---------------------------------------------------------------------------


@app.get("/status/alerts/config")
def get_alert_config():
    """Get alert configuration from DynamoDB."""
    try:
        table = _dynamodb_resource().Table(ALERT_TABLE_NAME)
        response = table.get_item(Key={"configId": "default"})
        item = response.get("Item")
        if not item:
            return {
                "configId": "default",
                "critical_jobs": [],
                "alert_emails": [],
                "enabled": False,
            }
        # Convert Decimal types
        return {
            "configId": item.get("configId", "default"),
            "critical_jobs": item.get("critical_jobs", []),
            "alert_emails": item.get("alert_emails", []),
            "enabled": bool(item.get("enabled", False)),
            "updated_at": item.get("updated_at"),
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})


@app.post("/status/alerts/config")
async def update_alert_config(request: Request):
    """Update alert configuration in DynamoDB and sync SNS subscriptions."""
    body = await request.json()

    critical_jobs = body.get("critical_jobs", [])
    alert_emails = body.get("alert_emails", [])
    enabled = body.get("enabled", False)

    try:
        table = _dynamodb_resource().Table(ALERT_TABLE_NAME)
        table.put_item(
            Item={
                "configId": "default",
                "critical_jobs": critical_jobs,
                "alert_emails": alert_emails,
                "enabled": enabled,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        )

        # Sync SNS subscriptions if topic ARN is configured
        if SNS_TOPIC_ARN:
            _sync_sns_subscriptions(alert_emails)

        return {"message": "Alert configuration updated", "enabled": enabled}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})


def _sync_sns_subscriptions(desired_emails: list[str]):
    """Sync SNS topic subscriptions to match desired email list."""
    sns = _sns_client()

    # Get current subscriptions
    current_emails = {}
    paginator = sns.get_paginator("list_subscriptions_by_topic")
    for page in paginator.paginate(TopicArn=SNS_TOPIC_ARN):
        for sub in page.get("Subscriptions", []):
            if (
                sub["Protocol"] == "email"
                and sub["SubscriptionArn"] != "PendingConfirmation"
            ):
                current_emails[sub["Endpoint"]] = sub["SubscriptionArn"]

    desired_set = set(desired_emails)
    current_set = set(current_emails.keys())

    # Subscribe new emails
    for email in desired_set - current_set:
        sns.subscribe(TopicArn=SNS_TOPIC_ARN, Protocol="email", Endpoint=email)

    # Unsubscribe removed emails
    for email in current_set - desired_set:
        try:
            sns.unsubscribe(SubscriptionArn=current_emails[email])
        except Exception:
            pass  # May fail for pending subscriptions


@app.post("/status/alerts/test")
def test_alert(request: Request):
    """Send a test alert email via SNS."""
    if not SNS_TOPIC_ARN:
        return JSONResponse(
            status_code=400, content={"detail": "SNS topic not configured"}
        )

    try:
        sns = _sns_client()
        sns.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject="[PRL] Test Alert",
            Message=(
                "This is a test alert from the PRL Monitoring system.\n\n"
                "If you received this message, your alert configuration is working correctly.\n\n"
                f"Sent at: {datetime.now(timezone.utc).isoformat()}"
            ),
        )
        return {"message": "Test alert sent"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})


# ---------------------------------------------------------------------------
# Job results (operations.job_results)
# ---------------------------------------------------------------------------


@app.get("/results/summary")
def results_summary():
    """Latest headline metrics for all jobs (for dashboard grid)."""
    try:
        conn = _get_db_connection()
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT jr.job_name, jr.started_at, jr.completed_at,
                          jr.duration_seconds, jr.status, jr.records_processed,
                          jr.error_count, jr.headline_metrics_json, jr.metrics_json
                   FROM operations.job_results jr
                   INNER JOIN (
                       SELECT job_name, MAX(id) AS max_id
                       FROM operations.job_results
                       GROUP BY job_name
                   ) latest ON jr.job_name = latest.job_name AND jr.id = latest.max_id"""
            )
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})
    finally:
        conn.close()

    summary = {}
    for row in rows:
        r = dict(zip(columns, row))
        job_name = r["job_name"]
        # Parse JSON fields
        headline = r.get("headline_metrics_json")
        if isinstance(headline, str):
            headline = json.loads(headline)
        metrics = r.get("metrics_json")
        if isinstance(metrics, str):
            metrics = json.loads(metrics)
        summary[job_name] = {
            "started_at": r["started_at"].isoformat() if r.get("started_at") else None,
            "completed_at": r["completed_at"].isoformat()
            if r.get("completed_at")
            else None,
            "duration_seconds": r.get("duration_seconds"),
            "status": r.get("status"),
            "records_processed": r.get("records_processed", 0),
            "error_count": r.get("error_count", 0),
            "headline_metrics": headline,
            "metrics": metrics,
        }

    return {"summary": summary}


@app.get("/results/{job_name}")
def results_history(job_name: str, request: Request):
    """Last N days of results for sparkline charts."""
    params = request.query_params
    days = min(int(params.get("days", "30")), 90)
    limit = min(int(params.get("limit", "100")), 500)

    try:
        conn = _get_db_connection()
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT id, started_at, completed_at, duration_seconds,
                          status, records_processed, error_count,
                          metrics_json, headline_metrics_json
                   FROM operations.job_results
                   WHERE job_name = %s
                     AND started_at >= DATE_SUB(NOW(), INTERVAL %s DAY)
                   ORDER BY started_at DESC
                   LIMIT %s""",
                (job_name, days, limit),
            )
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})
    finally:
        conn.close()

    results = []
    for row in rows:
        r = dict(zip(columns, row))
        metrics = r.get("metrics_json")
        if isinstance(metrics, str):
            metrics = json.loads(metrics)
        headline = r.get("headline_metrics_json")
        if isinstance(headline, str):
            headline = json.loads(headline)
        results.append(
            {
                "id": r["id"],
                "started_at": r["started_at"].isoformat()
                if r.get("started_at")
                else None,
                "completed_at": r["completed_at"].isoformat()
                if r.get("completed_at")
                else None,
                "duration_seconds": r.get("duration_seconds"),
                "status": r.get("status"),
                "records_processed": r.get("records_processed", 0),
                "error_count": r.get("error_count", 0),
                "metrics": metrics,
                "headline_metrics": headline,
            }
        )

    return {"job_name": job_name, "results": results, "days": days}


@app.get("/results/{job_name}/latest")
def results_latest(job_name: str):
    """Most recent result with full metrics, steps, and errors."""
    try:
        conn = _get_db_connection()
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT id, started_at, completed_at, duration_seconds,
                          status, exit_code, records_processed, error_count,
                          errors_json, metrics_json, headline_metrics_json, steps_json
                   FROM operations.job_results
                   WHERE job_name = %s
                   ORDER BY id DESC
                   LIMIT 1""",
                (job_name,),
            )
            columns = [desc[0] for desc in cursor.description]
            row = cursor.fetchone()
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})
    finally:
        conn.close()

    if not row:
        return {"job_name": job_name, "result": None}

    r = dict(zip(columns, row))
    # Parse JSON fields
    for field in ("errors_json", "metrics_json", "headline_metrics_json", "steps_json"):
        val = r.get(field)
        if isinstance(val, str):
            r[field] = json.loads(val)

    return {
        "job_name": job_name,
        "result": {
            "id": r["id"],
            "started_at": r["started_at"].isoformat() if r.get("started_at") else None,
            "completed_at": r["completed_at"].isoformat()
            if r.get("completed_at")
            else None,
            "duration_seconds": r.get("duration_seconds"),
            "status": r.get("status"),
            "exit_code": r.get("exit_code"),
            "records_processed": r.get("records_processed", 0),
            "error_count": r.get("error_count", 0),
            "errors": r.get("errors_json"),
            "metrics": r.get("metrics_json"),
            "headline_metrics": r.get("headline_metrics_json"),
            "steps": r.get("steps_json"),
        },
    }


# ---------------------------------------------------------------------------
# Officials — press release URL review
# ---------------------------------------------------------------------------


@app.get("/officials/press-urls")
def list_press_urls(request: Request):
    """List officials with press release URL data for admin review."""
    params = request.query_params
    status_filter = params.get("status")  # found, needs_review, not_found, error

    try:
        conn = _get_db_connection()
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

    try:
        with conn.cursor() as cursor:
            sql = """SELECT bioguide_id, first_name, last_name, party, state,
                            government_website, press_release_url,
                            press_release_url_status
                     FROM elite.officials
                     WHERE active = 1 AND level = 'national'"""
            query_params = []
            if status_filter:
                sql += " AND press_release_url_status = %s"
                query_params.append(status_filter)
            sql += " ORDER BY last_name, first_name"
            cursor.execute(sql, query_params)
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})
    finally:
        conn.close()

    officials = [dict(zip(columns, row)) for row in rows]
    # Count by status
    counts = {}
    for o in officials:
        s = o.get("press_release_url_status") or "unknown"
        counts[s] = counts.get(s, 0) + 1

    return {"officials": officials, "counts": counts, "total": len(officials)}


@app.post("/officials/press-urls/update")
async def update_press_url(request: Request):
    """Update an official's press release URL and status."""
    body = await request.json()
    bioguide_id = body.get("bioguide_id")
    press_release_url = body.get("press_release_url")
    press_release_url_status = body.get("press_release_url_status")

    if not bioguide_id:
        return JSONResponse(
            status_code=400, content={"detail": "bioguide_id is required"}
        )
    if press_release_url_status not in (
        "found",
        "needs_review",
        "not_found",
        "error",
    ):
        return JSONResponse(
            status_code=400,
            content={
                "detail": "press_release_url_status must be one of: found, needs_review, not_found, error"
            },
        )

    try:
        conn = _get_db_connection()
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """UPDATE elite.officials
                   SET press_release_url = %s, press_release_url_status = %s
                   WHERE bioguide_id = %s""",
                (press_release_url, press_release_url_status, bioguide_id),
            )
        conn.commit()
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})
    finally:
        conn.close()

    return {
        "message": "Updated successfully",
        "bioguide_id": bioguide_id,
        "press_release_url": press_release_url,
        "press_release_url_status": press_release_url_status,
    }


# ---------------------------------------------------------------------------
# Job trigger
# ---------------------------------------------------------------------------


@app.post("/jobs/{job_name}/trigger")
async def trigger_job(job_name: str):
    """Trigger an on-demand ECS task run for a triggerable job."""
    if job_name not in TRIGGERABLE_JOBS:
        return JSONResponse(
            status_code=400,
            content={"detail": f"Job '{job_name}' is not triggerable"},
        )

    ecs = _ecs_client()
    subnets = json.loads(os.environ.get("ECS_SUBNETS", "[]"))
    security_group = os.environ.get("ECS_SECURITY_GROUP", "")

    response = ecs.run_task(
        cluster=ECS_CLUSTER,
        taskDefinition=f"prl-{job_name}",
        launchType="FARGATE",
        networkConfiguration={
            "awsvpcConfiguration": {
                "subnets": subnets,
                "securityGroups": [security_group] if security_group else [],
                "assignPublicIp": "DISABLED",
            }
        },
    )
    task_arn = response["tasks"][0]["taskArn"] if response.get("tasks") else None
    return {"message": f"Triggered {job_name}", "task_arn": task_arn}


@app.get("/jobs/triggerable")
def list_triggerable_jobs():
    """List all jobs that can be triggered on-demand."""
    return {"triggerable_jobs": TRIGGERABLE_JOBS}


# ---------------------------------------------------------------------------
# Download stats
# ---------------------------------------------------------------------------


DOWNLOAD_STATS_BUCKET = os.environ.get("DOWNLOAD_STATS_BUCKET", "")
DOWNLOAD_STATS_KEY = os.environ.get("DOWNLOAD_STATS_KEY", "admin/download-stats.json")
DOWNLOAD_STATS_LAMBDA = os.environ.get("DOWNLOAD_STATS_LAMBDA", "prl-download-stats")


@app.get("/downloads/stats")
def get_download_stats():
    """Return the most recent download stats aggregation."""
    s3 = boto3.client("s3", region_name=REGION)
    try:
        obj = s3.get_object(Bucket=DOWNLOAD_STATS_BUCKET, Key=DOWNLOAD_STATS_KEY)
        return json.loads(obj["Body"].read())
    except s3.exceptions.NoSuchKey:
        return JSONResponse(
            status_code=404,
            content={
                "detail": "No download stats available yet — trigger the aggregator first."
            },
        )


@app.post("/downloads/refresh")
def refresh_download_stats():
    """Invoke the download-stats Lambda synchronously to regenerate the JSON."""
    client = boto3.client("lambda", region_name=REGION)
    response = client.invoke(
        FunctionName=DOWNLOAD_STATS_LAMBDA,
        InvocationType="RequestResponse",
        Payload=b"{}",
    )
    payload = json.loads(response["Payload"].read())
    status = response.get("StatusCode", 0)
    if status >= 300 or not payload.get("ok", False):
        return JSONResponse(
            status_code=500,
            content={"detail": "Aggregator failed", "payload": payload},
        )
    return {"ok": True, "as_of": payload.get("summary", {}).get("as_of")}


# ---------------------------------------------------------------------------
# Mangum handler
# ---------------------------------------------------------------------------

lambda_handler = Mangum(app, api_gateway_base_path="/")
