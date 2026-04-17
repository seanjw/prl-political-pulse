# PRL Backend

Primary codebase for the Polarization Research Lab's data ingestion, curation, and analytics platform. This system tracks U.S. elected officials' political activities, rhetoric, financing, and voting records, and serves curated insights through public dashboards.

## Project Structure

```
prl-backend/
├── elite/                    # Data ingestion modules
│   ├── entrypoints/          # ECS Fargate entry points
│   ├── attendance/           # Voting participation
│   ├── efficacy/             # Legislative productivity
│   ├── floor/                # Floor speeches
│   ├── ideology/             # DW-NOMINATE scores
│   ├── money/                # Campaign finance
│   ├── officials/            # Legislator profiles
│   ├── rhetoric/             # Rhetoric classification
│   │   ├── classify/         # OpenAI batch classification
│   │   ├── profile/          # Aggregate scoring
│   │   └── public/           # S3 export
│   ├── statements/           # Press releases
│   ├── twitter/              # Tweet ingestion & media
│   └── tv/                   # TV ad tracking
├── lambdas/                  # Lambda function code
│   ├── search/               # Rhetoric search API (Flask/Zappa)
│   ├── admin/                # Consolidated admin API (6 routes)
│   ├── survey-processor/     # Survey CSV processing (Docker)
│   └── scholar/              # Google Scholar scraping (Node.js)
├── pulse/                    # Public dashboard
│   └── server/api/           # FastAPI Lambda API
├── surveys/                  # Survey data pipeline
├── scripts/                  # Admin/data processing scripts
│   ├── process_us_wave.py
│   ├── process_international_wave.py
│   ├── generate-data-downloads.js
│   ├── regenerate_all_data_zip.py
│   ├── scrape-news.mjs
│   ├── parse_cv.py
│   ├── generate_international_aggregate_data.py
│   └── generate_international_questions_data.py
├── shared/                   # Shared utilities
│   ├── config.py             # Secrets Manager integration
│   └── runner.py             # Entrypoint runner
├── infra/                    # CDK infrastructure
│   └── stacks/
│       ├── api_stack.py      # Pulse API Lambda + API Gateway
│       ├── lambdas_stack.py  # Search, Admin, Survey Processor Lambdas
│       ├── batch_stack.py    # ECS Fargate + EventBridge
│       ├── network_stack.py  # VPC + RDS Proxy
│       └── monitoring_stack.py
├── monitoring/               # Monitoring Lambda
│   └── handler.py            # Status API
├── docker/                   # Dockerfiles
│   ├── Dockerfile.api        # Pulse API Lambda image
│   ├── Dockerfile.batch-light # Batch jobs
│   └── Dockerfile.survey-processor # Survey processor Lambda
├── tests/                    # Test suite
└── docs/                     # Documentation
    ├── ARCHITECTURE.md
    ├── DEPLOYMENT.md
    └── BATCH_JOBS.md
```

## Core Components

### Elite Module

The heart of the data ingestion system. Organized into specialized submodules:

| Submodule | Description | Data Source |
|-----------|-------------|-------------|
| `officials/` | Legislator metadata and profiles | unitedstates/congress-legislators, openstates/people |
| `attendance/` | Voting participation rates | Voteview |
| `ideology/` | DW-NOMINATE ideology scores | Voteview |
| `efficacy/` | Legislative productivity metrics | Congress.gov API |
| `floor/` | Congressional floor speech data | congress.gov API |
| `rhetoric/` | LLM-based rhetoric classification | OpenAI API |
| `twitter/` | Tweet data and media processing | Twitter API |
| `money/` | Campaign finance data | FEC.gov bulk data |
| `ads/google/` | Political advertising data | Google BigQuery |

### Pulse Module

Public-facing API at [americaspoliticalpulse.com](https://americaspoliticalpulse.com).

```
pulse/
└── server/                # Backend API (AWS Lambda)
    └── api/
        ├── main.py        # FastAPI application with Mangum handler
        └── models.py      # Tortoise ORM models
```

**Tech Stack:** FastAPI on AWS Lambda via Mangum adapter, Tortoise ORM with asyncmy.

### Lambda Functions

All Lambda function code lives in `lambdas/`, managed by CDK (`infra/stacks/lambdas_stack.py`).

| Directory | Purpose | Runtime | Memory |
|-----------|---------|---------|--------|
| `lambdas/search/` | Rhetoric search API (Flask/Zappa) | Python 3.11 (zip) | 512 MB |
| `lambdas/admin/` | Consolidated admin API (save, upload, survey config, presigned URLs, trigger processing, job status) | Python 3.11 (zip) | 256 MB |
| `lambdas/survey-processor/` | Survey CSV processing + DB ingestion | Python 3.11 (Docker) | 4096 MB |
| `lambdas/scholar/` | Google Scholar scraping | Node.js | — |

The admin Lambda consolidates what were previously two separate functions (admin + survey-upload) into a single handler with 6 routes.

### Scripts

Admin and data processing scripts in `scripts/`. All scripts use `shared/config.py` for database credentials (fetched from Secrets Manager).

| Script | Purpose |
|--------|---------|
| `process_us_wave.py` | Process US survey wave into database |
| `process_international_wave.py` | Process international survey wave |
| `generate-data-downloads.js` | Generate public download files |
| `regenerate_all_data_zip.py` | Rebuild `all-data.zip` from surveys DB |
| `scrape-news.mjs` | Scrape news mentions |
| `parse_cv.py` | Parse CV data |
| `generate_international_aggregate_data.py` | Generate international aggregate data |
| `generate_international_questions_data.py` | Generate international questions data |

### Surveys Module

YouGov survey data processing pipeline.

```
surveys/
├── process/
│   └── upload/            # CSV -> RDS -> S3 pipeline
└── pull/                  # Data collection scripts
```

## Infrastructure

The platform runs on AWS using infrastructure defined as code with AWS CDK (Python). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full details.

### AWS Services

| Service | Role |
|---------|------|
| **AWS Lambda** | Hosts Pulse API, Search API, Admin API, Survey Processor, and monitoring |
| **API Gateway** | HTTP API routing requests to Lambda |
| **ECS Fargate** | Runs 19 scheduled batch jobs as serverless containers |
| **EventBridge** | Triggers batch jobs on cron schedules |
| **Aurora MySQL** | Primary database cluster (`elite`, `pulse`, `operations` databases) |
| **RDS Proxy** | Connection pooling for database access |
| **S3** | Data storage (internal) and public downloads (via CloudFront) |
| **Secrets Manager** | Stores database credentials, API keys, and Google credentials |
| **VPC** | Private subnets with NAT Gateway for internet access |
| **CloudWatch** | Logs (`/prl/batch`) and metrics |

### CDK Stacks

The infrastructure is split into five CDK stacks deployed from `infra/app.py`:

| Stack | Class | Description |
|-------|-------|-------------|
| `PrlNetwork` | `NetworkStack` | VPC, subnets, security groups, RDS Proxy, Secrets Manager |
| `PrlApi` | `ApiStack` | Pulse API Lambda, API Gateway HTTP API |
| `PrlLambdas` | `LambdasStack` | Search, Admin, Survey Processor Lambdas + API Gateways |
| `PrlBatch` | `BatchStack` | ECS cluster, 19 Fargate task definitions, EventBridge rules |
| `PrlMonitoring` | `MonitoringStack` | Monitoring Lambda and API |

### Database

Aurora MySQL cluster `database-1` with three databases:
- `elite` -- Legislators, voting records, rhetoric, financial data
- `pulse` -- Public-facing dashboard data
- `operations` -- Activity logging and job status

### Storage

- **S3 Buckets** (names configured via environment variables):
  - Internal data storage bucket
  - Public-facing dashboard hosting and downloads bucket

## Scheduled Batch Jobs

All batch jobs run as ECS Fargate tasks triggered by EventBridge cron schedules. See [docs/BATCH_JOBS.md](docs/BATCH_JOBS.md) for the complete reference.

| Frequency | Job | Description |
|-----------|-----|-------------|
| Daily 4:00 AM UTC | `rhetoric-classify` | OpenAI batch classification of political text |
| Daily 5:20 AM UTC | `floor-ingest` | Congressional floor speech data |
| Daily 5:40 AM UTC | `twitter-ingest` | Tweet ingestion from Twitter API |
| Daily 6:45 AM UTC | `twitter-media-ingest` | Media files from tweets |
| Daily 7:20 AM UTC | `pulse-data-refresh` | Dashboard data refresh |
| Daily 7:55 AM UTC | `twitter-media-annotate` | OpenAI vision annotation of tweet media |
| Weekly Sunday | `ideology-update` | DW-NOMINATE scores from Voteview |
| Weekly Sunday | `federal-update` | Legislator profiles sync |
| Quarterly | `money-update` | FEC campaign finance data |

All times are in UTC. Jobs deploy in a disabled state and must be enabled via EventBridge after cutover.

## Data Flow

```
External Sources (APIs, Web, Bulk Data)
         |
         v
+-------------------------+
|  Batch Jobs (Fargate)   |  Pull, normalize, and classify data
+------------+------------+
             |
             v
+-------------------------+
|   Aurora MySQL (RDS)    |  Store structured records
+------------+------------+
             |
             v
+-------------------------+
|  Pulse API (Lambda)     |  Serve JSON data to frontend
+------------+------------+
             |
             v
+-------------------------+
|  S3 / CloudFront        |  Host dashboard + public downloads
+-------------------------+
```

## API Endpoints

The Pulse API (FastAPI on Lambda) provides:

- `GET /` -- Health check
- `GET /health` -- Database connectivity check
- `GET /data/{endpoint}` -- Direct JSON data retrieval
- `POST /query/` -- Flexible filtering with field/operation/value triplets
- `GET /count/{path}` -- Download tracking with redirect to CloudFront

**Monitoring API** (separate Lambda):

- `GET /status` -- Overall system health
- `GET /status/jobs` -- List recent ECS task runs
- `GET /status/jobs/{name}` -- Job details and recent logs
- `GET /status/api` -- Lambda invocation metrics

**Supported Query Fields:** `state`, `party`, `level`, `bioguide_id`, `name`, `type`, `source_id`

**Supported Operations:** `eq`, `gt`, `gte`, `lt`, `lte`, `in`, `icontains`

## Local Development

**Prerequisites:**
- Python 3.11+
- Node.js 18+ (for CDK)
- AWS CLI v2 (configured with appropriate credentials)
- Docker (for building container images)

**API (Local Testing):**
```bash
# Install dependencies
pip install -r pulse/server/requirements.txt

# Run FastAPI dev server
cd pulse/server/api
uvicorn main:app --reload --port 8000
```

**Running a Batch Job Locally:**
```bash
# Ensure AWS credentials are configured (for Secrets Manager access)
export AWS_PROFILE=prl
python -m elite.entrypoints.floor_ingest
```

**Infrastructure (CDK):**
```bash
cd infra
npm install
cdk synth       # Preview CloudFormation templates
cdk diff        # Show pending changes
cdk deploy --all  # Deploy all stacks
```

## Testing

```bash
pytest tests/ -v
```

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full deployment instructions.

Quick deploy:
```bash
cd infra
cdk deploy --all
```

## Further Documentation

- [Architecture](docs/ARCHITECTURE.md) -- System design, networking, secrets management
- [Deployment](docs/DEPLOYMENT.md) -- Prerequisites, first-time setup, rollback procedures
- [Batch Jobs](docs/BATCH_JOBS.md) -- Complete job reference, manual execution, adding new jobs

## Notes

- The `elite/` directory is a public GitHub repo -- never add sensitive data there
- All times in EventBridge schedules are UTC (adjust for EST: UTC-5)
- Batch jobs deploy in a disabled state; enable them via EventBridge console after cutover

## Resources

- **Public Dashboard**: https://americaspoliticalpulse.com
- **Elite Repository**: https://github.com/Polarization-Research-Lab/elite
