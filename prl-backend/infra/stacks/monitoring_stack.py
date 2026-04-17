from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    BundlingOptions,
    aws_ec2 as ec2,
    aws_lambda as _lambda,
    aws_apigatewayv2 as apigwv2,
    aws_apigatewayv2_integrations as integrations,
    aws_iam as iam,
    aws_dynamodb as dynamodb,
    aws_sns as sns,
    aws_events as events,
    aws_events_targets as targets,
    CfnOutput,
)
from constructs import Construct
import json
import os

# Infrastructure identifiers — read from environment (set in .env or CI)
S3_BUCKET = os.environ["PRL_S3_BUCKET"]


class MonitoringStack(Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        vpc: ec2.IVpc,
        ecs_security_group: ec2.ISecurityGroup | None = None,
        **kwargs,
    ):
        super().__init__(scope, construct_id, **kwargs)

        # -----------------------------------------------------------------
        # DynamoDB table for alert configuration
        # -----------------------------------------------------------------
        alert_table = dynamodb.Table(
            self,
            "PrlAlertConfig",
            table_name="prl-alert-config",
            partition_key=dynamodb.Attribute(
                name="configId", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.RETAIN,
        )

        # -----------------------------------------------------------------
        # SNS topic for batch alerts
        # -----------------------------------------------------------------
        alert_topic = sns.Topic(
            self,
            "PrlBatchAlertsTopic",
            topic_name="prl-batch-alerts",
            display_name="PRL Batch Job Alerts",
        )

        # -----------------------------------------------------------------
        # Monitoring Lambda
        # -----------------------------------------------------------------
        monitoring_code_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "monitoring"
        )
        monitoring_function = _lambda.Function(
            self,
            "PrlMonitoringFunction",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="handler.lambda_handler",
            code=_lambda.Code.from_asset(
                monitoring_code_path,
                bundling=BundlingOptions(
                    image=_lambda.Runtime.PYTHON_3_11.bundling_image,
                    platform="linux/amd64",
                    command=[
                        "bash",
                        "-c",
                        "pip install -r requirements.txt -t /asset-output && cp -au . /asset-output",
                    ],
                ),
            ),
            memory_size=256,
            timeout=Duration.seconds(60),
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
            ),
            environment={
                "ECS_CLUSTER_NAME": "prl",
                "LOG_GROUP_NAME": "/prl/batch",
                "ADMIN_PASSWORD": "{{resolve:secretsmanager:prl/api-keys:SecretString:ADMIN_PASSWORD}}",
                "ALERT_TABLE_NAME": alert_table.table_name,
                "SNS_TOPIC_ARN": alert_topic.topic_arn,
                "DB_SECRET_NAME": "prl/database",
                "PULSE_API_FUNCTION_NAME": os.environ.get("PULSE_API_FUNCTION_NAME", ""),
                "ECS_SUBNETS": json.dumps(
                    [subnet.subnet_id for subnet in vpc.private_subnets]
                ),
                "ECS_SECURITY_GROUP": ecs_security_group.security_group_id
                if ecs_security_group
                else "",
            },
        )

        # Grant permissions
        monitoring_function.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "ecs:ListTasks",
                    "ecs:DescribeTasks",
                    "ecs:ListTaskDefinitions",
                    "ecs:RunTask",
                    "iam:PassRole",
                    "logs:FilterLogEvents",
                    "logs:GetLogEvents",
                    "logs:DescribeLogStreams",
                    "cloudwatch:GetMetricStatistics",
                    "lambda:GetFunction",
                    "secretsmanager:GetSecretValue",
                ],
                resources=["*"],
            )
        )

        # DynamoDB permissions
        alert_table.grant_read_write_data(monitoring_function)

        # SNS permissions
        alert_topic.grant_publish(monitoring_function)
        monitoring_function.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "sns:Subscribe",
                    "sns:Unsubscribe",
                    "sns:ListSubscriptionsByTopic",
                ],
                resources=[alert_topic.topic_arn],
            )
        )

        # Download stats: read aggregated JSON + invoke aggregator Lambda
        monitoring_function.add_to_role_policy(
            iam.PolicyStatement(
                actions=["s3:GetObject"],
                resources=[f"arn:aws:s3:::{S3_BUCKET}/admin/*"],
            )
        )
        monitoring_function.add_to_role_policy(
            iam.PolicyStatement(
                actions=["lambda:InvokeFunction"],
                resources=[
                    f"arn:aws:lambda:{self.region}:{self.account}:function:prl-download-stats",
                ],
            )
        )

        # -----------------------------------------------------------------
        # Alert Lambda (EventBridge triggered)
        # -----------------------------------------------------------------
        alert_function = _lambda.Function(
            self,
            "PrlAlertFunction",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="alert_handler.lambda_handler",
            code=_lambda.Code.from_asset(
                monitoring_code_path,
                bundling=BundlingOptions(
                    image=_lambda.Runtime.PYTHON_3_11.bundling_image,
                    platform="linux/amd64",
                    command=[
                        "bash",
                        "-c",
                        "pip install -r requirements.txt -t /asset-output && cp -au . /asset-output",
                    ],
                ),
            ),
            memory_size=128,
            timeout=Duration.seconds(30),
            environment={
                "ALERT_TABLE_NAME": alert_table.table_name,
                "SNS_TOPIC_ARN": alert_topic.topic_arn,
            },
        )

        alert_table.grant_read_data(alert_function)
        alert_topic.grant_publish(alert_function)

        # EventBridge rule: ECS task stopped in prl cluster
        ecs_stopped_rule = events.Rule(
            self,
            "PrlEcsTaskStoppedRule",
            rule_name="prl-ecs-task-stopped",
            event_pattern=events.EventPattern(
                source=["aws.ecs"],
                detail_type=["ECS Task State Change"],
                detail={
                    "lastStatus": ["STOPPED"],
                    "clusterArn": [{"wildcard": "*prl*"}],
                },
            ),
        )
        ecs_stopped_rule.add_target(targets.LambdaFunction(alert_function))

        # -----------------------------------------------------------------
        # HTTP API with CORS
        # -----------------------------------------------------------------
        http_api = apigwv2.HttpApi(
            self,
            "PrlMonitoringApi",
            api_name="prl-monitoring-api",
            cors_preflight=apigwv2.CorsPreflightOptions(
                allow_origins=["*"],
                allow_methods=[
                    apigwv2.CorsHttpMethod.GET,
                    apigwv2.CorsHttpMethod.POST,
                    apigwv2.CorsHttpMethod.OPTIONS,
                ],
                allow_headers=["x-admin-password", "content-type"],
                max_age=Duration.hours(1),
            ),
        )

        integration = integrations.HttpLambdaIntegration(
            "MonitoringIntegration",
            handler=monitoring_function,
        )

        # Health (no auth, GET only)
        http_api.add_routes(
            path="/health",
            methods=[apigwv2.HttpMethod.GET],
            integration=integration,
        )

        # GET routes
        http_api.add_routes(
            path="/status",
            methods=[apigwv2.HttpMethod.GET],
            integration=integration,
        )
        http_api.add_routes(
            path="/status/{proxy+}",
            methods=[apigwv2.HttpMethod.GET],
            integration=integration,
        )

        # Results routes (job_results from RDS)
        http_api.add_routes(
            path="/results/summary",
            methods=[apigwv2.HttpMethod.GET],
            integration=integration,
        )
        http_api.add_routes(
            path="/results/{proxy+}",
            methods=[apigwv2.HttpMethod.GET],
            integration=integration,
        )

        # POST routes for alerts
        http_api.add_routes(
            path="/status/alerts/config",
            methods=[apigwv2.HttpMethod.POST],
            integration=integration,
        )
        http_api.add_routes(
            path="/status/alerts/test",
            methods=[apigwv2.HttpMethod.POST],
            integration=integration,
        )

        # POST route for job trigger
        http_api.add_routes(
            path="/jobs/{proxy+}",
            methods=[apigwv2.HttpMethod.POST],
            integration=integration,
        )

        # Officials press URL review routes
        http_api.add_routes(
            path="/officials/press-urls",
            methods=[apigwv2.HttpMethod.GET],
            integration=integration,
        )
        http_api.add_routes(
            path="/officials/press-urls/update",
            methods=[apigwv2.HttpMethod.POST],
            integration=integration,
        )

        # Download stats routes
        http_api.add_routes(
            path="/downloads/stats",
            methods=[apigwv2.HttpMethod.GET],
            integration=integration,
        )
        http_api.add_routes(
            path="/downloads/refresh",
            methods=[apigwv2.HttpMethod.POST],
            integration=integration,
        )

        # -----------------------------------------------------------------
        # Outputs
        # -----------------------------------------------------------------
        CfnOutput(self, "MonitoringApiUrl", value=http_api.url or "")
        CfnOutput(self, "AlertTopicArn", value=alert_topic.topic_arn)
        CfnOutput(self, "AlertTableName", value=alert_table.table_name)
