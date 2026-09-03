import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { stringifyJsonArray, writeAudit } from '@/lib/server-utils'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const post = await db.post.findUnique({ where: { id }, select: { id: true, workspaceId: true, status: true } })
    if (!post) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 })
    }
    const body = await req.json().catch(() => ({}))

    const data: Record<string, unknown> = {}
    if (typeof body.hook === 'string') data.hook = body.hook
    if (typeof body.caption === 'string') data.caption = body.caption
    if (typeof body.cta === 'string') data.cta = body.cta
    if (typeof body.altText === 'string') data.altText = body.altText
    if (Array.isArray(body.hashtags)) data.hashtags = stringifyJsonArray(body.hashtags)
    if (body.scheduledAt) data.scheduledAt = new Date(body.scheduledAt)

    if (typeof body.status === 'string') {
      const newStatus = body.status
      // Workspace approval mode when transitioning to approved
      if (newStatus === 'approved') {
        const ws = await db.workspace.findUnique({ where: { id: post.workspaceId } })
        if (ws) data.approvalMode = ws.approvalMode
      }
      // Scheduled requires scheduledAt
      if (newStatus === 'scheduled' && !body.scheduledAt && !data.scheduledAt) {
        const existing = await db.post.findUnique({ where: { id }, select: { scheduledAt: true } })
        if (!existing?.scheduledAt) {
          // Default to 24h from now if not set
          data.scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      }
      data.status = newStatus
    }

    const updated = await db.post.update({ where: { id }, data })

    await writeAudit({
      workspaceId: post.workspaceId,
      action: 'post.update',
      entityType: 'post',
      entityId: id,
      details: { fields: Object.keys(data), status: data.status ?? null },
    })

    return NextResponse.json({ success: true, data: { id: updated.id, status: updated.status } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
