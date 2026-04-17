from aws_cdk import (
    Stack,
    Duration,
    aws_ec2 as ec2,
    aws_ecr_assets as ecr_assets,
    aws_lambda as _lambda,
    aws_apigatewayv2 as apigwv2,
    aws_apigatewayv2_integrations as integrations,
    aws_iam as iam,
    CfnOutput,
)
from constructs import Construct
import os

# Infrastructure identifiers — read from environment (set in .env or CI)
S3_BUCKET = os.environ["PRL_S3_BUCKET"]
SURVEY_S3_BUCKET = os.environ["PRL_SURVEY_S3_BUCKET"]
CLOUDFRONT_DISTRIBUTION_ID = os.environ["PRL_CLOUDFRONT_DIST_ID"]


class LambdasStack(Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        vpc: ec2.IVpc,
        security_group: ec2.ISecurityGroup,
        **kwargs,
    ):
        super().__init__(scope, construct_id, **kwargs)

        lambdas_dir = os.path.join(os.path.dirname(__file__), "..", "..", "lambdas")
        project_root = os.path.join(os.path.dirname(__file__), "..", "..")

        # =====================================================================
        # Search API Lambda (Flask/Zappa — zip deployment)
        # =====================================================================
        self.search_function = _lambda.Function(
            self,
            "SearchApiFunction",
            function_name="prl-search-api",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="handler.lambda_handler",
            code=_lambda.Code.from_asset(os.path.join(lambdas_dir, "search")),
            memory_size=512,
            timeout=Duration.seconds(300),
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS
            ),
            security_groups=[security_group],
            environment={
                "AWS_REGION_NAME": "us-east-1",
            },
        )

        # Grant secrets + S3 access for search API
        self.search_function.add_to_role_policy(
            iam.PolicyStatement(
                actions=["secretsmanager:GetSecretValue"],
                resources=[
                    "arn:aws:secretsmanager:*:*:secret:prl/database*",
                ],
            )
        )

        # Search API Gateway (REST API — existing endpoint URL must not change)
        self.search_api = apigwv2.HttpApi(
            self,
            "SearchHttpApi",
            api_name="prl-search-api",
            cors_preflight=apigwv2.CorsPreflightOptions(
                allow_origins=["*"],
                allow_methods=[apigwv2.CorsHttpMethod.ANY],
                allow_headers=["*"],
            ),
        )

        search_integration = integrations.HttpLambdaIntegration(
            "SearchApiIntegration",
            handler=self.search_function,
        )

        self.search_api.add_routes(
            path="/{proxy+}",
            methods=[apigwv2.HttpMethod.ANY],
            integration=search_integration,
        )
        self.search_api.add_routes(
            path="/",
            methods=[apigwv2.HttpMethod.GET],
            integration=search_integration,
        )

        CfnOutput(self, "SearchApiUrl", value=self.search_api.url or "")

        # =====================================================================
        # Admin API Lambda (consolidated: admin + survey-upload)
        # =====================================================================
        self.admin_function = _lambda.Function(
            self,
            "AdminApiFunction",
            function_name="prl-admin-api",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="handler.handler",
            code=_lambda.Code.from_asset(os.path.join(lambdas_dir, "admin")),
            memory_size=256,
            timeout=Duration.seconds(30),
            environment={
                "S3_BUCKET": S3_BUCKET,
                "SURVEY_S3_BUCKET": SURVEY_S3_BUCKET,
                "CLOUDFRONT_URL": "https://americaspoliticalpulse.com",
                "SURVEY_API_SECRET_NAME": "americas-pulse/survey-upload-api",
                "ADMIN_PASSWORD": "{{resolve:secretsmanager:prl/api-keys:SecretString:ADMIN_PASSWORD}}",
                "API_KEY": "{{resolve:secretsmanager:prl/api-keys:SecretString:SURVEY_API_KEY}}",
                "PROCESSOR_LAMBDA_NAME": "survey-processor",
            },
        )

        # Grant S3, Secrets, Lambda invoke permissions
        self.admin_function.add_to_role_policy(
            iam.PolicyStatement(
                actions=["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
                resources=[
                    f"arn:aws:s3:::{S3_BUCKET}/*",
                    f"arn:aws:s3:::{S3_BUCKET}",
                    f"arn:aws:s3:::{SURVEY_S3_BUCKET}/*",
                    f"arn:aws:s3:::{SURVEY_S3_BUCKET}",
                ],
            )
        )
        self.admin_function.add_to_role_policy(
            iam.PolicyStatement(
                actions=["secretsmanager:GetSecretValue"],
                resources=[
                    "arn:aws:secretsmanager:*:*:secret:americas-pulse/*",
                ],
            )
        )
        self.admin_function.add_to_role_policy(
            iam.PolicyStatement(
                actions=["lambda:InvokeFunction"],
                resources=["*"],  # Will be scoped to survey-processor ARN
            )
        )
        self.admin_function.add_to_role_policy(
            iam.PolicyStatement(
                actions=["cloudfront:CreateInvalidation"],
                resources=[
                    f"arn:aws:cloudfront::{Stack.of(self).account}:distribution/{CLOUDFRONT_DISTRIBUTION_ID}"
                ],
            )
        )

        # Admin API Gateway
        self.admin_api = apigwv2.HttpApi(
            self,
            "AdminHttpApi",
            api_name="prl-admin-api",
            cors_preflight=apigwv2.CorsPreflightOptions(
                allow_origins=["*"],
                allow_methods=[apigwv2.CorsHttpMethod.ANY],
                allow_headers=["*"],
            ),
        )

        admin_integration = integrations.HttpLambdaIntegration(
            "AdminApiIntegration",
            handler=self.admin_function,
        )

        self.admin_api.add_routes(
            path="/{proxy+}",
            methods=[apigwv2.HttpMethod.ANY],
            integration=admin_integration,
        )

        CfnOutput(self, "AdminApiUrl", value=self.admin_api.url or "")

        # =====================================================================
        # Survey Processor Lambda (Docker — heavy processing)
        # =====================================================================
        survey_processor_image = _lambda.DockerImageCode.from_image_asset(
            directory=project_root,
            file="docker/Dockerfile.survey-processor",
            platform=ecr_assets.Platform.LINUX_AMD64,
        )

        self.survey_processor_function = _lambda.DockerImageFunction(
            self,
            "SurveyProcessorFunction",
            function_name="survey-processor",
            code=survey_processor_image,
            memory_size=4096,
            timeout=Duration.minutes(15),
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS
            ),
            security_groups=[security_group],
            environment={
                "S3_BUCKET": SURVEY_S3_BUCKET,
                "AWS_REGION_NAME": "us-east-1",
            },
        )

        # Grant DB, S3, and DynamoDB access
        self.survey_processor_function.add_to_role_policy(
            iam.PolicyStatement(
                actions=["secretsmanager:GetSecretValue"],
                resources=[
                    "arn:aws:secretsmanager:*:*:secret:prl/database*",
                ],
            )
        )
        self.survey_processor_function.add_to_role_policy(
            iam.PolicyStatement(
                actions=["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
                resources=[
                    f"arn:aws:s3:::{SURVEY_S3_BUCKET}/*",
                    f"arn:aws:s3:::{SURVEY_S3_BUCKET}",
                    f"arn:aws:s3:::{S3_BUCKET}/*",
                    f"arn:aws:s3:::{S3_BUCKET}",
                ],
            )
        )

        CfnOutput(
            self,
            "SurveyProcessorArn",
            value=self.survey_processor_function.function_arn,
        )
