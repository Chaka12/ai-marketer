import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeAudit } from '@/lib/server-utils'

/**
 * Update a destination (rename, change automation status, edit style hint).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
    if (body.type === 'page' || body.type === 'group') data.type = body.type
    if (body.automationStatus === 'automated' || body.automationStatus === 'manual') {
      data.automationStatus = body.automationStatus
    }
    if (typeof body.contentStyleHint === 'string') data.contentStyleHint = body.contentStyleHint || null
    if (typeof body.allowedFrequency === 'string') data.allowedFrequency = body.allowedFrequency || null
    if (typeof body.externalId === 'string') data.externalId = body.externalId || null

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 })
    }

    const updated = await db.destination.update({ where: { id }, data })
    const account = await db.socialAccount.findUnique({ where: { id: updated.socialAccountId } })
    await writeAudit({
      workspaceId: account?.workspaceId,
      action: 'distribution.destination_update',
      entityType: 'destination',
      entityId: id,
      details: { fields: Object.keys(data) },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        type: updated.type,
        name: updated.name,
        externalId: updated.externalId,
        platform: account?.platform ?? 'facebook',
        automationStatus: updated.automationStatus,
        contentStyleHint: updated.contentStyleHint,
        allowedFrequency: updated.allowedFrequency,
        lastPostAt: updated.lastPostAt?.toISOString() ?? null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * Remove a destination. Clears destinationId on any posts that referenced it.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const dest = await db.destination.findUnique({ where: { id } })
    if (!dest) {
      return NextResponse.json({ success: false, error: 'Destination not found' }, { status: 404 })
    }
    const account = await db.socialAccount.findUnique({ where: { id: dest.socialAccountId } })

    await db.post.updateMany({
      where: { destinationId: id },
      data: { destinationId: null },
    })
    await db.destination.delete({ where: { id } })

    await writeAudit({
      workspaceId: account?.workspaceId,
      action: 'distribution.destination_remove',
      entityType: 'destination',
      entityId: id,
      details: { name: dest.name, type: dest.type },
    })

    return NextResponse.json({ success: true, data: { id } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
