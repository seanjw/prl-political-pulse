# America's Political Pulse — Frontend

React frontend for the [Polarization Research Lab](https://polarizationresearchlab.org/) at Dartmouth College. Displays political research data, legislator profiles, and searchable rhetoric from elected officials at federal and state levels.

**Live site:** https://americaspoliticalpulse.com

## Quick Start

```bash
npm install
npm run dev       # Development server at localhost:5173
npm run build     # Production build (TypeScript check + Vite build)
npm run lint      # ESLint
npm run test      # Vitest (watch mode)
npm run test:run  # Vitest single run
```

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite 7
- **Styling:** Tailwind CSS v4 + Bootstrap 5
- **Charts:** ECharts, Chart.js, Recharts
- **Maps:** react-simple-maps + TopoJSON
- **Routing:** React Router v7

## Project Structure

```
src/
  App.tsx                   # Routes
  components/               # Shared components (Layout, Header, Footer)
  context/                  # StatsContext (site-wide stats)
  hooks/                    # Custom hooks (useCitizensData, useElitesProfiles)
  pages/
    admin/                  # Admin panel (content management)
    elites/                 # Legislator profiles, data visualizations
    search/                 # Legislator rhetoric search + export
    violence/               # Political violence research
public/data/                # Static JSON data files
scripts/                    # Data processing scripts
```

## Routes

| Route | Page |
|-------|------|
| `/` | Home |
| `/citizens`, `/citizens/values`, `/citizens/international` | Public opinion data |
| `/elites`, `/elites/profiles`, `/elites/profile/:id`, `/elites/data`, `/elites/about` | Legislator data |
| `/search` | Rhetoric search with filters and CSV/JSON export |
| `/reports`, `/report/:slug` | Research reports |
| `/violence` | Political violence research |
| `/data` | Public data downloads |
| `/about`, `/about/support`, `/about/news` | About pages |
| `/admin/*` | Admin panel |

## Backend APIs

All backend APIs live in `../prl-backend/`. Vite dev proxies are configured in `vite.config.ts`:

| API | Config File | Dev Proxy Target |
|-----|-------------|------------------|
| Pulse API | `src/config/api.ts` | API Gateway |
| Search API | `src/pages/search/config.ts` | API Gateway |

## Deployment

Auto-deploys via GitHub Actions on push to `main`. Can also deploy manually:

```bash
./deploy.sh    # Builds, syncs to S3, invalidates CloudFront cache
```

Hosted on S3 + CloudFront CDN. The deploy script excludes admin-managed files:
- `data/mediaMentions.json`, `data/westwood-publications.json`, `news/*` — managed via admin panel
- `data/all-data.zip` — rebuilt via `../prl-backend/scripts/regenerate_all_data_zip.py`
