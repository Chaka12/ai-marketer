import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeAudit, assetPublicPath } from '@/lib/server-utils'
import { UPLOADS_DIR, resolveUploadFsPath } from '@/lib/config'
import { promises as fs } from 'fs'
import path from 'path'

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const workspace = await db.workspace.findUnique({ where: { id } })
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 })
    }

    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Logo must be a PNG, JPEG, WebP, or SVG image' },
        { status: 400 },
      )
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Logo must be under 2 MB' },
        { status: 400 },
      )
    }

    // Use portable UPLOADS_DIR from config
    const uploadDir = path.join(UPLOADS_DIR, workspace.slug)
    await fs.mkdir(uploadDir, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 60)
    const filename = `logo-${timestamp}-${safeName}`
    const filePath = path.join(uploadDir, filename)

    await fs.writeFile(filePath, buffer)

    // Delete the previous logo file if it exists (keep filesystem tidy).
    if (workspace.logoUrl) {
      const prevPath = resolveUploadFsPath(workspace.logoUrl)
      // Only delete files inside the uploads directory.
      if (prevPath.startsWith(UPLOADS_DIR)) {
        await fs.rm(prevPath, { force: true })
      }
    }

    const publicPath = assetPublicPath(filePath)
    await db.workspace.update({
      where: { id },
      data: { logoUrl: publicPath },
    })
    await writeAudit({
      workspaceId: id,
      action: 'workspace.logo_upload',
      entityType: 'workspace',
      entityId: id,
      details: { filename, size: file.size, type: file.type },
    })

    return NextResponse.json({ success: true, data: { logoUrl: publicPath } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
