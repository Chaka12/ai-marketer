import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { brandToDTO, stringifyJsonArray, writeAudit } from '@/lib/server-utils'
import { regeneratePost } from '@/lib/ai'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const post = await db.post.findUnique({
      where: { id },
      include: { brand: true },
    })
    if (!post) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 })
    }
    if (!post.brand) {
      return NextResponse.json({ success: false, error: 'Brand missing' }, { status: 400 })
    }
    const body = await req.json().catch(() => ({}))
    const instruction: string = (body.instruction ?? '').trim()
    if (!instruction) {
      return NextResponse.json({ success: false, error: 'Instruction is required' }, { status: 400 })
    }

    const brandDTO = await brandToDTO(post.brand)
    const result = await regeneratePost({
      brand: brandDTO,
      current: {
        hook: post.hook ?? '',
        caption: post.caption,
        cta: post.cta ?? '',
        hashtags: JSON.parse(post.hashtags ?? '[]'),
      },
      instruction,
    })

    await db.post.update({
      where: { id },
      data: {
        hook: result.hook,
        caption: result.caption,
        cta: result.cta,
        hashtags: stringifyJsonArray(result.hashtags),
      },
    })

    await writeAudit({
      workspaceId: post.workspaceId,
      action: 'post.regenerate',
      entityType: 'post',
      entityId: id,
      details: { instruction },
    })

    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
