# Batch Jobs

Complete reference for the 19 ECS Fargate batch jobs that power the PRL data pipeline.

## Job Reference

All jobs run as Fargate tasks on the `prl` ECS cluster, triggered by EventBridge cron
schedules. Logs are written to the `/prl/batch` CloudWatch log group.

### Daily Jobs

| Job | Schedule (UTC) | Entrypoint | CPU | Memory | Timeout |
|-----|----------------|------------|-----|--------|---------|
| `rhetoric-classify` | 4:00 AM | `elite.entrypoints.rhetoric_classify` | 1024 | 4096 MB | 240 min |
| `floor-ingest` | 5:20 AM | `elite.entrypoints.floor_ingest` | 256 | 512 MB | 30 min |
| `twitter-ingest` | 5:40 AM | `elite.entrypoints.twitter_ingest` | 256 | 1024 MB | 120 min |
| `ads-google-ingest` | 5:50 AM | `elite.entrypoints.ads_google_ingest` | 256 | 512 MB | 30 min |
| `twitter-media-ingest` | 6:45 AM | `elite.entrypoints.twitter_media_ingest` | 256 | 1024 MB | 60 min |
| `pulse-site-update` | 7:20 AM | `elite.entrypoints.pulse_site_update` | 256 | 512 MB | 30 min |
| `pulse-citizens-update` | 7:20 AM | `elite.entrypoints.pulse_citizens_update` | 256 | 512 MB | 30 min |
| `pulse-elites-update` | 7:20 AM | `elite.entrypoints.pulse_elites_update` | 256 | 512 MB | 30 min |
| `twitter-media-annotate` | 7:55 AM | `elite.entrypoints.twitter_media_annotate` | 256 | 1024 MB | 120 min |
| `rhetoric-public-s3` | 10:00 AM | `elite.entrypoints.rhetoric_public_s3` | 512 | 2048 MB | 60 min |

### Weekly Jobs

| Job | Schedule (UTC) | Entrypoint | CPU | Memory | Timeout |
|-----|----------------|------------|-----|--------|---------|
| `ideology-update` | Sun 6:00 AM | `elite.entrypoints.ideology_update` | 512 | 1024 MB | 30 min |
| `efficacy-update` | Sun 6:00 AM | `elite.entrypoints.efficacy_update` | 512 | 1024 MB | 30 min |
| `attendance-update` | Sun 6:00 AM | `elite.entrypoints.attendance_update` | 256 | 512 MB | 30 min |
| `federal-update` | Sun 6:00 AM | `elite.entrypoints.federal_update` | 256 | 512 MB | 30 min |
| `rhetoric-profile` | Sun 6:00 AM | `elite.entrypoints.rhetoric_profile` | 512 | 1024 MB | 60 min |
| `state-sync` | Sat 7:00 AM | `elite.entrypoints.state_sync` | 256 | 512 MB | 30 min |
| `twitter-ids-update` | Sun 8:00 AM | `elite.entrypoints.twitter_ids_update` | 256 | 512 MB | 60 min |

### Monthly / Quarterly Jobs

| Job | Schedule (UTC) | Entrypoint | CPU | Memory | Timeout |
|-----|----------------|------------|-----|--------|---------|
| `state-update` | 1st of month, 7:00 AM | `elite.entrypoints.state_update` | 512 | 1024 MB | 60 min |
| `money-update` | 1st of Jan/Mar/Jun/Sep, 6:00 AM | `elite.entrypoints.money_update` | 2048 | 8192 MB | 120 min |

All jobs use the `Dockerfile.batch-light` Docker image.

## How Entrypoints Work

Each batch job has a thin Python entrypoint in `elite/entrypoints/`. These entrypoints are
invoked by the Fargate task command (e.g., `python -m elite.entrypoints.floor_ingest`).

### The Standard Pattern

Most entrypoints follow this pattern:

1. Add the project root to `sys.path`
2. Call `load_config()` from `shared/config.py` to load secrets into environment variables
3. Import and run the existing module code

Example (`elite/entrypoints/floor_ingest.py`):

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.config import load_config, get_db_url

load_config()

# ... existing ingestion logic using os.environ for credentials
```

### The Runner Pattern

For jobs that run multiple scripts sequentially, `shared/runner.py` provides helper
functions:

**`run_scripts(module_path, scripts, env=None, unbuffered=False)`**

Loads config, then runs a list of Python scripts in a specified directory. Scripts can be
plain filenames or `[filename, arg1, arg2, ...]` lists.

Example (`elite/entrypoints/rhetoric_classify.py`):

```python
from shared.runner import run_scripts

run_scripts(
    "elite/rhetoric/classify",
    [
        "insert_performance.py",
        "classify.py",
        ["batch_monitor.py", "--action", "monitor"],
    ],
    unbuffered=True,
)
```

**`run_ingest_digest(module_path, scripts=None)`**

Specialized runner for the ingest+digest pattern. Creates a `.tmp` directory before
running, cleans it up afterwards. Defaults to running `ingest.py` then `digest.py`.

## Running Jobs Manually

### Option 1: Run Directly with Python

Ensure your AWS credentials are configured (the entrypoint will call Secrets Manager):

```bash
export AWS_PROFILE=prl
python -m elite.entrypoints.floor_ingest
```

### Option 2: Run in Docker

Build and run the container locally to match the Fargate environment:

```bash
# Light image (most jobs)
docker build -f docker/Dockerfile.batch-light -t prl-batch-light .
docker run --rm \
  -e AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY \
  -e AWS_SESSION_TOKEN \
  -e AWS_REGION_NAME=us-east-1 \
  prl-batch-light \
  python -m elite.entrypoints.floor_ingest

```

### Option 3: Run via ECS (ad-hoc task)

Trigger the Fargate task directly without waiting for the schedule:

```bash
aws ecs run-task \
  --cluster prl \
  --task-definition prl-floor-ingest \
  --launch-type FARGATE \
  --network-configuration '{
    "awsvpcConfiguration": {
      "subnets": ["<private-subnet-id>"],
      "securityGroups": ["<ecs-sg-id>"],
      "assignPublicIp": "DISABLED"
    }
  }'
```

You can find the subnet and security group IDs from the `PrlNetwork` stack outputs or the
VPC console.

## Adding a New Batch Job

### Step 1: Write the Entrypoint

Create a new file in `elite/entrypoints/`:

```python
# elite/entrypoints/my_new_job.py
"""Entry point for my new batch job."""
from shared.runner import run_scripts

run_scripts(
    "elite/my_module",
    ["step1.py", "step2.py"],
)
```

Or for simple single-script jobs:

```python
# elite/entrypoints/my_new_job.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from shared.config import load_config

load_config()

# Your job logic here
```

### Step 2: Add to BATCH_JOBS List

Add a tuple to the `BATCH_JOBS` list in `infra/stacks/batch_stack.py`:

```python
BATCH_JOBS = [
    # ... existing jobs ...
    ("my-new-job", ["python", "-m", "elite.entrypoints.my_new_job"], "cron(0 8 * * ? *)", 256, 512, 30),
]
```

The tuple fields are:

| Position | Field | Description |
|----------|-------|-------------|
| 0 | `name` | Job name (used in task definition, EventBridge rule, and log prefix) |
| 1 | `command` | Docker CMD as a list of strings |
| 2 | `schedule` | EventBridge cron expression |
| 3 | `cpu` | Fargate CPU units (256, 512, 1024, 2048, or 4096) |
| 4 | `memory` | Memory in MiB (must be compatible with CPU -- see AWS docs) |
| 5 | `timeout` | Maximum runtime in minutes (informational, not enforced by CDK) |

### Step 3: Deploy

```bash
cd infra
cdk deploy PrlBatch
```

### Step 4: Enable the Schedule

New jobs deploy with their EventBridge rules disabled:

```bash
aws events enable-rule --name prl-my-new-job
```

## Troubleshooting

### Job Fails Immediately (Exit Code 1)

Check the CloudWatch logs for the traceback:

```bash
aws logs filter-log-events \
  --log-group-name /prl/batch \
  --log-stream-name-prefix floor-ingest \
  --start-time $(date -d '1 hour ago' +%s000) \
  --limit 50
```

Common causes:
- **ImportError**: A Python dependency is missing from the requirements file
- **Secrets Manager error**: The task role lacks `secretsmanager:GetSecretValue` permission,
  or the secret name is wrong
- **Database connection error**: RDS Proxy endpoint is incorrect in the `prl/database` secret,
  or the security group does not allow traffic on port 3306

### Job Runs But Produces No Data

- Verify the external API is reachable (NAT Gateway must be provisioned)
- Check if the API key in Secrets Manager is valid and not expired
- For `floor-ingest`: verify `CONGRESS_API` is set and valid
- For `twitter-ingest`: verify `TWITTER_API` bearer token is current
- For `rhetoric-classify`: verify `OPENAI_API_KEY` is valid and has quota

### Job Times Out

Fargate tasks have no built-in timeout enforcement from CDK. If a job runs too long:

1. Stop the task manually: `aws ecs stop-task --cluster prl --task <task-arn>`
2. Check if the data source is returning unusually large results
3. Consider increasing the task CPU/memory allocation in `BATCH_JOBS`

### Task Cannot Pull Docker Image

If the Fargate task fails during image pull:

- Verify the ECR repository exists (CDK creates it during deploy)
- Check that the execution role has `AmazonECSTaskExecutionRolePolicy`
- Ensure the NAT Gateway is functional (Fargate in private subnets needs it to reach ECR)

### Out of Memory (OOM)

If a task is killed with an OOM error (exit code 137):

1. Find the job in `BATCH_JOBS` in `infra/stacks/batch_stack.py`
2. Increase the `memory` value (MiB)
3. Ensure the new memory value is compatible with the CPU allocation (see
   [Fargate task size documentation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size))
4. Redeploy: `cdk deploy PrlBatch`

## Log Access

All batch job logs are in the `/prl/batch` CloudWatch log group with a 3-month retention
policy. Log streams are prefixed by job name.

### View Logs in the Console

1. Go to CloudWatch > Log groups > `/prl/batch`
2. Filter log streams by job name prefix (e.g., `floor-ingest`)
3. Click a stream to view the output

### View Logs via CLI

```bash
# Last 24 hours for a specific job
aws logs filter-log-events \
  --log-group-name /prl/batch \
  --log-stream-name-prefix rhetoric-classify \
  --start-time $(date -d '24 hours ago' +%s000)

# Tail logs in real-time (requires aws-logs-tail or similar)
aws logs tail /prl/batch --filter-pattern "rhetoric-classify" --follow
```

### View Logs via Monitoring API

```bash
curl <MONITORING_API_URL>/status/jobs/rhetoric-classify
```

This returns the last 24 hours of log events for the specified job.
