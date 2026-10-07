<div align="center">

  <h1>PULSE // OPS</h1>
  <p><strong>Real-Time Mission-Critical Incident Response & Infrastructure Telemetry Platform</strong></p>

  [![Stack](https://img.shields.io/badge/Stack-Next.js_16_|_Laravel_13-amber?style=for-the-badge)](https://github.com/ZainabM63/Pulse-ops)
  [![Database](https://img.shields.io/badge/Database-SQLite_|_PostgreSQL-blue?style=for-the-badge)](#)
  [![Real-Time](https://img.shields.io/badge/WebSockets-Laravel_Reverb-emerald?style=for-the-badge)](#)
  [![AI](https://img.shields.io/badge/AI-Google_Gemini-purple?style=for-the-badge)](#)
  [![License](https://img.shields.io/badge/License-MIT-slate?style=for-the-badge)](#)

  <br />

  <p>
    An enterprise-grade B2B command center designed for engineering teams to monitor microservice SLAs, triage outages, manage on-call rotations, collaborate in real-time Incident War Rooms, and run an AI remediation agent.
  </p>

</div>

---

## 📸 Key Interfaces & System Design

| View | Capabilities |
| :--- | :--- |
| **Incident Command Matrix** | Real-time outage triage, impact blast-radius calculators, MTTR/MTTA metrics, status steppers, and monospace telemetry log stream. |
| **Digital War Room** | Live websocket chat, terminal slash commands (`/ack`, `/escalate`, `/status`, `/help`), audio voice notes, and Root Cause Hypothesis tracking (confidence scoring, evidence, confirm/ruled-out workflow). |
| **AI Remediation Agent** | Gemini-powered multi-round agent runs: diagnose → remediate → notify → follow-up, with 9 executable tool actions, chat interface, and autonomous/sequential modes. |
| **Teams & On-Call Hub** | Visual rotation shift schedules, automated multi-level escalation policies, fatigue index tracking, and shift handover audit logs. |
| **Service Health Registry** | Service SLO error budget depletion trackers, latency/error-rate metrics, and circuit breaker state monitoring (closed/open/half-open). |

---

## ✨ Architectural Features & High-Value Capabilities

### 🤖 1. AI Incident Response Agent (Google Gemini)
* **Multi-Round Remediation Loop:** The agent observes service state, proposes tool calls, executes them, feeds results back, and re-decides (up to 5 rounds) until the incident is handled — with automatic deduplication and progress detection.
* **9 Tool Actions:** `restart_service`, `scale_resources`, `rollback_deployment`, `send_notification` (real Slack/Teams webhooks), `run_diagnostics`, `create_followup`, `generate_postmortem`, `resolve_incident`, `update_service_status`.
* **Run Persistence & Safety:** Every run and action is stored (`agent_runs`, `agent_actions`), ownership is enforced (403 on foreign runs), and rate-limited (30 req/min). A deterministic keyword fallback brain keeps the agent functional without an API key.

### 🎙️ 2. Real-Time Collaboration & Audio Messaging
* **In-Room Voice Notes:** Record and stream voice memos inside the Incident War Room using the browser's native `MediaRecorder` API, delivered over Laravel Reverb WebSockets.
* **Dispatch Voice Announcer:** Hands-free audible synthesized voice alerts (`SpeechSynthesisUtterance`) for critical P0 emergency arrivals.
* **Terminal Command Palette (`/command`):** Execute war-room commands directly from the prompt (`/ack`, `/escalate`, `/status`, `/help`, `/attach-log`).

### ⚙️ 3. Enterprise Infrastructure Management
* **SLO & Error Budget Drain Tracker:** Real-time tracking of service reliability targets and active error budget depletion per service.
* **Circuit Breaker Control:** Toggle circuit breaker states per service directly from the Service Health Registry.
* **On-Call Fatigue Analytics & Shift Handovers:** Off-hours alert frequency monitoring and audited shift transition logs between outgoing and incoming responders.
* **Root Cause Hypotheses:** Structured hypothesis workflow per incident — confidence scores, evidence JSON, owner assignment, and investigating/hypothesis/ruled_out/confirmed statuses.

### ⚡ 4. Real-Time Telemetry & Async Processing
* **Event-Driven WebSockets:** Powered by **Laravel Reverb** for instant state synchronization (`chat.message`, `incident.updated`, `notification.created`) across all connected clients.
* **Background Queue Pipeline:** Asynchronous broadcast dispatch via **Laravel Queues** for notifications and real-time updates.

---

## 🛠️ Tech Stack & System Architecture

* **Frontend:** Next.js 16 (App Router, client-side), TypeScript, React 19, Tailwind CSS v4, Lucide Icons, `next-themes` (Dual Light/Dark Mode), Laravel Echo + pusher-js.
* **Backend:** Laravel 13 JSON API (`/api/v1`), Laravel Sanctum (Stateless Token Auth), Laravel Reverb (WebSocket Broadcaster), Laravel Queues (database driver).
* **Database:** SQLite (local development) / PostgreSQL (production, Neon).
* **Multi-Tenancy:** Global query scope isolating all records by `company_id`.
* **AI:** Google Gemini function-calling API with keyword fallback brain.

---

## 🚀 Local Development Setup

### Prerequisites
* **Node.js** >= 18.x
* **PHP** >= 8.3
* **Composer**

---

### Backend Setup (Laravel API)

```bash
# Clone repository
git clone https://github.com/ZainabM63/Pulse-ops.git
cd Pulse-ops

# Install PHP dependencies
composer install

# Environment configuration
cp .env.example .env
php artisan key:generate

# Configure database & run migrations
# (SQLite: touch database/database.sqlite — already committed for dev)
php artisan migrate --seed

# Start development servers
php artisan serve          # API on http://localhost:8000
php artisan queue:work     # for queued broadcast events
php artisan reverb:start   # WebSockets on port 8080
```

### Frontend Setup (Next.js SPA)

```bash
# Navigate to frontend folder
cd frontend

# Install Node dependencies
npm install

# Environment configuration (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_REVERB_APP_KEY=your-reverb-key
NEXT_PUBLIC_REVERB_HOST=localhost
NEXT_PUBLIC_REVERB_PORT=8080
NEXT_PUBLIC_REVERB_SCHEME=http

# Run Next.js dev server
npm run dev
```

### Demo Account

```
Email:    sarah@acme.com
Password: password
```

---

## 🧪 Testing

```bash
composer test
```

~80 PHPUnit tests across 14 files covering notifications, agent authorization,
multi-round agent loops, all 9 executor tools, Gemini brain parsing (skipped
without `GEMINI_API_KEY`), and run mode lifecycles. Tests run on in-memory
SQLite with a deterministic keyword brain.

---

## 📚 API Overview

All endpoints live under `/api/v1` (47 routes total):

| Area | Endpoints |
| :--- | :--- |
| **Auth** | `POST /register`, `POST /login`, `POST /logout`, `GET /user` |
| **Incidents** | Full resource CRUD + `POST|GET /incidents/{id}/chat`, `POST /incidents/{id}/activity`, hypotheses resource |
| **Services** | Full resource CRUD + `PATCH /services/{id}/circuit-breaker` |
| **Teams** | Full resource CRUD + `GET /teams/users` |
| **Agent** | `GET /agent/health`, `GET|POST /agent/runs`, `GET /agent/runs/{run}`, `POST .../chat|execute|cancel` (throttled) |
| **Telemetry** | `GET|POST /telemetry` |
| **Dashboard** | `GET /dashboard`, `GET /activity-log` |
| **Notifications** | `GET /notifications`, `POST /notifications/read` |

---

## 📁 Project Structure

```
├── api/index.php            Vercel serverless entry
├── app/
│   ├── Events/              3 broadcast events (chat, incident, notification)
│   ├── Http/Controllers/Api/V1/   10 API controllers
│   ├── Http/Requests/       5 form requests
│   ├── Http/Resources/      9 API resources
│   ├── Models/              11 Eloquent models
│   ├── Scopes/              CompanyScope (multi-tenancy)
│   ├── Services/            AgentBrain, MockAgentBrain, AgentActionExecutor, IncidentNotifier
│   └── Traits/              BelongsToCompany
├── database/migrations/     21 migrations + idempotent demo seeder
├── frontend/                Next.js 16 SPA (src/app, components, hooks, lib)
├── routes/                  api.php, web.php, channels.php
└── tests/                   Unit + Feature (~80 tests)
```

See `PROJECT_OVERVIEW.txt` for the full detailed feature breakdown and `memory.md` for the in-depth architecture reference.
