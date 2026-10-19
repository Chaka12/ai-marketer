/**
 * Publisher adapter pattern (Module 8).
 *
 * MODES:
 *  - SIMULATION (default): pretends to publish, returns a fake post ID.
 *    Used when FB_APP_ID + FB_APP_SECRET are not set.
 *  - LIVE: calls the real Facebook Graph API. Activated by setting
 *    FB_APP_ID + FB_APP_SECRET in the environment.
 *
 * In both modes the rest of the system behaves identically.
 */
import 'server-only'
import { db } from './db'
import { assetPublicPath } from './config'
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
  simulated: boolean
}

export interface Publisher {
  platform: string
  publish(input: PublishInput): Promise<PublishResult>
}

function isLiveMode(): boolean {
  return !!(process.env.FB_APP_ID && process.env.FB_APP_SECRET)
}

const FB_GRAPH_VERSION = 'v21.0'

class FacebookPublisher implements Publisher {
  platform = 'facebook'

  async publish(input: PublishInput): Promise<PublishResult> {
    const { destination, post } = input

    if (isLiveMode() && input.accessToken && destination.externalId) {
      return this.publishLive(input)
    }

    // SIMULATION mode
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 600))
    if (Math.random() < 0.05) {
      return {
        success: false,
        error: 'Simulated transient error (set FB_APP_ID + FB_APP_SECRET for live mode).',
        simulated: true,
      }
    }
    const externalPostId = `sim_${destination.externalId ?? destination.id}_${post.id}_${Date.now()}`
    return { success: true, externalPostId, simulated: true }
  }

  private async publishLive(input: PublishInput): Promise<PublishResult> {
    const { destination, post } = input

    const asset = post.assetId
      ? await db.asset.findUnique({ where: { id: post.assetId } })
      : null

    const hasImage = asset && asset.type === 'image' && asset.filePath

    let url: string
    let body: Record<string, unknown>

    if (hasImage) {
      const publicAssetUrl = process.env.NEXT_PUBLIC_BASE_URL
        ? `${process.env.NEXT_PUBLIC_BASE_URL}${assetPublicPath(asset.filePath)}`
        : assetPublicPath(asset.filePath)
      url = `https://graph.facebook.com/${FB_GRAPH_VERSION}/${destination.externalId}/photos`
      body = {
        caption: buildFullCaption(post),
        url: publicAssetUrl,
        access_token: input.accessToken,
        published: true,
      }
    } else {
      url = `https://graph.facebook.com/${FB_GRAPH_VERSION}/${destination.externalId}/feed`
      body = {
        message: buildFullCaption(post),
        access_token: input.accessToken,
      }
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        return {
          success: false,
          error: json.error?.message ?? `Facebook API error: ${res.status}`,
          simulated: false,
        }
      }
      return { success: true, externalPostId: json.id ?? json.post_id, simulated: false }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        simulated: false,
      }
    }
  }
}

function buildFullCaption(post: Post): string {
  const parts: string[] = []
  if (post.hook) parts.push(post.hook)
  if (post.caption) parts.push(post.caption)
  if (post.cta) parts.push(post.cta)
  try {
    const tags = JSON.parse(post.hashtags ?? '[]')
    if (Array.isArray(tags) && tags.length > 0) parts.push(tags.join(' '))
  } catch {}
  return parts.join('\n\n')
}

// (assetFilePathToPublic removed — now using assetPublicPath from config.ts,
//  which is portable and works on any machine, not just /home/z/my-project)

const publishers: Record<string, Publisher> = {
  facebook: new FacebookPublisher(),
}

export function getPublisher(platform: string): Publisher | null {
  return publishers[platform] ?? null
}

export async function publishPost(postId: string): Promise<PublishResult> {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: { destination: { include: { socialAccount: true } } },
  })

  if (!post) return { success: false, error: 'Post not found', simulated: false }
  if (!post.destination) {
    return { success: false, error: 'Post has no destination assigned', simulated: false }
  }

  const publisher = getPublisher(post.destination.socialAccount.platform)
  if (!publisher) {
    return {
      success: false,
      error: `No publisher adapter for platform "${post.destination.socialAccount.platform}"`,
      simulated: false,
    }
  }

  await db.post.update({ where: { id: postId }, data: { status: 'publishing' } })

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

export function getPublishMode(): 'live' | 'simulation' {
  return isLiveMode() ? 'live' : 'simulation'
}
