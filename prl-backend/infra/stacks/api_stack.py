from aws_cdk import (
    Stack,
    Duration,
    aws_ec2 as ec2,
    aws_lambda as _lambda,
    aws_apigatewayv2 as apigwv2,
    aws_apigatewayv2_integrations as integrations,
    aws_iam as iam,
    CfnOutput,
)
from constructs import Construct
import os


class ApiStack(Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        vpc: ec2.IVpc,
        security_group: ec2.ISecurityGroup,
        **kwargs,
    ):
        super().__init__(scope, construct_id, **kwargs)

        # Docker image for Lambda
        api_image = _lambda.DockerImageCode.from_image_asset(
            directory=os.path.join(os.path.dirname(__file__), "..", ".."),
            file="docker/Dockerfile.api",
        )

        # Lambda function
        self.api_function = _lambda.DockerImageFunction(
            self,
            "PrlApiFunction",
            code=api_image,
            memory_size=512,
            timeout=Duration.seconds(30),
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS
            ),
            security_groups=[security_group],
            reserved_concurrent_executions=10,
            environment={
                "AWS_REGION_NAME": "us-east-1",
                "ADMIN_PASSWORD": "{{resolve:secretsmanager:prl/api-keys:SecretString:ADMIN_PASSWORD}}",
            },
        )

        # Grant secrets access
        self.api_function.add_to_role_policy(
            iam.PolicyStatement(
                actions=["secretsmanager:GetSecretValue"],
                resources=[
                    "arn:aws:secretsmanager:*:*:secret:prl/database*",
                ],
            )
        )

        # HTTP API Gateway
        self.http_api = apigwv2.HttpApi(
            self,
            "PrlHttpApi",
            api_name="prl-pulse-api",
            cors_preflight=apigwv2.CorsPreflightOptions(
                allow_origins=["*"],
                allow_methods=[apigwv2.CorsHttpMethod.ANY],
                allow_headers=["*"],
            ),
        )

        # Lambda integration
        lambda_integration = integrations.HttpLambdaIntegration(
            "PrlApiIntegration",
            handler=self.api_function,
        )

        # Routes
        self.http_api.add_routes(
            path="/{proxy+}",
            methods=[apigwv2.HttpMethod.ANY],
            integration=lambda_integration,
        )
        self.http_api.add_routes(
            path="/",
            methods=[apigwv2.HttpMethod.GET],
            integration=lambda_integration,
        )

        CfnOutput(self, "ApiUrl", value=self.http_api.url or "")
