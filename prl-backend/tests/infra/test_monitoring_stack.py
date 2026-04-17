"""Tests for CDK MonitoringStack infrastructure definition."""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

try:
    import aws_cdk as cdk
    from aws_cdk.assertions import Template, Match

    HAS_CDK = True
except ImportError:
    HAS_CDK = False

pytestmark = pytest.mark.skipif(not HAS_CDK, reason="aws-cdk-lib not installed")


@pytest.fixture(autouse=True)
def _cdk_env_vars(monkeypatch):
    """Set required infrastructure env vars for CDK synthesis."""
    monkeypatch.setenv("PRL_S3_BUCKET", "test-bucket")
    monkeypatch.setenv("PRL_SURVEY_S3_BUCKET", "test-survey-bucket")
    monkeypatch.setenv("PRL_CLOUDFRONT_DIST_ID", "TESTDISTID")
    monkeypatch.setenv("PRL_S3_INTERNAL_BUCKET", "test-internal")
    monkeypatch.setenv("PRL_S3_TWITTER_IMAGES_BUCKET", "test-twitter-images")


@pytest.fixture
def template():
    """Synthesize the MonitoringStack and return a Template for assertions."""
    from infra.stacks.monitoring_stack import MonitoringStack
    from infra.stacks.network_stack import NetworkStack

    app = cdk.App()

    network = NetworkStack(
        app,
        "TestNetwork",
        env=cdk.Environment(account="123456789012", region="us-east-1"),
    )

    stack = MonitoringStack(
        app,
        "TestMonitoring",
        vpc=network.vpc,
        env=cdk.Environment(account="123456789012", region="us-east-1"),
    )

    return Template.from_stack(stack)


class TestMonitoringFunction:
    def test_monitoring_function_exists(self, template):
        template.has_resource_properties(
            "AWS::Lambda::Function",
            {
                "Handler": "handler.lambda_handler",
                "Runtime": "python3.11",
                "MemorySize": 256,
                "Timeout": 60,
            },
        )

    def test_monitoring_function_env_vars(self, template):
        template.has_resource_properties(
            "AWS::Lambda::Function",
            {
                "Handler": "handler.lambda_handler",
                "Environment": Match.object_like(
                    {
                        "Variables": Match.object_like(
                            {
                                "ECS_CLUSTER_NAME": "prl",
                                "LOG_GROUP_NAME": "/prl/batch",
                                "DB_SECRET_NAME": "prl/database",
                            }
                        ),
                    }
                ),
            },
        )


class TestAlertFunction:
    def test_alert_function_exists(self, template):
        template.has_resource_properties(
            "AWS::Lambda::Function",
            {
                "Handler": "alert_handler.lambda_handler",
                "Runtime": "python3.11",
                "MemorySize": 128,
                "Timeout": 30,
            },
        )


class TestDynamoDB:
    def test_alert_config_table_exists(self, template):
        template.has_resource_properties(
            "AWS::DynamoDB::Table",
            {
                "TableName": "prl-alert-config",
                "KeySchema": [{"AttributeName": "configId", "KeyType": "HASH"}],
                "BillingMode": "PAY_PER_REQUEST",
            },
        )


class TestSNS:
    def test_alert_topic_exists(self, template):
        template.has_resource_properties(
            "AWS::SNS::Topic",
            {
                "TopicName": "prl-batch-alerts",
                "DisplayName": "PRL Batch Job Alerts",
            },
        )


class TestEventBridge:
    def test_ecs_stopped_rule_exists(self, template):
        template.has_resource_properties(
            "AWS::Events::Rule",
            {
                "Name": "prl-ecs-task-stopped",
                "EventPattern": Match.object_like(
                    {
                        "source": ["aws.ecs"],
                        "detail-type": ["ECS Task State Change"],
                    }
                ),
            },
        )


class TestApi:
    def test_http_api_exists(self, template):
        template.has_resource_properties(
            "AWS::ApiGatewayV2::Api",
            {
                "Name": "prl-monitoring-api",
                "ProtocolType": "HTTP",
            },
        )

    def test_cors_configured(self, template):
        template.has_resource_properties(
            "AWS::ApiGatewayV2::Api",
            {
                "CorsConfiguration": Match.object_like(
                    {
                        "AllowOrigins": ["*"],
                        "AllowHeaders": ["x-admin-password", "content-type"],
                    }
                ),
            },
        )


class TestOutputs:
    def test_monitoring_api_url_output(self, template):
        template.has_output("MonitoringApiUrl", {})

    def test_alert_topic_arn_output(self, template):
        template.has_output("AlertTopicArn", {})

    def test_alert_table_name_output(self, template):
        template.has_output("AlertTableName", {})
