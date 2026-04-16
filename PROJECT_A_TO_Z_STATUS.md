# Freelancer OS - Project A to Z Status

Last updated: 2026-04-14

## A. Application Overview
Freelancer OS is a monorepo app for freelancer workflow automation:
- React web app (Vite) for dashboard, proposals, templates, analytics, alerts, records, profile.
- Node.js API (Express + Prisma + Redis) for auth, business logic, and persistence.
- Python scraper service (FastAPI + Playwright/httpx) for scraping and browser-based account connect.
- PostgreSQL for primary data and Redis for session/refresh token storage.

## B. Build and Runtime Stack
- Monorepo: pnpm workspaces + Turbo.
- API: TypeScript, Express, Prisma, JWT, Redis, cron jobs.
- Web: React 18, TanStack Query, Zustand, Axios, Tailwind.
- Scraper: FastAPI, httpx, Playwright.

## C. Current Architecture (Ports)
- Web: http://localhost:5173
- API: http://localhost:3001
- Scraper: http://localhost:8001
- Postgres: localhost:5432
- Redis: localhost:6379

## D. Data Model Highlights
Main models in Prisma:
- users
- user_profiles
- proposals
- proposal_templates
- template_components
- project_records
- ai_analyses
- profile_reviews
- alert_configs
- analytics_events
- platform_connections
- oauth_provider_configs
- oauth_app_configs

## E. Environment Requirements
Required core variables:
- DATABASE_URL
- REDIS_URL
- JWT_SECRET
- JWT_REFRESH_SECRET
- CORS_ORIGIN
- SCRAPER_URL

Optional/feature-specific:
- GROQ_API_KEY
- GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
- AWS_* + S3_BUCKET_NAME
- FIREBASE_SERVICE_ACCOUNT

Reference template exists in `.env.example`.

## F. Features Implemented (Completed)
### Auth and Routing
- Signup/login with JWT access and refresh tokens.
- Refresh token rotation via Redis session key.
- Silent refresh on app boot when access token is missing but refresh token exists.
- Auth-aware catch-all route: unknown paths redirect to dashboard (signed-in) or login (guest).
- API interceptor handles 401 and redirects to login when refresh fails.

### User Data Safety
- User/profile writes happen only after authenticated user existence checks.
- Login path includes profile auto-heal if profile row is missing.

### Platform Connection (Browser Login Flow)
- Web calls scraper endpoint to open real Chromium login window.
- Scraper waits for post-login URL and captures cookies.
- API endpoint stores session cookies in `platform_connections`.
- Profile page supports connect/disconnect with status refresh and error messaging.

### Scraping
- Freelancer scraping via HTTP API.
- Upwork scraping with HTTP attempt + Playwright fallback.

## G. Known Major Errors Encountered
1. EADDRINUSE on API port 3001.
2. Playwright Chromium missing.
3. NotImplementedError from subprocess/event loop behavior on Windows.
4. Scraper reload/import path instability during uvicorn reload.
5. Browser login detection timing/URL-matching issues.
6. Freelancer CAPTCHA page incorrectly detected as post-login URL.
7. Playwright browser detected as automation by both platforms.

## H. Error Root Causes and Fixes Applied
### 1) EADDRINUSE :3001
Root cause:
- Multiple `pnpm dev` / turbo / tsx watcher processes started in parallel.

Fix:
- Kill duplicate Node/turbo/tsx runners.
- Start a single backend runner only.

### 2) Chromium Not Installed
Root cause:
- Playwright package present but browser binary missing.

Fix:
- `python -m playwright install chromium`

### 3) Windows Subprocess NotImplementedError
Root cause:
- Async subprocess limitations under certain Windows event loop contexts.

Fix:
- Use `sync_playwright` in a dedicated thread.
- Set Windows Proactor event loop policy in thread before Playwright startup.

### 4) Uvicorn Reload Stale Module Behavior
Root cause:
- Reload worker import path/watch mismatch.

Fix:
- Ensure scraper directory is on `sys.path`.
- Use explicit `reload_dirs=[scraper_dir]`.

### 5) Login Detection Fragility
Root cause:
- URL matching too strict and timing races.

Fixes implemented:
- Broader post-login URL logic.
- Navigation-event listener plus polling fallback.
- Extended post-login wait to allow cookie persistence.
- Added runtime logs and visible in-page status badge.

### 6) Freelancer CAPTCHA Page False Positive
Root cause:
- `_is_post_login` only blocked `/login` and `/signup` paths.
- Freelancer CAPTCHA/challenge URLs (`/captcha`, `/challenges`, `/verification`,
  `/security-check`) contain neither, so the function returned `True` while
  the user was still on the challenge page — app thought login succeeded.

Fix:
- Replaced single `has_login_page` check with two explicit lists per platform:
  `_AUTH_FLOW_FRAGMENTS` (URLs where we must keep waiting) and
  `_POST_LOGIN_CONFIRMED` (URLs that confirm success).
- Three-stage logic: reject if auth-flow fragment present → accept if
  post-login fragment present → fallback: on domain and not auth-flow.

### 7) Playwright Automation Detection / CAPTCHA Loop
Root cause:
- Browser launched with minimal stealth (only `navigator.webdriver` spoof).
- Missing: plugin list, `window.chrome`, WebGL vendor, screen dimensions,
  `navigator.hardwareConcurrency`, `deviceMemory` — all bot-detection signals.

Fix:
- Added `STEALTH_INIT_SCRIPT` injected into every context via `add_init_script`.
- Added `playwright-stealth==1.0.6` to requirements.txt for enhanced stealth
  (applied first; manual script used as fallback if lib unavailable).
- Extended Chromium launch args: `--disable-infobars`, `--lang=en-US`,
  `--disable-features=IsolateOrigins`, etc.
- Added session persistence: after first successful login, `storage_state` is
  saved to `.sessions/{platform}_session.json`. On next connect, the saved
  state is loaded — platform sees an existing session and skips CAPTCHA.
- Added `DELETE /auth/browser-connect/{platform}/session` endpoint to clear
  the saved session when the user wants a clean login.

## I. Current Health Snapshot
Verified recently:
- API health endpoint returned 200.
- Scraper health endpoint returned 200.
- API on 3001 can run cleanly when only one instance is active.

Operational risk still present:
- Starting multiple dev sessions can reintroduce port conflicts.

## J. Job Schedulers
API starts recurring jobs:
- Expiry job daily at 00:00 UTC.
- Timezone-based alert jobs.

## K. Key API Flows
- Auth: signup, login, refresh, logout, me.
- Users: profile read/update, stats.
- Connections: status, OAuth start/callback, browser session store, disconnect.
- Scraper API: scrape search and browser-connect routes.

## L. Local Run Guide (Recommended)
1. Start infra first:
   - `docker-compose up -d postgres redis`
2. Start backend only (single terminal):
   - `pnpm --filter @freelancer-os/api dev`
3. Start web only (second terminal):
   - `pnpm --filter @freelancer-os/web dev`
4. Start scraper (third terminal):
   - `cd apps/scraper`
   - `python api.py`
5. Verify health:
   - API: `http://localhost:3001/health`
   - Scraper: `http://localhost:8001/health`

## M. Monorepo Commands
- Root dev: `pnpm dev`
- API only: `pnpm --filter @freelancer-os/api dev`
- Web only: `pnpm --filter @freelancer-os/web dev`
- Build all: `pnpm build`
- Typecheck all: `pnpm typecheck`

## N. Notable Integration Details
- Web talks to API via Vite proxy `/api -> :3001`.
- Web talks to scraper via Vite proxy `/scraper-api -> :8001`.
- Scraper connect request timeout on web is long (6 minutes) for manual login.

## O. Outstanding/Watch Items
- Continue monitoring browser connect completion for both platforms in real user sessions.
- Ensure profile username extraction selectors remain valid if platform DOM changes.
- Keep process hygiene to avoid duplicate backend starts.

## O2. Recent Implementation (2026-04-14)

### Platform Login Fix — Browser-Connect Flow
- **Problem**: OAuth authorize URL returned "Page Not Found" due to OAuth app not being registered on platforms.
- **Fix**: Added `POST /api/v1/connections/:platform/browser-connect` endpoint in `apps/api/src/routes/connections.ts`.
  - Calls Python scraper's `POST /auth/browser-connect/{platform}` (6-min timeout).
  - Receives session cookies + username/email back from scraper.
  - Stores serialized cookies as the encrypted access token in `platform_connections`.
- **Profile page** (`apps/web/src/pages/Profile.tsx`): Connect button now calls `connectionsApi.browserConnect(platform)` directly — no OAuth popup needed.
- **api.ts**: Added `browserConnect(platform)` to `connectionsApi` with 6-min timeout.
- User sees "A browser window has opened on your machine..." while waiting.

### Sidebar Scrolling Fix
- **Layout.tsx**: Changed root div to `h-screen overflow-hidden` so sidebar never scrolls with page content.
- **Sidebar.tsx**: Changed `min-h-screen` → `h-full flex-shrink-0 overflow-y-auto`.

### Scraper Page Overhaul (`apps/web/src/pages/Scraper.tsx`)
- **Filter panel** (click Filters button):
  - Platform, Max Proposals, Min Client Rating dropdowns
  - Include Keywords / Exclude Keywords (comma-separated, matches title+description)
  - Client Verification checkboxes: Identity Verified, Payment Verified, Deposit Made, Profile Completed
  - Verification flags are forwarded to the scraper search payload
- **Refresh button**: Re-runs the last search without re-typing the query.
- **Pagination**: Page-number based (10 per page), replaces load-more. Shows page N of M + prev/next buttons.
- **Project card action buttons** (4 buttons per card):
  - **View**: Opens project URL in new tab (existing)
  - **Analyze**: Navigates to `/ai-analyze` with project pre-filled
  - **Quick**: Inline AI analysis (existing quick result in-card)
  - **Save**: Saves/unsaves project to left saved-projects panel (localStorage)
  - **Bid**: Marks project as bid — hides it from all results permanently
- **Saved Projects Panel**: Left-side collapsible panel (toggle via "Saved" button in header).
  - Shows all saved projects with Open / Analyze / Remove buttons.
  - Persists in `localStorage` under `fos_savedProjects`.
- **Bid history**: Hidden projects stored in `localStorage` under `fos_biddedIds`. Reset button available.
- **Client rating display**: Now shown on project cards (star rating).

### AI Analyze Page (`apps/web/src/pages/AIAnalyze.tsx`)
- Now reads React Router `location.state.project` when navigated from Scraper.
- Auto-fills `projectTitle`, `projectDescription`, `clientCountry` from the selected project.
- User can immediately click "Analyze Project" without re-typing anything.

## P. Process Hygiene Checklist
Before starting new dev servers:
- Confirm no old listeners on 3001/5173/8001.
- Avoid running root `pnpm dev` in multiple terminals.
- Prefer split commands (api/web/scraper separately) during debugging.

## Q. Quick Troubleshooting Commands (Windows)
Check port owner:
- `netstat -ano | findstr :3001`

Find project node processes:
- `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'Freelancer-os' } | Select-Object ProcessId, CommandLine`

Kill one process:
- `taskkill /PID <PID> /F`

Install Playwright Chromium:
- `python -m playwright install chromium`

## R. Recent Functional Outcome
- Browser can reach post-login Upwork URLs (for example `/nx/proposals/...?...`).
- This indicates credentials entry and platform login itself are succeeding.
- Any remaining failure is usually backend availability/process duplication, not user login credentials.

## S. Security Notes
- Do not commit real secrets to git.
- Replace placeholder JWT/OAuth keys before production.
- Store production secrets in managed secret storage.

## T. Testing Status (Practical)
Manual validation performed:
- API startup and health.
- Scraper startup and health.
- Browser opening for platform login.
- Port conflict diagnosis and recovery.

Automated tests:
- No dedicated end-to-end test pipeline documented in this status file.

## U. User-Facing Pages Present
- Dashboard
- Proposals
- Builder
- Templates
- AI Analyze
- Records
- Alerts
- Analytics
- Profile
- Scraper
- Settings
- Login/Signup

## V. Versioning and Tooling
- pnpm workspace with Turbo.
- TypeScript across API and web.
- Prisma migrations present for OAuth/platform connection models.

## W. What Is Done vs Pending
Done:
- Core auth flow hardening.
- Catch-all routing behavior.
- Browser-based platform connect integration.
- Session store endpoint and DB write path.
- Major Windows Playwright runtime fixes.
- Repeated backend port-conflict remediation.

Pending/monitor:
- Long-session reliability validation for both platforms under repeated connects.
- Add permanent process-management strategy to prevent duplicate `pnpm dev` starts.

## X. eXit Criteria for Stable Daily Use
System can be considered stable for daily local use when:
- One API process remains on 3001 with no EADDRINUSE crashes.
- Scraper stays healthy on 8001.
- Platform connect succeeds repeatedly and updates connection status in Profile.

## Y. Why Failures Happened Most Often
- Simultaneous duplicate dev commands created competing listeners.
- Runtime complexity from mixed Node + Python + browser automation in Windows dev environment.

## Z. Zero-Guess Recovery Playbook
If things break, do this exactly:
1. Stop duplicate Node processes using port/process commands above.
2. Start infra (`postgres`, `redis`).
3. Start API only and confirm `/health`.
4. Start scraper and confirm `/health`.
5. Start web only.
6. Retry platform connect from Profile.

---

## Appendix: Practical Current Recommendation
For debugging, avoid root `pnpm dev` until everything is stable. Use three separate terminals:
- API only
- Web only
- Scraper only

This keeps failures isolated and prevents hidden duplicate watchers.
