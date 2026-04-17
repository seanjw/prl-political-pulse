# Architecture

System architecture for the PRL Backend platform.

## Overview

The PRL Backend is a data pipeline and analytics platform that collects political data from
external sources, processes it through batch jobs, stores it in a relational database, and
serves it through a public API and dashboard. The system runs entirely on AWS using serverless
and managed services.

```
                          +-------------------+
                          |   EventBridge     |
                          | (cron schedules)  |
                          +--------+----------+
                                   |
                                   v
+---------------+         +-------------------+         +------------------+
| External APIs |-------->| ECS Fargate Tasks |-------->| Aurora MySQL     |
| (Congress.gov,|         | (19 batch jobs)   |         | (RDS Proxy)      |
|  Twitter,     |         +-------------------+         +--------+---------+
|  OpenAI,      |                                                |
|  FEC, etc.)   |                                                |
+---------------+                                                v
                                                        +------------------+
                          +-------------------+         | Pulse API        |
                          |  API Gateway      |-------->| (Lambda/FastAPI)  |
                          |  (HTTP APIs)      |         +------------------+
                          +--------+----------+         +------------------+
                                   |  |                 | Search API       |
                                   |  +---------------->| (Lambda/Flask)   |
                                   |                    +------------------+
                                   |                    +------------------+
                                   +------------------->| Admin API        |
                                   ^                    | (Lambda)         |
                                   |                    +------------------+
                             HTTPS requests
                             from dashboard     +------------------+
                                                | Survey Processor |
                                                | (Lambda/Docker)  |
                                                +------------------+
                                                        |
                                                        v
                                                +------------------+
                                                | S3 / CloudFront  |
                                                | (public data)    |
                                                +------------------+
```

## Components

### Pulse API (AWS Lambda)

The public-facing API is a FastAPI application packaged as a Docker container image and
deployed to AWS Lambda using the Mangum adapter for ASGI-to-Lambda translation.

- **Stack:** `PrlApi` (`infra/stacks/api_stack.py`)
- **Docker image:** `docker/Dockerfile.api` (based on `public.ecr.aws/lambda/python:3.11`)
- **Memory:** 512 MB
- **Timeout:** 30 seconds
- **Concurrency:** 10 reserved concurrent executions
- **Database access:** Tortoise ORM via async MySQL driver (`asyncmy`) through RDS Proxy
- **Secrets:** Reads `prl/database` from Secrets Manager at startup via `shared/config.py`

The API provides:
- `GET /data/{endpoint}` -- JSON data retrieval by endpoint name
- `POST /query/` -- Flexible filtering across legislators, federal profiles, and state profiles
- `GET /count/{path}` -- Download count tracking with CloudFront redirect
- `GET /health` -- Database connectivity verification

API Gateway is configured as an HTTP API (not REST API) with a catch-all `/{proxy+}` route
and full CORS support.

### Lambda Functions (Search, Admin, Survey Processor)

Three additional Lambda functions are managed by the `PrlLambdas` stack (`infra/stacks/lambdas_stack.py`):

| Function | Code | Runtime | Memory | Timeout | API Gateway |
|----------|------|---------|--------|---------|-------------|
| Search API | `lambdas/search/` | Python 3.11 (zip) | 512 MB | 300s | HTTP API |
| Admin API | `lambdas/admin/` | Python 3.11 (zip) | 256 MB | 30s | HTTP API |
| Survey Processor | `lambdas/survey-processor/` | Python 3.11 (Docker) | 4096 MB | 15 min | None (async invoke) |

**Search API:** Flask application deployed via Zappa pattern. Provides rhetoric search, histogram, totals, export, and autocomplete endpoints. Connects to the `elite` database through RDS Proxy.

**Admin API:** Consolidated handler with 6 routes (from previously separate admin and survey-upload functions):
- `POST /save` — Save JSON to S3
- `POST /upload` — Upload binary files to S3
- `POST /get-survey-config` — Fetch survey API config from Secrets Manager
- `POST /get-presigned-url` — Generate S3 presigned URL for survey uploads
- `POST /trigger-processing` — Invoke survey processor Lambda asynchronously
- `GET /job-status/{id}` — Check survey processing job status

**Survey Processor:** Long-running Lambda (Docker image, `docker/Dockerfile.survey-processor`) that processes uploaded survey CSV files and ingests them into the database. Invoked asynchronously by the Admin API.

### Batch Jobs (ECS Fargate)

Nineteen batch jobs run as Fargate tasks on a shared ECS cluster named `prl`. Each job is
defined as a Fargate task definition with its own CPU/memory allocation, command, and EventBridge schedule rule.

- **Stack:** `PrlBatch` (`infra/stacks/batch_stack.py`)
- **Cluster:** `prl`
- **Log group:** `/prl/batch` (CloudWatch, 3-month retention)
- **Subnets:** Private subnets with egress (via NAT Gateway)
- **IAM:** Shared task role with access to Secrets Manager (`prl/*`) and S3 (internal + public buckets)

Jobs are defined in the `BATCH_JOBS` list in `batch_stack.py` as tuples of:
```
(name, command, schedule_expression, cpu, memory_mib, timeout_minutes)
```

All jobs use a single Docker image (`Dockerfile.batch-light`): Python 3.11-slim with
standard data processing libraries.

### Aurora MySQL (RDS)

The platform uses an existing Aurora MySQL cluster (`database-1`) with three databases:

| Database | Purpose | Primary consumers |
|----------|---------|-------------------|
| `elite` | Legislator data, voting records, rhetoric scores, campaign finance | Batch jobs (read/write), API (read) |
| `pulse` | Dashboard data, legislator profiles, download counts | API (read/write), batch jobs (write) |
| `operations` | Activity logging, job execution history | Monitoring |

Access is through RDS Proxy (`prl-rds-proxy`) for connection pooling, which is necessary
because both Lambda functions and Fargate tasks can create many concurrent connections.

The `dataset` library is used for most database operations in the `elite/` modules. The
Pulse API uses Tortoise ORM with the `asyncmy` async MySQL driver.

### S3 Storage

| Bucket | Purpose |
|--------|---------|
| `$S3_INTERNAL_BUCKET` | Internal data storage (raw data files, intermediate processing) |
| `$S3_BUCKET` | Public-facing data served via CloudFront (downloads, dashboard data) |

Several batch jobs write to S3:
- `rhetoric-public-s3` exports rhetoric data for public download
- `pulse-site-update` refreshes dashboard data files

### Monitoring (Lambda)

A separate FastAPI Lambda provides operational visibility:

- **Endpoints:** `/status`, `/status/jobs`, `/status/jobs/{name}`, `/status/api`
- **Data sources:** ECS API (task status), CloudWatch Logs (job output), CloudWatch Metrics (API performance)
- **Stack:** `PrlMonitoring` (`infra/stacks/monitoring_stack.py`)

## Networking

All compute resources run inside a VPC with the following topology:

```
VPC (2 AZs)
+------------------------------------------+
|                                          |
|  Public Subnets (/24 each)               |
|  +------------------+  +---------------+ |
|  | NAT Gateway      |  |               | |
|  +------------------+  +---------------+ |
|                                          |
|  Private Subnets (/24 each)              |
|  +------------------+  +---------------+ |
|  | Lambda functions |  | Fargate tasks | |
|  | RDS Proxy        |  |               | |
|  +------------------+  +---------------+ |
|                                          |
+------------------------------------------+
```

- **Public subnets** host the NAT Gateway, which provides internet access for resources in
  private subnets.
- **Private subnets** host Lambda functions, Fargate tasks, and RDS Proxy. These resources
  cannot be reached directly from the internet.
- **NAT Gateway** (single, in one AZ) allows outbound internet access for API calls to
  external services (Congress.gov, Twitter, OpenAI, etc.).

### Security Groups

| Security Group | Attached To | Rules |
|----------------|-------------|-------|
| `LambdaSg` | Lambda functions | Outbound: all traffic |
| `EcsSg` | ECS Fargate tasks | Outbound: all traffic |
| `RdsProxySg` | RDS Proxy | Inbound: TCP 3306 from `LambdaSg` and `EcsSg` |

## Secrets Management

All secrets are stored in AWS Secrets Manager and loaded at runtime by `shared/config.py`.

### Secrets

| Secret Name | Contents | Used By |
|-------------|----------|---------|
| `prl/database` | `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_DIALECT` | All components |
| `prl/api-keys` | `CONGRESS_API`, `TWITTER_API`, `OPENAI_API_KEY`, `CURRENT_CONGRESS` | Batch jobs |
| `prl/google-credentials` | Google Sheets service account JSON | `ads-google-ingest`, `state-sync` |

### How Secrets Flow

1. **Batch jobs** call `load_config()` from `shared/config.py` at startup. This fetches
   `prl/database` and `prl/api-keys` from Secrets Manager and injects all key-value pairs
   into `os.environ`. Existing code that reads `os.environ['DB_USER']` etc. continues to
   work without modification.

2. **Google credentials** are handled via a context manager `setup_google_creds()` that
   downloads the JSON to a temporary file and sets `PATH_TO_GOOGLE_CREDS` in the environment.

3. **The API** calls `get_tortoise_db_url()` which fetches `prl/database` and constructs a
   connection string directly, without setting environment variables.

4. Secrets are cached in-process via `@lru_cache` to avoid repeated Secrets Manager calls
   within a single invocation.

## Docker Images

### `Dockerfile.api` (Lambda API)

Based on `public.ecr.aws/lambda/python:3.11`. Contains only the Pulse API code and shared
config module. The Lambda handler is `main.lambda_handler`.

### `Dockerfile.batch-light` (Batch jobs)

Based on `python:3.11-slim`. Includes system libraries for XML parsing and git, plus all
Python dependencies for data processing. Sets `PYTHONPATH=/app` and `PYTHONUNBUFFERED=1`,
and copies the `elite/`, `shared/`, `surveys/`, and `pulse/` directories into `/app/`.

### `Dockerfile.survey-processor` (Survey Processor Lambda)

Based on `public.ecr.aws/lambda/python:3.11`. Installs pandas, numpy, and other survey processing dependencies. Copies `lambdas/survey-processor/` code. Handler: `handler.lambda_handler`.
