/**
 * Publisher adapter pattern (Module 8).
 *
 * The rest of the app talks to a generic `Publisher` interface. Each platform
 * has its own adapter that knows how that platform's API works. Adding a new
 * platform means adding a new adapter — nothing else in the codebase changes.
 *
 * In this sandbox there are no real Facebook credentials (Meta requires app
 * review for the Pages Publishing API). The Facebook adapter therefore runs
 * in SIMULATION mode: it pretends to publish, sleeps for a moment to mimic
 * network latency, writes a fake external post id, and returns success.
 *
 * The adapter is structured so that swapping in the real Graph API later is
 * a drop-in change — replace the body of `publish()` with a fetch() to
 * https://graph.facebook.com/v18.0/{page-id}/feed and the rest of the system
 * keeps working.
 */
import 'server-only'
import { db } from './db'
import type { Post } from '@prisma/client'

export interface PublishInput {
  post: Post
  destination: {
    id: string
    name: string
    type: string
    externalId: string | null
    platform: string
  }
  accessToken: string | null
}

export interface PublishResult {
  success: boolean
  externalPostId?: string
  error?: string
  /** Whether the publish actually went to the platform or was simulated. */
  simulated: boolean
}

export interface Publisher {
  platform: string
  publish(input: PublishInput): Promise<PublishResult>
}

// ── Facebook Page adapter (simulated) ──────────────────────

class FacebookPublisher implements Publisher {
  platform = 'facebook'

  async publish(input: PublishInput): Promise<PublishResult> {
    const { destination, post } = input

    // Real implementation would do:
    //
    //   const res = await fetch(
    //     `https://graph.facebook.com/v18.0/${destination.externalId}/feed`,
    //     {
    //       method: 'POST',
    //       headers: { 'Content-Type': 'application/json' },
    //       body: JSON.stringify({
    //         message: post.caption,
    //         access_token: input.accessToken,
    //       }),
    //     },
    //   )
    //   const json = await res.json()
    //   if (!res.ok) return { success: false, error: json.error?.message, simulated: false }
    //   return { success: true, externalPostId: json.id, simulated: false }
    //
    // Sandbox: simulate.

    await new Promise((r) => setTimeout(r, 600 + Math.random() * 800))

    // 5% chance of a simulated transient failure so the retry/backoff logic
    // is exercised end-to-end.
    if (Math.random() < 0.05) {
      return {
        success: false,
        error: 'Simulated transient error: Facebook API returned 503.',
        simulated: true,
      }
    }

    const externalPostId = `sim_${destination.externalId ?? destination.id}_${post.id}_${Date.now()}`

    return {
      success: true,
      externalPostId,
      simulated: true,
    }
  }
}

// ── Registry ───────────────────────────────────────────────

const publishers: Record<string, Publisher> = {
  facebook: new FacebookPublisher(),
}

export function getPublisher(platform: string): Publisher | null {
  return publishers[platform] ?? null
}

/**
 * High-level helper used by the scheduler. Looks up the destination's account,
 * finds the right adapter, publishes, and updates the Post row in the DB.
 */
export async function publishPost(postId: string): Promise<PublishResult> {
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

  const publisher = getPublisher(post.destination.socialAccount.platform)
  if (!publisher) {
    return {
      success: false,
      error: `No publisher adapter for platform "${post.destination.socialAccount.platform}"`,
      simulated: false,
    }
  }

  // Mark as publishing
  await db.post.update({
    where: { id: postId },
    data: { status: 'publishing' },
  })

  try {
    const result = await publisher.publish({
      post,
      destination: {
        id: post.destination.id,
        name: post.destination.name,
        type: post.destination.type,
        externalId: post.destination.externalId,
        platform: post.destination.socialAccount.platform,
      },
      accessToken: post.destination.socialAccount.accessToken,
    })

    if (result.success) {
      await db.post.update({
        where: { id: postId },
        data: {
          status: 'published',
          publishedAt: new Date(),
          externalPostId: result.externalPostId,
          failureReason: null,
        },
      })
      // Update destination lastPostAt
      await db.destination.update({
        where: { id: post.destination.id },
        data: { lastPostAt: new Date() },
      })
    } else {
      await db.post.update({
        where: { id: postId },
        data: {
          status: 'failed',
          failureReason: result.error ?? 'Unknown error',
          retryCount: { increment: 1 },
        },
      })
    }

    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db.post.update({
      where: { id: postId },
      data: {
        status: 'failed',
        failureReason: message,
        retryCount: { increment: 1 },
      },
    })
    return { success: false, error: message, simulated: false }
  }
}
