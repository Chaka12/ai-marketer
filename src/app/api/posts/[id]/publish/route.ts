import { NextResponse } from 'next/server'
import { publishPost } from '@/lib/publisher'
import { writeAudit } from '@/lib/server-utils'
import { db } from '@/lib/db'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const post = await db.post.findUnique({ where: { id }, select: { workspaceId: true } })
    if (!post) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 })
    }
    const result = await publishPost(id)
    await writeAudit({
      workspaceId: post.workspaceId,
      action: result.success ? 'post.publish' : 'post.publish_failed',
      entityType: 'post',
      entityId: id,
      details: { simulated: result.simulated, externalPostId: result.externalPostId, error: result.error },
    })
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 502 })
    }
    return NextResponse.json({ success: true, data: { externalPostId: result.externalPostId, simulated: result.simulated } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
