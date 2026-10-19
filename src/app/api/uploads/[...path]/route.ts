import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { UPLOADS_DIR, resolveUploadFsPath, ensureDirectories } from '@/lib/config'

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    // Ensure the uploads directory exists (portable — creates <cwd>/uploads)
    await ensureDirectories()

    const { path: segments } = await params
    if (!segments || segments.length === 0) {
      return new NextResponse('Not found', { status: 404 })
    }
    // Prevent path traversal — strip any '..' or unsafe chars.
    const cleaned = segments
      .map((s) => s.replace(/\.\./g, '').replace(/[^a-zA-Z0-9._-]/g, ''))
      .filter(Boolean)
    if (cleaned.length !== segments.length) {
      return new NextResponse('Not found', { status: 404 })
    }

    // Convert the public URL path back to a filesystem path using the
    // portable config. This works on ANY machine — the UPLOADS_DIR is
    // derived from process.cwd(), not hardcoded.
    const publicPath = '/uploads/' + cleaned.join('/')
    const filePath = resolveUploadFsPath(publicPath)

    // Safety: ensure the resolved path is inside UPLOADS_DIR
    if (!filePath.startsWith(UPLOADS_DIR)) {
      return new NextResponse('Not found', { status: 404 })
    }

    try {
      await fs.access(filePath)
    } catch {
      return new NextResponse('Not found', { status: 404 })
    }
    const stat = await fs.stat(filePath)
    if (!stat.isFile()) {
      return new NextResponse('Not found', { status: 404 })
    }
    const ext = path.extname(filePath).toLowerCase().slice(1)
    const contentType = EXT_TO_MIME[ext] ?? 'application/octet-stream'
    const data = await fs.readFile(filePath)
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new NextResponse(message, { status: 500 })
  }
}
