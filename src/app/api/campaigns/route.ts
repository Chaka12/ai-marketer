import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveWorkspace, parseJsonArray } from '@/lib/server-utils'

export async function GET() {
  try {
    const workspace = await resolveWorkspace('maison-ete')
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'No workspace' }, { status: 404 })
    }
    const campaigns = await db.campaign.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { posts: true, assets: true } },
      },
    })

    const campaignsWithStats = await Promise.all(
      campaigns.map(async (c) => {
        const analytics = await db.postAnalytics.aggregate({
          _sum: { reach: true, reactions: true, comments: true, shares: true, clicks: true },
          where: { post: { campaignId: c.id } },
        })
        return {
          id: c.id,
          name: c.name,
          objective: c.objective,
          status: c.status,
          startDate: c.startDate?.toISOString() ?? null,
          endDate: c.endDate?.toISOString() ?? null,
          contentMix: parseJsonArray<{ pillar: string; percentage: number }>(c.contentMix),
          postCount: c._count.posts,
          assetCount: c._count.assets,
          totalReach: analytics._sum.reach ?? 0,
          totalEngagement:
            (analytics._sum.reactions ?? 0) +
            (analytics._sum.comments ?? 0) +
            (analytics._sum.shares ?? 0),
          totalClicks: analytics._sum.clicks ?? 0,
        }
      }),
    )

    return NextResponse.json({ success: true, data: campaignsWithStats })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
