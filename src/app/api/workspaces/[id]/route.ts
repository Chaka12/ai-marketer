import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeAudit } from '@/lib/server-utils'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}
    if (['manual', 'assisted', 'autonomous'].includes(body.approvalMode)) {
      data.approvalMode = body.approvalMode
    }
    if (typeof body.name === 'string') data.name = body.name

    const updated = await db.workspace.update({ where: { id }, data })
    await writeAudit({
      workspaceId: id,
      action: 'workspace.update',
      entityType: 'workspace',
      entityId: id,
      details: { fields: Object.keys(data) },
    })
    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        approvalMode: updated.approvalMode,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
