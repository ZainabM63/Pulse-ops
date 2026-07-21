<div align="center">

  <h1>PULSE // OPS</h1>
  <p><strong>Real-Time Mission-Critical Incident Response & Infrastructure Telemetry Platform</strong></p>

  [![Stack](https://img.shields.io/badge/Stack-Next.js_14_|_Laravel_13-amber?style=for-the-badge)](https://github.com/ZainabM63/Pulse-ops)
  [![Database](https://img.shields.io/badge/Database-PostgreSQL_|_Redis-blue?style=for-the-badge)](#)
  [![Real-Time](https://img.shields.io/badge/WebSockets-Laravel_Reverb-emerald?style=for-the-badge)](#)
  [![License](https://img.shields.io/badge/License-MIT-slate?style=for-the-badge)](#)

  <br />

  <p>
    An enterprise-grade B2B command center designed for engineering teams to monitor microservice SLAs, triage outages, manage on-call rotations, and collaborate in real-time Incident War Rooms.
  </p>

</div>

---

## 📸 Key Interfaces & System Design

| View | Capabilities |
| :--- | :--- |
| **Incident Command Matrix** | Real-time outage triage, impact blast-radius calculators, MTTR/MTTA metrics, and monospace telemetry log stream. |
| **Digital War Room** | Multi-user presence indicators, live websocket chat, terminal slash commands (`/ack`, `/escalate`), and audio voice notes. |
| **Teams & On-Call Hub** | Visual rotation shift schedules, automated multi-level escalation policies, and fatigue index tracking. |
| **Service Health Registry** | Service SLO error budget depletion rate trackers, latency ticks, and circuit breaker status monitoring. |

---

## ✨ Architectural Features & High-Value Capabilities

### 🎙️ 1. Real-Time Collaboration & Audio Messaging
* **In-Room Voice Notes:** Record and stream `.webm` voice memos inside the Incident War Room using the browser's native `MediaRecorder` API and Laravel Reverb WebSockets.
* **Dispatch Voice Announcer:** Hands-free audible synthesized voice alerts (`SpeechSynthesisUtterance`) for critical P0 emergency arrivals.
* **Terminal Command Palette (`/command`):** Execute server remediation scripts directly from the War Room prompt (`/ack`, `/p1`, `/runbook restart-pods`).

### ⚙️ 2. Enterprise Infrastructure Management
* **SLO & Error Budget Drain Tracker:** Real-time mathematical tracking of service reliability targets (`99.9%`) and active error budget depletion.
* **On-Call Fatigue Analytics:** Calculates off-hours alert frequencies to monitor team workload and prevent engineer burnout.
* **Shift Handover Audit Logs:** Asynchronous shift transition logs between outgoing primary responders and incoming secondary engineers.

### ⚡ 3. Real-Time Telemetry & Async Processing
* **Event-Driven WebSockets:** Powered by **Laravel Reverb** for instant state synchronization across all connected clients without browser polling.
* **Background Queue Pipeline:** Asynchronous job delegation via **Laravel Queues & Redis** for automated escalation timeouts and email/Slack dispatches.

---

## 🛠️ Tech Stack & System Architecture

* **Frontend:** Next.js 14 (App Router), TypeScript, React, Tailwind CSS, Lucide Icons, `next-themes` (Dual Light/Dark Mode).
* **Backend:** Laravel 13 API, Laravel Sanctum (Stateless Token Auth), Laravel Reverb (WebSocket Broadcaster), Laravel Queues (Redis Driver).
* **Database & Caching:** PostgreSQL / MySQL, Redis (Session/Queue/Cache Store).

---

## 🚀 Local Development Setup

### Prerequisites
* **Node.js** >= 18.x
* **PHP** >= 8.3
* **Composer**
* **Redis** (Local or Docker)

---

### Backend Setup (Laravel API)

```bash
# Clone repository
git clone [https://github.com/ZainabM63/Pulse-ops.git](https://github.com/ZainabM63/Pulse-ops.git)
cd Pulse-ops

# Install PHP dependencies
composer install

# Environment configuration
cp .env.example .env
php artisan key:generate

# Configure database & run migrations
php artisan migrate --seed

# Create storage link for audio voice notes
php artisan storage:link

# Start development servers
php artisan serve
php artisan queue:work
php artisan reverb:start

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
