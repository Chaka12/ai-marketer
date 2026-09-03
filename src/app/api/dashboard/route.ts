import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveWorkspace } from '@/lib/server-utils'

export async function GET() {
  try {
    const workspace = await resolveWorkspace('maison-ete')
    if (!workspace) {
      return NextResponse.json(
        { success: false, error: 'No workspace found' },
        { status: 404 },
      )
    }

    const [
      pendingApproval,
      scheduled,
      published,
      failed,
      totalAssets,
      totalPosts,
      activeCampaign,
      analyticsAgg,
      recentEngagement,
      previousEngagement,
    ] = await Promise.all([
      db.post.count({
        where: { workspaceId: workspace.id, status: 'pending_approval' },
      }),
      db.post.count({
        where: { workspaceId: workspace.id, status: 'scheduled' },
      }),
      db.post.count({
        where: { workspaceId: workspace.id, status: 'published' },
      }),
      db.post.count({
        where: { workspaceId: workspace.id, status: 'failed' },
      }),
      db.asset.count({ where: { workspaceId: workspace.id } }),
      db.post.count({ where: { workspaceId: workspace.id } }),
      db.campaign.findFirst({
        where: { workspaceId: workspace.id, status: 'active' },
        orderBy: { createdAt: 'desc' },
      }),
      db.postAnalytics.aggregate({
        _sum: { reach: true, impressions: true, reactions: true, comments: true, shares: true, clicks: true },
        where: {
          post: { workspaceId: workspace.id, status: 'published' },
        },
      }),
      db.postAnalytics.aggregate({
        _sum: { reach: true, reactions: true, comments: true, shares: true },
        where: {
          post: {
            workspaceId: workspace.id,
            status: 'published',
            publishedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
      }),
      db.postAnalytics.aggregate({
        _sum: { reach: true, reactions: true, comments: true, shares: true },
        where: {
          post: {
            workspaceId: workspace.id,
            status: 'published',
            publishedAt: {
              gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
              lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        },
      }),
    ])

    const totalEngagement =
      (analyticsAgg._sum.reactions ?? 0) +
      (analyticsAgg._sum.comments ?? 0) +
      (analyticsAgg._sum.shares ?? 0)

    const recentSum =
      (recentEngagement._sum.reactions ?? 0) +
      (recentEngagement._sum.comments ?? 0) +
      (recentEngagement._sum.shares ?? 0)
    const prevSum =
      (previousEngagement._sum.reactions ?? 0) +
      (previousEngagement._sum.comments ?? 0) +
      (previousEngagement._sum.shares ?? 0)
    const engagementTrend =
      prevSum === 0 ? (recentSum > 0 ? 100 : 0) : Math.round(((recentSum - prevSum) / prevSum) * 100)

    return NextResponse.json({
      success: true,
      data: {
        campaign: activeCampaign
          ? {
              id: activeCampaign.id,
              name: activeCampaign.name,
              objective: activeCampaign.objective ?? 'awareness',
            }
          : undefined,
        contentSupplied: totalAssets,
        postsGenerated: totalPosts,
        postsScheduled: scheduled,
        postsPublished: published,
        awaitingApproval: pendingApproval,
        failed,
        totalEngagement,
        engagementTrend,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
