from aws_cdk import (
    Stack,
    RemovalPolicy,
    aws_ec2 as ec2,
    aws_ecs as ecs,
    aws_ecr_assets as ecr_assets,
    aws_iam as iam,
    aws_logs as logs,
    aws_events as events,
    aws_events_targets as targets,
    CfnOutput,
)
from constructs import Construct
import os

# Infrastructure identifiers — read from environment (set in .env or CI)
S3_BUCKET = os.environ["PRL_S3_BUCKET"]
S3_INTERNAL_BUCKET = os.environ["PRL_S3_INTERNAL_BUCKET"]
S3_TWITTER_IMAGES_BUCKET = os.environ["PRL_S3_TWITTER_IMAGES_BUCKET"]


# Job definitions: (name, entrypoint_command, schedule_expression, cpu, memory, timeout_minutes[, image_type])
# image_type: "light" (default) or "heavy" (Playwright + Chromium)
BATCH_JOBS = [
    (
        "floor-ingest",
        ["python", "-m", "elite.entrypoints.floor_ingest"],
        "cron(20 5 * * ? *)",
        256,
        512,
        30,
    ),
    (
        "twitter-ingest",
        ["python", "-m", "elite.entrypoints.twitter_ingest"],
        "cron(40 5 * * ? *)",
        256,
        1024,
        120,
    ),
    (
        "twitter-media-ingest",
        ["python", "-m", "elite.entrypoints.twitter_media_ingest"],
        "cron(45 6 * * ? *)",
        256,
        1024,
        60,
    ),
    (
        "twitter-media-annotate",
        ["python", "-m", "elite.entrypoints.twitter_media_annotate"],
        "cron(55 7 * * ? *)",
        256,
        1024,
        120,
    ),
    # ("ads-google-ingest", ["python", "-m", "elite.entrypoints.ads_google_ingest"], "cron(50 5 * * ? *)", 256, 512, 30),  # code not yet migrated
    (
        "rhetoric-classify",
        ["python", "-m", "elite.entrypoints.rhetoric_classify"],
        "cron(0 4 * * ? *)",
        1024,
        4096,
        240,
    ),
    (
        "rhetoric-profile",
        ["python", "-m", "elite.entrypoints.rhetoric_profile"],
        "cron(0 6 ? * SUN *)",
        512,
        1024,
        60,
    ),
    (
        "rhetoric-public-s3",
        ["python", "-m", "elite.entrypoints.rhetoric_public_s3"],
        "cron(0 10 * * ? *)",
        2048,
        16384,
        60,
    ),
    (
        "state-rhetoric-public-s3",
        ["python", "-m", "elite.entrypoints.state_rhetoric_public_s3"],
        "cron(30 10 * * ? *)",
        1024,
        8192,
        60,
    ),
    (
        "ideology-update",
        ["python", "-m", "elite.entrypoints.ideology_update"],
        "cron(0 6 ? * SUN *)",
        512,
        1024,
        30,
    ),
    (
        "efficacy-update",
        ["python", "-m", "elite.entrypoints.efficacy_update"],
        "cron(0 6 ? * SUN *)",
        512,
        1024,
        30,
    ),
    (
        "attendance-update",
        ["python", "-m", "elite.entrypoints.attendance_update"],
        "cron(0 6 ? * SUN *)",
        256,
        512,
        30,
    ),
    (
        "money-update",
        ["python", "-m", "elite.entrypoints.money_update"],
        "cron(0 6 1 1,3,6,9 ? *)",
        2048,
        8192,
        120,
    ),
    (
        "federal-update",
        ["python", "-m", "elite.entrypoints.federal_update"],
        "cron(0 6 ? * SUN *)",
        256,
        512,
        30,
    ),
    (
        "twitter-ids-update",
        ["python", "-m", "elite.entrypoints.twitter_ids_update"],
        "cron(0 8 ? * SUN *)",
        256,
        512,
        60,
    ),
    (
        "state-update",
        ["python", "-m", "elite.entrypoints.state_update"],
        "cron(0 7 ? * SAT *)",
        512,
        1024,
        90,
    ),
    # ("pulse-site-update", ["python", "-m", "elite.entrypoints.pulse_site_update"], "cron(20 7 * * ? *)", 256, 512, 30),  # code not yet migrated
    (
        "pulse-citizens-update",
        ["python", "-m", "elite.entrypoints.pulse_citizens_update"],
        "cron(20 7 * * ? *)",
        512,
        1024,
        60,
    ),
    (
        "pulse-elites-update",
        ["python", "-m", "elite.entrypoints.pulse_elites_update"],
        "cron(40 7 * * ? *)",
        512,
        2048,
        60,
    ),
    # Challenger pipeline
    (
        "challenger-sync",
        ["python", "-m", "elite.entrypoints.challenger_sync"],
        "cron(0 3 ? * SUN *)",
        256,
        512,
        30,
    ),
    (
        "challenger-money-update",
        ["python", "-m", "elite.entrypoints.challenger_money_update"],
        "cron(0 4 ? * MON *)",
        512,
        1024,
        30,
    ),
    (
        "challenger-twitter-ingest",
        ["python", "-m", "elite.entrypoints.challenger_twitter_ingest"],
        "cron(0 10 * * ? *)",
        256,
        1024,
        120,
    ),
    (
        "challenger-rhetoric-classify",
        ["python", "-m", "elite.entrypoints.challenger_rhetoric_classify"],
        "cron(0 12 * * ? *)",
        1024,
        4096,
        240,
    ),
    (
        "pulse-primary-update",
        ["python", "-m", "elite.entrypoints.pulse_primary_update"],
        "cron(0 14 * * ? *)",
        512,
        2048,
        60,
    ),
    # Statements
    (
        "statements-press-urls",
        ["python", "-m", "elite.entrypoints.statements_press_urls"],
        "cron(0 1 ? * SUN *)",  # Weekly Sunday 1 AM UTC
        256,
        512,
        30,
    ),
    (
        "statements-ingest",
        ["python", "-m", "elite.entrypoints.statements_ingest"],
        "cron(0 3 * * ? *)",  # Daily 3 AM UTC
        1024,
        4096,
        240,
        "heavy",
    ),
    # Campaign site crawlers (use heavy image with Playwright + Chromium)
    (
        "campaign-sites-crawl",
        ["python", "-m", "elite.entrypoints.campaign_sites_crawl"],
        "cron(0 2 ? * SUN *)",  # Weekly Sunday 2 AM UTC
        2048,
        8192,
        360,
        "heavy",
    ),
    (
        "campaign-sites-crawl-state",
        ["python", "-m", "elite.entrypoints.campaign_sites_crawl_state"],
        "cron(0 0 1 1,4,7,10 ? *)",  # Quarterly: 1st of Jan, Apr, Jul, Oct
        2048,
        8192,
        600,
        "heavy",
    ),
]

# On-demand jobs: (name, command, cpu, memory, timeout_minutes) — no schedule
ON_DEMAND_JOBS = [
    (
        "toplines-generate",
        ["python", "-m", "elite.entrypoints.toplines_generate"],
        1024,
        4096,
        60,
    ),
    (
        "regenerate-data",
        ["python", "-m", "elite.entrypoints.regenerate_data"],
        512,
        2048,
        30,
    ),
]


class BatchStack(Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        vpc: ec2.IVpc,
        security_group: ec2.ISecurityGroup,
        **kwargs,
    ):
        super().__init__(scope, construct_id, **kwargs)

        # ECS Cluster
        self.cluster = ecs.Cluster(
            self,
            "PrlBatchCluster",
            cluster_name="prl",
            vpc=vpc,
            container_insights_v2=ecs.ContainerInsights.ENABLED,
        )

        # Log group
        self.log_group = logs.LogGroup(
            self,
            "PrlBatchLogs",
            log_group_name="/prl/batch",
            removal_policy=RemovalPolicy.RETAIN,
            retention=logs.RetentionDays.THREE_MONTHS,
        )

        # Shared task execution role
        self.execution_role = iam.Role(
            self,
            "PrlBatchExecutionRole",
            assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "service-role/AmazonECSTaskExecutionRolePolicy"
                ),
            ],
        )

        # Shared task role (permissions the container code uses)
        self.task_role = iam.Role(
            self,
            "PrlBatchTaskRole",
            assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
        )

        # Grant secrets access
        self.task_role.add_to_policy(
            iam.PolicyStatement(
                actions=["secretsmanager:GetSecretValue"],
                resources=[
                    f"arn:aws:secretsmanager:{Stack.of(self).region}:{Stack.of(self).account}:secret:prl/*",
                ],
            )
        )

        # Grant S3 access (for rhetoric public push, pulse site)
        self.task_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "s3:GetObject",
                    "s3:PutObject",
                    "s3:ListBucket",
                    "s3:DeleteObject",
                ],
                resources=[
                    f"arn:aws:s3:::{S3_BUCKET}/*",
                    f"arn:aws:s3:::{S3_BUCKET}",
                    f"arn:aws:s3:::{S3_INTERNAL_BUCKET}/*",
                    f"arn:aws:s3:::{S3_INTERNAL_BUCKET}",
                    f"arn:aws:s3:::{S3_TWITTER_IMAGES_BUCKET}/*",
                    f"arn:aws:s3:::{S3_TWITTER_IMAGES_BUCKET}",
                ],
            )
        )

        # Docker images for batch jobs
        batch_dir = os.path.join(os.path.dirname(__file__), "..", "..")
        batch_image_light = ecr_assets.DockerImageAsset(
            self,
            "BatchImage",
            directory=batch_dir,
            file="docker/Dockerfile.batch-light",
            platform=ecr_assets.Platform.LINUX_AMD64,
        )
        batch_image_heavy = ecr_assets.DockerImageAsset(
            self,
            "BatchImageHeavy",
            directory=batch_dir,
            file="docker/Dockerfile.batch-heavy",
            platform=ecr_assets.Platform.LINUX_AMD64,
        )
        batch_images = {
            "light": batch_image_light,
            "heavy": batch_image_heavy,
        }

        # Create task definitions and EventBridge rules for each job
        for job_entry in BATCH_JOBS:
            job_name, command, schedule, cpu, memory, timeout_min = job_entry[:6]
            image_type = job_entry[6] if len(job_entry) > 6 else "light"
            selected_image = batch_images[image_type]
            task_def = ecs.FargateTaskDefinition(
                self,
                f"TaskDef-{job_name}",
                family=f"prl-{job_name}",
                cpu=cpu,
                memory_limit_mib=memory,
                execution_role=self.execution_role,
                task_role=self.task_role,
            )

            task_def.add_container(
                f"Container-{job_name}",
                image=ecs.ContainerImage.from_docker_image_asset(selected_image),
                command=command,
                logging=ecs.LogDrivers.aws_logs(
                    stream_prefix=job_name,
                    log_group=self.log_group,
                ),
                environment={
                    "JOB_NAME": job_name,
                    "AWS_REGION_NAME": Stack.of(self).region,
                },
            )

            # EventBridge scheduled rule
            rule = events.Rule(
                self,
                f"Schedule-{job_name}",
                rule_name=f"prl-{job_name}",
                schedule=events.Schedule.expression(schedule),
                enabled=True,
            )

            rule.add_target(
                targets.EcsTask(
                    cluster=self.cluster,
                    task_definition=task_def,
                    subnet_selection=ec2.SubnetSelection(
                        subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    ),
                    security_groups=[security_group],
                )
            )

        # On-demand task definitions (no EventBridge schedule)
        for job_name, command, cpu, memory, timeout_min in ON_DEMAND_JOBS:
            task_def = ecs.FargateTaskDefinition(
                self,
                f"TaskDef-{job_name}",
                family=f"prl-{job_name}",
                cpu=cpu,
                memory_limit_mib=memory,
                execution_role=self.execution_role,
                task_role=self.task_role,
            )

            task_def.add_container(
                f"Container-{job_name}",
                image=ecs.ContainerImage.from_docker_image_asset(batch_image_light),
                command=command,
                logging=ecs.LogDrivers.aws_logs(
                    stream_prefix=job_name,
                    log_group=self.log_group,
                ),
                environment={
                    "JOB_NAME": job_name,
                    "AWS_REGION_NAME": Stack.of(self).region,
                },
            )

        CfnOutput(self, "ClusterName", value=self.cluster.cluster_name)
