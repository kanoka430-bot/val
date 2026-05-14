# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Valoranto Five Planner is a zero-dependency vanilla Node.js web app (no npm packages, no build step). See `README.md` for basic run instructions.

### Running the dev server

```bash
npm start
# Listens on http://localhost:5173 by default
# Configurable via HOST and PORT env vars
```

### Key notes

- There are **no npm dependencies** — `npm install` is effectively a no-op but safe to run.
- There is **no build step**, **no linter**, and **no automated test suite** in this repo.
- The frontend is vanilla HTML/CSS/JS served as static files by `server.mjs`.
- State is persisted to `shared-state.json` on disk; this file is gitignored.
- The app fetches agent/map data from `https://valorant-api.com/v1` at runtime; if the external API is unreachable, hardcoded fallback data is used (reduced agent roster, no map images).
- SSE (`/api/events`) provides real-time sync between clients.

### API endpoints for testing

| Endpoint | Method | Description |
|---|---|---|
| `/api/state` | GET | Fetch current shared state |
| `/api/state` | POST | Update shared state (JSON body with `state` key) |
| `/api/events` | GET | SSE stream for real-time sync |
