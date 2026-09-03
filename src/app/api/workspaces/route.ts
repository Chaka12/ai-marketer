import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeAudit } from '@/lib/server-utils'

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
      logoUrl: w.logoUrl,
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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const name: string = (body.name ?? '').toString().trim()
    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
    }
    // Generate a unique slug from the name.
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      || 'workspace'
    let slug = baseSlug
    let suffix = 1
    while (await db.workspace.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix++}`
    }

    // Find the first user to act as owner (sandbox: there is one demo user).
    const owner = await db.user.findFirst({ orderBy: { createdAt: 'asc' } })
    if (!owner) {
      return NextResponse.json({ success: false, error: 'No owner user found' }, { status: 400 })
    }

    const workspace = await db.workspace.create({
      data: {
        name,
        slug,
        ownerId: owner.id,
        approvalMode: 'assisted',
      },
    })
    await db.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: owner.id,
        role: 'owner',
      },
    })
    await writeAudit({
      workspaceId: workspace.id,
      userId: owner.id,
      action: 'workspace.create',
      entityType: 'workspace',
      entityId: workspace.id,
      details: { name, slug },
    })
    return NextResponse.json({
      success: true,
      data: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        approvalMode: workspace.approvalMode,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
