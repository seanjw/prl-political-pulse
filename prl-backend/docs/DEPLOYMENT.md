# Deployment

Instructions for deploying and maintaining the PRL Backend infrastructure.

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| AWS CLI | v2 | AWS account access and configuration |
| AWS CDK | v2 | Infrastructure as code deployment |
| Docker | 20+ | Building container images for Lambda and Fargate |
| Python | 3.11+ | CDK app and batch job runtime |
| Node.js | 18+ | CDK CLI |
| npm | 9+ | CDK and Node dependency management |

Ensure your AWS CLI is configured with credentials that have permissions to create and manage
VPCs, Lambda functions, ECS clusters, RDS Proxy, Secrets Manager, S3, API Gateway,
EventBridge, IAM roles, and CloudWatch resources.

```bash
aws configure
# Or set AWS_PROFILE if using named profiles:
export AWS_PROFILE=prl
```

## Secrets Manager Setup

Three secrets must exist in Secrets Manager before deployment. The CDK stacks create
placeholder secrets, but you must update them with real values after initial deployment.

### prl/database

Database credentials for the Aurora MySQL cluster.

```json
{
  "DB_USER": "admin",
  "DB_PASSWORD": "<password>",
  "DB_HOST": "<rds-proxy-endpoint>",
  "DB_PORT": "3306",
  "DB_DIALECT": "mysql"
}
```

Update `DB_HOST` to the RDS Proxy endpoint after the `PrlNetwork` stack deploys (the
endpoint is printed as a stack output).

### prl/api-keys

API keys for external services used by batch jobs.

```json
{
  "CONGRESS_API": "<congress.gov-api-key>",
  "TWITTER_API": "<twitter-bearer-token>",
  "OPENAI_API_KEY": "<openai-api-key>",
  "CURRENT_CONGRESS": "119"
}
```

### prl/google-credentials

Google Sheets service account credentials. This should be the full JSON key file contents
for a service account with access to the relevant Google Sheets.

## First-Time Deployment

1. **Install CDK dependencies:**

```bash
cd infra
npm install
```

2. **Bootstrap CDK** (one-time per AWS account/region):

```bash
cdk bootstrap aws://<ACCOUNT_ID>/us-east-1
```

3. **Preview the infrastructure:**

```bash
cdk synth   # Generate CloudFormation templates
cdk diff    # Review what will be created
```

4. **Deploy all stacks:**

```bash
cdk deploy --all
```

This deploys five stacks in dependency order:

| Order | Stack | What it creates |
|-------|-------|-----------------|
| 1 | `PrlNetwork` | VPC, subnets, NAT Gateway, security groups, RDS Proxy, Secrets Manager secrets |
| 2 | `PrlApi` | Pulse API Lambda (Docker), API Gateway HTTP API |
| 2 | `PrlLambdas` | Search, Admin, Survey Processor Lambdas + API Gateways |
| 2 | `PrlBatch` | ECS cluster, 19 Fargate task definitions, EventBridge rules (disabled) |
| 2 | `PrlMonitoring` | Monitoring Lambda and API |

`PrlApi`, `PrlLambdas`, `PrlBatch`, and `PrlMonitoring` all depend on `PrlNetwork` and deploy in
parallel after it completes.

5. **Update secrets with real values:**

After deployment, update the secrets in Secrets Manager with actual credentials. In
particular, update `DB_HOST` in `prl/database` with the RDS Proxy endpoint from the
`PrlNetwork` stack output:

```bash
# Get the RDS Proxy endpoint
aws cloudformation describe-stacks --stack-name PrlNetwork \
  --query "Stacks[0].Outputs[?OutputKey=='RdsProxyEndpoint'].OutputValue" \
  --output text
```

6. **Verify the API:**

```bash
# Get the API URL
aws cloudformation describe-stacks --stack-name PrlApi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text

# Test the health endpoint
curl <API_URL>/health
```

## Updating Individual Components

### Update the API

If you change code in `pulse/server/api/` or `shared/`:

```bash
cd infra
cdk deploy PrlApi
```

CDK rebuilds the Docker image and updates the Lambda function.

### Update Lambda Functions

If you change code in `lambdas/`:

```bash
cd infra
cdk deploy PrlLambdas
```

CDK rebuilds the Lambda packages (zip or Docker) and updates the function code.

The `PrlLambdas` stack manages three functions:
- **Search API** (`lambdas/search/`) — Flask/Zappa, Python 3.11 zip package
- **Admin API** (`lambdas/admin/`) — Consolidated handler, Python 3.11 zip package
- **Survey Processor** (`lambdas/survey-processor/`) — Docker image (`docker/Dockerfile.survey-processor`)

### Update Batch Jobs

If you change code in `elite/`, `shared/`, `surveys/`, or `pulse/`:

```bash
cd infra
cdk deploy PrlBatch
```

CDK rebuilds both Docker images (light and heavy) and updates all Fargate task definitions.

### Update Networking

Changes to VPC, security groups, or RDS Proxy:

```bash
cd infra
cdk deploy PrlNetwork
```

**Warning:** Networking changes can cause downtime. Always run `cdk diff PrlNetwork` first
to review the impact.

### Update All Stacks

```bash
cd infra
cdk deploy --all
```

## Enabling Batch Jobs

All EventBridge rules deploy in a **disabled** state. This is intentional -- it prevents
jobs from running before the infrastructure is fully configured and secrets are populated.

To enable a specific job:

```bash
aws events enable-rule --name prl-floor-ingest
```

To enable all jobs at once:

```bash
for rule in $(aws events list-rules --name-prefix prl- --query "Rules[].Name" --output text); do
  echo "Enabling $rule"
  aws events enable-rule --name "$rule"
done
```

To disable a job (e.g., for maintenance):

```bash
aws events disable-rule --name prl-rhetoric-classify
```

You can also manage rules from the EventBridge console under **Rules** in the default
event bus.

## Rollback Procedures

### Rolling Back the API

Lambda automatically keeps previous versions. To roll back:

1. Find the previous version in the Lambda console under **Versions**.
2. Update the alias or API Gateway integration to point to the previous version.

Or redeploy from a previous git commit:

```bash
git checkout <previous-commit>
cd infra
cdk deploy PrlApi
```

### Rolling Back Batch Jobs

Fargate task definitions are versioned. To use a previous version:

1. Go to ECS console > Task Definitions > `prl-<job-name>`.
2. Find the previous revision.
3. Update the EventBridge target to reference the previous task definition revision.

Or redeploy from a previous commit:

```bash
git checkout <previous-commit>
cd infra
cdk deploy PrlBatch
```

### Rolling Back Infrastructure

For networking or RDS Proxy changes, use CloudFormation rollback:

```bash
aws cloudformation rollback-stack --stack-name PrlNetwork
```

**Warning:** Some resources (like VPCs with active ENIs) cannot be rolled back cleanly.
Always test infrastructure changes in a staging environment first.

## Monitoring

### Status API Endpoints

The monitoring Lambda provides these endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /status` | Overall system health (running task count) |
| `GET /status/jobs` | List recent ECS task runs (running + stopped) |
| `GET /status/jobs/{name}` | Details and last 24h logs for a specific job |
| `GET /status/api` | Lambda invocation metrics (invocations, errors, duration) |

### CloudWatch Logs

- **Batch jobs:** `/prl/batch` log group, streams prefixed by job name
- **API Lambda:** Standard Lambda log group `/aws/lambda/PrlApiFunction`

View recent logs for a batch job:

```bash
aws logs filter-log-events \
  --log-group-name /prl/batch \
  --log-stream-name-prefix floor-ingest \
  --start-time $(date -d '24 hours ago' +%s000) \
  --limit 50
```

### CloudWatch Metrics

Key metrics to monitor:

- `AWS/Lambda` > `Errors` for `PrlApiFunction` -- API errors
- `AWS/Lambda` > `Duration` for `PrlApiFunction` -- API latency
- `AWS/ECS` > `CPUUtilization` and `MemoryUtilization` for `prl` cluster -- batch job resource usage
- `AWS/RDS` > `DatabaseConnections` for the proxy -- connection pool usage

## Troubleshooting

### CDK Deploy Fails

```bash
# Check the CloudFormation events for the failing stack
aws cloudformation describe-stack-events --stack-name PrlBatch \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED' || ResourceStatus=='UPDATE_FAILED']"
```

### Docker Build Fails

CDK builds Docker images locally during `cdk deploy`. If the build fails:

```bash
# Build manually to see full output
docker build -f docker/Dockerfile.batch-light -t prl-batch-light .
docker build -f docker/Dockerfile.api -t prl-api .
```

### Secrets Not Found

If batch jobs fail with Secrets Manager errors, verify:

1. The secrets exist: `aws secretsmanager list-secrets --query "SecretList[?starts_with(Name,'prl/')]"`
2. The task role has permission: check the `PrlBatchTaskRole` IAM role
3. The region is correct: tasks use `AWS_REGION_NAME` environment variable
