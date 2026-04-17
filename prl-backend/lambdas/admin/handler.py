"""
Consolidated Admin API Lambda Handler.

Merges routes from lambda-admin (save, upload, get-survey-config)
and lambda-survey-upload (get-presigned-url, trigger-processing, job-status).
"""

import json
import os
import base64
import uuid
import boto3
from datetime import datetime

# Configuration
S3_BUCKET = os.environ["S3_BUCKET"]
SURVEY_S3_BUCKET = os.environ["SURVEY_S3_BUCKET"]
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
API_KEY = os.environ.get("API_KEY", "")
CLOUDFRONT_URL = os.environ.get("CLOUDFRONT_URL", "https://americaspoliticalpulse.com")
SURVEY_API_SECRET_NAME = os.environ.get(
    "SURVEY_API_SECRET_NAME", "americas-pulse/survey-upload-api"
)
PRESIGNED_URL_EXPIRY = 3600  # 1 hour
PROCESSOR_LAMBDA_NAME = os.environ.get("PROCESSOR_LAMBDA_NAME", "survey-processor")
DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE")  # Optional - for job tracking

s3_client = boto3.client("s3")
cf_client = boto3.client("cloudfront")
secrets_client = boto3.client("secretsmanager")
lambda_client = boto3.client("lambda")

CLOUDFRONT_DISTRIBUTION_ID = os.environ.get("CLOUDFRONT_DISTRIBUTION_ID", "")

# Lazy-loaded DynamoDB resource
_dynamodb = None


def get_dynamodb():
    """Get DynamoDB resource (lazy-loaded)."""
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb")
    return _dynamodb


def cors_response(status_code, body):
    """Return a response with CORS headers."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, x-api-key",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        },
        "body": json.dumps(body),
    }


def handler(event, context):
    """Main Lambda handler - routes requests to appropriate handlers."""
    http_method = event.get("httpMethod") or event.get("requestContext", {}).get(
        "http", {}
    ).get("method", "")
    path = event.get("path") or event.get("rawPath", "/")

    # Handle CORS preflight
    if http_method == "OPTIONS":
        return cors_response(200, {"message": "OK"})

    # Strip stage prefix if present (e.g., /prod/save -> /save)
    for prefix in ("/prod", "/dev"):
        if path.startswith(prefix):
            path = path[len(prefix) :]
            break

    # --- Admin routes (password auth) ---
    if path == "/login":
        return handle_login(event)
    elif path == "/save":
        return handle_save(event)
    elif path == "/upload":
        return handle_upload(event)
    elif path == "/get-survey-config":
        return handle_get_survey_config(event)

    # --- Report HTML upload route (password auth) ---
    elif path == "/get-report-presigned-url":
        return handle_get_report_presigned_url(event)

    # --- Survey upload routes (API key auth) ---
    elif path == "/get-presigned-url":
        return handle_get_presigned_url(event)
    elif path == "/trigger-processing":
        return handle_trigger_processing(event)
    elif path.startswith("/job-status/"):
        job_id = path.split("/job-status/")[-1]
        return handle_get_job_status(job_id, event)

    else:
        return cors_response(404, {"error": "Not found"})


# =============================================================================
# Admin routes (from lambda-admin)
# =============================================================================


def handle_login(event):
    """Validate admin password."""
    try:
        body = json.loads(event.get("body", "{}"))
        if body.get("password") == ADMIN_PASSWORD:
            return cors_response(200, {"success": True})
        return cors_response(401, {"error": "Unauthorized"})
    except Exception as e:
        return cors_response(500, {"error": str(e)})


def handle_save(event):
    """Save JSON content to S3."""
    try:
        body = json.loads(event.get("body", "{}"))

        if body.get("password") != ADMIN_PASSWORD:
            return cors_response(401, {"error": "Unauthorized"})

        file_path = body.get("filePath")
        content = body.get("content")

        if not file_path or content is None:
            return cors_response(400, {"error": "Missing filePath or content"})

        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=file_path,
            Body=json.dumps(content, indent=2),
            ContentType="application/json",
            CacheControl="no-cache",
        )

        # Invalidate CloudFront cache so changes appear immediately
        cf_client.create_invalidation(
            DistributionId=CLOUDFRONT_DISTRIBUTION_ID,
            InvalidationBatch={
                "Paths": {"Quantity": 1, "Items": [f"/{file_path}"]},
                "CallerReference": f"admin-save-{datetime.utcnow().timestamp()}",
            },
        )

        return cors_response(
            200,
            {
                "message": "Published successfully",
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    except Exception as e:
        return cors_response(500, {"error": str(e)})


def handle_upload(event):
    """Upload a binary file (like PDF) to S3."""
    try:
        body = json.loads(event.get("body", "{}"))

        if body.get("password") != ADMIN_PASSWORD:
            return cors_response(401, {"error": "Unauthorized"})

        file_path = body.get("filePath")
        file_data = body.get("fileData")  # Base64 encoded
        content_type = body.get("contentType", "application/octet-stream")

        if not file_path or not file_data:
            return cors_response(400, {"error": "Missing filePath or fileData"})

        try:
            binary_data = base64.b64decode(file_data)
        except Exception:
            return cors_response(400, {"error": "Invalid base64 data"})

        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=file_path,
            Body=binary_data,
            ContentType=content_type,
            CacheControl="max-age=31536000",
        )

        url = f"{CLOUDFRONT_URL}/{file_path}"

        return cors_response(
            200,
            {
                "message": "Uploaded successfully",
                "url": url,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    except Exception as e:
        return cors_response(500, {"error": str(e)})


def handle_get_survey_config(event):
    """Get survey upload API configuration from Secrets Manager."""
    try:
        body = json.loads(event.get("body", "{}"))

        if body.get("password") != ADMIN_PASSWORD:
            return cors_response(401, {"error": "Unauthorized"})

        try:
            secret_response = secrets_client.get_secret_value(
                SecretId=SURVEY_API_SECRET_NAME
            )
            secret_data = json.loads(secret_response["SecretString"])

            return cors_response(
                200,
                {
                    "apiKey": secret_data.get("apiKey"),
                    "baseUrl": secret_data.get("baseUrl"),
                },
            )
        except secrets_client.exceptions.ResourceNotFoundException:
            return cors_response(404, {"error": "Survey API configuration not found"})
        except Exception as e:
            return cors_response(500, {"error": f"Failed to retrieve secret: {str(e)}"})

    except Exception as e:
        return cors_response(500, {"error": str(e)})


def handle_get_report_presigned_url(event):
    """Generate a presigned PUT URL for uploading an HTML report to S3."""
    try:
        body = json.loads(event.get("body", "{}"))

        if body.get("password") != ADMIN_PASSWORD:
            return cors_response(401, {"error": "Unauthorized"})

        slug = body.get("slug")
        if not slug:
            return cors_response(400, {"error": "Missing slug"})

        s3_key = f"news/html/{slug}.html"

        presigned_url = s3_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": S3_BUCKET,
                "Key": s3_key,
                "ContentType": "text/html",
            },
            ExpiresIn=PRESIGNED_URL_EXPIRY,
        )

        return cors_response(
            200,
            {
                "presignedUrl": presigned_url,
                "s3Key": s3_key,
                "expiresIn": PRESIGNED_URL_EXPIRY,
            },
        )

    except Exception as e:
        return cors_response(500, {"error": str(e)})


# =============================================================================
# Survey upload routes (from lambda-survey-upload)
# =============================================================================


def handle_get_presigned_url(event):
    """Generate a presigned URL for S3 upload."""
    try:
        headers = event.get("headers", {})
        api_key = headers.get("x-api-key") or headers.get("X-Api-Key") or ""

        if api_key != API_KEY:
            return cors_response(401, {"error": "Unauthorized - Invalid API key"})

        body = json.loads(event.get("body", "{}"))
        filename = body.get("filename")
        upload_type = body.get("uploadType")

        if not filename:
            return cors_response(400, {"error": "Missing filename"})

        if not upload_type:
            return cors_response(400, {"error": "Missing uploadType"})

        if upload_type not in ["labelled", "unlabelled", "international"]:
            return cors_response(
                400,
                {
                    "error": "Invalid uploadType. Must be: labelled, unlabelled, or international"
                },
            )

        if filename.lower().endswith(".csv"):
            content_type = "text/csv"
        elif filename.lower().endswith(".zip"):
            content_type = "application/zip"
        else:
            content_type = "application/octet-stream"

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        s3_key = f"surveys/{upload_type}/{timestamp}_{unique_id}_{filename}"

        presigned_url = s3_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": SURVEY_S3_BUCKET,
                "Key": s3_key,
                "ContentType": content_type,
            },
            ExpiresIn=PRESIGNED_URL_EXPIRY,
        )

        return cors_response(
            200,
            {
                "presignedUrl": presigned_url,
                "s3Key": s3_key,
                "expiresIn": PRESIGNED_URL_EXPIRY,
            },
        )

    except Exception as e:
        return cors_response(500, {"error": str(e)})


def handle_trigger_processing(event):
    """Trigger on-demand processing: ingestion (with s3Key) or analytics-only."""
    try:
        headers = event.get("headers", {})
        api_key = headers.get("x-api-key") or headers.get("X-Api-Key") or ""

        if api_key != API_KEY:
            return cors_response(401, {"error": "Unauthorized - Invalid API key"})

        body = json.loads(event.get("body", "{}"))
        s3_key = body.get("s3Key")

        if s3_key:
            # Ingest mode: invoke with S3 event format (ingests CSV + runs analytics)
            payload = {
                "Records": [
                    {
                        "s3": {
                            "bucket": {"name": SURVEY_S3_BUCKET},
                            "object": {"key": s3_key},
                        }
                    }
                ]
            }
            message = f"Ingestion triggered for: {s3_key}"
        else:
            # Analytics-only mode
            action = body.get("action", "process_all")
            valid_actions = ["process_us", "process_international", "process_all"]
            if action not in valid_actions:
                return cors_response(
                    400,
                    {
                        "error": f"Invalid action. Must be one of: {', '.join(valid_actions)}"
                    },
                )
            payload = {"action": action}
            message = f"Processing triggered: {action}"

        lambda_client.invoke(
            FunctionName=PROCESSOR_LAMBDA_NAME,
            InvocationType="Event",  # Async invocation
            Payload=json.dumps(payload),
        )

        tracking_id = str(uuid.uuid4())

        return cors_response(
            200,
            {
                "message": message,
                "trackingId": tracking_id,
                "status": "processing",
            },
        )

    except lambda_client.exceptions.ResourceNotFoundException:
        return cors_response(
            503,
            {"error": "Processing service not available. Lambda function not found."},
        )
    except Exception as e:
        return cors_response(500, {"error": str(e)})


def handle_get_job_status(job_id, event):
    """Get processing job status from DynamoDB (if configured)."""
    try:
        headers = event.get("headers", {})
        api_key = headers.get("x-api-key") or headers.get("X-Api-Key") or ""

        if api_key != API_KEY:
            return cors_response(401, {"error": "Unauthorized - Invalid API key"})

        if not job_id:
            return cors_response(400, {"error": "Job ID required"})

        if not DYNAMODB_TABLE:
            return cors_response(
                501, {"error": "Job tracking not configured (DYNAMODB_TABLE not set)"}
            )

        dynamodb = get_dynamodb()
        table = dynamodb.Table(DYNAMODB_TABLE)
        response = table.get_item(Key={"jobId": job_id})

        job = response.get("Item")
        if not job:
            return cors_response(404, {"error": "Job not found"})

        # Convert Decimal to int/float for JSON serialization
        serializable_job = {}
        for key, value in job.items():
            if hasattr(value, "__int__"):
                serializable_job[key] = int(value)
            elif hasattr(value, "__float__"):
                serializable_job[key] = float(value)
            else:
                serializable_job[key] = value

        return cors_response(200, serializable_job)

    except Exception as e:
        return cors_response(500, {"error": str(e)})
