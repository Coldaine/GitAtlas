# GitAtlas sync-worker

Tiny Bun process that keeps the GitAtlas dashboard live by polling the Next.js
app's sync endpoints.

## Why it's separate from the Next.js app

The Next.js app holds all the smarts — the 5 AI routes under
`src/app/api/github/{analyze,deep-analyze,smart-search,rewrite-readme,recommendations}`
**are** the subagents. They each take input, call the OpenAI-compatible LLM,
and write back to the DB.

This worker is the *outer loop*: it just calls the orchestrator endpoint
(`/api/sync/enrich-next`) on a tight schedule so stale data gets refreshed
automatically. Running it as a separate process means a 30-second deep
analysis never blocks a user request.

## Loops

| Loop    | Endpoint                   | Default interval        |
| ------- | -------------------------- | ----------------------- |
| refresh | `POST /api/sync/refresh`   | `SYNC_REFRESH_INTERVAL` (default 900s) |
| enrich  | `POST /api/sync/enrich-next` | `SYNC_ENRICH_INTERVAL`  (default 60s)  |

## Env vars

- `SYNC_BASE_URL` — where the Next.js app is reachable (e.g. `http://localhost:3000`)
- `SYNC_USERNAME` — GitHub username to keep in sync (e.g. `Coldaine`)
- `SYNC_REFRESH_INTERVAL` — seconds between cheap "what changed" probes
- `SYNC_ENRICH_INTERVAL` — seconds between LLM enrichment ticks

## Run

```bash
cd mini-services
bun run start
```

For instant updates from GitHub, also wire a webhook to
`POST /api/webhooks/github` with `GITHUB_WEBHOOK_SECRET` set in the Next.js
app's env. The webhook marks affected repos stale and the next enrich tick
picks them up.
