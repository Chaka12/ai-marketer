import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveWorkspace, parseJsonObject } from '@/lib/server-utils'

export async function GET() {
  try {
    const workspace = await resolveWorkspace('maison-ete')
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'No workspace' }, { status: 404 })
    }
    const logs = await db.auditLog.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const data = logs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      details: l.details ? parseJsonObject(l.details) : null,
      createdAt: l.createdAt.toISOString(),
    }))
    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
