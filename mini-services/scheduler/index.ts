/**
 * Scheduler mini-service — entry point (Module 8).
 *
 * Standalone Bun process that polls the shared SQLite database every 30s
 * and publishes any post whose `scheduledAt` has arrived, plus any post
 * in `failed` status whose `nextRetryAt` has arrived and that hasn't
 * exhausted its 5 retries.
 *
 * The scheduler does NOT talk to the main Next.js app over HTTP — they
 * share the database. The HTTP server on port 3003 is for operational
 * introspection only (health check + stats).
 *
 * Run with: `bun run dev` (hot reload) or `bun run start` (no hot reload).
 */
import { PrismaClient } from '@prisma/client'
import { publishPost, getStats, setPending } from './publisher'
import path from 'path'

// ── Config ────────────────────────────────────────────────

const PORT = 3003
const POLL_INTERVAL_MS = 30_000
const TICK_BATCH_SIZE = 20 // max new posts per tick
const RETRY_BATCH_SIZE = 10 // max retries per tick

// ── DB client ─────────────────────────────────────────────

// Bun auto-loads .env from the cwd, so DATABASE_URL is set before this runs.
// Portable fallback: use a relative path based on the parent project's cwd.
// This works on any machine — not just /home/z/my-project.
if (!process.env.DATABASE_URL) {
  // The scheduler lives in <project-root>/mini-services/scheduler/, so the
  // project root is two levels up. We use path.resolve to get an absolute
  // path for the SQLite file (Prisma needs an absolute path on some OSes).
  const projectRoot = path.resolve(__dirname, '..', '..')
  process.env.DATABASE_URL = `file:${path.join(projectRoot, 'db', 'custom.db')}`
}

const db = new PrismaClient()

// ── Logging helper ────────────────────────────────────────

function ts(): string {
  return new Date().toISOString()
}
function log(level: 'INFO' | 'WARN' | 'ERROR', msg: string): void {
  const line = `[${ts()}] [${level}] ${msg}`
  if (level === 'ERROR') console.error(line)
  else if (level === 'WARN') console.warn(line)
  else console.log(line)
}

log('INFO', `scheduler starting — port=${PORT} pollInterval=${POLL_INTERVAL_MS}ms`)

// ── Tick state ────────────────────────────────────────────

let lastTick: Date | null = null
let ticking = false // guard against overlapping ticks if a tick takes >30s
let shuttingDown = false

// ── HTTP status server ────────────────────────────────────

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url)

    if (url.pathname === '/health') {
      return Response.json({ ok: true })
    }

    if (url.pathname === '/' || url.pathname === '/status') {
      return Response.json({
        service: 'scheduler',
        status: shuttingDown ? 'shutting-down' : 'running',
        uptime: process.uptime(),
        lastTick: lastTick?.toISOString() ?? null,
        stats: getStats(),
      })
    }

    return new Response('Not found', { status: 404 })
  },
})

log('INFO', `status server listening on http://localhost:${PORT}`)

// ── Tick loop ─────────────────────────────────────────────

async function tick(): Promise<void> {
  if (ticking || shuttingDown) return
  ticking = true
  const tickStart = Date.now()
  lastTick = new Date()
  const now = lastTick

  try {
    // Posts whose scheduledAt has arrived.
    const due = await db.post.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { lte: now },
      },
      take: TICK_BATCH_SIZE,
      orderBy: { scheduledAt: 'asc' },
    })

    // Posts that previously failed and whose nextRetryAt has arrived
    // (and that haven't exhausted their 5 retries).
    const retryDue = await db.post.findMany({
      where: {
        status: 'failed',
        nextRetryAt: { lte: now },
        retryCount: { lt: 5 },
      },
      take: RETRY_BATCH_SIZE,
      orderBy: { nextRetryAt: 'asc' },
    })

    // Refresh the "pending" stat: how many posts are still waiting to be
    // picked up (scheduled but not yet due).
    const pendingCount = await db.post.count({
      where: {
        status: 'scheduled',
        scheduledAt: { gt: now },
      },
    })
    setPending(pendingCount)

    log(
      'INFO',
      `tick due=${due.length} retryDue=${retryDue.length} pending=${pendingCount}`,
    )

    const all = [...due, ...retryDue]
    for (const post of all) {
      if (shuttingDown) {
        log('WARN', `tick aborted mid-batch (shutdown signal); ${all.length - all.indexOf(post)} posts deferred to next run`)
        break
      }
      const isRetry = retryDue.includes(post)
      log(
        'INFO',
        `picking up post=${post.id} retry=${isRetry} retryCount=${post.retryCount} scheduledAt=${post.scheduledAt?.toISOString() ?? 'null'}`,
      )
      try {
        const result = await publishPost(db, post.id)
        if (result.success) {
          log(
            'INFO',
            `published post=${post.id} externalId=${result.externalPostId ?? 'n/a'} simulated=${result.simulated}`,
          )
        } else {
          // recordFailure already logged the details.
          log(
            'WARN',
            `publish failed post=${post.id} error=${result.error ?? 'unknown'}`,
          )
        }
      } catch (err) {
        // Shouldn't happen — publishPost catches its own errors — but guard
        // so one bad post can't kill the whole tick.
        log('ERROR', `unexpected error publishing post=${post.id}: ${err}`)
      }
    }

    const elapsed = Date.now() - tickStart
    log('INFO', `tick complete in ${elapsed}ms`)
  } catch (err) {
    log('ERROR', `tick failed: ${err}`)
  } finally {
    ticking = false
  }
}

// ── Schedule ──────────────────────────────────────────────

// Fire one tick immediately so we don't wait 30s on cold start.
tick().catch((err) => log('ERROR', `initial tick crashed: ${err}`))

const interval = setInterval(() => {
  tick().catch((err) => log('ERROR', `tick crashed: ${err}`))
}, POLL_INTERVAL_MS)

// ── Graceful shutdown ─────────────────────────────────────

async function shutdown(signal: 'SIGINT' | 'SIGTERM'): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  log('INFO', `${signal} received — shutting down (may take up to 30s to finish current tick)`)

  clearInterval(interval)

  // Give the current tick up to 30 seconds to finish.
  const deadline = Date.now() + 30_000
  while (ticking && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200))
  }

  try {
    await db.$disconnect()
    log('INFO', 'database disconnected')
  } catch (err) {
    log('ERROR', `db disconnect failed: ${err}`)
  }

  server.stop(true)
  log('INFO', 'goodbye')
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
