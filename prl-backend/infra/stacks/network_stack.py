from aws_cdk import (
    Stack,
    aws_ec2 as ec2,
    aws_secretsmanager as sm,
    CfnOutput,
)
from constructs import Construct


class NetworkStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs):
        super().__init__(scope, construct_id, **kwargs)

        # VPC with public + private subnets and NAT Gateway
        self.vpc = ec2.Vpc(
            self,
            "PrlVpc",
            max_azs=2,
            nat_gateways=1,
            subnet_configuration=[
                ec2.SubnetConfiguration(
                    name="Public",
                    subnet_type=ec2.SubnetType.PUBLIC,
                    cidr_mask=24,
                ),
                ec2.SubnetConfiguration(
                    name="Private",
                    subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidr_mask=24,
                ),
            ],
        )

        # Security Groups
        self.lambda_sg = ec2.SecurityGroup(
            self,
            "LambdaSg",
            vpc=self.vpc,
            description="Security group for Lambda functions",
            allow_all_outbound=True,
        )

        self.ecs_sg = ec2.SecurityGroup(
            self,
            "EcsSg",
            vpc=self.vpc,
            description="Security group for ECS Fargate tasks",
            allow_all_outbound=True,
        )

        # Secrets Manager secrets
        self.db_secret = sm.Secret(
            self,
            "PrlDatabaseSecret",
            secret_name="prl/database",
            description="PRL database credentials",
            generate_secret_string=sm.SecretStringGenerator(
                secret_string_template='{"DB_USER":"admin","DB_HOST":"","DB_PORT":"3306","DB_DIALECT":"mysql"}',
                generate_string_key="DB_PASSWORD",
                exclude_punctuation=True,
            ),
        )

        self.api_keys_secret = sm.Secret(
            self,
            "PrlApiKeysSecret",
            secret_name="prl/api-keys",
            description="PRL API keys (Congress, Twitter, OpenAI)",
            generate_secret_string=sm.SecretStringGenerator(
                secret_string_template='{"CONGRESS_API":"","TWITTER_API":"","OPENAI_API_KEY":"","CURRENT_CONGRESS":"119"}',
                generate_string_key="_placeholder",
            ),
        )

        self.google_creds_secret = sm.Secret(
            self,
            "PrlGoogleCredsSecret",
            secret_name="prl/google-credentials",
            description="Google Sheets service account JSON",
        )

        # NOTE: Aurora cluster is publicly accessible in an existing VPC.
        # Lambda and Fargate connect to Aurora directly via the public endpoint
        # through the NAT Gateway.
        # RDS Proxy can be added later if connection pooling is needed.

        CfnOutput(self, "VpcId", value=self.vpc.vpc_id)
