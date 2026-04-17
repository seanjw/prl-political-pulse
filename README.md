# America's Political Pulse

A full-stack platform from the [Polarization Research Lab](https://polarizationresearchlab.org) at Dartmouth College for tracking U.S. elected officials' political activities, rhetoric, financing, and voting records — and serving curated insights through public dashboards.

**Live site:** [americaspoliticalpulse.com](https://americaspoliticalpulse.com)

## Repository Structure

```
prl-political-pulse/
├── prl-frontend/                # React frontend (S3 + CloudFront)
│   ├── src/
│   │   ├── App.tsx              # Route definitions
│   │   ├── components/          # Shared UI (Layout, Header, Footer)
│   │   ├── context/             # React context (StatsContext)
│   │   ├── hooks/               # Custom hooks (useCitizensData, useElitesProfiles)
│   │   └── pages/
│   │       ├── admin/           # Admin panel (content management, operations)
│   │       ├── elites/          # Legislator profiles and data visualizations
│   │       ├── search/          # Rhetoric search with filters and CSV/JSON export
│   │       ├── primary/         # 2026 primary election tracker
│   │       └── violence/        # Political violence research
│   ├── public/data/             # Static JSON data files
│   └── scripts/                 # Data processing scripts
│
├── prl-backend/                 # Data pipeline, APIs, and infrastructure
│   ├── elite/                   # Data ingestion modules (19 batch jobs)
│   │   ├── entrypoints/         # ECS Fargate entry points
│   │   ├── attendance/          # Voting participation
│   │   ├── efficacy/            # Legislative productivity
│   │   ├── floor/               # Floor speeches
│   │   ├── ideology/            # DW-NOMINATE scores
│   │   ├── money/               # Campaign finance (FEC)
│   │   ├── officials/           # Legislator profiles
│   │   ├── rhetoric/            # LLM-based rhetoric classification
│   │   ├── statements/          # Press releases
│   │   ├── twitter/             # Tweet ingestion & media
│   │   └── tv/                  # TV ad tracking
│   ├── lambdas/                 # Lambda function code
│   │   ├── search/              # Rhetoric search API (Flask)
│   │   ├── admin/               # Admin API (6 routes)
│   │   ├── survey-processor/    # Survey CSV processing (Docker)
│   │   └── scholar/             # Google Scholar scraping (Node.js)
│   ├── pulse/server/api/        # Public API (FastAPI + Mangum)
│   ├── surveys/                 # YouGov survey data pipeline
│   ├── scripts/                 # Admin and data processing scripts
│   ├── shared/                  # Shared utilities (config, runner)
│   ├── monitoring/              # Monitoring Lambda (status API)
│   ├── infra/stacks/            # AWS CDK infrastructure-as-code
│   ├── docker/                  # Dockerfiles (API, batch, survey processor)
│   ├── tests/                   # Backend test suite
│   └── docs/                    # Architecture, deployment, batch job docs
│
├── .github/workflows/           # CI/CD (path-filtered per sub-project)
└── .env.example files           # Required environment variables (see Setup)
```

## Architecture

```
                              ┌──────────────────────────────┐
                              │     EventBridge (cron)        │
                              └──────────────┬───────────────┘
                                             │
  ┌───────────────────┐       ┌──────────────▼───────────────┐
  │  External APIs     │──────▶  19 ECS Fargate Batch Jobs    │
  │  (Congress.gov,    │       │  (rhetoric, tweets, finance,  │
  │   Twitter, OpenAI, │       │   floor speeches, profiles)   │
  │   FEC, Voteview)   │       └──────────────┬───────────────┘
  └───────────────────┘                       │
                                              ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                    Aurora MySQL (RDS Proxy)                   │
  │  ┌──────────┐   ┌──────────┐   ┌────────────┐   ┌────────┐ │
  │  │  elite    │   │  pulse   │   │ operations │   │surveys │ │
  │  │ (7.5M+   │   │ (dash-   │   │ (job logs) │   │ (162K  │ │
  │  │  rows)   │   │  board)  │   │            │   │  rows) │ │
  │  └──────────┘   └──────────┘   └────────────┘   └────────┘ │
  └────────────────────────┬────────────────────────────────────┘
                           │
         ┌─────────────────┼────────────────────┐
         ▼                 ▼                     ▼
  ┌─────────────┐  ┌──────────────┐    ┌────────────────┐
  │ Pulse API   │  │ Search API   │    │  Admin API     │
  │ (FastAPI)   │  │ (Flask)      │    │  (Lambda)      │
  └──────┬──────┘  └──────┬───────┘    └────────┬───────┘
         │                │                      │
         └────────┬───────┘                      │
                  ▼                               │
         ┌──────────────┐               ┌────────▼───────┐
         │ API Gateway  │               │ Survey         │
         │ (HTTP APIs)  │               │ Processor      │
         └──────┬───────┘               │ (Docker/Lambda)│
                │                       └────────────────┘
                ▼
  ┌──────────────────────┐
  │  React Frontend       │
  │  (S3 + CloudFront)    │
  └──────────────────────┘
```

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, TypeScript, Vite 7, Tailwind CSS v4, Bootstrap 5 |
| **Charts/Maps** | ECharts, Chart.js, Recharts, react-simple-maps + TopoJSON |
| **Routing** | React Router v7 |
| **Public API** | FastAPI + Tortoise ORM + Mangum (Lambda adapter) |
| **Search API** | Flask (deployed as Lambda zip) |
| **Batch Jobs** | Python 3.11, ECS Fargate containers, pandas, dataset, OpenAI API |
| **Infrastructure** | AWS CDK (Python), CloudFormation |
| **Database** | Aurora MySQL, RDS Proxy for connection pooling |
| **Storage** | S3 (internal + public), CloudFront CDN |
| **Secrets** | AWS Secrets Manager (`prl/database`, `prl/api-keys`, `prl/google-credentials`) |
| **CI/CD** | GitHub Actions (path-filtered per sub-project) |

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with key metrics |
| `/elites`, `/elites/profiles`, `/elites/profile/:id` | Legislator polarization data and individual profiles |
| `/elites/data`, `/elites/about` | Data downloads and methodology |
| `/citizens`, `/citizens/values`, `/citizens/international` | Public opinion and policy values data |
| `/search` | Full-text rhetoric search with filters, histograms, and CSV/JSON export |
| `/primary` | 2026 primary election tracker with rhetoric rankings |
| `/violence` | Political violence tracking |
| `/reports`, `/report/:slug` | Research reports |
| `/data` | Public data downloads |
| `/about`, `/about/support`, `/about/news` | About pages |
| `/admin/*` | Content management panel |

## Data Sources

| Source | Data | Module |
|--------|------|--------|
| [Congress.gov API](https://api.congress.gov/) | Floor speeches, legislative productivity | `elite/floor/`, `elite/efficacy/` |
| [Voteview](https://voteview.com/) | DW-NOMINATE ideology scores, voting participation | `elite/ideology/`, `elite/attendance/` |
| Twitter/X API | Tweets, media files, OpenAI vision annotations | `elite/twitter/` |
| [OpenAI API](https://platform.openai.com/) | Rhetoric classification (batch), media annotation | `elite/rhetoric/`, `elite/twitter/` |
| [FEC.gov](https://www.fec.gov/) | Campaign finance bulk data | `elite/money/` |
| [unitedstates/congress-legislators](https://github.com/unitedstates/congress-legislators) | Federal legislator metadata | `elite/officials/` |
| [openstates/people](https://github.com/openstates/people) | State legislator metadata | `elite/officials/` |
| Google BigQuery | Political advertising data | `elite/ads/google/` |

Also see the public [elite data pipeline](https://github.com/Polarization-Research-Lab/elite).

## API Endpoints

### Pulse API (FastAPI on Lambda)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Database connectivity check |
| `GET` | `/data/{endpoint}` | JSON data retrieval by endpoint name |
| `POST` | `/query/` | Flexible filtering with field/operation/value triplets |
| `GET` | `/count/{path}` | Download tracking with redirect to CloudFront |

**Supported query fields:** `state`, `party`, `level`, `bioguide_id`, `name`, `type`, `source_id`
**Supported operations:** `eq`, `gt`, `gte`, `lt`, `lte`, `in`, `icontains`

### Search API (Flask on Lambda)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/search` | Search statements with filters + pagination |
| `POST` | `/search_histogram` | Monthly counts by party |
| `POST` | `/search_totals` | Party totals for date range |
| `POST` | `/export` | CSV/JSON export (chunked for large results) |
| `GET` | `/autocomplete_data` | Names, handles, districts |

### Admin API (Lambda)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/save` | Save JSON to S3 |
| `POST` | `/upload` | Upload binary files to S3 |
| `POST` | `/get-survey-config` | Fetch survey API config from Secrets Manager |
| `POST` | `/get-presigned-url` | Generate S3 presigned URL for survey uploads |
| `POST` | `/trigger-processing` | Invoke survey processor Lambda asynchronously |
| `GET` | `/job-status/{id}` | Check survey processing job status |

### Monitoring API (Lambda)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/status` | Overall system health |
| `GET` | `/status/jobs` | List recent ECS task runs |
| `GET` | `/status/jobs/{name}` | Job details and recent logs |
| `GET` | `/status/api` | Lambda invocation metrics |

## Batch Jobs

19 ECS Fargate tasks run on cron schedules via EventBridge. All use a single Docker image (`Dockerfile.batch-light`) and log to `/prl/batch` in CloudWatch.

### Daily

| Job | Schedule (UTC) | Description | CPU | Memory |
|-----|----------------|-------------|-----|--------|
| `rhetoric-classify` | 4:00 AM | OpenAI batch classification of political text | 1024 | 4 GB |
| `floor-ingest` | 5:20 AM | Congressional floor speech data | 256 | 512 MB |
| `twitter-ingest` | 5:40 AM | Tweet ingestion from Twitter API | 256 | 1 GB |
| `ads-google-ingest` | 5:50 AM | Political advertising data from Google | 256 | 512 MB |
| `twitter-media-ingest` | 6:45 AM | Media files from tweets | 256 | 1 GB |
| `pulse-site-update` | 7:20 AM | Dashboard data refresh | 256 | 512 MB |
| `pulse-citizens-update` | 7:20 AM | Citizens survey data refresh | 256 | 512 MB |
| `pulse-elites-update` | 7:20 AM | Elites profile data refresh | 256 | 512 MB |
| `twitter-media-annotate` | 7:55 AM | OpenAI vision annotation of tweet media | 256 | 1 GB |
| `rhetoric-public-s3` | 10:00 AM | Export rhetoric data for public download | 512 | 2 GB |

### Weekly

| Job | Schedule (UTC) | Description | CPU | Memory |
|-----|----------------|-------------|-----|--------|
| `ideology-update` | Sun 6:00 AM | DW-NOMINATE scores from Voteview | 512 | 1 GB |
| `efficacy-update` | Sun 6:00 AM | Legislative productivity metrics | 512 | 1 GB |
| `attendance-update` | Sun 6:00 AM | Voting participation rates | 256 | 512 MB |
| `federal-update` | Sun 6:00 AM | Federal legislator profile sync | 256 | 512 MB |
| `rhetoric-profile` | Sun 6:00 AM | Aggregate rhetoric scoring | 512 | 1 GB |
| `state-sync` | Sat 7:00 AM | State legislator sync from OpenStates | 256 | 512 MB |
| `twitter-ids-update` | Sun 8:00 AM | Twitter ID resolution | 256 | 512 MB |

### Monthly / Quarterly

| Job | Schedule (UTC) | Description | CPU | Memory |
|-----|----------------|-------------|-----|--------|
| `state-update` | 1st of month 7:00 AM | State legislator full update | 512 | 1 GB |
| `money-update` | Quarterly (Jan/Mar/Jun/Sep) | FEC campaign finance bulk data | 2048 | 8 GB |

## Database

Aurora MySQL cluster with four databases:

| Database | Key Tables | Purpose |
|----------|-----------|---------|
| `elite` | `mat_classification_legislator` (~7.5M rows), `officials` (~7.7K), `openstates` (~7.7K) | Legislator rhetoric, profiles, voting records, finance |
| `pulse` | `legislators`, `federal_profiles`, `state_profiles`, `data` | Aggregated dashboard data |
| `surveys` | `us_labelled` (~162K rows, 172 columns) | Raw US survey responses |
| `operations` | `job_results`, activity logs | Job execution history and metrics |

All access goes through **RDS Proxy** for connection pooling.

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker
- AWS CLI v2 (configured with appropriate credentials)

### Environment Variables

Both sub-projects require environment variables. Copy the example files and fill in your values:

```bash
# Frontend
cp prl-frontend/.env.example prl-frontend/.env.local

# Backend
cp prl-backend/.env.example prl-backend/.env
```

**Frontend** (`prl-frontend/.env.local`):

| Variable | Description |
|----------|-------------|
| `VITE_DATA_API_URL` | Pulse API Gateway URL |
| `VITE_SEARCH_API_URL` | Search API Gateway URL |
| `VITE_MONITORING_API_URL` | Monitoring API Gateway URL |
| `VITE_ADMIN_API_URL` | Admin API Gateway URL |

**Backend** (`prl-backend/.env`):

| Variable | Description |
|----------|-------------|
| `PRL_S3_BUCKET` | Public-facing S3 bucket name |
| `PRL_SURVEY_S3_BUCKET` | Survey data S3 bucket name |
| `PRL_S3_INTERNAL_BUCKET` | Internal data S3 bucket name |
| `PRL_S3_TWITTER_IMAGES_BUCKET` | Twitter images S3 bucket name |
| `PRL_CLOUDFRONT_DIST_ID` | CloudFront distribution ID |
| `S3_BUCKET` | Runtime alias for public S3 bucket |

**AWS Secrets Manager** (must exist before deployment):

| Secret | Contents |
|--------|----------|
| `prl/database` | `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_DIALECT` |
| `prl/api-keys` | `CONGRESS_API`, `TWITTER_API`, `OPENAI_API_KEY`, `CURRENT_CONGRESS` |
| `prl/google-credentials` | Google Sheets service account JSON |

### Frontend Development

```bash
cd prl-frontend
npm install
npm run dev           # Vite dev server at localhost:5173
npm run build         # TypeScript check + Vite production build
npm run lint          # ESLint
npm run test:run      # Vitest single run
```

### Backend Development

```bash
cd prl-backend

# Run Pulse API locally
pip install -r pulse/server/api/requirements.txt
cd pulse/server/api && uvicorn main:app --reload --port 8000

# Run a batch job locally (requires AWS credentials for Secrets Manager)
python -m elite.entrypoints.floor_ingest

# Tests
pytest tests/ -v

# Linting
pip install ruff
ruff check . --exclude "infra/cdk.out"
ruff format --check . --exclude "infra/cdk.out"
```

### Infrastructure (CDK)

```bash
cd prl-backend/infra
npm install
npx cdk synth         # Generate CloudFormation templates
npx cdk diff          # Preview changes
npx cdk deploy --all  # Deploy all 5 stacks
```

Five CDK stacks deploy in dependency order:

| Stack | Class | Description |
|-------|-------|-------------|
| `PrlNetwork` | `NetworkStack` | VPC, subnets, NAT Gateway, security groups, RDS Proxy |
| `PrlApi` | `ApiStack` | Pulse API Lambda (Docker) + API Gateway |
| `PrlLambdas` | `LambdasStack` | Search, Admin, Survey Processor Lambdas + API Gateways |
| `PrlBatch` | `BatchStack` | ECS cluster, 19 Fargate task definitions, EventBridge rules |
| `PrlMonitoring` | `MonitoringStack` | Monitoring Lambda and API |

## CI/CD

All workflows live in `.github/workflows/` with path-based triggers for monorepo isolation:

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `frontend-ci.yml` | Push/PR to `main` (frontend changes) | Lint, typecheck, test, build |
| `frontend-deploy.yml` | Push to `main` (frontend changes) | Build, S3 sync, CloudFront invalidation |
| `backend-test.yml` | Push/PR to `main` (backend changes) | Ruff lint/format, pytest, CDK diff (PRs) |
| `backend-deploy.yml` | Push to `main` (backend changes) | Build Docker images, push to ECR, CDK deploy |
| `security.yml` | Weekly + PRs | npm audit, pip-audit, gitleaks secret scan |
| `update-scholar-stats.yml` | Daily 6 AM UTC | Scrape Google Scholar, update S3 JSON |

Required **GitHub Secrets** for CI/CD:

| Secret | Used by |
|--------|---------|
| `AWS_ROLE_TO_ASSUME` | All deploy workflows (OIDC auth) |
| `S3_BUCKET` | Frontend deploy, scholar stats |
| `CLOUDFRONT_DIST_ID` | Frontend deploy, scholar stats |
| `VITE_DATA_API_URL` | Frontend deploy |
| `VITE_SEARCH_API_URL` | Frontend deploy |
| `VITE_MONITORING_API_URL` | Frontend deploy |
| `VITE_ADMIN_API_URL` | Frontend deploy |

## Deployment

Both frontend and backend auto-deploy on push to `main` via GitHub Actions.

Manual deployment:

```bash
# Frontend
cd prl-frontend && ./deploy.sh

# Backend (all stacks)
cd prl-backend/infra && npx cdk deploy --all

# Individual stacks
npx cdk deploy PrlApi        # Just the Pulse API
npx cdk deploy PrlLambdas    # Search, Admin, Survey Processor
npx cdk deploy PrlBatch      # Batch jobs
```

Batch jobs deploy with EventBridge rules **disabled** — enable after verifying infrastructure:

```bash
aws events enable-rule --name prl-floor-ingest
```

## Testing

```bash
# Frontend
cd prl-frontend && npm run test:run

# Backend
cd prl-backend && pytest tests/ -v
```

## Documentation

- [`prl-backend/docs/ARCHITECTURE.md`](prl-backend/docs/ARCHITECTURE.md) — System design, networking, secrets flow
- [`prl-backend/docs/DEPLOYMENT.md`](prl-backend/docs/DEPLOYMENT.md) — Full deployment guide, rollback procedures
- [`prl-backend/docs/BATCH_JOBS.md`](prl-backend/docs/BATCH_JOBS.md) — Batch job reference, adding new jobs, troubleshooting

## License

This project is maintained by the [Polarization Research Lab](https://polarizationresearchlab.org) at Dartmouth College.
