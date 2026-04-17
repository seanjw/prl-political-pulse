# America's Political Pulse

A platform from the [Polarization Research Lab](https://polarizationresearchlab.org) at Dartmouth College for tracking U.S. elected officials' political activities, rhetoric, financing, and voting records.

**Live site:** [americaspoliticalpulse.com](https://americaspoliticalpulse.com)

## Repository Structure

This is a monorepo containing the full stack:

```
americas-political-pulse/
├── prl-frontend/   # React frontend (S3 + CloudFront)
├── prl-backend/            # Backend: APIs, batch jobs, infrastructure (AWS CDK)
│   ├── docs/               # Architecture, deployment, and batch job docs
│   ├── elite/              # Data ingestion modules (public repo)
│   ├── infra/              # AWS CDK stacks
│   ├── lambdas/            # Lambda functions (Search, Admin, Survey, Scholar)
│   ├── pulse/              # Pulse API (FastAPI)
│   └── shared/             # Shared config and utilities
└── .github/workflows/      # CI/CD pipelines (path-filtered per sub-project)
```

## Architecture

```
┌─────────────────────┐     ┌──────────────────────────┐
│  React + TS + Vite  │     │  19 ECS Fargate batch    │
│  (S3 + CloudFront)  │     │  jobs (EventBridge cron) │
└────────┬────────────┘     └──────────┬───────────────┘
         │                             │
         ├──▶ Search API (Flask)       │
         ├──▶ Admin API (Lambda)       │
         │                             │
         └──▶ Pulse API (FastAPI) ◀────┘
                     │
              Aurora MySQL (RDS)
```

## Tech Stack

**Frontend:** React 19, TypeScript, Vite 7, Tailwind CSS v4, Bootstrap 5, ECharts, react-simple-maps

**Backend:** Python 3.11, FastAPI, Flask, AWS CDK, ECS Fargate, Lambda, Aurora MySQL

## Development

### Frontend

```bash
cd prl-frontend
npm install && npm run dev    # Dev server at localhost:5173
npm run build                 # Production build
npm run test:run              # Run tests
```

### Backend

```bash
cd prl-backend
export AWS_PROFILE=prl
pytest tests/ -v                                              # Run tests
cd pulse/server/api && uvicorn main:app --reload --port 8000  # Local API
```

## CI/CD

All CI/CD runs via GitHub Actions with path-based triggers:

- **Frontend:** Lint + typecheck + test on push/PR; auto-deploy to S3/CloudFront on merge to `main`
- **Backend:** Ruff lint + pytest on push/PR; Docker build + CDK deploy on merge to `main`
- **Security:** Weekly npm audit, pip-audit, and gitleaks scans
- **Scholar stats:** Daily Google Scholar scrape updating S3 data

## Deployment

Both frontend and backend **auto-deploy on push to `main`** via GitHub Actions.

Manual deployment:
```bash
# Frontend
cd prl-frontend && ./deploy.sh

# Backend
cd prl-backend/infra && cdk deploy --all
```

## Pages

| Page | Description |
|------|-------------|
| Home | Landing page with key metrics |
| Elites | Legislator polarization data and profiles |
| Citizens | Public opinion data |
| International | Cross-country comparisons |
| Violence | Political violence tracking |
| Policy Values | Policy position analysis |
| Search | Legislator rhetoric search with filters and export |
| Reports | Research reports |
| Data | Public data downloads |
| Admin | Content management panel |

## Documentation

- [`prl-backend/docs/ARCHITECTURE.md`](prl-backend/docs/ARCHITECTURE.md) — System architecture
- [`prl-backend/docs/DEPLOYMENT.md`](prl-backend/docs/DEPLOYMENT.md) — Full deployment guide
- [`prl-backend/docs/BATCH_JOBS.md`](prl-backend/docs/BATCH_JOBS.md) — Batch job reference

## Data Sources

Aggregated data from our [public data pipeline](https://github.com/Polarization-Research-Lab/elite).
