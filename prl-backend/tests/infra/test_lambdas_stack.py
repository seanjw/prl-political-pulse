"""Tests for CDK LambdasStack infrastructure definition.

Tests that the stack synthesizes correctly and produces the expected resources.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

# CDK imports
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


@pytest.fixture
def template():
    """Synthesize the LambdasStack and return a Template for assertions."""
    from infra.stacks.lambdas_stack import LambdasStack
    from infra.stacks.network_stack import NetworkStack

    app = cdk.App()

    # Create a minimal network stack to provide VPC and security group
    network = NetworkStack(
        app,
        "TestNetwork",
        env=cdk.Environment(account="123456789012", region="us-east-1"),
    )

    stack = LambdasStack(
        app,
        "TestLambdas",
        vpc=network.vpc,
        security_group=network.lambda_sg,
        env=cdk.Environment(account="123456789012", region="us-east-1"),
    )

    return Template.from_stack(stack)


class TestLambdaFunctions:
    """Test that Lambda functions are correctly defined."""

    def test_search_function_exists(self, template):
        template.has_resource_properties(
            "AWS::Lambda::Function",
            {
                "FunctionName": "prl-search-api",
                "Runtime": "python3.11",
                "MemorySize": 512,
                "Timeout": 300,
            },
        )

    def test_admin_function_exists(self, template):
        template.has_resource_properties(
            "AWS::Lambda::Function",
            {
                "FunctionName": "prl-admin-api",
                "Runtime": "python3.11",
                "MemorySize": 256,
                "Timeout": 30,
            },
        )

    def test_survey_processor_exists(self, template):
        """Survey processor uses Docker image, so it's defined differently."""
        template.has_resource_properties(
            "AWS::Lambda::Function",
            {
                "FunctionName": "survey-processor",
                "MemorySize": 4096,
                "Timeout": 900,  # 15 minutes
            },
        )

    def test_search_handler_path(self, template):
        template.has_resource_properties(
            "AWS::Lambda::Function",
            {
                "FunctionName": "prl-search-api",
                "Handler": "handler.lambda_handler",
            },
        )

    def test_admin_handler_path(self, template):
        template.has_resource_properties(
            "AWS::Lambda::Function",
            {
                "FunctionName": "prl-admin-api",
                "Handler": "handler.handler",
            },
        )

    def test_three_lambda_functions_total(self, template):
        """Exactly 3 Lambda functions should be created."""
        resources = template.find_resources("AWS::Lambda::Function")
        assert len(resources) == 3


class TestApiGateways:
    """Test API Gateway configuration."""

    def test_search_api_gateway_exists(self, template):
        template.has_resource_properties(
            "AWS::ApiGatewayV2::Api",
            {
                "Name": "prl-search-api",
                "ProtocolType": "HTTP",
            },
        )

    def test_admin_api_gateway_exists(self, template):
        template.has_resource_properties(
            "AWS::ApiGatewayV2::Api",
            {
                "Name": "prl-admin-api",
                "ProtocolType": "HTTP",
            },
        )

    def test_two_api_gateways(self, template):
        """Search and Admin each get an API Gateway. Survey processor does not."""
        apis = template.find_resources("AWS::ApiGatewayV2::Api")
        assert len(apis) == 2

    def test_cors_configured(self, template):
        """Both APIs should have CORS configured."""
        template.has_resource_properties(
            "AWS::ApiGatewayV2::Api",
            {
                "CorsConfiguration": Match.object_like(
                    {
                        "AllowOrigins": ["*"],
                    }
                ),
            },
        )


class TestIamPolicies:
    """Test IAM permissions are correctly configured."""

    def test_search_has_secrets_access(self, template):
        """Search function should have Secrets Manager access for prl/database."""
        template.has_resource_properties(
            "AWS::IAM::Policy",
            {
                "PolicyDocument": Match.object_like(
                    {
                        "Statement": Match.array_with(
                            [
                                Match.object_like(
                                    {
                                        "Action": "secretsmanager:GetSecretValue",
                                        "Resource": Match.string_like_regexp(
                                            "prl/database"
                                        ),
                                    }
                                ),
                            ]
                        ),
                    }
                ),
            },
        )

    def test_admin_has_s3_access(self, template):
        """Admin function should have S3 access."""
        template.has_resource_properties(
            "AWS::IAM::Policy",
            {
                "PolicyDocument": Match.object_like(
                    {
                        "Statement": Match.array_with(
                            [
                                Match.object_like(
                                    {
                                        "Action": Match.array_with(
                                            [
                                                "s3:GetObject",
                                                "s3:PutObject",
                                                "s3:ListBucket",
                                            ]
                                        ),
                                    }
                                ),
                            ]
                        ),
                    }
                ),
            },
        )

    def test_admin_has_lambda_invoke(self, template):
        """Admin function should be able to invoke other Lambdas (for survey-processor)."""
        template.has_resource_properties(
            "AWS::IAM::Policy",
            {
                "PolicyDocument": Match.object_like(
                    {
                        "Statement": Match.array_with(
                            [
                                Match.object_like(
                                    {
                                        "Action": "lambda:InvokeFunction",
                                    }
                                ),
                            ]
                        ),
                    }
                ),
            },
        )


class TestEnvironmentVariables:
    """Test that Lambda environment variables are correctly set."""

    def test_admin_env_vars(self, template):
        template.has_resource_properties(
            "AWS::Lambda::Function",
            {
                "FunctionName": "prl-admin-api",
                "Environment": Match.object_like(
                    {
                        "Variables": Match.object_like(
                            {
                                "S3_BUCKET": "test-bucket",
                                "SURVEY_S3_BUCKET": "test-survey-bucket",
                                "CLOUDFRONT_URL": "https://americaspoliticalpulse.com",
                            }
                        ),
                    }
                ),
            },
        )

    def test_search_env_vars(self, template):
        template.has_resource_properties(
            "AWS::Lambda::Function",
            {
                "FunctionName": "prl-search-api",
                "Environment": Match.object_like(
                    {
                        "Variables": Match.object_like(
                            {
                                "AWS_REGION_NAME": "us-east-1",
                            }
                        ),
                    }
                ),
            },
        )

    def test_survey_processor_env_vars(self, template):
        template.has_resource_properties(
            "AWS::Lambda::Function",
            {
                "FunctionName": "survey-processor",
                "Environment": Match.object_like(
                    {
                        "Variables": Match.object_like(
                            {
                                "S3_BUCKET": "test-survey-bucket",
                                "AWS_REGION_NAME": "us-east-1",
                            }
                        ),
                    }
                ),
            },
        )


class TestOutputs:
    """Test that stack outputs are defined."""

    def test_search_api_url_output(self, template):
        template.has_output("SearchApiUrl", {})

    def test_admin_api_url_output(self, template):
        template.has_output("AdminApiUrl", {})

    def test_survey_processor_arn_output(self, template):
        template.has_output("SurveyProcessorArn", {})


class TestVpcConfiguration:
    """Test VPC configuration for Lambda functions."""

    def test_search_in_vpc(self, template):
        """Search Lambda should be in VPC."""
        template.has_resource_properties(
            "AWS::Lambda::Function",
            {
                "FunctionName": "prl-search-api",
                "VpcConfig": Match.object_like(
                    {
                        "SubnetIds": Match.any_value(),
                        "SecurityGroupIds": Match.any_value(),
                    }
                ),
            },
        )

    def test_survey_processor_in_vpc(self, template):
        """Survey processor should be in VPC for DB access."""
        template.has_resource_properties(
            "AWS::Lambda::Function",
            {
                "FunctionName": "survey-processor",
                "VpcConfig": Match.object_like(
                    {
                        "SubnetIds": Match.any_value(),
                        "SecurityGroupIds": Match.any_value(),
                    }
                ),
            },
        )
