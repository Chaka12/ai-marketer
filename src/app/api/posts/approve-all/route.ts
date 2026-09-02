import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeAudit, nextOccurrence } from '@/lib/server-utils'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const postIds: string[] = Array.isArray(body.postIds) ? body.postIds : []
    if (postIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No post IDs provided' }, { status: 400 })
    }

    const posts = await db.post.findMany({
      where: { id: { in: postIds } },
      select: { id: true, workspaceId: true, contentPillar: true, scheduledAt: true },
    })

    let scheduledCount = 0
    for (const p of posts) {
      const pillar = p.contentPillar ?? 'engagement'
      // Determine day of week from existing schedule (if any) or push to next available pillar day
      let scheduledAt = p.scheduledAt
      if (!scheduledAt) {
        // Round-robin across the next 7 days
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        const day = days[scheduledCount % 7]
        scheduledAt = nextOccurrence(day, pillar)
      }

      // Approval is implicit (we recorded approvalMode); final state = scheduled so the calendar picks them up.
      const ws = await db.workspace.findUnique({ where: { id: p.workspaceId }, select: { approvalMode: true } })
      await db.post.update({
        where: { id: p.id },
        data: { status: 'scheduled', scheduledAt, approvalMode: ws?.approvalMode ?? 'assisted' },
      })
      scheduledCount++
    }

    if (posts[0]) {
      await writeAudit({
        workspaceId: posts[0].workspaceId,
        action: 'post.approve_all',
        entityType: 'post',
        details: { count: scheduledCount, postIds },
      })
    }

    return NextResponse.json({ success: true, data: { approved: scheduledCount } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
