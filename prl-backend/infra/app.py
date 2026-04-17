#!/usr/bin/env python3
import aws_cdk as cdk
from stacks.network_stack import NetworkStack
from stacks.api_stack import ApiStack
from stacks.batch_stack import BatchStack
from stacks.lambdas_stack import LambdasStack
from stacks.logging_stack import LoggingStack
from stacks.monitoring_stack import MonitoringStack

app = cdk.App()

env = cdk.Environment(
    account=app.node.try_get_context("account") or None,
    region=app.node.try_get_context("region") or "us-east-1",
)

network = NetworkStack(app, "PrlNetwork", env=env)
api = ApiStack(
    app, "PrlApi", vpc=network.vpc, security_group=network.lambda_sg, env=env
)
batch = BatchStack(
    app, "PrlBatch", vpc=network.vpc, security_group=network.ecs_sg, env=env
)
lambdas = LambdasStack(
    app, "PrlLambdas", vpc=network.vpc, security_group=network.lambda_sg, env=env
)
logging_stack = LoggingStack(app, "PrlLogging", env=env)
monitoring = MonitoringStack(
    app,
    "PrlMonitoring",
    vpc=network.vpc,
    ecs_security_group=network.ecs_sg,
    env=env,
)

api.add_dependency(network)
batch.add_dependency(network)
lambdas.add_dependency(network)
monitoring.add_dependency(network)

app.synth()
