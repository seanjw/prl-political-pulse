"""
Logging stack: CloudFront standard logging + Athena + download stats aggregator.

Creates:
- S3 bucket for CloudFront logs (prl-cloudfront-logs)
- Glue database and table with partition projection over the log bucket
- Athena workgroup with query result location and cost limit
- Lambda that aggregates logs into a JSON file for the admin dashboard
- Weekly EventBridge schedule that invokes the Lambda

CloudFront logging itself must be enabled on the distribution via CLI
after this stack deploys — the distribution is not managed by CDK.
"""

import os

from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    aws_s3 as s3,
    aws_glue as glue,
    aws_athena as athena,
    aws_lambda as _lambda,
    aws_iam as iam,
    aws_events as events,
    aws_events_targets as targets,
    CfnOutput,
)
from constructs import Construct


GLUE_DB_NAME = "prl_logs"
GLUE_TABLE_NAME = "cloudfront_logs"
ATHENA_WORKGROUP_NAME = "prl-logs"
LOG_BUCKET_NAME = "prl-cloudfront-logs"
# CloudFront writes logs under this prefix; Athena results go to a sibling
# prefix so the Glue table doesn't accidentally read Athena's own output.
LOG_PREFIX = "cf-logs/"
ATHENA_RESULTS_PREFIX = "athena-results/"
OUTPUT_BUCKET = os.environ["PRL_S3_BUCKET"]
OUTPUT_KEY = "admin/download-stats.json"


class LoggingStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs):
        super().__init__(scope, construct_id, **kwargs)

        # -----------------------------------------------------------------
        # S3 bucket for CloudFront logs
        # -----------------------------------------------------------------
        # CloudFront standard logging writes via ACL, so ObjectOwnership must
        # allow ACLs — BUCKET_OWNER_PREFERRED is the correct setting.
        log_bucket = s3.Bucket(
            self,
            "CloudFrontLogsBucket",
            bucket_name=LOG_BUCKET_NAME,
            object_ownership=s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            removal_policy=RemovalPolicy.RETAIN,
            lifecycle_rules=[
                s3.LifecycleRule(
                    id="expire-old-logs",
                    enabled=True,
                    prefix=LOG_PREFIX,
                    expiration=Duration.days(730),
                    transitions=[
                        s3.Transition(
                            storage_class=s3.StorageClass.GLACIER,
                            transition_after=Duration.days(90),
                        )
                    ],
                ),
                s3.LifecycleRule(
                    id="expire-athena-results",
                    enabled=True,
                    prefix=ATHENA_RESULTS_PREFIX,
                    expiration=Duration.days(30),
                ),
            ],
        )

        # -----------------------------------------------------------------
        # Glue database + table with partition projection
        # -----------------------------------------------------------------
        glue.CfnDatabase(
            self,
            "LogsDatabase",
            catalog_id=self.account,
            database_input=glue.CfnDatabase.DatabaseInputProperty(name=GLUE_DB_NAME),
        )

        # CloudFront standard log format (v1.0), tab-separated, 33 fields.
        # Reference: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/AccessLogs.html#LogFileFormat
        cloudfront_columns = [
            glue.CfnTable.ColumnProperty(name="log_date", type="date"),
            glue.CfnTable.ColumnProperty(name="log_time", type="string"),
            glue.CfnTable.ColumnProperty(name="location", type="string"),
            glue.CfnTable.ColumnProperty(name="bytes", type="bigint"),
            glue.CfnTable.ColumnProperty(name="request_ip", type="string"),
            glue.CfnTable.ColumnProperty(name="method", type="string"),
            glue.CfnTable.ColumnProperty(name="host", type="string"),
            glue.CfnTable.ColumnProperty(name="uri", type="string"),
            glue.CfnTable.ColumnProperty(name="status", type="int"),
            glue.CfnTable.ColumnProperty(name="referrer", type="string"),
            glue.CfnTable.ColumnProperty(name="user_agent", type="string"),
            glue.CfnTable.ColumnProperty(name="query_string", type="string"),
            glue.CfnTable.ColumnProperty(name="cookie", type="string"),
            glue.CfnTable.ColumnProperty(name="result_type", type="string"),
            glue.CfnTable.ColumnProperty(name="request_id", type="string"),
            glue.CfnTable.ColumnProperty(name="host_header", type="string"),
            glue.CfnTable.ColumnProperty(name="request_protocol", type="string"),
            glue.CfnTable.ColumnProperty(name="request_bytes", type="bigint"),
            glue.CfnTable.ColumnProperty(name="time_taken", type="float"),
            glue.CfnTable.ColumnProperty(name="xforwarded_for", type="string"),
            glue.CfnTable.ColumnProperty(name="ssl_protocol", type="string"),
            glue.CfnTable.ColumnProperty(name="ssl_cipher", type="string"),
            glue.CfnTable.ColumnProperty(name="response_result_type", type="string"),
            glue.CfnTable.ColumnProperty(name="http_version", type="string"),
            glue.CfnTable.ColumnProperty(name="fle_status", type="string"),
            glue.CfnTable.ColumnProperty(name="fle_encrypted_fields", type="int"),
            glue.CfnTable.ColumnProperty(name="c_port", type="int"),
            glue.CfnTable.ColumnProperty(name="time_to_first_byte", type="float"),
            glue.CfnTable.ColumnProperty(name="detailed_result_type", type="string"),
            glue.CfnTable.ColumnProperty(name="sc_content_type", type="string"),
            glue.CfnTable.ColumnProperty(name="sc_content_len", type="bigint"),
            glue.CfnTable.ColumnProperty(name="sc_range_start", type="bigint"),
            glue.CfnTable.ColumnProperty(name="sc_range_end", type="bigint"),
        ]

        # Note: CloudFront standard logs are written flat under cf-logs/
        # (e.g. cf-logs/{dist-id}.2026-04-09-03.abc.gz), not in date-prefixed
        # folders. Date filtering in SQL uses the `log_date` column from each
        # record. A 1 GB workgroup cost cap keeps queries bounded while log
        # volume is small. If volume grows, move to a partitioned layout via
        # S3 event-driven reorganization.
        logs_table = glue.CfnTable(
            self,
            "CloudFrontLogsTable",
            catalog_id=self.account,
            database_name=GLUE_DB_NAME,
            table_input=glue.CfnTable.TableInputProperty(
                name=GLUE_TABLE_NAME,
                table_type="EXTERNAL_TABLE",
                parameters={
                    "skip.header.line.count": "2",
                    "EXTERNAL": "TRUE",
                    "classification": "csv",
                },
                storage_descriptor=glue.CfnTable.StorageDescriptorProperty(
                    columns=cloudfront_columns,
                    location=f"s3://{LOG_BUCKET_NAME}/{LOG_PREFIX}",
                    input_format="org.apache.hadoop.mapred.TextInputFormat",
                    output_format="org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
                    compressed=True,
                    serde_info=glue.CfnTable.SerdeInfoProperty(
                        serialization_library="org.apache.hadoop.hive.serde2.lazy.LazySimpleSerDe",
                        parameters={"field.delim": "\t", "serialization.format": "\t"},
                    ),
                ),
            ),
        )
        logs_table.add_dependency(self.node.find_child("LogsDatabase"))

        # -----------------------------------------------------------------
        # Athena workgroup — cost limit + result location
        # -----------------------------------------------------------------
        athena.CfnWorkGroup(
            self,
            "LogsWorkgroup",
            name=ATHENA_WORKGROUP_NAME,
            state="ENABLED",
            work_group_configuration=athena.CfnWorkGroup.WorkGroupConfigurationProperty(
                enforce_work_group_configuration=True,
                publish_cloud_watch_metrics_enabled=False,
                bytes_scanned_cutoff_per_query=1_000_000_000,  # 1 GB max per query
                result_configuration=athena.CfnWorkGroup.ResultConfigurationProperty(
                    output_location=f"s3://{LOG_BUCKET_NAME}/{ATHENA_RESULTS_PREFIX}",
                    encryption_configuration=athena.CfnWorkGroup.EncryptionConfigurationProperty(
                        encryption_option="SSE_S3"
                    ),
                ),
            ),
        )

        # -----------------------------------------------------------------
        # Download-stats Lambda
        # -----------------------------------------------------------------
        lambdas_dir = os.path.join(os.path.dirname(__file__), "..", "..", "lambdas")
        download_stats_fn = _lambda.Function(
            self,
            "DownloadStatsFunction",
            function_name="prl-download-stats",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="handler.lambda_handler",
            code=_lambda.Code.from_asset(os.path.join(lambdas_dir, "download-stats")),
            memory_size=512,
            timeout=Duration.minutes(5),
            environment={
                "ATHENA_WORKGROUP": ATHENA_WORKGROUP_NAME,
                "ATHENA_DATABASE": GLUE_DB_NAME,
                "ATHENA_TABLE": GLUE_TABLE_NAME,
                "OUTPUT_BUCKET": OUTPUT_BUCKET,
                "OUTPUT_KEY": OUTPUT_KEY,
                "LOG_BUCKET": LOG_BUCKET_NAME,
                "ATHENA_RESULTS_LOCATION": f"s3://{LOG_BUCKET_NAME}/{ATHENA_RESULTS_PREFIX}",
            },
        )

        # Athena + Glue read access
        download_stats_fn.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "athena:StartQueryExecution",
                    "athena:GetQueryExecution",
                    "athena:GetQueryResults",
                    "athena:GetWorkGroup",
                    "athena:StopQueryExecution",
                ],
                resources=[
                    f"arn:aws:athena:{self.region}:{self.account}:workgroup/{ATHENA_WORKGROUP_NAME}",
                ],
            )
        )
        download_stats_fn.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "glue:GetDatabase",
                    "glue:GetTable",
                    "glue:GetPartitions",
                ],
                resources=[
                    f"arn:aws:glue:{self.region}:{self.account}:catalog",
                    f"arn:aws:glue:{self.region}:{self.account}:database/{GLUE_DB_NAME}",
                    f"arn:aws:glue:{self.region}:{self.account}:table/{GLUE_DB_NAME}/{GLUE_TABLE_NAME}",
                ],
            )
        )
        # Log bucket read + Athena results write
        log_bucket.grant_read(download_stats_fn)
        log_bucket.grant_write(
            download_stats_fn, objects_key_pattern=f"{ATHENA_RESULTS_PREFIX}*"
        )
        # Output JSON write to content bucket
        download_stats_fn.add_to_role_policy(
            iam.PolicyStatement(
                actions=["s3:PutObject"],
                resources=[f"arn:aws:s3:::{OUTPUT_BUCKET}/admin/*"],
            )
        )

        # -----------------------------------------------------------------
        # Weekly schedule
        # -----------------------------------------------------------------
        events.Rule(
            self,
            "DownloadStatsSchedule",
            rule_name="prl-download-stats-weekly",
            description="Weekly aggregation of CloudFront download logs",
            schedule=events.Schedule.cron(
                minute="0", hour="3", week_day="SUN", month="*", year="*"
            ),
            targets=[targets.LambdaFunction(download_stats_fn)],
        )

        # -----------------------------------------------------------------
        # Outputs
        # -----------------------------------------------------------------
        CfnOutput(self, "LogBucketName", value=log_bucket.bucket_name)
        CfnOutput(self, "AthenaWorkgroupName", value=ATHENA_WORKGROUP_NAME)
        CfnOutput(
            self, "DownloadStatsFunctionName", value=download_stats_fn.function_name
        )
