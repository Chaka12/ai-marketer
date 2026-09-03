import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveWorkspace, parseJsonArray, assetPublicPath } from '@/lib/server-utils'
import { generateInsights } from '@/lib/ai'

export async function GET() {
  try {
    const workspace = await resolveWorkspace('maison-ete')
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'No workspace' }, { status: 404 })
    }

    const publishedPosts = await db.post.findMany({
      where: { workspaceId: workspace.id, status: 'published' },
      include: { analytics: true, asset: true },
      orderBy: { publishedAt: 'desc' },
    })

    const withAnalytics = publishedPosts.filter((p) => p.analytics)

    const totals = withAnalytics.reduce(
      (acc, p) => {
        const a = p.analytics!
        acc.reach += a.reach
        acc.impressions += a.impressions
        acc.reactions += a.reactions
        acc.comments += a.comments
        acc.shares += a.shares
        acc.clicks += a.clicks
        acc.engagementRate += a.engagementRate
        return acc
      },
      { reach: 0, impressions: 0, reactions: 0, comments: 0, shares: 0, clicks: 0, engagementRate: 0 },
    )
    totals.engagementRate = withAnalytics.length ? totals.engagementRate / withAnalytics.length : 0

    // Group by pillar
    const pillarMap: Record<string, { posts: number; engagementSum: number; reachSum: number }> = {}
    for (const p of withAnalytics) {
      const pillar = p.contentPillar ?? 'unknown'
      pillarMap[pillar] ??= { posts: 0, engagementSum: 0, reachSum: 0 }
      pillarMap[pillar].posts++
      pillarMap[pillar].engagementSum += p.analytics!.engagementRate
      pillarMap[pillar].reachSum += p.analytics!.reach
    }
    const byPillar = Object.entries(pillarMap).map(([pillar, v]) => ({
      pillar,
      posts: v.posts,
      avgEngagement: v.posts ? v.engagementSum / v.posts : 0,
      avgReach: v.posts ? v.reachSum / v.posts : 0,
    }))

    // Group by objective
    const objectiveMap: Record<string, { posts: number; engagementSum: number }> = {}
    for (const p of withAnalytics) {
      const objective = p.objective ?? 'unknown'
      objectiveMap[objective] ??= { posts: 0, engagementSum: 0 }
      objectiveMap[objective].posts++
      objectiveMap[objective].engagementSum += p.analytics!.engagementRate
    }
    const byObjective = Object.entries(objectiveMap).map(([objective, v]) => ({
      objective,
      posts: v.posts,
      avgEngagement: v.posts ? v.engagementSum / v.posts : 0,
    }))

    // Top posts
    const topPosts = [...withAnalytics]
      .sort((a, b) => (b.analytics!.engagementRate ?? 0) - (a.analytics!.engagementRate ?? 0))
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        caption: p.caption,
        contentPillar: p.contentPillar,
        reach: p.analytics!.reach,
        engagementRate: p.analytics!.engagementRate,
        publishedAt: p.publishedAt?.toISOString() ?? null,
        asset: p.asset
          ? {
              id: p.asset.id,
              filename: p.asset.filename,
              publicPath: assetPublicPath(p.asset.filePath),
            }
          : null,
      }))

    // Insights — cache via PerformanceSnapshot for 30d
    let insights: string[] = []
    if (withAnalytics.length >= 5) {
      const cached = await db.performanceSnapshot.findFirst({
        where: { workspaceId: workspace.id, period: '30d' },
        orderBy: { createdAt: 'desc' },
      })
      const cacheFresh =
        cached && Date.now() - cached.createdAt.getTime() < 60 * 60 * 1000 // 1h cache
      if (cacheFresh && cached.insights) {
        insights = parseJsonArray<string>(cached.insights)
      } else {
        try {
          const result = await generateInsights({ byPillar, byObjective })
          insights = result.insights
          await db.performanceSnapshot.create({
            data: {
              workspaceId: workspace.id,
              period: '30d',
              pillarAverages: JSON.stringify(byPillar),
              topPerformingContent: JSON.stringify(topPosts),
              insights: JSON.stringify(insights),
            },
          })
        } catch {
          insights = []
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: { totals, byPillar, byObjective, topPosts, insights },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
