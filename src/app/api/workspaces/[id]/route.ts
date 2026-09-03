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
    if (typeof body.name === 'string' && body.name.trim()) {
      data.name = body.name.trim()
    }
    if (typeof body.logoUrl === 'string') {
      // Allow null (clear logo) or a string path under /uploads/.
      data.logoUrl = body.logoUrl || null
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 })
    }

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
        logoUrl: updated.logoUrl,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    // Prevent deleting the last remaining workspace.
    const count = await db.workspace.count()
    if (count <= 1) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete the last workspace' },
        { status: 400 },
      )
    }
    await db.workspace.delete({ where: { id } })
    return NextResponse.json({ success: true, data: { id } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
