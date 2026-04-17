"""
PRL Alert Lambda — triggered by EventBridge when an ECS task stops.

Checks DynamoDB alert config to see if the failed job is critical,
then publishes to SNS if alerts are enabled.
"""

import os
from datetime import datetime, timezone

import boto3

ALERT_TABLE_NAME = os.environ.get("ALERT_TABLE_NAME", "prl-alert-config")
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")
REGION = os.environ.get("AWS_REGION_NAME", "us-east-1")


def _dynamodb_resource():
    return boto3.resource("dynamodb", region_name=REGION)


def _sns_client():
    return boto3.client("sns", region_name=REGION)


def _get_alert_config():
    """Fetch alert configuration from DynamoDB."""
    table = _dynamodb_resource().Table(ALERT_TABLE_NAME)
    response = table.get_item(Key={"configId": "default"})
    return response.get("Item")


def _extract_job_name(task_definition_arn: str) -> str:
    """Extract job name from task definition ARN.

    e.g. 'arn:aws:ecs:...:task-definition/prl-floor-ingest:3' -> 'floor-ingest'
    """
    family = task_definition_arn.split("/")[-1].split(":")[0]
    # Strip 'prl-' prefix if present
    if family.startswith("prl-"):
        family = family[4:]
    return family


def lambda_handler(event, context):
    """Handle ECS Task State Change events from EventBridge."""
    detail = event.get("detail", {})
    last_status = detail.get("lastStatus", "")

    # Only care about STOPPED tasks
    if last_status != "STOPPED":
        return {"action": "skipped", "reason": "not a STOPPED event"}

    # Check exit code
    containers = detail.get("containers", [])
    exit_code = containers[0].get("exitCode") if containers else None

    if exit_code == 0:
        return {"action": "skipped", "reason": "task succeeded (exit code 0)"}

    # Get job name from task definition
    task_def_arn = detail.get("taskDefinitionArn", "")
    job_name = _extract_job_name(task_def_arn)

    if not job_name:
        return {"action": "skipped", "reason": "could not determine job name"}

    # Check alert config
    config = _get_alert_config()
    if not config:
        return {"action": "skipped", "reason": "no alert config found"}

    if not config.get("enabled", False):
        return {"action": "skipped", "reason": "alerts disabled"}

    critical_jobs = config.get("critical_jobs", [])
    if job_name not in critical_jobs:
        return {
            "action": "skipped",
            "reason": f"'{job_name}' is not in critical jobs list",
        }

    # Send alert
    if not SNS_TOPIC_ARN:
        return {"action": "skipped", "reason": "SNS topic not configured"}

    stop_reason = detail.get("stoppedReason", "Unknown")
    task_arn = detail.get("taskArn", "Unknown")
    cluster_arn = detail.get("clusterArn", "Unknown")
    stopped_at = detail.get("stoppedAt", datetime.now(timezone.utc).isoformat())

    message = (
        f"ALERT: Batch job '{job_name}' failed\n\n"
        f"Exit Code: {exit_code}\n"
        f"Stop Reason: {stop_reason}\n"
        f"Task ARN: {task_arn}\n"
        f"Cluster: {cluster_arn}\n"
        f"Stopped At: {stopped_at}\n\n"
        f"Check the Operations Dashboard for logs and details."
    )

    sns = _sns_client()
    sns.publish(
        TopicArn=SNS_TOPIC_ARN,
        Subject=f"[PRL] FAILED: {job_name}",
        Message=message,
    )

    return {
        "action": "alert_sent",
        "job_name": job_name,
        "exit_code": exit_code,
    }
