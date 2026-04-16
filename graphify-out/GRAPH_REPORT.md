# Graph Report - d:/Freelancer-os  (2026-04-15)

## Corpus Check
- Corpus is ~34,052 words - fits in a single context window. You may not need a graph.

## Summary
- 280 nodes · 253 edges · 73 communities detected
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.84)
- Token cost: 7,200 input · 3,800 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Blueprint Core Features|Blueprint Core Features]]
- [[_COMMUNITY_Browser Connect & Session|Browser Connect & Session]]
- [[_COMMUNITY_Scraper Python Dependencies|Scraper Python Dependencies]]
- [[_COMMUNITY_OAuth Token Management|OAuth Token Management]]
- [[_COMMUNITY_UI Utility Functions|UI Utility Functions]]
- [[_COMMUNITY_Scraper Page & Search|Scraper Page & Search]]
- [[_COMMUNITY_AI & LLM Integration|AI & LLM Integration]]
- [[_COMMUNITY_Firebase Settings & Messaging|Firebase Settings & Messaging]]
- [[_COMMUNITY_API Client & Profile|API Client & Profile]]
- [[_COMMUNITY_Alert Scheduling (Cron)|Alert Scheduling (Cron)]]
- [[_COMMUNITY_Templates Page|Templates Page]]
- [[_COMMUNITY_Firebase Service Layer|Firebase Service Layer]]
- [[_COMMUNITY_Proposal References & Builder|Proposal References & Builder]]
- [[_COMMUNITY_Proposals Page|Proposals Page]]
- [[_COMMUNITY_Alerts Page|Alerts Page]]
- [[_COMMUNITY_Auth Middleware|Auth Middleware]]
- [[_COMMUNITY_Request Validation|Request Validation]]
- [[_COMMUNITY_AI Analyze Page|AI Analyze Page]]
- [[_COMMUNITY_Records Page|Records Page]]
- [[_COMMUNITY_Button Component|Button Component]]
- [[_COMMUNITY_Loading Spinners|Loading Spinners]]
- [[_COMMUNITY_Mobile & State Strategy|Mobile & State Strategy]]
- [[_COMMUNITY_JWT Token Generation|JWT Token Generation]]
- [[_COMMUNITY_Proposal Expiry|Proposal Expiry]]
- [[_COMMUNITY_App Root & Auth Guard|App Root & Auth Guard]]
- [[_COMMUNITY_App Layout|App Layout]]
- [[_COMMUNITY_Sidebar Navigation|Sidebar Navigation]]
- [[_COMMUNITY_Analytics Page|Analytics Page]]
- [[_COMMUNITY_Dashboard Page|Dashboard Page]]
- [[_COMMUNITY_Login Page|Login Page]]
- [[_COMMUNITY_Signup Page|Signup Page]]
- [[_COMMUNITY_Alert UI Component|Alert UI Component]]
- [[_COMMUNITY_Badge Component|Badge Component]]
- [[_COMMUNITY_Card Component|Card Component]]
- [[_COMMUNITY_Input Component|Input Component]]
- [[_COMMUNITY_Modal Component|Modal Component]]
- [[_COMMUNITY_Login Detection Logic|Login Detection Logic]]
- [[_COMMUNITY_Windows Playwright Fix|Windows Playwright Fix]]
- [[_COMMUNITY_Database Schema Design|Database Schema Design]]
- [[_COMMUNITY_Express App Entry|Express App Entry]]
- [[_COMMUNITY_Prisma Client|Prisma Client]]
- [[_COMMUNITY_AI Routes|AI Routes]]
- [[_COMMUNITY_Alert Routes|Alert Routes]]
- [[_COMMUNITY_Analytics Routes|Analytics Routes]]
- [[_COMMUNITY_Server Entry|Server Entry]]
- [[_COMMUNITY_Push Notification Routes|Push Notification Routes]]
- [[_COMMUNITY_Records Routes|Records Routes]]
- [[_COMMUNITY_Scraper Routes|Scraper Routes]]
- [[_COMMUNITY_Templates Routes|Templates Routes]]
- [[_COMMUNITY_Users Routes|Users Routes]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]
- [[_COMMUNITY_Vite Config|Vite Config]]
- [[_COMMUNITY_Firebase Service Worker|Firebase Service Worker]]
- [[_COMMUNITY_React Entry|React Entry]]
- [[_COMMUNITY_OAuth Callback Page|OAuth Callback Page]]
- [[_COMMUNITY_Auth Store (Zustand)|Auth Store (Zustand)]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Tailwind Preset|Tailwind Preset]]
- [[_COMMUNITY_Shared Constants|Shared Constants]]
- [[_COMMUNITY_Packages Index|Packages Index]]
- [[_COMMUNITY_Shared Schemas|Shared Schemas]]
- [[_COMMUNITY_Shared Types|Shared Types]]
- [[_COMMUNITY_Empty State Component|Empty State Component]]
- [[_COMMUNITY_UI Package Index|UI Package Index]]
- [[_COMMUNITY_Select Component|Select Component]]
- [[_COMMUNITY_Port Conflict Error|Port Conflict Error]]
- [[_COMMUNITY_Playwright Setup Error|Playwright Setup Error]]
- [[_COMMUNITY_Uvicorn Reload Issue|Uvicorn Reload Issue]]
- [[_COMMUNITY_Login Detection Fragility|Login Detection Fragility]]
- [[_COMMUNITY_Python Dotenv|Python Dotenv]]
- [[_COMMUNITY_TanStack Query|TanStack Query]]
- [[_COMMUNITY_Tailwind CSS (Web)|Tailwind CSS (Web)]]

## God Nodes (most connected - your core abstractions)
1. `Freelancer Work Management Application (Blueprint)` - 12 edges
2. `Python Scraper Service (FastAPI + Playwright)` - 7 edges
3. `AI-Based Project Analysis (GPT-4)` - 6 edges
4. `ScrapedProject` - 5 edges
5. `scrape_upwork()` - 5 edges
6. `scrape_upwork_playwright()` - 5 edges
7. `Freelancer OS Project` - 5 edges
8. `Auth & Users Module` - 5 edges
9. `encryptIfNeeded()` - 4 edges
10. `getFirebaseApp()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `JWT Access + Refresh Token Auth` --semantically_similar_to--> `Auth & Users Module`  [INFERRED] [semantically similar]
  PROJECT_A_TO_Z_STATUS.md → freelancer-blueprint (1).pdf
- `pnpm Workspaces + Turbo (Monorepo)` --semantically_similar_to--> `Monorepo Layout (pnpm workspaces / Turborepo)`  [INFERRED] [semantically similar]
  PROJECT_A_TO_Z_STATUS.md → freelancer-blueprint (1).pdf
- `AI Analyze Page (apps/web/src/pages/AIAnalyze.tsx)` --semantically_similar_to--> `AI-Based Project Analysis (GPT-4)`  [INFERRED] [semantically similar]
  PROJECT_A_TO_Z_STATUS.md → freelancer-blueprint (1).pdf
- `API Cron Jobs (Expiry + Alerts)` --semantically_similar_to--> `Event-Driven Alert Engine (cron + FCM)`  [INFERRED] [semantically similar]
  PROJECT_A_TO_Z_STATUS.md → freelancer-blueprint (1).pdf
- `Freelancer OS Project` --implements--> `Freelancer Work Management Application (Blueprint)`  [INFERRED]
  PROJECT_A_TO_Z_STATUS.md → freelancer-blueprint (1).pdf

## Hyperedges (group relationships)
- **Scraper Service Python Dependencies** — status_scraper_service, req_fastapi, req_uvicorn, req_httpx, req_beautifulsoup4, req_lxml, req_python_dotenv, req_playwright, req_playwright_stealth [EXTRACTED 1.00]
- **Freelancer OS Core Services** — status_web_app, status_api_service, status_scraper_service, status_postgresql, status_redis [EXTRACTED 1.00]
- **Playwright Automation Detection Fix Cluster** — status_automation_detection, status_stealth_fix, req_playwright_stealth, req_playwright [INFERRED 0.88]
- **AI Integration and Analysis Cluster** — bp_ai_analysis, bp_profile_analysis, bp_openai_gpt4, bp_gpt4_prompt_engineering, bp_redis_cache_rationale, status_ai_analyze_page [INFERRED 0.87]
- **Blueprint Core Feature Modules** — bp_auth_module, bp_timezone_alerts, bp_proposal_builder, bp_ai_analysis, bp_profile_analysis, bp_records_tracking, bp_file_storage, bp_analytics_dashboard [EXTRACTED 1.00]

## Communities

### Community 0 - "Blueprint Core Features"
Cohesion: 0.08
Nodes (33): Rationale: 7-Day TTL on Proposals and Files, AI-Based Project Analysis (GPT-4), Event-Driven Alert Engine (cron + FCM), Analytics Dashboard, Rationale: analytics_events as Append-Only Event Log, Auth & Users Module, AWS S3 (Object Storage), Cost Estimates (~$30-70/month Solo User) (+25 more)

### Community 1 - "Browser Connect & Session"
Cohesion: 0.12
Nodes (22): browser_connect(), BrowserConnectResponse, clear_session(), _extract_username(), _is_post_login(), Freelancer OS — Project Scraper Service Runs on port 8001. Scrapes Upwork and Fr, Hits Upwork's search API endpoint.     Falls back to Playwright if anti-bot bloc, Fallback using a real browser when HTTP scraping is blocked. (+14 more)

### Community 2 - "Scraper Python Dependencies"
Cohesion: 0.1
Nodes (23): BeautifulSoup4 (HTML Parser), FastAPI, httpx (Async HTTP Client), lxml (XML/HTML Parser), Playwright (Browser Automation), playwright-stealth (Bot Detection Bypass), Uvicorn (ASGI Server), Node.js API Service (Express + Prisma + Redis) (+15 more)

### Community 3 - "OAuth Token Management"
Cohesion: 0.14
Nodes (10): decryptToken(), getOAuthConfig(), parsePlatform(), upsertConnection(), decrypt(), encrypt(), encryptIfNeeded(), getKey() (+2 more)

### Community 4 - "UI Utility Functions"
Cohesion: 0.15
Nodes (2): isWithinWindow(), timeToMinutes()

### Community 5 - "Scraper Page & Search"
Cohesion: 0.15
Nodes (2): markBidded(), unsaveProject()

### Community 6 - "AI & LLM Integration"
Cohesion: 0.22
Nodes (3): analyzeProject(), hashText(), setCache()

### Community 7 - "Firebase Settings & Messaging"
Cohesion: 0.27
Nodes (5): getFirebaseMessaging(), isFirebaseConfigured(), onForegroundMessage(), registerPushNotifications(), handleEnablePush()

### Community 8 - "API Client & Profile"
Cohesion: 0.22
Nodes (2): getApiErrorMessage(), startBrowserConnect()

### Community 9 - "Alert Scheduling (Cron)"
Cohesion: 0.32
Nodes (5): getUTCCronForCountry(), scheduleCountryAlerts(), startAlertJobs(), startExpiryJob(), main()

### Community 10 - "Templates Page"
Cohesion: 0.29
Nodes (0): 

### Community 11 - "Firebase Service Layer"
Cohesion: 0.7
Nodes (4): getFirebaseApp(), isFirebaseEnabled(), sendPushNotification(), sendPushToMany()

### Community 12 - "Proposal References & Builder"
Cohesion: 0.4
Nodes (0): 

### Community 13 - "Proposals Page"
Cohesion: 0.4
Nodes (0): 

### Community 14 - "Alerts Page"
Cohesion: 0.5
Nodes (0): 

### Community 15 - "Auth Middleware"
Cohesion: 0.67
Nodes (0): 

### Community 16 - "Request Validation"
Cohesion: 0.67
Nodes (0): 

### Community 17 - "AI Analyze Page"
Cohesion: 0.67
Nodes (0): 

### Community 18 - "Records Page"
Cohesion: 0.67
Nodes (0): 

### Community 19 - "Button Component"
Cohesion: 0.67
Nodes (0): 

### Community 20 - "Loading Spinners"
Cohesion: 0.67
Nodes (0): 

### Community 21 - "Mobile & State Strategy"
Cohesion: 0.67
Nodes (3): Rationale: Stack Chosen to Maximize Code Reuse Web/Mobile, React Native (Mobile Framework), Zustand (State Management)

### Community 22 - "JWT Token Generation"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Proposal Expiry"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "App Root & Auth Guard"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "App Layout"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Sidebar Navigation"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Analytics Page"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Dashboard Page"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Login Page"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Signup Page"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Alert UI Component"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Badge Component"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Card Component"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Input Component"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Modal Component"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Login Detection Logic"
Cohesion: 1.0
Nodes (2): AUTH_FLOW_FRAGMENTS / POST_LOGIN_CONFIRMED URL Logic, Freelancer CAPTCHA Page False Positive

### Community 37 - "Windows Playwright Fix"
Cohesion: 1.0
Nodes (2): sync_playwright in Dedicated Thread (Windows Fix), Windows Subprocess NotImplementedError

### Community 38 - "Database Schema Design"
Cohesion: 1.0
Nodes (2): Database Schema Design (PostgreSQL), Rationale: JSONB for AI Output and Template Components

### Community 39 - "Express App Entry"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Prisma Client"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "AI Routes"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Alert Routes"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Analytics Routes"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Server Entry"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Push Notification Routes"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Records Routes"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Scraper Routes"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Templates Routes"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Users Routes"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "PostCSS Config"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Tailwind Config"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Vite Config"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Firebase Service Worker"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "React Entry"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "OAuth Callback Page"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Auth Store (Zustand)"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "ESLint Config"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Tailwind Preset"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Shared Constants"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Packages Index"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Shared Schemas"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Shared Types"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Empty State Component"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "UI Package Index"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Select Component"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Port Conflict Error"
Cohesion: 1.0
Nodes (1): EADDRINUSE Port 3001 Error

### Community 67 - "Playwright Setup Error"
Cohesion: 1.0
Nodes (1): Playwright Chromium Binary Missing Error

### Community 68 - "Uvicorn Reload Issue"
Cohesion: 1.0
Nodes (1): Uvicorn Reload Stale Module Behavior

### Community 69 - "Login Detection Fragility"
Cohesion: 1.0
Nodes (1): Login Detection Fragility (Timing/URL Race)

### Community 70 - "Python Dotenv"
Cohesion: 1.0
Nodes (1): python-dotenv (Env Variables)

### Community 71 - "TanStack Query"
Cohesion: 1.0
Nodes (1): TanStack Query (Data Fetching)

### Community 72 - "Tailwind CSS (Web)"
Cohesion: 1.0
Nodes (1): Tailwind CSS (Web Styling)

## Knowledge Gaps
- **35 isolated node(s):** `Freelancer OS — Project Scraper Service Runs on port 8001. Scrapes Upwork and Fr`, `Hits Upwork's search API endpoint.     Falls back to Playwright if anti-bot bloc`, `Fallback using a real browser when HTTP scraping is blocked.`, `Return True only when the browser URL clearly indicates a completed login.`, `Launch args that reduce Chromium's automation footprint.` (+30 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `JWT Token Generation`** (2 nodes): `generateTokens()`, `auth.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Proposal Expiry`** (2 nodes): `proposals.ts`, `expiresAt()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Root & Auth Guard`** (2 nodes): `AuthInitializer()`, `App.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Layout`** (2 nodes): `Layout.tsx`, `Layout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sidebar Navigation`** (2 nodes): `Sidebar.tsx`, `handleLogout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Analytics Page`** (2 nodes): `heatColor()`, `Analytics.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dashboard Page`** (2 nodes): `Dashboard.tsx`, `getGreeting()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Login Page`** (2 nodes): `Login.tsx`, `onSubmit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Signup Page`** (2 nodes): `Signup.tsx`, `onSubmit()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Alert UI Component`** (2 nodes): `Alert()`, `Alert.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Badge Component`** (2 nodes): `Badge()`, `Badge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Card Component`** (2 nodes): `Card()`, `Card.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Input Component`** (2 nodes): `Input.tsx`, `clsx()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Modal Component`** (2 nodes): `Modal.tsx`, `Modal()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Login Detection Logic`** (2 nodes): `AUTH_FLOW_FRAGMENTS / POST_LOGIN_CONFIRMED URL Logic`, `Freelancer CAPTCHA Page False Positive`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Windows Playwright Fix`** (2 nodes): `sync_playwright in Dedicated Thread (Windows Fix)`, `Windows Subprocess NotImplementedError`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Database Schema Design`** (2 nodes): `Database Schema Design (PostgreSQL)`, `Rationale: JSONB for AI Output and Template Components`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Express App Entry`** (1 nodes): `app.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Prisma Client`** (1 nodes): `prisma.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `AI Routes`** (1 nodes): `ai.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Alert Routes`** (1 nodes): `alerts.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Analytics Routes`** (1 nodes): `analytics.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Server Entry`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Push Notification Routes`** (1 nodes): `notifications.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Records Routes`** (1 nodes): `records.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Scraper Routes`** (1 nodes): `scraper.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Templates Routes`** (1 nodes): `templates.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Users Routes`** (1 nodes): `users.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PostCSS Config`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tailwind Config`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vite Config`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Firebase Service Worker`** (1 nodes): `firebase-messaging-sw.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `React Entry`** (1 nodes): `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `OAuth Callback Page`** (1 nodes): `OAuthCallback.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Store (Zustand)`** (1 nodes): `authStore.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ESLint Config`** (1 nodes): `eslint.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tailwind Preset`** (1 nodes): `tailwind.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shared Constants`** (1 nodes): `constants.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Packages Index`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shared Schemas`** (1 nodes): `schemas.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Shared Types`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Empty State Component`** (1 nodes): `EmptyState.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Package Index`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Select Component`** (1 nodes): `Select.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Port Conflict Error`** (1 nodes): `EADDRINUSE Port 3001 Error`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Playwright Setup Error`** (1 nodes): `Playwright Chromium Binary Missing Error`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Uvicorn Reload Issue`** (1 nodes): `Uvicorn Reload Stale Module Behavior`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Login Detection Fragility`** (1 nodes): `Login Detection Fragility (Timing/URL Race)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Python Dotenv`** (1 nodes): `python-dotenv (Env Variables)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `TanStack Query`** (1 nodes): `TanStack Query (Data Fetching)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tailwind CSS (Web)`** (1 nodes): `Tailwind CSS (Web Styling)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Freelancer Work Management Application (Blueprint)` connect `Blueprint Core Features` to `Scraper Python Dependencies`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `Freelancer OS Project` connect `Scraper Python Dependencies` to `Blueprint Core Features`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `Freelancer OS — Project Scraper Service Runs on port 8001. Scrapes Upwork and Fr`, `Hits Upwork's search API endpoint.     Falls back to Playwright if anti-bot bloc`, `Fallback using a real browser when HTTP scraping is blocked.` to the rest of the system?**
  _35 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Blueprint Core Features` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Browser Connect & Session` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Scraper Python Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `OAuth Token Management` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._