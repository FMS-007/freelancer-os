# Freelancer OS

Freelancer OS is a monorepo for freelancer workflow automation.

## What’s inside

- `apps/web`: React + Vite dashboard for proposals, templates, analytics, alerts, records, profile, and settings
- `apps/api`: Express + Prisma API for auth, persistence, business logic, and scheduled jobs
- `apps/scraper`: FastAPI + Playwright Python service for browser-based scraping and account connection flows
- `packages/shared`: shared types, schemas, and constants
- `packages/ui`: reusable UI components

## Tech Stack

- pnpm workspaces
- Turbo
- React 18, Vite, Tailwind CSS
- Express, Prisma, Redis, JWT
- FastAPI, Playwright, httpx

## Prerequisites

- Node.js 20+ recommended
- pnpm
- Python 3.11+ for the scraper service
- PostgreSQL
- Redis

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create your environment file:

```bash
cp .env.example .env
```

3. Fill in the required values in `.env`.

4. Generate Prisma client and apply migrations:

```bash
pnpm --filter @freelancer-os/api prisma:generate
pnpm --filter @freelancer-os/api prisma:migrate
```

## Development

Run all apps:

```bash
pnpm dev
```

Run only the API:

```bash
pnpm dev:api
```

Run only the web app:

```bash
pnpm dev:web
```

## Build

```bash
pnpm build
```

## Useful Commands

- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter @freelancer-os/api prisma:studio`

## Environment

The main app expects variables such as:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN`
- `SCRAPER_URL`

Optional integrations may also use:

- `GROQ_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AWS_*`
- `FIREBASE_SERVICE_ACCOUNT`

## Notes

- The scraper service has its own Python dependencies in `apps/scraper/requirements.txt`
- `graphify-out/` contains generated analysis output and is safe to ignore locally

## License

MIT
