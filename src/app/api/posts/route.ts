import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveWorkspace, parseJsonArray, assetPublicPath } from '@/lib/server-utils'

export async function GET(req: Request) {
  try {
    const workspace = await resolveWorkspace('maison-ete')
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'No workspace' }, { status: 404 })
    }
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const where: Record<string, unknown> = { workspaceId: workspace.id }
    if (status) where.status = status

    const posts = await db.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        asset: true,
        destination: { include: { socialAccount: true } },
        campaign: true,
        analytics: true,
      },
    })

    const data = posts.map((p) => ({
      id: p.id,
      objective: p.objective,
      contentPillar: p.contentPillar,
      hook: p.hook,
      caption: p.caption,
      cta: p.cta,
      hashtags: parseJsonArray<string>(p.hashtags),
      altText: p.altText,
      status: p.status,
      approvalMode: p.approvalMode,
      scheduledAt: p.scheduledAt?.toISOString() ?? null,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      externalPostId: p.externalPostId,
      failureReason: p.failureReason,
      retryCount: p.retryCount,
      score: p.score,
      confidence: p.confidence,
      recycledFromId: p.recycledFromId,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      asset: p.asset
        ? {
            id: p.asset.id,
            filename: p.asset.filename,
            filePath: p.asset.filePath,
            publicPath: assetPublicPath(p.asset.filePath),
            type: p.asset.type,
          }
        : null,
      destination: p.destination
        ? {
            id: p.destination.id,
            name: p.destination.name,
            type: p.destination.type,
            platform: p.destination.socialAccount.platform,
            automationStatus: p.destination.automationStatus,
          }
        : null,
      campaign: p.campaign
        ? { id: p.campaign.id, name: p.campaign.name }
        : null,
      analytics: p.analytics
        ? {
            reach: p.analytics.reach,
            impressions: p.analytics.impressions,
            reactions: p.analytics.reactions,
            comments: p.analytics.comments,
            shares: p.analytics.shares,
            clicks: p.analytics.clicks,
            engagementRate: p.analytics.engagementRate,
          }
        : null,
    }))

    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
