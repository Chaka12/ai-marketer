import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveWorkspace, assetPublicPath } from '@/lib/server-utils'
import { promises as fs } from 'fs'
import path from 'path'

const UPLOADS_ROOT = '/home/z/my-project/uploads'

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
}

export async function POST(req: Request) {
  try {
    const workspace = await resolveWorkspace('maison-ete')
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'No workspace' }, { status: 404 })
    }

    const formData = await req.formData()
    const files = formData.getAll('files').filter((f): f is File => f instanceof File)
    if (files.length === 0) {
      return NextResponse.json({ success: false, error: 'No files provided' }, { status: 400 })
    }
    if (files.length > 10) {
      return NextResponse.json({ success: false, error: 'Maximum 10 files at once' }, { status: 400 })
    }

    // Find brand & default campaign for the workspace
    const brand = await db.brand.findFirst({ where: { workspaceId: workspace.id } })
    const campaign = await db.campaign.findFirst({
      where: { workspaceId: workspace.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
    })

    const uploadDir = path.join(UPLOADS_ROOT, workspace.slug)
    await fs.mkdir(uploadDir, { recursive: true })

    const created = []
    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase().slice(1) || 'jpg'
      const safeExt = EXT_TO_MIME[ext] ? ext : 'jpg'
      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 60)
      const filename = `${timestamp}-${safeName}`
      const filePath = path.join(uploadDir, filename)
      const buffer = Buffer.from(await file.arrayBuffer())
      await fs.writeFile(filePath, buffer)

      const mimeType = EXT_TO_MIME[safeExt] ?? 'application/octet-stream'
      const type = mimeType.startsWith('image/')
        ? 'image'
        : mimeType.startsWith('video/')
          ? 'video'
          : mimeType.startsWith('application/pdf')
            ? 'pdf'
            : 'image'

      const asset = await db.asset.create({
        data: {
          workspaceId: workspace.id,
          brandId: brand?.id,
          campaignId: campaign?.id,
          type,
          filename: file.name,
          filePath,
          mimeType,
          fileSize: file.size,
          analysisStatus: 'pending',
        },
      })

      created.push({
        id: asset.id,
        type: asset.type,
        filename: asset.filename,
        filePath: asset.filePath,
        publicPath: assetPublicPath(asset.filePath),
        mimeType: asset.mimeType,
        analysisStatus: asset.analysisStatus,
        createdAt: asset.createdAt.toISOString(),
      })
    }

    return NextResponse.json({ success: true, data: created })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
