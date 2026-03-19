# 🚀 Mission Controller — OpenClaw Agent Dashboard

A real-time visualization and control dashboard for OpenClaw AI agents. Built with React + Express, it gives you a NASA mission control-style view into all your running agents.

## Features

- **Live Dashboard** — Real-time list of all agents with status, model, runtime, tokens
- **Agent Detail View** — Full task, logs, token breakdown, session key
- **Control Panel** — Spawn new agents, kill running ones, steer with messages
- **Timeline View** — Visual horizontal timeline of agent activity over time
- **Stats Panel** — Token usage, cost estimates, success rate, model distribution charts
- **Filters** — Filter by status, model, project; search by task text
- **WebSocket Live Updates** — Changes broadcast in ~2s, HTTP polling fallback
- **Toast Notifications** — Alerts when agents complete or fail
- **Space Aesthetic** — Dark mode, neon green/blue accents, monospace fonts

## Setup

```bash
# Install backend dependencies
cd /tmp/mission-controller/backend
npm install

# Install frontend dependencies
cd /tmp/mission-controller/frontend
npm install
```

## Running

### Quick start (two terminals)

**Terminal 1 — Backend (port 3334):**
```bash
cd /tmp/mission-controller/backend
node server.js
```

**Terminal 2 — Frontend (port 3333):**
```bash
cd /tmp/mission-controller/frontend
npx vite --port 3333 --host
```

Then open: **http://localhost:3333**

### Or use the start script:
```bash
cd /tmp/mission-controller
./start.sh
```

## How it works

The backend reads directly from OpenClaw's local state files:
- `~/.openclaw/subagents/runs.json` — Subagent run data (task, model, status, timing)
- `~/.openclaw/agents/main/sessions/sessions.json` — Session token usage
- `~/.openclaw/agents/main/sessions/{sessionId}.jsonl` — Conversation transcripts

It polls these files every 2 seconds and broadcasts changes via WebSocket.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/agents | List all agents |
| GET | /api/agents/:id | Agent details + logs |
| POST | /api/agents | Spawn new agent |
| DELETE | /api/agents/:id | Kill running agent |
| POST | /api/agents/:id/steer | Steer agent focus |
| GET | /api/stats | Dashboard statistics |
| GET | /api/timeline | Timeline data |

## Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Recharts, React Query, Zustand, Lucide
- **Backend:** Express, ws (WebSocket), Node.js 18+

## Design

- Space/mission control aesthetic
- Neon green (#00ff88) and blue (#00d4ff) accents
- JetBrains Mono for logs and code
- Responsive (mobile-friendly)
- CRT scanline overlay for the aesthetic
