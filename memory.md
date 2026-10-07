# PULSE // OPS — Project Memory

> **Purpose**: This file is a single-source reference for any AI session to instantly understand the entire project. Read this first if resuming work.

---

## 1. Project Identity

| Field | Value |
|---|---|
| **Name** | PULSE // OPS |
| **Type** | Enterprise SRE Incident Response & AI Remediation Platform |
| **Architecture** | Monorepo: Laravel 13 API backend + Next.js 16 SPA frontend |
| **Database** | Neon PostgreSQL (remote) in dev + prod |
| **Auth** | Laravel Sanctum (bearer tokens) |
| **AI** | Google Gemini 2.0 Flash (with keyword-based mock fallback) |
| **Backend URL** | `https://pulse-ops-three.vercel.app/api/v1` |
| **Frontend URL** | `https://pulse-ops-fnt.vercel.app` |
| **Demo Login** | `sarah@acme.com` / `password` |

---

## 2. Tech Stack

### Backend
- PHP 8.3+ / Laravel 13.8
- Laravel Sanctum 4.0 (API auth)
- Laravel Reverb 1.10 (WebSockets, for future real-time)
- Neon PostgreSQL (remote, used in both dev and prod)
- `php artisan serve` is single-threaded — all requests queue sequentially
- Neon DB has high latency (~5-6s per query round trip)
- `laravel-vite-plugin` + Tailwind CSS v4 for backend assets
- Google Gemini API (`gemini-2.0-flash`) for AI agent

### Frontend
- Next.js 16.2.10 (App Router, all client-side rendering)
- React 19.2.4
- TypeScript 5
- Tailwind CSS v4 (CSS-first config in `globals.css`, no `tailwind.config.*`)
- `lucide-react` icons
- `next-themes` (dark/light/system, default: dark)
- JetBrains Mono font (via `next/font/google`)
- No state library — React Context (`useAuth`) + local component state

### Deployment
- Backend: Vercel serverless (`api/index.php` + `vercel-php@0.9.0`)
- Frontend: Vercel or Netlify (dual config present)
- Docker: `php:8.5-fpm-alpine` + nginx + PostgreSQL
- CORS: Whitelisted origin `https://pulse-ops-fnt.vercel.app`

---

## 3. Architecture Overview

```
my-laravel-app/                    ← Laravel root
├── api/index.php                  ← Vercel serverless entry point
├── app/
│   ├── Http/
│   │   ├── Controllers/Api/V1/    ← All API controllers
│   │   ├── Requests/              ← Form request validation
│   │   └── Resources/             ← API resource transformers
│   ├── Models/                    ← Eloquent models
│   ├── Scopes/                    ← CompanyScope (multi-tenant)
│   ├── Services/                  ← AgentBrain, MockAgentBrain, AgentActionExecutor
│   ├── Events/                    ← IncidentUpdated (broadcast)
│   └── Traits/                    ← BelongsToCompany
├── database/
│   ├── migrations/                ← 13 migration files
│   └── seeders/DatabaseSeeder.php ← Demo data
├── routes/api.php                 ← All 20+ API endpoints
├── config/services.php            ← Gemini config added
├── frontend/                      ← Decoupled Next.js SPA
│   ├── src/
│   │   ├── app/                   ← Next.js App Router pages
│   │   ├── components/            ← React components
│   │   ├── hooks/useAuth.tsx      ← Auth context provider
│   │   ├── lib/api.ts             ← HTTP client
│   │   └── types/index.ts         ← All TypeScript types
│   ├── package.json
│   └── vercel.json
├── dist/                          ← Compiled frontend assets
├── Dockerfile
├── vercel.json                    ← Backend CORS + serverless config
└── composer.json
```

---

## 4. Backend Deep Dive

### 4.1 Database Schema (13 Tables)

#### Core Domain

| Table | Key Columns | Purpose |
|---|---|---|
| `companies` | id, name, slug (unique), settings (JSON) | Multi-tenant root entity |
| `teams` | id, company_id (FK), name, slug, description | User groups. Unique on (company_id, slug) |
| `users` | id, company_id (FK), team_id (FK nullable), name, email (unique), password, role, avatar_url | Auth users. Role: admin/manager/member |
| `services` | id, company_id (FK), team_id (FK nullable), name, slug, description, status, severity_level, metadata (JSON) | Monitored infrastructure. Status: operational/degraded/partial_outage/major_outage |
| `incidents` | id, company_id (FK), title, description, severity, status, reporter_id (FK), assignee_id (FK nullable), team_id (FK nullable), acknowledged_at, resolved_at | Core incident records |
| `incident_services` | id, incident_id (FK), service_id (FK) | Pivot: incidents <-> services (many-to-many) |
| `incident_activities` | id, incident_id (FK), user_id (FK), type, body, metadata (JSON) | Activity/audit trail. Types: comment, status_change, severity_change, assignment, chat, zoom_bridge, slack_alert, postmortem_export, agent_action, command |

#### AI Agent

| Table | Key Columns | Purpose |
|---|---|---|
| `agent_runs` | id, incident_id (FK nullable, null on delete), user_id (FK), title, status (pending/running/completed/failed/cancelled), mode (sequential/autonomous), metadata (JSON) | AI agent execution session |
| `agent_actions` | id, agent_run_id (FK), type, label, status (pending/running/completed/failed/skipped), input (JSON), output (JSON), error, executed_at | Individual tool calls within a run |

#### Infrastructure

| Table | Purpose |
|---|---|
| `personal_access_tokens` | Sanctum API tokens |
| `sessions` | Database sessions |
| `password_reset_tokens` | Password resets |
| `cache` | Database cache |
| `jobs` | Database queue |

### 4.2 Model Relationships

```
Company ──hasMany──> User, Team, Service, Incident
Team ────hasMany──> User, Incident
User ────belongsTo──> Company (via BelongsToCompany trait), Team
User ────hasMany──> Incident (as reporter), Incident (as assignee)
Service belongsTo> Company (via trait), Team
Service <──belongsToMany──> Incident (via incident_services)
Incident belongsTo> Company (via trait), User (reporter), User (assignee), Team
Incident hasMany> IncidentActivity
Incident <──belongsToMany──> Service
IncidentActivity belongsTo> Incident, User
AgentRun belongsTo> User, Incident (optional)
AgentRun hasMany> AgentAction
AgentAction belongsTo> AgentRun
```

### 4.3 Multi-Tenancy

- `BelongsToCompany` trait (used by User, Team, Service, Incident) applies `CompanyScope` global scope
- Auto-filters ALL queries by `company_id = Auth::user()->company_id`
- Controllers also explicitly use `$request->user()->company_id` for creation
- Complete tenant isolation at the database query level

### 4.4 API Routes (All under `/api/v1`)

#### Public
| Method | URI | Description |
|---|---|---|
| POST | `/v1/register` | Create account, returns Sanctum token |
| POST | `/v1/login` | Authenticate, returns Sanctum token |

#### Auth Protected (`auth:sanctum`)
| Method | URI | Controller | Description |
|---|---|---|---|
| POST | `/v1/logout` | AuthController@logout | Revoke token |
| GET | `/v1/user` | AuthController@me | Current user profile |
| GET | `/v1/dashboard` | DashboardController (invokable) | Aggregate stats |
| GET | `/v1/activity-log` | ActivityLogController (invokable) | Global activity feed |
| **Incidents** | | | |
| GET | `/v1/incidents` | IncidentController@index | Paginated list, filters: severity, status, assignee_id, unassigned |
| POST | `/v1/incidents` | IncidentController@store | Create (auto-logs "declared" activity) |
| GET | `/v1/incidents/{id}` | IncidentController@show | Single with relations |
| PUT/PATCH | `/v1/incidents/{id}` | IncidentController@update | Update, auto-logs status/severity/assignment changes, broadcasts event |
| DELETE | `/v1/incidents/{id}` | IncidentController@destroy | Delete |
| POST | `/v1/incidents/{id}/chat` | IncidentController@chat | Post chat message as activity |
| GET | `/v1/incidents/{id}/chat` | IncidentController@getChat | Activity feed, optional `after_id` for polling |
| POST | `/v1/incidents/{id}/activity` | IncidentController@logActivity | Log custom activity |
| **Services** | | | |
| GET | `/v1/services` | ServiceController@index | Paginated, filterable by status |
| POST | `/v1/services` | ServiceController@store | Create |
| GET | `/v1/services/{id}` | ServiceController@show | Single |
| PUT/PATCH | `/v1/services/{id}` | ServiceController@update | Update |
| DELETE | `/v1/services/{id}` | ServiceController@destroy | Delete |
| **Teams** | | | |
| GET | `/v1/teams` | TeamController@index | Paginated with users |
| POST | `/v1/teams` | TeamController@store | Create (auto-slug from name) |
| GET | `/v1/teams/{id}` | TeamController@show | Single with users |
| PUT/PATCH | `/v1/teams/{id}` | TeamController@update | Update, reassign users |
| DELETE | `/v1/teams/{id}` | TeamController@destroy | Delete |
| GET | `/v1/teams/users` | TeamController@users | All company users |
| **Agent** | | | |
| GET | `/v1/agent/runs` | AgentController@index | List runs, filter: incident_id, status |
| POST | `/v1/agent/runs` | AgentController@store | Create run: sends message + incident context to AI brain |
| GET | `/v1/agent/runs/{id}` | AgentController@show | Single run with actions |
| POST | `/v1/agent/runs/{id}/chat` | AgentController@chat | Follow-up message, appends new actions |
| POST | `/v1/agent/runs/{id}/execute` | AgentController@execute | Execute all pending actions sequentially |
| POST | `/v1/agent/runs/{id}/cancel` | AgentController@cancel | Cancel run, skip pending actions |

### 4.5 Services Layer

#### `AgentBrain` (`app/Services/AgentBrain.php`)
- Uses Google Gemini API (`gemini-2.0-flash`) via HTTP POST
- `decide(userMessage, incidentContext)` — sends system prompt + tools + context to Gemini, parses function calls from response
- `summarize(userMessage, toolResults)` — asks Gemini to summarize actions taken
- `fallbackDecide()` — keyword-based matching when API fails
- `fallbackSummarize()` — simple count-based summary
- 8 tool schemas: `restart_service`, `scale_resources`, `rollback_deployment`, `send_notification`, `run_diagnostics`, `create_followup`, `generate_postmortem`, `update_service_status`

#### `MockAgentBrain` (`app/Services/MockAgentBrain.php`)
- Extends `AgentBrain`, empty constructor (no API key)
- Always uses `fallbackDecide()` / `fallbackSummarize()`
- Used when `GEMINI_API_KEY` is not configured

#### `AgentActionExecutor` (`app/Services/AgentActionExecutor.php`)
Executes the 8 tool types:

| Action | What It Does |
|---|---|
| `restart_service` | Fuzzy name match service, set status to `operational` |
| `scale_resources` | Log activity (simulated, no real scaling) |
| `rollback_deployment` | Log activity (simulated) |
| `send_notification` | Log activity (simulated) |
| `run_diagnostics` | Query all company services, return status breakdown |
| `create_followup` | Create new Incident record linked to original's services/team |
| `generate_postmortem` | Generate Markdown post-mortem from incident data |
| `update_service_status` | Fuzzy name match, update service status in DB |

Each execution logs an `agent_action` type `IncidentActivity`.

### 4.6 Broadcasting

- `IncidentUpdated` event implements `ShouldBroadcast`
- Broadcasts to private channel `company.{company_id}` with event name `incident.updated`

### 4.7 Form Requests (Validation)

| Request | Rules |
|---|---|
| RegisterRequest | name (required), email (required, unique), password (required, min:8, confirmed) |
| LoginRequest | email (required), password (required) |
| StoreIncidentRequest | title (required), severity (required, in: critical/major/minor/info), description, assignee_id, team_id, service_ids[] |
| UpdateIncidentRequest | All optional (sometimes). Status validated: investigating/identified/monitoring/resolved/postmortem. Additional comment field. |
| StoreTeamRequest | name (required), slug (auto-generated), description, user_ids[] |

### 4.8 API Resources (Response Serialization)

| Resource | Exposes |
|---|---|
| UserResource | id, name, email, role, avatar_url, company, team, created_at |
| CompanyResource | id, name, slug, settings, created_at |
| TeamResource | id, name, slug, description, users[], created_at |
| ServiceResource | id, name, slug, description, status, severity_level, metadata, team, created_at |
| IncidentResource | id, title, description, severity, status, reporter, assignee, team, services[], activities[], acknowledged_at, resolved_at, timestamps |
| IncidentActivityResource | id, type, body, metadata, user, created_at |
| AgentRunResource | id, incident_id, user, title, status, mode, metadata, actions[], incident, timestamps |
| AgentActionResource | id, type, label, status, input, output, error, executed_at, created_at |

---

## 5. Frontend Deep Dive

### 5.1 Routing

```
/                              → Redirect to /dashboard
/login                         → Login page (public)
/register                      → Registration page (public)
/(authenticated)/              → Protected layout (auth guard)
  /dashboard                   → System overview
  /incidents                   → Incident list
  /incidents/[id]              → Incident detail
  /incidents/[id]/war-room     → Real-time war room
  /services                    → Service health grid
  /teams                       → Team management
```

All pages are `"use client"` — no SSR/SSG. Auth guard in `(authenticated)/layout.tsx` via useEffect redirect.

### 5.2 Design System (`globals.css`)

- CSS custom properties with light/dark theme support
- Color palette: Canvas, Surface, Card, Elevated, Hover, Border, Foreground (primary/secondary/muted), Amber (primary accent)
- Status colors: Critical (red), Major (orange), Minor (yellow), Info (blue)
- Health colors: Healthy (green), Degraded (amber), Outage (red)
- Animations: `pulse-glow`, `glow-crimson`, `glow-amber`
- Tailwind v4 `@theme inline` maps CSS vars to utility classes (e.g., `bg-canvas`, `text-fg-primary`)

### 5.3 Key Pages

| Page | Features |
|---|---|
| **Dashboard** | 4 stat cards, ServiceHealthGrid, LiveTerminal (polls `/activity-log` every 5s, supports CLI commands: `/ack`, `/escalate`, `/status`, `/help`), AgentPanel |
| **Incidents List** | Paginated table, search/filter, filter pills (P0 Critical, P1 Major, My Services, Unassigned), MTTR calculator, inline actions (acknowledge, reassign, delete) |
| **Incident Detail** | Header with metadata, StatusStepper (5-step pipeline), ActivityFeed with comments, EscalationTimer (live countdown), QuickActions (Zoom/post-mortem/Slack), AgentPanel, details sidebar |
| **War Room** | Left: Chat + slash commands (/ack, /escalate, /attach-log, /status, /mute, /help) + Live Logs tab + voice recording. Right: Incident info + Root Cause Analysis (mock hypotheses) + QuickActions + AgentPanel. Header: Dispatch announcer (speech synthesis), responder count, elapsed time |
| **Services** | Tier filtering (Tier 0-3), per-service cards with status, SLO budget bar, circuit breaker state (CLOSED/OPEN/HALF-OPEN), mock metrics |
| **Teams** | Team CRUD grid, create/edit modals with member assignment, team cards with on-call display, HandoffModal for shift handovers |

### 5.4 Component Inventory

```
components/
├── layout/
│   └── Shell.tsx               ← Top header: logo, env badge, live metrics, on-call, theme switcher
├── Sidebar.tsx                  ← Left nav: workspace, links, incident count, user profile
├── StatCard.tsx                 ← Metric card
├── StatusBadge.tsx              ← Status pill
├── SeverityBadge.tsx            ← Severity pill
├── EscalationBadge.tsx          ← Auto-updating escalation badge (polls every 30s)
├── IncidentRow.tsx              ← Incident table row with inline actions
├── dashboard/
│   ├── ServiceHealthGrid.tsx    ← Service status grid with mock metrics
│   └── LiveTerminal.tsx         ← Log viewer + interactive CLI + WebSocket
├── incidents/
│   ├── StatusStepper.tsx        ← 5-step status pipeline
│   ├── ActivityFeed.tsx         ← Activity timeline with comment input
│   ├── EscalationTimer.tsx      ← Countdown to next escalation
│   ├── QuickActions.tsx         ← Zoom/Report/Slack actions
│   ├── DeclareIncidentModal.tsx ← Incident creation form
│   └── TelemetryStream.tsx      ← Mock log stream (unused in pages)
├── agent/
│   ├── AgentPanel.tsx           ← Container: launcher or chat, history
│   ├── AgentLauncher.tsx        ← Launch form: message, mode (sequential/autonomous), incident link
│   ├── AgentChat.tsx            ← Chat: messages, tool cards, execute, follow-up, voice I/O
│   └── AgentToolCard.tsx        ← Single action card: status, input/output, error, retry
├── teams/
│   ├── CreateTeamModal.tsx
│   ├── EditTeamModal.tsx
│   ├── YourTeamsModal.tsx       ← Two-level modal: list -> detail
│   ├── TeamCard.tsx             ← Rich card: health, on-call, SLA, escalation policy
│   └── HandoffModal.tsx         ← Shift handoff form
└── warroom/
    └── VoiceNotePlayer.tsx      ← Audio player for voice notes

hooks/
├── useAuth.tsx                  ← Auth context provider
├── useRealtimeIncident.ts       ← Laravel Echo WebSocket hook (real-time chat + events)
├── useVoiceInput.ts             ← SpeechRecognition (speech-to-text)
└── useVoiceOutput.ts            ← SpeechSynthesis (text-to-speech) + localStorage preference

lib/
├── api.ts                       ← HTTP client (fetch + bearer token)
└── echo.ts                      ← Laravel Echo / Pusher client setup
```

### 5.5 API Client (`src/lib/api.ts`)

- Base URL from `NEXT_PUBLIC_API_BASE_URL` (fallback: `localhost:8000/api/v1`)
- Auth: Bearer token in localStorage as `pulseops_token`
- Auto-redirect to `/login` on 401
- Methods: `api.get<T>()`, `api.post<T>()`, `api.put<T>()`, `api.delete<T>()`
- Auto-parses JSON; handles 204 No Content

### 5.6 Auth Flow (`src/hooks/useAuth.tsx`)

- React Context provider wrapping the app
- On mount: checks localStorage token → fetches `GET /user` → sets user or clears
- Methods: `login(email, password)`, `register(name, email, password, password_confirmation)`, `logout()`

---

## 6. AI Agent Feature (Latest In-Progress Work)

### 6.1 What It Does

An AI assistant that can analyze incidents, propose remediation actions (restart services, rollback deployments, scale resources, run diagnostics, create follow-up incidents, generate post-mortems), and execute them.

### 6.2 Flow

```
User sends message (POST /agent/runs)
  → If incident_id provided, gather incident context (services, activities, etc.)
  → AgentBrain.decide() → Gemini API (or keyword fallback)
  → AI returns array of tool calls
  → AgentRun created (status: pending)
  → AgentAction records created for each tool call

Sequential mode: User clicks "Run Next" → POST /agent/runs/{id}/execute
Autonomous mode: Actions execute immediately

AgentChat: Follow-up messages via POST /agent/runs/{id}/chat
  → Appends new actions to same run
```

### 6.3 Database

- `agent_runs`: id, incident_id (FK nullable), user_id (FK), title, status, mode, metadata
- `agent_actions`: id, agent_run_id (FK), type, label, status, input, output, error, executed_at

### 6.4 Frontend Components

- **AgentPanel**: Top-level container. Shows AgentLauncher or AgentChat. History toggle. Cancel functionality.
- **AgentLauncher**: Text input, mode toggle (sequential/autonomous), optional incident selector.
- **AgentChat**: Chat bubbles, tool cards, "Run Next" button (sequential), follow-up input, polling every 2s, summary display.
- **AgentToolCard**: Status icon, label, input params, output, error, retry button (not wired).

### 6.5 Known Bugs & Issues

1. ~~**No authorization on run access**~~: **FIXED** — Added `authorizeRun()` method, all endpoints verify `run->user_id === $request->user()->id`
2. ~~**`chat()` resets status to `pending` unconditionally**~~: **FIXED** — Only resets if not cancelled
3. ~~**`restartService()` bug**~~: **FIXED** — `previous_status` captured before update in `AgentActionExecutor`
4. **`scale_resources`, `rollback_deployment`, `send_notification`**: Stub implementations (log activity only, no real infra changes) — by design
5. ~~**Duplicated `$actionLabels` map**~~: **FIXED** — Extracted to `private const ACTION_LABELS`
6. ~~**Frontend history fetch**~~: **CORRECT AS-IS** — `AgentRunResource::collection(paginate())` wraps in `{data: [...]}`, `res.data` correctly accesses the array
7. ~~**`onRetry` prop in AgentToolCard**~~: **FIXED** — Wired in AgentChat, passes `handleExecute` as retry handler
8. ~~**No rate limiting**~~: **FIXED** — Agent routes wrapped in `throttle:30,1` middleware (30 requests/min)
9. **No tests** for any agent backend components
10. ~~**`AgentController@chat()` missing relations**~~: **FIXED** — `$run->load('actions')` → `$run->load(['actions', 'user', 'incident'])`
11. ~~**`AgentController@cancel()` missing `incident`**~~: **FIXED** — `load(['user', 'actions'])` → `load(['user', 'actions', 'incident'])`
12. ~~**LiveTerminal `/ack` sends invalid status**~~: **FIXED** — Was `status: "acknowledged"` (422), now `POST /incidents/{id}/activity` (type: command) + `PUT /incidents/{id}` (status: investigating)
13. ~~**ActivityFeed uses `PUT` instead of activity endpoint**~~: **FIXED** — Changed from `PUT /incidents/{id}` with `{comment}` to `POST /incidents/{id}/activity` with `{type: "comment", body}`
14. ~~**`AuthController@me()` response format mismatch**~~: **FIXED** — Was returning `UserResource` directly (`{"id":1,"name":...}`) but frontend expects `{"data":{...}}`. Changed return type from `UserResource` to `JsonResponse` with explicit `data` wrapper.
15. ~~**Neon PostgreSQL latency blocking local dev**~~: **FIXED** — Switched to SQLite locally. `php artisan serve` is single-threaded; Neon's 5-6s per query caused 40-80s page loads and request queuing. `.env` now uses `DB_CONNECTION=sqlite` (pgsql creds commented out for easy switchback). 
16. ~~**Frontend requests hang forever on failure**~~: **FIXED** — Added 15s `AbortController` timeout to `api.ts`.
17. ~~**Backend crashes with 500 instead of 401 on unauthenticated requests**~~: **FIXED** — Added `redirectGuestsTo()` in `bootstrap/app.php` so API requests return proper 401.

---

## 7. Deployment

| Config | File | Purpose |
|---|---|---|
| Vercel Backend | `vercel.json` | Routes to `api/index.php` serverless, CORS headers for frontend origin |
| Vercel Frontend | `frontend/vercel.json` | Next.js build, outputs to `.next` |
| Netlify Frontend | `frontend/netlify.toml` | Next.js via `@netlify/plugin-nextjs` |
| Docker | `Dockerfile` | `php:8.5-fpm-alpine` + nginx + PostgreSQL, runs `artisan migrate && artisan serve` |
| Vercel Entry | `api/index.php` | Creates `/tmp/storage`, fixes SCRIPT_NAME for Symfony routing, boots Laravel |
| CORS | `vercel.json` | Origin: `https://pulse-ops-fnt.vercel.app`, methods: GET/OPTIONS/PATCH/DELETE/POST/PUT |

---

## 8. Demo Data (DatabaseSeeder)

Creates:
- **1 Company**: "Acme Corp Engineering" (`acme-corp`)
- **2 Teams**: "Platform", "SRE"
- **4 Users**:
  - Sarah Chen (admin, SRE) — incident commander
  - Marcus Rivera (manager, SRE) — SRE lead
  - Aisha Patel (member, Platform) — DevOps
  - PulseOps Agent (member, SRE) — AI bot user
- **4 Services**: API Gateway (degraded), Auth Service, Payment Processor, Notification Service (all operational)
- **2 Incidents** with activity histories:
  1. "Elevated 5xx rates on API Gateway" (critical, investigating)
  2. "Payment webhook retries failing" (major, identified)
- All passwords: `password`

---

## 9. Known Issues & TODOs

### Agent Feature (Priority)
- [x] Fix authorization: verify run belongs to authenticated user in show/chat/execute/cancel
- [x] Fix `chat()` status reset — don't overwrite completed/failed status
- [x] Fix `restartService()` — capture previous_status before update
- [x] Extract duplicated `$actionLabels` to a constant
- [x] Wire up `onRetry` prop in AgentToolCard from AgentChat
- [x] Add pagination handling for history fetch in AgentPanel (correct as-is)
- [x] Add rate limiting on agent endpoints (throttle:30,1)

### General
- [ ] No tests written for any backend components
- [ ] `TelemetryStream.tsx` component exists but is unused in any page
- [ ] Several frontend components use hardcoded mock data alongside real API data
- [ ] No middleware-based auth — route protection is client-side only
- [x] ~~No Redis/Reverb WebSocket integration yet~~ — **DONE**: Echo client + useRealtimeIncident hook + ChatMessageBroadcast event. Requires `php artisan reverb:install` (blocked by missing mbstring extension locally) + Redis/Reverb in production.

---

## 10. Development Conventions

### Code Style
- Backend: Laravel conventions, PSR-12, `laravel/pint` for formatting
- Frontend: TypeScript, `"use client"` on all pages, no comments unless asked
- File naming: PascalCase for components, kebab-case for routes, camelCase for functions

### How to Run
```bash
# Backend (run in one terminal)
composer install
cp .env.example .env
php artisan key:generate
# For local dev: .env uses SQLite by default
# To switch back to Neon: uncomment pgsql lines, comment sqlite line
php artisan migrate --seed
php artisan serve

# Frontend (run in another terminal)
cd frontend
npm install
npm run dev
```

> **Note**: `php artisan serve` is single-threaded. With SQLite (local default), queries are sub-millisecond so concurrency is fine. If switching to remote Neon PostgreSQL, expect 5-6s per query and request queuing — use the Vercel-deployed backend instead for production-like testing.

### Environment Variables

### Environment Variables
```
GEMINI_API_KEY=          # Google Gemini API key (leave empty for mock)
GEMINI_MODEL=gemini-3.6-flash   # gemini-2.0-flash is retired; gemini-3.8-flash gets 503 high-demand spikes
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1  # local dev
# NEXT_PUBLIC_API_BASE_URL=https://pulse-ops-three.vercel.app/api/v1  # production

# Database: .env uses DB_CONNECTION=sqlite for local dev
# For Vercel, set these in Vercel dashboard:
# DB_CONNECTION=pgsql
# DB_HOST=ep-square-feather-ayfzp7c1.c-5.us-east-2.aws.neon.tech
# DB_DATABASE=neondb
# DB_USERNAME=neondb_owner
# DB_PASSWORD=...
```

---

## 11. Current Git State

**Branch**: `main` (up to date with `origin/main`)

**Modified files (uncommitted)**:
- `.env.example` — Added Gemini config vars + REVERB_* vars
- `app/Http/Controllers/Api/V1/ActivityLogController.php` — Added level classification
- `app/Http/Controllers/Api/V1/AgentController.php` — Added authorizeRun, ACTION_LABELS const, cancelled guard
- `app/Http/Controllers/Api/V1/IncidentController.php` — Added chat, getChat, logActivity + ChatMessageBroadcast dispatch
- `app/Http/Controllers/Api/V1/ServiceController.php` — Added severity_level validation, auto-slug
- `app/Http/Resources/IncidentResource.php` — Added company_id to response
- `app/Services/AgentActionExecutor.php` — Fixed previous_status bug in restartService
- `config/services.php` — Added Gemini config block
- `database/seeders/DatabaseSeeder.php` — Updated with demo data
- `frontend/src/app/(authenticated)/dashboard/page.tsx` — Agent panel integration
- `frontend/src/app/(authenticated)/incidents/[id]/page.tsx` — Agent panel in detail view
- `frontend/src/app/(authenticated)/incidents/[id]/war-room/page.tsx` — WebSocket + voice + quick actions fix
- `frontend/src/app/(authenticated)/services/page.tsx` — Create service form + teams fetch
- `frontend/src/components/agent/AgentChat.tsx` — Voice I/O + onRetry wiring
- `frontend/src/components/dashboard/LiveTerminal.tsx` — WebSocket + useAuth + fixed `/ack` command (was 422, now activity endpoint + valid status)
- `frontend/src/components/incidents/ActivityFeed.tsx` — Enhanced activity types + fixed comment endpoint (was PUT, now POST /activity)
- `frontend/src/components/incidents/QuickActions.tsx` — Zoom/post-mortem/Slack
- `frontend/src/types/index.ts` — Agent types, escalation types, company_id on Incident
- `routes/api.php` — Agent routes + throttle middleware

**New untracked files**:
- `app/Events/ChatMessageBroadcast.php` — WebSocket broadcast for chat messages
- `app/Http/Controllers/Api/V1/AgentController.php` — Fixed load() calls in chat() (+user, +incident) and cancel() (+incident)
- `app/Http/Resources/AgentActionResource.php`
- `app/Http/Resources/AgentRunResource.php`
- `app/Models/AgentAction.php`
- `app/Models/AgentRun.php`
- `app/Services/AgentBrain.php`
- `app/Services/AgentActionExecutor.php`
- `app/Services/MockAgentBrain.php`
- `database/migrations/2026_07_28_000001_create_agent_runs_table.php`
- `database/migrations/2026_07_28_000002_create_agent_actions_table.php`
- `frontend/.env.local` — NEXT_PUBLIC_REVERB_* vars
- `frontend/src/lib/echo.ts` — Laravel Echo client setup
- `frontend/src/hooks/useRealtimeIncident.ts` — WebSocket hook for real-time events
- `frontend/src/hooks/useVoiceInput.ts` — SpeechRecognition hook
- `frontend/src/hooks/useVoiceOutput.ts` — SpeechSynthesis hook with preference
- `frontend/src/components/agent/AgentPanel.tsx`
- `frontend/src/components/agent/AgentLauncher.tsx`
- `frontend/src/components/agent/AgentChat.tsx`
- `frontend/src/components/agent/AgentToolCard.tsx`

---

## 12. Session Log & Feature Tracker

> Append new entries here after each session. Format: `[DATE] — What was done / requested / fixed.`

### Session History

- **2026-07-28** — Initial session. Built the AI Agent feature (backend + frontend). Created AgentBrain, MockAgentBrain, AgentActionExecutor services. Created AgentRun/AgentAction models and migrations. Built AgentController with full CRUD + chat + execute + cancel. Built AgentPanel, AgentLauncher, AgentChat, AgentToolCard frontend components. Expanded war room with slash commands, live logs, voice recording. Added QuickActions (Zoom/post-mortem/Slack). Added CLI commands to LiveTerminal. Added activity log controller with level classification. Updated seeder with demo data. Added Gemini config.
- **2026-07-28 (Session 2)** — Reverb WebSocket setup (Echo client, useRealtimeIncident hook, ChatMessageBroadcast event). War Room quick actions fixed to persist via API. Services page: full CRUD with create form (name, description, status, severity, team). Voice I/O: useVoiceInput (SpeechRecognition) + useVoiceOutput (SpeechSynthesis) hooks wired into War Room and AgentChat. Slash commands /mute now persist via API. Agent bug fixes: authorizeRun(), cancelled guard, previous_status fix, ACTION_LABELS constant, onRetry wiring, throttle:30,1 rate limiting on agent routes. IncidentResource exposes company_id for WebSocket channel binding.

- **2026-07-29 (Session 3)** — Bug hunt & fixes. Identified and fixed 4 bugs:
  - **Bug #1 (LiveTerminal `/ack`)**: Changed from invalid `PUT /incidents/{id}` with `status: "acknowledged"` (422 validation error) to `POST /incidents/{id}/activity` (type: command) + `PUT /incidents/{id}` (status: investigating).
  - **Bug #3 (AgentController@chat() missing relations)**: Added `'user'` and `'incident'` to `$run->load()` so AgentRunResource includes all expected relations.
  - **Bug #4 (AgentController@cancel() missing incident)**: Added `'incident'` to `$run->fresh()->load()` in cancel response.
  - **Bug #8 (ActivityFeed comment uses PUT)**: Changed from `PUT /incidents/{id}` with `{comment}` to `POST /incidents/{id}/activity` with `{type: "comment", body}`.
  - Verified: `tsc --noEmit` passes, PHP syntax clean, all routes registered.
- **2026-07-29 (Session 3, cont.)** — Fixed critical auth bug:
  - **Bug #14 (`AuthController@me()` response format)**: Was returning `UserResource` directly (no `data` wrapper), but frontend's `useAuth` hook expects `{ data: User }`. Caused `setUser(undefined)` on every page refresh, silently logging out the user. Fixed by wrapping in `response()->json(['data' => ...])`.
- **2026-07-29 (Session 3, final)** — Fixed performance and deployment issues:
  - **Switched to SQLite for local dev**: Neon PostgreSQL had 5-6s query latency. With `php artisan serve` being single-threaded, concurrent requests queued behind slow queries, causing 40-80s page load times and timeouts. Changed `.env` to `DB_CONNECTION=sqlite` (commented out pgsql creds for easy switchback). Vercel will still use PostgreSQL via dashboard env vars.
  - **Added 15s request timeout to `api.ts`**: Prevents requests from hanging indefinitely. Uses `AbortController` with `signal` on fetch.
  - **Fixed `bootstrap/app.php` `route('login')` crash**: Added `redirectGuestsTo()` so unauthenticated API requests return proper 401 instead of crashing with 500. Fixes both local and Vercel deployments.

### Current TODO / Next Steps
- [ ] Write tests for agent backend components
- [ ] Clean up mock data vs real data in frontend components (TelemetryStream unused, hardcoded mock metrics)
- [ ] Add middleware-based auth (currently client-side only)
- [ ] Verify end-to-end flow with seeded data (run `php artisan migrate --seed` and test)
