import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { publishPost } from '@/lib/publisher'

/**
 * Vercel Cron endpoint — called every minute by Vercel's cron scheduler.
 * Replaces the standalone scheduler mini-service on serverless.
 *
 * Security: requires Authorization: Bearer <CRON_SECRET> header.
 * For local dev, use the scheduler mini-service instead.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const now = new Date()

    const due = await db.post.findMany({
      where: { status: 'scheduled', scheduledAt: { lte: now } },
      take: 20,
      select: { id: true },
    })

    const retryDue = await db.post.findMany({
      where: { status: 'failed', nextRetryAt: { lte: now }, retryCount: { lt: 5 } },
      take: 10,
      select: { id: true },
    })

    const allDue = [...due, ...retryDue]
    let published = 0
    let failed = 0
    const errors: string[] = []

    for (const { id } of allDue) {
      try {
        const result = await publishPost(id)
        if (result.success) published++
        else {
          failed++
          if (result.error) errors.push(`${id}: ${result.error}`)
        }
      } catch (err) {
        failed++
        errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return NextResponse.json({
      success: true,
      data: { checked: allDue.length, published, failed, errors: errors.slice(0, 5) },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
