# Scheduler mini-service (Module 8)

A standalone Bun process that polls the shared SQLite database every 30 seconds and publishes any post whose `scheduledAt` has arrived. Also retries previously-failed posts using an exponential-backoff schedule. This is the job queue + worker described in Module 8 of the architecture doc.

## What it does

1. **Polls every 30s** for posts where `status = 'scheduled'` AND `scheduledAt <= now()`.
2. **Also polls** for posts where `status = 'failed'` AND `nextRetryAt <= now()` AND `retryCount < 5`.
3. For each due post, runs the simulated Facebook publisher: marks the post as `publishing`, sleeps 600–1400ms to mimic network latency, has a 5% chance of simulated transient failure (to exercise the retry path), and otherwise returns a fake external post id of the form `sim_<pageId>_<postId>_<timestamp>`.
4. On success: sets `status = 'published'`, `publishedAt`, `externalPostId`, clears `failureReason`, and bumps `destination.lastPostAt`.
5. On failure: increments `retryCount`, sets `failureReason`, and schedules `nextRetryAt` via exponential backoff (see below). After 5 attempts the post is marked permanently `failed` and will not be retried.
6. Exposes a small HTTP status endpoint on port 3003 for operational introspection.
7. Handles `SIGINT` / `SIGTERM` gracefully — finishes the current tick, disconnects the DB, exits cleanly.

## How to run

```bash
cd /home/z/my-project/mini-services/scheduler
bun install           # first time only — installs @prisma/client + bun-types
bun run dev           # hot reload (recommended during development)
# or
bun run start         # no hot reload (production-style)
```

Or from the project root:

```bash
bun run scheduler     # runs `cd mini-services/scheduler && bun run dev`
```

## Configuration

| Setting | Value | Notes |
| --- | --- | --- |
| Port | `3003` | Hard-coded, not via env. |
| Poll interval | `30_000 ms` | Hard-coded. |
| Batch size per tick | `20` new posts + `10` retries | Prevents one tick from monopolising the event loop. |
| Database | `file:/home/z/my-project/db/custom.db` | Set in `.env`; Bun auto-loads it. |
| Prisma client | Parent project's `node_modules/@prisma/client` | Imported via relative path; uses the same generated client as the Next.js app. |

## Retry / backoff schedule

When a publish attempt fails, the post is marked `failed` and scheduled for retry at `now + backoff + jitter`:

| Retry # | Wait |
| --- | --- |
| 1 | 1 minute |
| 2 | 5 minutes |
| 3 | 15 minutes |
| 4 | 60 minutes |
| 5+ | Marked permanently `failed` (no further retries) |

Up to 10% jitter is added to each delay to avoid the thundering-herd problem when many posts fail simultaneously.

## HTTP endpoints

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/health` | `200 { "ok": true }` |
| `GET` | `/` or `/status` | `200 { service, status, uptime, lastTick, stats }` where `stats = { published, failed, retried, pending }` |
| * | * | `404 Not found` |

The scheduler does NOT need to be reachable from the main Next.js app. They share the database — that is the only coupling. The HTTP server is for operational checks only.

## How it shares the DB with the main app

- Both the Next.js app and the scheduler read/write the same SQLite file at `/home/z/my-project/db/custom.db`.
- Both use the same Prisma schema (`/home/z/my-project/prisma/schema.prisma`).
- The scheduler imports `PrismaClient` from the parent project's `node_modules/@prisma/client`, so it uses the parent's already-generated client. There is no separate `prisma generate` step.
- SQLite handles concurrent readers fine; the scheduler writes one post at a time per tick, so contention with the app is negligible.

## Independence from the main Next.js app

The scheduler is a **completely separate process**. It does not:

- Import anything from `src/` in the parent project (the publisher logic is reimplemented locally to avoid the `@/lib/db` path alias).
- Depend on the Next.js dev server being up.
- Require any HTTP call from the app.

You can start/stop/restart the scheduler without touching the Next.js app, and vice versa. The only shared state is the SQLite database file.

## Verification

```bash
# Health check
curl http://localhost:3003/health
# → {"ok":true}

# Status
curl http://localhost:3003/
# → {"service":"scheduler","status":"running","uptime":12.34,"lastTick":"2026-...","stats":{"published":0,"failed":0,"retried":0,"pending":2}}

# End-to-end test: set a scheduled post's scheduledAt to the past
# (run from the project root)
bun -e "import { PrismaClient } from '@prisma/client'; const db = new PrismaClient(); const p = await db.post.findFirst({ where: { status: 'scheduled' } }); await db.post.update({ where: { id: p.id }, data: { scheduledAt: new Date(Date.now() - 1000) } }); console.log('reset scheduledAt for', p.id); await db.\$disconnect();"
# Within 30s the scheduler log will show it picked up the post, marked it
# 'publishing', then 'published'. The /stats endpoint will reflect +1 published.
```

## Files

```
mini-services/scheduler/
  package.json     # @prisma/client + bun-types
  tsconfig.json    # ESNext, bundler resolution, bun-types, @prisma/client path alias
  .env             # DATABASE_URL pointing at the shared SQLite file
  index.ts         # entry — poller + HTTP server + graceful shutdown
  publisher.ts     # reimplemented simulated FB publisher + backoff + stats
  README.md        # this file
```
