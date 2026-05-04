# FreelancerOS — Complete System Documentation

> **Version:** 1.0  |  **Last Updated:** 2026-04-28  |  **Author:** Engineering Team

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Features & Functionalities](#4-features--functionalities)
5. [Core Logic & Workflows](#5-core-logic--workflows)
6. [Database Design](#6-database-design)
7. [API Design](#7-api-design)
8. [Implementation Details](#8-implementation-details)
9. [Recent Changes (Last 10 Days)](#9-recent-changes-last-10-days)
10. [Current System State](#10-current-system-state)
11. [Challenges & Fixes](#11-challenges--fixes)
12. [Future Improvements](#12-future-improvements)

---

## 1. Project Overview

### Project Name
**FreelancerOS** — Freelancer Automation Operating System

### Purpose
FreelancerOS is a full-stack automation platform that helps independent freelancers systematically discover, filter, analyze, and respond to project listings on Upwork and Freelancer.com. It replaces the manual habit of checking job boards by running a scheduled scraping engine that silently collects matching opportunities and surfaces only the highest-quality leads.

### Target Users
- Independent software developers, designers, and writers who actively bid on Upwork and Freelancer.com
- Freelancers who submit 5–30+ proposals per week and need to optimize their discovery pipeline
- Power users who want data-driven decision support (AI analysis, win-rate analytics, proposal templates)

### Core Problem Being Solved
Freelancers waste 1–3 hours per day manually searching job boards, reading irrelevant listings, and copy-pasting proposals. The platform automates the full discovery-to-proposal pipeline:

1. **Discovery** — Scrapes platforms on a schedule using a real browser session (bypasses CAPTCHAs)
2. **Filtering** — Drops low-quality listings based on client verification, rating, reviews, keywords, and budget
3. **Analysis** — AI evaluates each project against the freelancer's profile and suggests a bid strategy
4. **Proposal** — Pre-built template system with AI-assisted generation outputs ready-to-send proposals

### Key Value Proposition
- Zero manual searching: extension scrapes in the background every N minutes
- Real signal vs. noise: strict multi-layer filtering eliminates ~90 % of irrelevant listings
- Proposal velocity: AI analysis + template system reduces proposal writing from 20 min to 3 min
- Full history: every scraped project, proposal, and outcome is persisted for pattern analysis

---

## 2. System Architecture

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     BROWSER LAYER                            │
│                                                              │
│  ┌─────────────────────────────┐                            │
│  │   Chrome Extension (MV3)    │                            │
│  │  ┌──────────┐ ┌──────────┐  │                            │
│  │  │ popup.js │ │background│  │                            │
│  │  └──────────┘ │   .js    │  │                            │
│  │               │ (service │  │                            │
│  │  scrapers/    │  worker) │  │                            │
│  │  ├─upwork.js  └──────────┘  │                            │
│  │  └─freelancer.js            │                            │
│  └──────────┬──────────────────┘                            │
│             │  content-scripts/app-bridge.js                │
│  ┌──────────▼──────────────────┐                            │
│  │   React Frontend (Vite)     │  ←── localhost:5173        │
│  │  Automation / Find Projects │                            │
│  │  Dashboard / AI / Analytics │                            │
│  └──────────┬──────────────────┘                            │
└─────────────┼────────────────────────────────────────────────┘
              │ REST API (Axios + JWT Bearer)
              ▼
┌──────────────────────────────────────────────────────────────┐
│                    BACKEND LAYER                             │
│                                                              │
│  ┌──────────────────────────┐   ┌──────────────────────┐    │
│  │  Node.js/Express API     │   │  Python Scraper API  │    │
│  │  localhost:3001           │   │  localhost:8001       │    │
│  │  ─ Auth (JWT + Firebase) │   │  ─ Upwork DOM         │    │
│  │  ─ Scraper routes        │◄──│  ─ Freelancer DOM     │    │
│  │  ─ AI routes (Groq)      │   │  (fallback only)      │    │
│  │  ─ Proposals/Templates   │   └──────────────────────┘    │
│  │  ─ Analytics/Records     │                               │
│  └──────────┬───────────────┘                               │
│             │                                               │
│  ┌──────────▼───────────────┐   ┌──────────────────────┐    │
│  │  PostgreSQL (Prisma ORM) │   │  Redis (ioredis)     │    │
│  │  ─ Users / Proposals     │   │  ─ Session cache     │    │
│  │  ─ Templates / Records   │   │  ─ Scrape results    │    │
│  │  ─ Analytics / Alerts    │   │  ─ Auto-run log      │    │
│  └──────────────────────────┘   └──────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────────┐
│                 EXTERNAL SERVICES                            │
│  ─ Firebase Auth (Google SSO, email verification)           │
│  ─ Groq API (LLaMA 3 / Mixtral — AI analysis)              │
│  ─ Upwork RSS Feed (public, no auth required)               │
│  ─ Freelancer.com REST API v0.1 (session cookies)           │
└──────────────────────────────────────────────────────────────┘
```

### Components Breakdown

| Component | Location | Purpose |
|---|---|---|
| Chrome Extension | `apps/extension/` | Primary scraping engine; single source of truth for all automation state |
| React Frontend | `apps/web/` | Dashboard and all UI pages |
| Node.js API | `apps/api/` | Business logic, auth, persistence, AI proxy |
| Python Scraper | `apps/scraper/` | Fallback DOM-based scraper (used when extension is absent) |
| PostgreSQL | Hosted / local | Permanent storage for all user data |
| Redis | Local / hosted | Short-TTL cache for scrape results; auto-run log queue |

### Extension Is The Source Of Truth

The Chrome extension owns all automation state: keywords, platform, schedule, filters, ON/OFF toggle. The web app reads this state on mount and mirrors it. Changes in the web app are written back to extension storage. Changes in the extension popup propagate forward to the web app via DOM events. **Neither side maintains independent state** — all truth lives in `chrome.storage.local`.

### Data Flow

```
Extension scrapes (alarm fires every N min)
    │
    ▼
applyFilters() in background.js
  [keyword text match + 24h freshness + verification + rating + reviews]
    │
    ▼
POST /api/v1/scraper/extension-results  ← Find Projects cache (10 min TTL)
POST /api/v1/scraper/auto-results       ← Automation page feed  (24h TTL)
    │
    ▼
Redis stores:
  ext-results:{userId}:{platform}:{query}
  auto-projects:{userId}
  auto-log:{userId}
    │
    ▼
Frontend polls GET /api/v1/scraper/auto-results every 10s
    │
    ▼
matchesConfig() — optional extra filters (tech stack, budget, proposals)
    │
    ▼
Project cards render in Automation page right panel
```

---

## 3. Tech Stack

### Frontend — `apps/web/`

| Technology | Version | Why |
|---|---|---|
| React 18 | ^18 | Component model, concurrent features, hooks |
| TypeScript | ^5 | Type safety across shared types with backend |
| Vite | ^5 | Sub-second HMR during development |
| TanStack Query v5 | ^5 | Server-state management, polling, cache invalidation |
| Zustand | ^4 | Auth state (access/refresh tokens) — minimal boilerplate |
| React Router v6 | ^6 | Client-side routing |
| Axios | ^1 | HTTP client with interceptors for token refresh |
| Tailwind CSS | ^3 | Utility-first styling, consistent design tokens |
| Lucide React | ^0.3 | Icon set |
| clsx | ^2 | Conditional class name merging |

**Why TanStack Query over SWR or raw `useEffect`**: Built-in polling (`refetchInterval`), query invalidation on demand (`queryClient.invalidateQueries`), stale-while-revalidate semantics, and background refetch on window focus — all without manual state management.

**Why Zustand for auth vs. Redux**: Auth state is simple (two tokens + user object). Zustand's `getState()` method is callable outside React components, which is essential for the Axios interceptor that reads the access token on every request.

### Backend — `apps/api/`

| Technology | Why |
|---|---|
| Node.js + TypeScript | Type-safe API server; shares `@freelancer-os/shared` types with frontend |
| Express.js | Minimal, composable middleware chain |
| Prisma ORM | Type-safe DB access, automatic migrations, excellent TypeScript integration |
| PostgreSQL | Relational data with complex joins (proposals ↔ templates ↔ records) |
| Redis (ioredis) | Sub-millisecond cache reads; TTL-based expiry; list operations for log queues |
| JWT (jsonwebtoken) | Stateless auth; access token (15 min) + refresh token (30 days) |
| Firebase Admin SDK | Email verification, Google OAuth, token validation |
| Groq SDK | LLaMA 3 / Mixtral inference for proposal analysis (low latency, free tier) |
| Helmet | Security headers |
| express-rate-limit | Per-endpoint rate limiting (500 req/15 min general; 15 req/min on auth) |
| Zod (via shared package) | Request body validation schemas |

### Chrome Extension — `apps/extension/`

| Technology | Why |
|---|---|
| Manifest V3 | Current Chrome extension standard; service worker instead of background page |
| Service Worker | `importScripts()` loads scraper modules synchronously into the worker scope |
| chrome.alarms API | Persistent scheduling that survives service worker sleep/wake cycles |
| chrome.storage.local | Shared state between popup, background worker, and web app (via content script) |
| chrome.cookies API | Reads real browser session cookies for authenticated API calls |
| DOMParser | Parses Upwork RSS XML feed inside the service worker |
| Fetch API | Direct HTTP calls from service worker to Upwork RSS and Freelancer REST API |

### Infrastructure

| Service | Purpose |
|---|---|
| Redis | Scrape result cache (TTL 10 min for ext-results; 24h for auto-projects) |
| PostgreSQL | All permanent data |
| Firebase | Auth provider (Google SSO + email/password) |
| Groq Cloud | AI inference endpoint |

---

## 4. Features & Functionalities

### 4.1 Chrome Extension — Automated Scraping Engine

**Description**: The extension runs as a Manifest V3 service worker with a `chrome.alarms` recurring timer. On each alarm tick, it scrapes both Upwork and Freelancer in parallel, applies multi-layer filtering, and pushes matched projects to the backend API.

**User flow**:
1. User installs extension, opens popup, pastes JWT token from Profile page, clicks Save & Test
2. User sets keywords, platform, interval, time window, active days, and filters
3. Toggles Auto-Scrape ON
4. Extension schedules `chrome.alarms.create('autoScrape', { periodInMinutes: N })`
5. Each alarm tick triggers `handleScrape()` → scrape → filter → POST to API

**Backend logic**:
- Popup-triggered scrapes: `SCRAPE` message → `handleScrape()`
- Alarm-triggered scrapes: `chrome.alarms.onAlarm` → reads storage → `handleScrape()`
- Both paths always call both `sendProjectsToApi` and `sendResultsToAutomation`

**Edge cases**:
- Service worker was killed mid-scrape: next alarm restarts cleanly; no orphaned state
- No auth token: rejected immediately with popup error message
- No keywords: alarm fires but `handleScrape` exits early before any network calls
- Day-of-week guard: alarm fires daily but `handleScrape` checks `scheduleDays` array and returns if today is inactive
- Hour-range guard: checks `scheduleStartHour`/`scheduleEndHour` before scraping

---

### 4.2 Upwork Scraping (RSS Feed)

**Description**: Fetches Upwork's public RSS feed from the extension background service worker. No DOM injection required — avoids Upwork's anti-bot CSP.

**User flow**: Triggered automatically during each scrape cycle for "upwork" or "both" platform selection.

**Backend logic**:
```
GET https://www.upwork.com/ab/feed/jobs/rss?q={query}&sort=recency&paging={offset};50
Headers: User-Agent (browser UA), Referer: https://www.upwork.com/, Accept: application/rss+xml
```
- Pages 0, 50, 100, 150, 200 (max 200 results)
- First attempt without cookies; if empty, retry with `.upwork.com` session cookies
- Early termination: stops paginating when an entire page has no result within the last 12 hours
- XML parsed with `DOMParser` inside the service worker
- Each `<item>` parsed: title, link, pubDate, description (contains budget, skills)
- Budget extracted via regex: `/(?:Budget|Hourly Range)[:\s]+(\$[\d,./\-]+)/i`
- Skills extracted via regex: `/Skills:\s*([^\n<]+)/i`

**Edge cases**:
- Non-XML response (login page, 403): logged with `console.warn` showing first 120 chars; returns `[]`
- XML parse error: `doc.querySelector('parsererror')` → logged, returns `[]`
- Unparseable pubDate: `_postedMs = 0` → rejected by 24h freshness filter in `handleScrape`

---

### 4.3 Freelancer.com Scraping (REST API)

**Description**: Calls Freelancer's public REST API v0.1 with real session cookies, fetching up to 1,000 active projects per keyword, including full employer verification data.

**User flow**: Triggered automatically during each scrape cycle.

**Backend logic**:
```
GET https://www.freelancer.com/api/projects/0.1/projects/active/
  ?query={keyword}&full_description=true&job_details=true&user_details=true
  &sort_field=time_updated&reverse_sort=true&limit=100&offset={0,100,200,...}
```
- Batches 3 pages concurrently (`FL_BATCH = 3`) with `Promise.allSettled`
- 350–450ms sleep between batches to avoid rate-limiting
- `user_details: true` returns employer reputation data in response
- Verification fields extracted: `owner.status.payment_verified`, `owner.status.identity_verified`
- Rating/review fields: `owner.employer_reputation.entire_history.overall`, `.reviews`
- `_postedMs = p.time_submitted * 1000` (exact millisecond timestamp for freshness checks)
- `postedAt` formatted as "Apr 27, 2026" for display

**Edge cases**:
- Missing verification data: field set to `null` (treated as "platform doesn't expose it" — passes all filters)
- Missing timestamp: `_postedMs = 0` → rejected by 24h freshness filter
- Duplicate IDs across batches: `seenIds` Set deduplicates before pushing

---

### 4.4 Extension-to-Web Sync Bridge

**Description**: Two-way state synchronization between the Chrome extension and the web application using custom DOM events. The content script bridges the isolated extension world and the page's MAIN world.

**Events dispatched by web page → handled by bridge**:

| Event | Payload | Action |
|---|---|---|
| `FOS_GET_EXT_STATE` | none | Reads `chrome.storage.local`, fires `FOS_EXT_STATE` back |
| `FOS_SET_EXT_STATE` | `{ key: value }` | Writes to `chrome.storage.local`; fires alarm messages if `autoScrape` or `scheduleInterval` changed |
| `FOS_SCRAPE_REQUEST` | `{ query, platform }` | Sends `SCRAPE` message to background worker |
| `FOS_AUTO_SCRAPE` | `{ enabled: bool }` | Sends `AUTO_SCRAPE_ON` or `AUTO_SCRAPE_OFF` to background |

**Events dispatched by bridge → handled by web page**:

| Event | Payload | When |
|---|---|---|
| `FOS_EXT_STATE` | Full state snapshot | Response to `FOS_GET_EXT_STATE` |
| `FOS_EXT_STATE_CHANGED` | Delta of changed keys | Any `chrome.storage.onChanged` on tracked keys |
| `FOS_SCRAPE_EVENT` | `{ type, message }` | `SCRAPE_STATUS` and `SCRAPE_DONE` forwarded from background |
| `FOS_SCRAPE_RESPONSE` | Background ack | Immediate response to `FOS_SCRAPE_REQUEST` |

**Loop prevention**: `isUpdatingFromExtRef` ref is set for 200ms when a state change originates from the extension. The 600ms debounced config-sync `useEffect` checks this ref and skips writing back, preventing circular update loops.

---

### 4.5 Automation Page

**Description**: The main control panel for automated scraping. Mirrors extension state completely when the extension is installed. Shows matched projects in real-time as the extension scrapes.

**User flow**:
1. Page loads → reads `fos_autoEnabled` and `fos_autoConfig` from localStorage immediately (no flash)
2. Extension detected (~800ms) → dispatches `FOS_GET_EXT_STATE` → syncs full config
3. If `enabled = true` or extension detected: polling starts (GET /auto-results every 10s)
4. Extension scrapes → `SCRAPE_DONE` event fires → page invalidates query after 2s → immediate display
5. Projects appear in right panel filtered by platform + `matchesConfig()`

**State persistence**:
- `fos_autoEnabled` → `localStorage` — survives refresh; polling resumes immediately
- `fos_autoConfig` → `localStorage` — full config survives refresh
- `fos_matchedProjects` → `localStorage` (capped at 200) — projects visible on refresh without waiting for next poll
- `fos_savedProjects` → `localStorage` — bookmarked projects

**Platform leakage prevention**: `prevPlatformRef` tracks previous platform. When `config.platform` changes, all `matchedProjects` not matching the new platform are removed immediately.

**Without extension**: Falls back to an interval-based scheduler that calls the Python scraper (`POST /scraper/search`). Degrades gracefully if scraper is offline.

---

### 4.6 Find Projects (Scraper Page)

**Description**: On-demand project search. Checks extension-cached Redis results first, then falls back to the Python scraper service. Deduplicates across sources.

**User flow**:
1. User types keywords, selects platform, clicks Search
2. `POST /scraper/search` — backend checks Redis for extension results first
3. If extension results found: returns immediately (no Python scraper call)
4. If not found: calls Python scraper at `SCRAPER_URL/scrape`
5. Results cached 2 minutes for repeated queries

**Cache key**: `ext-results:{userId}:{platform}:{normalizedQuery}` (set by extension, read by search endpoint)

---

### 4.7 AI Project Analysis

**Description**: Sends a project listing to Groq (LLaMA 3 / Mixtral) with the user's profile context for a structured competitive analysis and bid strategy recommendation.

**User flow**:
1. User clicks "Analyze" on any project card
2. Frontend navigates to `/ai-analyze` with project data in router state
3. `POST /api/v1/ai/analyze` with project + user profile
4. Groq returns: project assessment, required skills match, bid recommendation, proposal outline
5. Result saved to `analyses` table for history

---

### 4.8 Proposal Builder

**Description**: Template-based proposal generation with AI assistance. Users build a library of reusable components (intro, experience, pricing, CTA) that are assembled and optionally polished by AI.

**User flow**:
1. User creates template components (categorized as intro/experience/pricing/cta)
2. Builds a proposal template by selecting and ordering components
3. On a specific project: selects template → AI fills in project-specific details → edits → copies

---

### 4.9 Alerts & Notifications

**Description**: Configurable notification system that fires when new matched projects arrive. Supports time-window restrictions (e.g., "only alert between 9 AM and 6 PM on weekdays").

**Backend logic**: Background job (`apps/api/src/jobs/alerts.ts`) periodically checks Redis auto-results for new entries and triggers notifications matching each user's alert configuration.

---

### 4.10 Analytics Dashboard

**Description**: Visualizes the user's scraping and proposal performance over time: total projects scraped, proposals sent, win rate, response rate, revenue trend, platform distribution, and activity heatmap.

**Data sources**: `ProjectRecord` and `Proposal` tables aggregated in `apps/api/src/routes/analytics.ts`.

---

### 4.11 Records

**Description**: Full history of all scraped and saved projects, with search/filter and CSV export. Every project pushed to `/auto-results` or saved via "Save" button is written to `ProjectRecord`.

---

### 4.12 Authentication

**Description**: Dual-layer auth — Firebase handles email verification and Google SSO; the backend issues its own short-lived JWT access tokens (15 min) + refresh tokens (30 days).

**Extension token**: Separate 30-day token generated via `POST /auth/extension-token`. This token is pasted into the extension popup, allowing the extension to authenticate API calls without the user's full session.

---

## 5. Core Logic & Workflows

### 5.1 Full Auto-Scrape Cycle

```
chrome.alarms.onAlarm fires ('autoScrape')
    │
    ├─ Read chrome.storage.local:
    │   autoScrape, selectedKeywords, lastPlatform,
    │   apiUrl, authToken, scheduleDays, scheduleStartHour,
    │   scheduleEndHour, scrapeFilters
    │
    ├─ Guard: !autoScrape || !resolvedQuery || !authToken → return
    ├─ Guard: today not in scheduleDays → return
    ├─ Guard: now.getHours() outside [startHour, endHour] → return
    │
    └─ handleScrape({ query, platform, apiUrl, authToken, filters })
            │
            ├─ startKeepAlive() — pings chrome.runtime every 20s
            │
            ├─ Split query by commas → uniqueKws[]
            │
            ├─ For each keyword:
            │   ├─ if platform ∈ ['upwork','both']:
            │   │   scrapeUpwork(kw) → Upwork RSS pages → parse items
            │   └─ if platform ∈ ['freelancer','both']:
            │       scrapeFreelancer(kw) → FL API batches → parse projects
            │
            ├─ Deduplicate by ID across all keywords and platforms
            │
            ├─ 24h freshness filter:
            │   reject if _postedMs === 0 OR _postedMs <= 0
            │   reject if (now - _postedMs) > 24h
            │
            ├─ applyFilters(freshProjects, filters, uniqueKws):
            │   1. Keyword text match: title+description must contain ≥1 keyword (OR logic)
            │   2. paymentVerified: reject if p.paymentVerified === false (null passes)
            │   3. profileVerified: reject if p.identityVerified === false (null passes)
            │   4. depositMade: reject if p.depositMade === false (null passes)
            │   5. minReviews: reject if p.clientReviewCount != null && count < min
            │   6. minRating: reject if p.clientRating != null && rating < min
            │
            ├─ Strip _postedMs from outgoing projects
            │
            ├─ sendProjectsToApi → POST /scraper/extension-results (Find Projects cache)
            ├─ sendResultsToAutomation → POST /scraper/auto-results (Automation feed)
            │
            ├─ Update chrome.storage.local: scrapeStatus, lastScrapeTime, lastScrapeCount
            ├─ chrome.runtime.sendMessage(SCRAPE_DONE)
            │
            └─ stopKeepAlive()
```

### 5.2 Frontend State Sync Protocol

```
Page mounts
    │
    ├─ Read fos_autoEnabled from localStorage → setEnabled
    ├─ Read fos_autoConfig from localStorage → setConfig
    ├─ Read fos_matchedProjects from localStorage → setMatchedProjects
    │
    ├─ Check window.__FOS_EXTENSION_INSTALLED__
    │   ├─ true → setExtensionInstalled(true)
    │   └─ false → setTimeout 800ms, check again
    │
    ├─ Extension detected → dispatch FOS_GET_EXT_STATE
    │
    └─ FOS_EXT_STATE fires → applyExtState(state):
           ├─ state.autoScrape → setEnabled
           ├─ state.selectedKeywords → config.query
           ├─ state.lastPlatform → config.platform
           ├─ state.scheduleInterval → config.intervalMinutes
           ├─ state.scheduleStartHour/EndHour → config.startTime/endTime
           ├─ state.scheduleDays → config.activeDays
           └─ state.scrapeFilters → config.paymentVerified, identityVerified, etc.

Config changes (user edits in UI)
    │
    └─ 600ms debounce → dispatch FOS_SET_EXT_STATE(configToExtState(config))
           ─ Writes to chrome.storage.local
           ─ If autoScrape changed: sends AUTO_SCRAPE_ON/OFF to background
           ─ If scheduleInterval changed: sends RESCHEDULE_IF_ACTIVE

Extension popup changes (popup.js writes to storage)
    │
    └─ chrome.storage.onChanged → app-bridge.js → FOS_EXT_STATE_CHANGED → applyExtState(delta)
           ─ isUpdatingFromExtRef = true (200ms)
           ─ Config sync useEffect skips (loop prevention)
```

### 5.3 Project Filtering Decision Tree

```
Project arrives at matchesConfig(project, config):
    │
    ├─ maxProposals ≠ 'any' AND project.proposalsCount > max → REJECT
    ├─ minClientRating set AND project.clientRating < min → REJECT
    ├─ minClientReviews set AND project.clientReviewCount < min → REJECT
    ├─ includeKeywords set AND NOT all kws appear in title+desc → REJECT
    ├─ excludeKeywords set AND any kw appears in title+desc → REJECT
    ├─ techStack not empty:
    │   normalize: strip dots/spaces from tech names and project text
    │   ANY tech in normalized skills OR normalized description → PASS
    │   none match → REJECT
    ├─ minBudget set AND parseBudgetMin(budget) < min → REJECT
    ├─ maxBudget set AND parseBudgetMin(budget) > max → REJECT
    ├─ identityVerified=true AND project.identityVerified === false → REJECT
    ├─ paymentVerified=true AND project.paymentVerified === false → REJECT
    ├─ depositMade=true AND project.depositMade === false → REJECT
    ├─ profileCompleted=true AND project.profileCompleted === false → REJECT
    └─ → PASS
```

### 5.4 Token Refresh Protocol

```
API request fires (Axios)
    │
    ├─ Request interceptor: attach Bearer {accessToken} from Zustand
    │
    └─ If 401 response:
           ├─ Skip if URL is /auth/login, /auth/signup, /auth/refresh
           ├─ pendingRefresh singleton (prevents N parallel 401s each calling /refresh)
           ├─ POST /auth/refresh { refreshToken }
           ├─ Success: setTokens(new access, new refresh)
           ├─ Retry original request with new access token
           └─ Failure: logout() + redirect to /login
```

### 5.5 Redis Cache Strategy

| Key Pattern | TTL | Content | Written By | Read By |
|---|---|---|---|---|
| `ext-results:{uid}:{plat}:{query}` | 600s | Matched projects from extension scrape | `POST /extension-results` | `POST /search` (priority) |
| `auto-projects:{uid}` | 86400s | Accumulated matched projects | `POST /auto-results` | `GET /auto-results` |
| `auto-log:{uid}` | 604800s | List of run log entries (LPUSH, capped 50) | `POST /auto-results` | `GET /auto-results` |
| `scraper:{uid}:{plat}:{query}:{limit}` | 120s | Python scraper results | `POST /search` (fallback) | `POST /search` |

---

## 6. Database Design

### Schema Overview (PostgreSQL via Prisma)

#### `User`
| Field | Type | Purpose |
|---|---|---|
| id | String (cuid) | Primary key |
| email | String (unique) | Login identifier |
| name | String | Display name |
| hashedPassword | String? | Null for OAuth users |
| refreshToken | String? | Current valid refresh token |
| extensionToken | String? | 30-day token for Chrome extension |
| extensionTokenExpiry | DateTime? | Extension token expiry |
| avatarUrl | String? | Profile picture URL |
| createdAt | DateTime | Account creation |

#### `Proposal`
| Field | Type | Purpose |
|---|---|---|
| id | String | Primary key |
| userId | String | FK → User |
| title | String | Project title |
| platform | String | "upwork" / "freelancer" |
| url | String? | Original project URL |
| status | String | "draft" / "sent" / "won" / "lost" |
| bidAmount | Float | Submitted bid in USD |
| proposalText | String | Full proposal body |
| aiAnalysis | Json? | Groq analysis result |
| createdAt | DateTime | |

#### `ProjectRecord`
| Field | Type | Purpose |
|---|---|---|
| id | String | Primary key |
| userId | String | FK → User |
| title | String | Project title |
| description | String | Project description |
| clientCountry | String | Client location |
| techStack | String[] | Required skills array |
| platform | String | Source platform |
| url | String? | Original URL (unique per user) |
| bidAmount | Float | Defaults 0; updated when proposal submitted |
| scrapedAt | DateTime | When project was discovered |

#### `Template` and `TemplateComponent`
- `TemplateComponent`: reusable text block with `type` (intro/experience/pricing/cta) and `content`
- `Template`: ordered list of component IDs; assembled into a full proposal document

#### `AlertConfig`
Stores per-user notification preferences: enabled/disabled, timezone, time window, active days, delivery channel (email / push).

#### `Analysis`
Stores Groq AI analysis results for individual projects: project snapshot + AI response JSON + timestamp.

#### `PlatformConnection`
Stores OAuth tokens or session cookies for Upwork and Freelancer.com:
- `platform`: "upwork" / "freelancer"
- `accessToken`: encrypted
- `refreshToken`: encrypted
- `connectedAt` / `expiresAt`
- `email` / `externalId`: for display in UI

---

## 7. API Design

### Authentication
All protected endpoints require:
```
Authorization: Bearer {jwt_access_token}
```

The extension uses a separate 30-day extension token (same header format):
```
Authorization: Bearer {extension_token}
```

Both token types are validated by the same `authenticate` middleware which calls `jwt.verify()`.

### Rate Limiting
- **General**: 500 failed requests per 15 minutes per user IP (successful requests skip counting)
- **Auth endpoints** (login/signup/refresh): 15 requests per minute per user

### Core Endpoints

#### Auth — `/api/v1/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/signup` | None | Register with email + password |
| POST | `/login` | None | Returns `accessToken` + `refreshToken` |
| POST | `/logout` | Bearer | Clears refresh token from DB |
| POST | `/refresh` | None | Exchanges refresh token for new pair |
| GET | `/me` | Bearer | Returns current user object |
| POST | `/extension-token` | Bearer | Issues 30-day extension token |

**Login response**:
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { "id": "...", "email": "...", "name": "..." }
}
```

#### Scraper — `/api/v1/scraper`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/status` | None | Checks Python scraper health |
| POST | `/search` | Bearer | Search projects (ext cache → Python fallback) |
| POST | `/save` | Bearer | Save project to `ProjectRecord` |
| GET | `/saved` | Bearer | List saved projects |
| DELETE | `/saved/:id` | Bearer | Remove saved project |
| POST | `/extension-results` | Bearer | Extension pushes scrape batch (Find Projects cache) |
| GET | `/extension-results` | Bearer | Frontend reads cached extension results |
| DELETE | `/extension-results` | Bearer | Bust cache for a query |
| POST | `/auto-results` | Bearer | Extension pushes auto-scrape results (Automation feed) |
| GET | `/auto-results` | Bearer | Frontend polls for projects + run log |
| DELETE | `/clear-results` | Bearer | Clear Redis auto-projects + log |

**POST /auto-results request**:
```json
{
  "platform": "both",
  "query": "node.js developer",
  "projects": [ { "id": "fl_123", "title": "...", ... } ],
  "source": "extension"
}
```

**GET /auto-results response**:
```json
{
  "projects": [ { "id": "fl_123", ... } ],
  "logs": [
    {
      "ts": "2026-04-28T14:00:00Z",
      "platform": "both",
      "query": "node",
      "received": 67,
      "fresh": 67,
      "source": "extension"
    }
  ],
  "total": 67
}
```

#### AI — `/api/v1/ai`

| Method | Path | Description |
|---|---|---|
| POST | `/analyze` | Analyze a project with Groq LLM |
| POST | `/generate-proposal` | Generate proposal text |
| POST | `/profile-review` | Review freelancer profile |
| GET | `/analyses` | List past analyses |

#### Connections — `/api/v1/connections`

| Method | Path | Description |
|---|---|---|
| GET | `/status` | Returns `{ upwork: bool, freelancer: bool, connections: {...} }` |
| POST | `/:platform/start` | Begin OAuth flow |
| POST | `/:platform/browser-connect` | Submit browser session cookies |
| POST | `/:platform/token` | Submit PAT (Personal Access Token) |
| POST | `/:platform/refresh` | Refresh expired OAuth token |
| DELETE | `/:platform` | Disconnect platform |

### Error Response Format
```json
{
  "error": "Human-readable error message"
}
```
HTTP status codes: 400 (bad request), 401 (unauthorized), 403 (forbidden), 429 (rate limited), 500 (server error), 503 (scraper offline).

---

## 8. Implementation Details

### 8.1 Extension Module Structure

```
apps/extension/
├── manifest.json                 # MV3 manifest
├── background.js                 # Service worker: orchestration, filtering, API calls
├── popup.html                    # Extension popup UI
├── popup.js                      # Popup logic: storage reads/writes, UI updates
├── popup.css                     # Popup styling (dark theme, CSS variables)
├── scrapers/
│   ├── upwork.js                 # Upwork RSS feed scraper (loaded via importScripts)
│   └── freelancer.js             # Freelancer REST API scraper (loaded via importScripts)
└── content-scripts/
    ├── app-bridge-main.js        # MAIN world: sets window.__FOS_EXTENSION_INSTALLED__ = true
    └── app-bridge.js             # ISOLATED world: bridges extension ↔ web page via DOM events
```

**Why `importScripts` instead of ES modules**: MV3 service workers support ES modules (`"type": "module"` in manifest), but `importScripts` allows synchronous loading of scraper files before the service worker starts processing messages. This avoids timing issues where the first alarm fires before scraper functions are defined.

**Why separate scraper files**: Separation of concerns — `background.js` is pure orchestration. Each scraper module owns its constants, request logic, parsing, and pagination. When Freelancer changes their API, only `scrapers/freelancer.js` needs updating.

### 8.2 Frontend Page Structure

```
apps/web/src/pages/
├── auth/
│   ├── Login.tsx
│   └── Signup.tsx
├── Automation.tsx          # Main automation control + project display
├── Scraper.tsx             # Find Projects (on-demand search)
├── Dashboard.tsx           # Stats overview
├── AIAnalyze.tsx           # AI project analysis
├── Proposals.tsx           # Proposal CRM
├── Builder.tsx             # Proposal builder with templates
├── Templates.tsx           # Template component library
├── Records.tsx             # Full project history
├── Analytics.tsx           # Charts and metrics
├── Alerts.tsx              # Notification config
├── Profile.tsx             # User profile + extension token
└── Settings.tsx            # App settings
```

### 8.3 State Management Pattern in Automation.tsx

The component uses a layered state strategy:
- **Immediate**: `useState` with localStorage initializer → zero-flicker load
- **Extension sync**: `FOS_EXT_STATE` / `FOS_EXT_STATE_CHANGED` DOM events → `applyExtState()`
- **Server state**: TanStack Query polling → `autoResultsData` → `setMatchedProjects`
- **Persistence**: `useEffect` per state slice → `localStorage.setItem`
- **Loop prevention**: `isUpdatingFromExtRef` prevents config write-back when change came FROM extension

### 8.4 API Axios Configuration

- Base URL: `/api/v1` (Vite proxy rewrites to `http://localhost:3001` in dev)
- Request interceptor: attaches `Authorization: Bearer {token}` from Zustand store
- Response interceptor: handles 401 (token refresh) and 429 (Retry-After header back-off)
- Singleton `pendingRefresh` promise: N concurrent 401s share one `/refresh` call

### 8.5 Redis Key Design

Keys follow the pattern: `{resource}:{userId}:{...discriminants}` — user-scoped to prevent data leakage between accounts. TTLs are set conservatively: `extension-results` expires in 10 minutes (short enough that stale results don't persist across work sessions), `auto-projects` expires in 24 hours (accumulates throughout the work day).

### 8.6 Security

- **Helmet.js**: Sets `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, etc.
- **CORS**: Restricted to `CORS_ORIGIN` env var (defaults to `localhost:5173`)
- **JWT secrets**: Loaded from environment variables; never hardcoded
- **Extension token**: Separate 30-day JWT; stored in `chrome.storage.local` (isolated from web page JS)
- **Cookies for scraping**: Read via `chrome.cookies.getAll()` (requires `cookies` permission); never exposed to the web page
- **SQL injection**: Prevented by Prisma's parameterized queries

---

## 9. Recent Changes (Last 10 Days)

### 2026-04-18 — Extension popup UI redesign

**What changed**: Full rewrite of `popup.html` and `popup.css`.

**Why**: Old popup used heavy emoji in section headers and buttons (⚙️ 🔗 🔍 ⏰ 💾), inconsistent colors, and no connection status indicator.

**Changes**:
- Removed all emoji from headers and buttons
- Added `#syncBadge` pill with pulsing green dot indicating live connection to web app
- Inline toggle + section title via `.section-title-row` flex layout
- CSS variables: `--surface-2: #0D1B2E`, `--primary-lo: #162B5C`, `--border: #2D3F55`, `--muted: #7C8FA6`
- `@keyframes pulse-dot` animation on the sync badge green dot
- Keyword tags changed from solid blue to bordered variant (`primary-lo` background, blue border)
- Toggle unchecked thumb uses `#8096AD` (clearly indicates off state)

**Impact**: Extension popup now matches the web app's design system. Zero breaking changes to `popup.js` logic.

---

### 2026-04-18 — Scraper modularization

**What changed**: Extracted Upwork and Freelancer scraping out of `background.js` into `scrapers/upwork.js` and `scrapers/freelancer.js`. `background.js` becomes orchestration-only.

**Why**: Monolithic `background.js` was 700+ lines mixing orchestration, scraping, parsing, and filtering. Changes to one platform's API were risky. Testing was impossible.

**Before**: Single file with all platform logic inline.

**After**:
```
background.js          → orchestration, filtering, API dispatch
scrapers/upwork.js     → Upwork RSS pagination, parsing
scrapers/freelancer.js → Freelancer API batching, parsing, verification extraction
```

**Impact**: Freelancer scraper now extracts real `paymentVerified`, `identityVerified`, `clientRating`, `clientReviewCount` from `user_details: true` API response. Previously all Freelancer verification fields were `null`.

---

### 2026-04-19 — Strict 24h timestamp enforcement

**What changed**: `handleScrape` in `background.js` now **rejects** projects with `_postedMs === 0` or `_postedMs <= 0`. Previously, projects with no timestamp were passed through.

**Why**: Projects with no timestamp have unknown age. They could be months old. User explicitly requested strict 24h enforcement.

**Before**:
```js
if (!p._postedMs || p._postedMs <= 0) return true; // pass unknown timestamps
```

**After**:
```js
if (!p._postedMs || p._postedMs <= 0) return false; // reject unknown timestamps
```

**Impact**: Eliminates stale edge cases at the source. Roughly 5–10% of Freelancer results have no `time_submitted` and are now dropped before API submission.

---

### 2026-04-19 — Keyword text verification in applyFilters

**What changed**: `applyFilters()` in `background.js` now verifies each project's title and description contains at least one search keyword (OR logic), regardless of platform.

**Why**: The Freelancer API performs broad full-text search; results can include tangentially related projects. This is a safety net that ensures projects forwarded to the API are semantically relevant.

**Logic**:
```js
const text = ((p.title || '') + ' ' + (p.description || '')).toLowerCase();
if (!keywords.some(k => text.includes(k.toLowerCase()))) return false;
```

---

### 2026-04-19 — Automation page crash fix (activeDays undefined)

**What changed**: Fixed `TypeError: Cannot read properties of undefined (reading 'includes')` at `Automation.tsx:894`.

**Root cause**: `config.activeDays` was `undefined` when `extStateToConfigPatch` only patches keys present in the extension state snapshot. If `scheduleDays` was never written to extension storage, `activeDays` remained `undefined` after the partial merge.

**Fix**: `(config.activeDays ?? []).includes(idx)` at both the render site and in `toggleDay()`.

---

### 2026-04-19 — Extension state sync + persistence overhaul (Automation.tsx)

**What changed**: Multiple fixes to `Automation.tsx` for persistence and sync stability.

**Changes**:
1. `enabled` state initialized from `localStorage` (key: `fos_autoEnabled`)
2. `config` state initialized from `localStorage` (key: `fos_autoConfig`)
3. `useEffect` to persist `enabled` → localStorage on every change
4. `handleToggleEnable` guard: `!config.query.trim() && !extensionInstalled` — when extension is installed, keywords come from extension storage, not local config, so don't block start
5. Platform filtering added before `matchesConfig` to prevent cross-platform leakage
6. `isUpdatingFromExtRef` prevents write-back loops (ext→page→ext)

---

### 2026-04-19 — All scrapes route to Automation page (background.js)

**What changed**: Removed the `if (isAutoScrape)` conditional that prevented popup-triggered and test scrapes from calling `sendResultsToAutomation`.

**Before**: Only alarm-triggered scrapes called both endpoints.

**After**: Every scrape (popup, Test button, alarm) always calls both `sendProjectsToApi` AND `sendResultsToAutomation`.

**Impact**: Projects from manual popup scrapes now appear in the Automation page, not just auto-scrape results.

---

### 2026-04-20 — Extension popup button text cleanup

**What changed**: Fixed three button state strings in `popup.js` to match the redesigned emoji-free `popup.html`.

**Before → After**:
- `'💾 Save & Test'` → `'Save & Test Connection'`
- `'⏳ Scraping...'` → `'Scraping...'`
- `'🔍 Start Scraping'` → `'Start Scraping'`

---

### 2026-04-27 — Polling always active when extension installed

**What changed**: `useQuery` in `Automation.tsx` now enables polling when `extensionInstalled = true`, regardless of `enabled` state.

**Why**: If a user stops automation in the web app (`enabled = false`) but the extension's alarm continues scraping (race condition between web app stop message and alarm), projects pile up in Redis but the frontend never polls to display them.

**Before**:
```tsx
enabled: enabled,
refetchInterval: enabled ? 10_000 : false,
```

**After**:
```tsx
const isPollingActive = enabled || extensionInstalled;
enabled: isPollingActive,
refetchInterval: isPollingActive ? 10_000 : false,
```

---

### 2026-04-27 — SCRAPE_DONE triggers immediate refetch

**What changed**: `FOS_SCRAPE_EVENT` handler in `Automation.tsx` now calls `queryClient.invalidateQueries` 2 seconds after receiving `SCRAPE_DONE`.

**Why**: Without this, projects from a just-completed scrape sit in Redis for up to 10 seconds before the next polling interval fetches them.

**Code added**:
```tsx
setTimeout(() => {
  queryClient.invalidateQueries({ queryKey: ['automation-auto-results'] });
}, 2000);
```

---

### 2026-04-27 — matchedProjects persisted to localStorage

**What changed**: `matchedProjects` state now initializes from `localStorage` (key: `fos_matchedProjects`, capped at 200 entries) and saves on every change.

**Why**: On page refresh, matched projects were cleared from memory even though they existed in Redis. Users had to wait up to 10 seconds (next poll) to see them again.

**Impact**: Projects are visible instantly on refresh. The `existingIds` deduplication check in the `autoResultsData` handler prevents duplicates when the poll fires.

---

### 2026-04-27 — Platform leakage fix

**What changed**: Added `prevPlatformRef` + `useEffect([config.platform])` that filters `matchedProjects` to only keep the selected platform's projects when the user switches platforms.

**Before**: Switching from "Both" to "Upwork" left all previously-matched Freelancer projects visible.

**After**: On platform change, `setMatchedProjects(prev => prev.filter(p => p.platform === config.platform))` runs immediately.

---

### 2026-04-28 — Backend is24hFresh removed from auto-results and extension-results

**What changed**: Removed the `is24hFresh()` re-filter from both `POST /auto-results` and `POST /extension-results` backend handlers.

**Root cause** (confirmed by video): Activity log showed `[Auto-scrape] 4 matched (67 scraped)`. The log entry counts `received = 67` (extension sent 67 projects) but `fresh = 4` (only 4 passed backend's `is24hFresh`). Freelancer's `postedAt` is a date-only string like `"Apr 27, 2026"`, which `new Date()` parses as midnight UTC. By the time the backend checks, many same-day projects appear "older than 24h" because they were posted after midnight. The extension already performs correct 24h filtering using `_postedMs` (exact millisecond timestamp from Freelancer API). The backend re-filter was redundant AND broken for date-only strings.

**Before**: 63 of 67 extension-sent projects dropped by backend → only 4 in Redis → frontend displays 0 (4 fail additional frontend filters).

**After**: All 67 extension-sent projects stored in Redis → frontend can display matching projects.

---

### 2026-04-28 — Upwork RSS headers improved

**What changed**: Added `User-Agent` and `Referer` headers to Upwork RSS fetch requests in `scrapers/upwork.js`. Added granular error logging for each failure mode.

**Why**: Upwork blocks bare RSS requests without a browser-like User-Agent. Without the header, fetch returns 403 or a login redirect page, causing the scraper to silently return 0 results.

**Added**:
```js
'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...',
'Referer': 'https://www.upwork.com/',
```

**Error logging added**:
```js
console.warn(`[upwork] RSS HTTP ${resp.status} at offset=${offset} useCookies=${useCookies}`);
console.warn(`[upwork] Non-XML response at offset=${offset}: ${trimmed.substring(0, 120)}`);
```

---

### 2026-04-28 — Tech stack matching normalization

**What changed**: `matchesConfig()` in `Automation.tsx` now normalizes dots and spaces when comparing tech stack filter chips against project skills and text.

**Before**: `'node.js'` filter chip required exact string "node.js" in skill names or description. A project with "NodeJS" or "Node JS" skills would fail.

**After**:
```tsx
const norm = (s: string) => s.toLowerCase().replace(/[.\s]/g, '');
// 'node.js' → 'nodejs', 'Node JS' → 'nodejs'
return skillSet.some(s => s.includes(tl) || norm(s).includes(tlN))
  || text.includes(tl) || norm(text).includes(tlN);
```

**Impact**: Substantially increases the number of projects that pass the tech stack filter, particularly for "node.js", "asp.net", and "vue.js" variants.

---

## 10. Current System State

### Completed

- Chrome extension: fully operational as primary scraping engine
- Extension popup: redesigned, emoji-free, sync badge, all controls working
- Upwork RSS scraping: implemented in `scrapers/upwork.js` with pagination and early termination
- Freelancer API scraping: implemented in `scrapers/freelancer.js` with real verification data
- Extension-to-web sync: full two-way state synchronization via DOM events
- Automation page: full sync with extension, correct polling, project display, persistence
- Backend API: all CRUD endpoints, Redis caching, JWT auth, rate limiting
- AI integration: Groq-powered project analysis and proposal generation
- Proposal builder: template component system
- Analytics: dashboard, timeline, heatmap, activity calendar
- Records: project history with CSV export
- Alerts: configurable notification system with time window
- Platform connections: OAuth + PAT support for Upwork and Freelancer.com

### In Progress

- Upwork RSS reliability: headers added to fix blocking; real-world testing still needed
- Extension detection edge case: 800ms timeout may miss the flag if content script loads late on some pages

### Known Issues

- **Upwork 0 results**: Unconfirmed whether `User-Agent` fix fully resolves Upwork's bot detection. If RSS returns non-XML, the scraper silently returns empty. Debug via extension service worker console logs.
- **Python scraper dependency**: Find Projects fallback requires `python api.py` running separately on port 8001. No in-process fallback if it is unavailable.
- **Redis requirement**: Both Redis and PostgreSQL must be running for the API to function. No graceful degradation for Redis unavailability.
- **Extension token expiry**: If the 30-day extension token expires, all scraping silently stops. No proactive re-authentication flow in the extension.

### Technical Debt

- `popup.js` has no TypeScript; relies on `getElementById` for all DOM operations with no type safety
- Python scraper is a separate process with no shared type definitions with the TypeScript stack
- `auto-projects` Redis key accumulates projects across runs (merged list). Over a full work week this could hit 500 cap, at which point oldest projects are silently dropped
- No test coverage across any layer; all validation is manual

---

## 11. Challenges & Fixes

### Challenge 1: Extension service worker was killed mid-scrape

**Problem**: Chrome MV3 service workers can be killed after ~30 seconds of inactivity. Long scrapes (Freelancer API with 10 batches × 350ms sleep) could be interrupted.

**Root cause**: Chrome aggressively suspends idle service workers under memory pressure.

**Solution**: `startKeepAlive()` calls `chrome.runtime.getPlatformInfo()` every 20 seconds during a scrape cycle. This is a no-op that keeps the service worker alive. `stopKeepAlive()` is called in the `finally` block of `handleScrape`.

---

### Challenge 2: Backend is24hFresh dropped 63/67 extension-sent projects

**Problem**: Activity log showed `4 matched (67 scraped)` but Automation page showed 0 projects.

**Root cause**: Freelancer's `postedAt` field is a date-only string (`"Apr 27, 2026"`). `new Date("Apr 27, 2026")` parses to midnight UTC. For projects posted in the afternoon and checked the next morning, `Date.now() - midnight` exceeds 24 hours even though the project is legitimately within the window. The extension correctly used `_postedMs` (exact unix milliseconds) but stripped it before sending. Backend's `is24hFresh` used the imprecise date string.

**Solution**: Removed `is24hFresh` from `POST /auto-results` and `POST /extension-results`. Extension pre-filters correctly; backend trusts the sent payload.

---

### Challenge 3: Extension-to-web sync loop

**Problem**: Extension popup writes `selectedKeywords` → `chrome.storage.onChanged` → `FOS_EXT_STATE_CHANGED` → `applyExtState` → `setConfig` → config `useEffect` fires → `FOS_SET_EXT_STATE` → writes back to extension storage → triggers `onChanged` again → infinite loop.

**Solution**: `isUpdatingFromExtRef` ref is set to `true` for 200ms when `applyExtState` runs. The config-sync `useEffect` checks this ref and returns early, preventing write-back. 600ms debounce provides an additional buffer.

---

### Challenge 4: `matchedProjects` cleared on every page refresh

**Problem**: Users would start automation, see matched projects accumulate, then refresh the page and see an empty panel. The React state was not persisted anywhere.

**Root cause**: `useState<ScrapedProject[]>([])` — initial value is always an empty array.

**Solution**: Initialize from localStorage: `useState(() => loadStorage('fos_matchedProjects', []))`. Persist on change with a `useEffect`. Capped at 200 entries to prevent localStorage bloat.

---

### Challenge 5: Platform leakage in project display

**Problem**: Switching from "Both Platforms" to "Upwork Only" left Freelancer projects visible in the matched projects panel.

**Root cause**: The `autoResultsData` useEffect only ADDS new projects (checking `existingIds`). It never removes projects that were added under a previous platform config.

**Solution**: Track previous platform in `prevPlatformRef`. On `config.platform` change, immediately filter `matchedProjects` to only keep entries matching the new platform.

---

### Challenge 6: Upwork returned 0 results silently

**Problem**: Extension reported 0 Upwork projects for every keyword. No error logged.

**Root cause**: Upwork's RSS endpoint returns a non-XML response (redirect to login, or 403) when no `User-Agent` header is present. The existing code checked `if (!resp.ok) return []` but did not log why.

**Solution**: Added browser-like `User-Agent` and `Referer` headers. Added `console.warn` for non-OK HTTP status, non-XML response body, and XML parse errors. Now each failure mode is visible in the service worker console.

---

## 12. Future Improvements

### Planned Features

- **Push notifications**: Real-time browser notifications (Web Push API) when high-match projects arrive, without requiring the user to have the app open
- **Proposal Win-Rate ML**: Train a simple model on `Proposal.status` outcomes correlated with project attributes, bid amount, and template used — feed recommendations back into the bid strategy
- **Smart keyword expansion**: Auto-suggest related keywords based on successful past proposals (e.g., searching "react" could auto-include "reactjs", "react.js", "react native")
- **Duplicate-across-platforms detection**: The same client posts on both Upwork and Freelancer — deduplicate by comparing title + budget similarity
- **Extension auto-reconnect**: Detect expired extension token and surface a "Token expired — click to refresh" banner in the popup with one-click token renewal

### Optimization Ideas

- **Redis TTL compaction**: Replace the 24h `auto-projects` key with a sliding window that drops projects older than 24h on every write. Currently the list accumulates until it hits 500.
- **Parallel keyword scraping**: The current multi-keyword loop is sequential per platform. Each keyword could be a `Promise.all` across platforms for 2–4× speed improvement.
- **Incremental extension-results**: Instead of replacing the full `ext-results` cache on each scrape, store project IDs as a Redis Set and only write genuinely new project objects. Reduces Redis write amplification.
- **Background sync on Automation page**: Use `BroadcastChannel` to notify all open tabs when a scrape completes, so multiple open windows stay in sync without each polling independently.

### Scaling Considerations

- **Multi-user Redis namespacing**: Current keys are `{resource}:{userId}:...` — correct for single-instance. For multi-region: prefix with region or use Redis Cluster with hash tags `{userId}` to ensure related keys land on the same slot.
- **Postgres connection pooling**: Current Prisma setup uses a single connection pool. Under load (many concurrent API requests), add PgBouncer as a connection pooler.
- **Scraper rate limit**: The Freelancer API has undocumented rate limits. At scale (many users scraping simultaneously), implement a per-user API call budget and exponential backoff tracked in Redis.
- **Extension per-user scheduling**: Currently all extension alarms fire on user-configured intervals. At 100+ users with 5-minute intervals, the backend would receive ~20 concurrent POSTs per minute — acceptable, but Redis write contention on `auto-projects` keys should be monitored.
- **Groq API rate limits**: Free tier has aggressive token-per-minute limits. At scale, implement a request queue with user-visible position/ETA and store results for 24h to avoid re-analyzing the same project.
