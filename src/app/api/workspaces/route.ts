import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const workspaces = await db.workspace.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { brands: true, posts: true, members: true },
        },
      },
    })
    const data = workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      approvalMode: w.approvalMode,
      brandCount: w._count.brands,
      postCount: w._count.posts,
      memberCount: w._count.members,
      createdAt: w.createdAt.toISOString(),
    }))
    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
