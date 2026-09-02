import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveWorkspace } from '@/lib/server-utils'

export async function GET(req: Request) {
  try {
    const workspace = await resolveWorkspace('maison-ete')
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'No workspace' }, { status: 404 })
    }
    const { searchParams } = new URL(req.url)
    const workspaceIdParam = searchParams.get('workspaceId')
    void workspaceIdParam

    const accounts = await db.socialAccount.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'asc' },
      include: {
        destinations: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    const data = accounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      name: a.name,
      accountId: a.accountId,
      status: a.status,
      destinations: a.destinations.map((d) => ({
        id: d.id,
        type: d.type,
        name: d.name,
        externalId: d.externalId,
        platform: a.platform,
        automationStatus: d.automationStatus,
        contentStyleHint: d.contentStyleHint,
        allowedFrequency: d.allowedFrequency,
        lastPostAt: d.lastPostAt?.toISOString() ?? null,
      })),
    }))

    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
