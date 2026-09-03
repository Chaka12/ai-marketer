import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveWorkspace, assetPublicPath } from '@/lib/server-utils'

export async function GET() {
  try {
    const workspace = await resolveWorkspace('maison-ete')
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'No workspace' }, { status: 404 })
    }

    const from = new Date()
    const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    // Include pending_approval, scheduled, published, approved
    const posts = await db.post.findMany({
      where: {
        workspaceId: workspace.id,
        status: { in: ['scheduled', 'published', 'pending_approval', 'approved'] },
        OR: [
          { scheduledAt: { gte: from, lte: to } },
          { publishedAt: { gte: new Date(from.getTime() - 14 * 24 * 60 * 60 * 1000), lte: to } },
          { status: 'pending_approval' },
        ],
      },
      orderBy: [{ scheduledAt: 'asc' }, { publishedAt: 'asc' }],
      include: {
        asset: true,
        destination: { include: { socialAccount: true } },
        campaign: true,
      },
    })

    const data = posts.map((p) => ({
      id: p.id,
      scheduledAt: p.scheduledAt?.toISOString() ?? null,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      status: p.status,
      caption: p.caption,
      hook: p.hook,
      objective: p.objective,
      contentPillar: p.contentPillar,
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
          }
        : null,
      campaign: p.campaign
        ? { id: p.campaign.id, name: p.campaign.name }
        : null,
    }))

    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
