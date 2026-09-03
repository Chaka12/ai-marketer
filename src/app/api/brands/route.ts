import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveWorkspace, brandToDTO } from '@/lib/server-utils'

export async function GET() {
  try {
    const workspace = await resolveWorkspace('maison-ete')
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'No workspace' }, { status: 404 })
    }
    const brands = await db.brand.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'asc' },
    })
    const dtos = await Promise.all(brands.map(brandToDTO))
    return NextResponse.json({ success: true, data: dtos })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
