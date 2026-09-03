/**
 * Scheduler mini-service — Publisher (Module 8).
 *
 * This is a self-contained reimplementation of the parent project's
 * `src/lib/publisher.ts`. We can't import across the workspace boundary
 * (the parent uses `@/lib/db` path aliasing tied to its Next.js config),
 * so the scheduler ships its own copy. It walks the same DB rows and uses
 * the same status transitions as the main app, which means a post picked
 * up by the scheduler will look identical to one published via the UI's
 * "Publish now" button.
 *
 * Differences from the parent publisher:
 *   • Takes a PrismaClient instance (so the caller owns the connection).
 *   • Records retry/backoff state on failure (nextRetryAt, retryCount).
 *   • Maintains in-memory stats counters for the /status endpoint.
 *
 * The Facebook adapter is simulated — see the comment block inside
 * `simulateFacebookPublish` for the production Graph API equivalent.
 */
import type { PrismaClient } from '../../node_modules/@prisma/client'

// ── Types ─────────────────────────────────────────────────

export interface PublishResult {
  success: boolean
  externalPostId?: string
  error?: string
  /** Whether the publish actually went to the platform or was simulated. */
  simulated: boolean
}

export interface SchedulerStats {
  /** Successfully published posts since the service started. */
  published: number
  /** Permanently failed posts (retryCount >= 5) since the service started. */
  failed: number
  /** Retry attempts made (transient failures that will be retried) since start. */
  retried: number
  /** Posts currently in `scheduled` status (awaiting their scheduledAt). */
  pending: number
}

// ── In-memory stats ───────────────────────────────────────

const stats: SchedulerStats = {
  published: 0,
  failed: 0,
  retried: 0,
  pending: 0,
}

export function getStats(): SchedulerStats {
  return { ...stats }
}

/** Called by index.ts after each tick to refresh the pending count. */
export function setPending(count: number): void {
  stats.pending = count
}

// ── Backoff schedule ──────────────────────────────────────

/**
 * Exponential backoff for retries:
 *   Retry 1 →  +1  minute
 *   Retry 2 →  +5  minutes
 *   Retry 3 →  +15 minutes
 *   Retry 4 →  +60 minutes
 *   Retry 5 →  mark as `failed` permanently (no nextRetryAt).
 *
 * `retryCount` here is the count AFTER the latest failed attempt
 * (i.e. the value already written to the DB by `recordFailure`).
 *
 * Returns null when the post should NOT be retried again.
 */
export function getBackoffMs(retryCount: number): number | null {
  const baseMs = (() => {
    switch (retryCount) {
      case 1:
        return 60 * 1000 // 1 minute
      case 2:
        return 5 * 60 * 1000 // 5 minutes
      case 3:
        return 15 * 60 * 1000 // 15 minutes
      case 4:
        return 60 * 60 * 1000 // 60 minutes
      default:
        return null // retryCount >= 5 → permanent failure
    }
  })()
  if (baseMs === null) return null

  // Add up to 10% jitter to avoid thundering herd on mass failures.
  const jitterRatio = Math.random() * 0.1
  return Math.round(baseMs * (1 + jitterRatio))
}

// ── Simulated Facebook publisher ─────────────────────────

/**
 * Simulates a Facebook Graph API publish call.
 *
 * Production equivalent (drop-in replacement for the body of this fn):
 *
 *   const res = await fetch(
 *     `https://graph.facebook.com/v18.0/${destination.externalId}/feed`,
 *     {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({
 *         message: `${post.hook ?? ''}\n\n${post.caption}\n\n${post.cta ?? ''}`,
 *         access_token: accessToken,
 *       }),
 *     },
 *   )
 *   const json = await res.json()
 *   if (!res.ok) {
 *     return { success: false, error: json.error?.message ?? `HTTP ${res.status}`, simulated: false }
 *   }
 *   return { success: true, externalPostId: json.id, simulated: false }
 *
 * In sandbox mode we have no real credentials, so we simulate:
 *   • 600-1400ms of "network" latency
 *   • 5% chance of a transient 503-style failure to exercise retries
 *   • A deterministic-looking fake external post id
 */
async function simulateFacebookPublish(input: {
  post: { id: string; hook: string | null; caption: string; cta: string | null }
  destination: { id: string; externalId: string | null }
  accessToken: string | null
}): Promise<PublishResult> {
  // Sleep 600-1400ms to mimic network latency.
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 800))

  // 5% transient failure so retry/backoff logic gets exercised end-to-end.
  if (Math.random() < 0.05) {
    return {
      success: false,
      error: 'Simulated transient error: Facebook API returned 503 Service Unavailable.',
      simulated: true,
    }
  }

  const externalPostId = `sim_${input.destination.externalId ?? input.destination.id}_${input.post.id}_${Date.now()}`
  return {
    success: true,
    externalPostId,
    simulated: true,
  }
}

// ── High-level publishPost ───────────────────────────────

/**
 * Look up the post + destination + socialAccount, mark as `publishing`,
 * call the simulated Facebook adapter, and update the DB with the result.
 *
 * On success:
 *   • status → 'published'
 *   • publishedAt set
 *   • externalPostId set
 *   • failureReason cleared
 *   • destination.lastPostAt bumped
 *
 * On failure:
 *   • retryCount incremented
 *   • failureReason set
 *   • If retryCount >= 5 → status stays 'failed' permanently (no nextRetryAt)
 *   • Else → status stays 'failed', nextRetryAt set via exponential backoff + jitter
 */
export async function publishPost(
  db: PrismaClient,
  postId: string,
): Promise<PublishResult> {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: {
      destination: {
        include: {
          socialAccount: true,
        },
      },
    },
  })

  if (!post) {
    return { success: false, error: 'Post not found', simulated: false }
  }

  if (!post.destination) {
    return {
      success: false,
      error: 'Post has no destination assigned',
      simulated: false,
    }
  }

  const platform = post.destination.socialAccount.platform
  if (platform !== 'facebook') {
    return {
      success: false,
      error: `No publisher adapter for platform "${platform}"`,
      simulated: false,
    }
  }

  // Mark as publishing so the UI / status endpoint sees the in-flight state.
  await db.post.update({
    where: { id: postId },
    data: { status: 'publishing' },
  })

  try {
    const result = await simulateFacebookPublish({
      post: {
        id: post.id,
        hook: post.hook,
        caption: post.caption,
        cta: post.cta,
      },
      destination: {
        id: post.destination.id,
        externalId: post.destination.externalId,
      },
      accessToken: post.destination.socialAccount.accessToken,
    })

    if (result.success) {
      // ── Success path ──
      await db.post.update({
        where: { id: postId },
        data: {
          status: 'published',
          publishedAt: new Date(),
          externalPostId: result.externalPostId,
          failureReason: null,
          nextRetryAt: null,
        },
      })
      await db.destination.update({
        where: { id: post.destination.id },
        data: { lastPostAt: new Date() },
      })
      stats.published += 1
      return result
    }

    // ── Failure path (transient) ──
    await recordFailure(db, postId, result.error ?? 'Unknown error')
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await recordFailure(db, postId, message)
    return { success: false, error: message, simulated: false }
  }
}

/**
 * Write the failure outcome to the DB and bump stats.
 * Sets `nextRetryAt` for retries 1-4; leaves it null when retryCount >= 5
 * (permanent failure — status stays 'failed', the tick loop will skip it).
 */
async function recordFailure(
  db: PrismaClient,
  postId: string,
  reason: string,
): Promise<void> {
  // Fetch current retryCount so we can compute nextRetryAt accurately.
  const current = await db.post.findUnique({
    where: { id: postId },
    select: { retryCount: true },
  })
  const newRetryCount = (current?.retryCount ?? 0) + 1
  const backoffMs = getBackoffMs(newRetryCount)

  if (backoffMs === null) {
    // Permanent failure — retryCount has hit 5.
    await db.post.update({
      where: { id: postId },
      data: {
        status: 'failed',
        failureReason: `${reason} (permanent failure after ${newRetryCount} attempts)`,
        retryCount: newRetryCount,
        nextRetryAt: null,
      },
    })
    stats.failed += 1
    console.error(
      `[publish] post=${postId} PERMANENT FAILURE retryCount=${newRetryCount}: ${reason}`,
    )
  } else {
    const nextRetryAt = new Date(Date.now() + backoffMs)
    await db.post.update({
      where: { id: postId },
      data: {
        status: 'failed',
        failureReason: reason,
        retryCount: newRetryCount,
        nextRetryAt,
      },
    })
    stats.retried += 1
    console.warn(
      `[publish] post=${postId} transient failure retryCount=${newRetryCount} nextRetryAt=${nextRetryAt.toISOString()}: ${reason}`,
    )
  }
}
