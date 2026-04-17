"""
Status Tracker for Survey Processing Jobs

Manages job status in DynamoDB for tracking processing progress.
"""

import os
import uuid
import logging
from datetime import datetime
from typing import Optional

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class StatusTracker:
    """Track survey processing job status in DynamoDB."""

    # Job statuses
    STATUS_PENDING = "pending"
    STATUS_INGESTING = "ingesting"
    STATUS_PROCESSING = "processing"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"

    def __init__(self, table_name: Optional[str] = None):
        """
        Initialize the status tracker.

        Args:
            table_name: DynamoDB table name. Defaults to DYNAMODB_TABLE env var.
        """
        self.table_name = table_name or os.environ.get(
            "DYNAMODB_TABLE", "survey-processing-jobs"
        )
        self.dynamodb = boto3.resource("dynamodb")
        self.table = self.dynamodb.Table(self.table_name)

    def create_job(
        self, s3_key: str, upload_type: str, filename: Optional[str] = None
    ) -> str:
        """
        Create a new processing job record.

        Args:
            s3_key: S3 object key
            upload_type: Type of upload (labelled, unlabelled, international)
            filename: Original filename

        Returns:
            Job ID
        """
        job_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat() + "Z"

        item = {
            "jobId": job_id,
            "s3Key": s3_key,
            "uploadType": upload_type,
            "status": self.STATUS_PENDING,
            "createdAt": now,
            "updatedAt": now,
            "rowsIngested": 0,
        }

        if filename:
            item["filename"] = filename

        try:
            self.table.put_item(Item=item)
            logger.info(f"Created job {job_id} for {s3_key}")
            return job_id
        except ClientError as e:
            logger.error(f"Failed to create job: {e}")
            raise

    def update_status(
        self,
        job_id: str,
        status: str,
        rows_ingested: Optional[int] = None,
        error_message: Optional[str] = None,
        additional_data: Optional[dict] = None,
    ) -> None:
        """
        Update job status.

        Args:
            job_id: Job ID
            status: New status
            rows_ingested: Number of rows ingested (optional)
            error_message: Error message if failed (optional)
            additional_data: Additional data to store (optional)
        """
        now = datetime.utcnow().isoformat() + "Z"

        update_expr = "SET #status = :status, updatedAt = :updatedAt"
        expr_names = {"#status": "status"}
        expr_values = {":status": status, ":updatedAt": now}

        if rows_ingested is not None:
            update_expr += ", rowsIngested = :rowsIngested"
            expr_values[":rowsIngested"] = rows_ingested

        if error_message is not None:
            update_expr += ", errorMessage = :errorMessage"
            expr_values[":errorMessage"] = error_message

        if additional_data:
            for key, value in additional_data.items():
                update_expr += f", {key} = :{key}"
                expr_values[f":{key}"] = value

        try:
            self.table.update_item(
                Key={"jobId": job_id},
                UpdateExpression=update_expr,
                ExpressionAttributeNames=expr_names,
                ExpressionAttributeValues=expr_values,
            )
            logger.info(f"Updated job {job_id} status to {status}")
        except ClientError as e:
            logger.error(f"Failed to update job status: {e}")
            raise

    def get_job(self, job_id: str) -> Optional[dict]:
        """
        Get job status.

        Args:
            job_id: Job ID

        Returns:
            Job record or None if not found
        """
        try:
            response = self.table.get_item(Key={"jobId": job_id})
            return response.get("Item")
        except ClientError as e:
            logger.error(f"Failed to get job: {e}")
            return None

    def mark_ingesting(self, job_id: str) -> None:
        """Mark job as ingesting data."""
        self.update_status(job_id, self.STATUS_INGESTING)

    def mark_processing(self, job_id: str, rows_ingested: int) -> None:
        """Mark job as processing analytics."""
        self.update_status(job_id, self.STATUS_PROCESSING, rows_ingested=rows_ingested)

    def mark_completed(self, job_id: str, rows_ingested: Optional[int] = None) -> None:
        """Mark job as completed."""
        self.update_status(job_id, self.STATUS_COMPLETED, rows_ingested=rows_ingested)

    def mark_failed(self, job_id: str, error_message: str) -> None:
        """Mark job as failed with error message."""
        self.update_status(job_id, self.STATUS_FAILED, error_message=error_message)
