import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resolveWorkspace, parseJsonArray, assetPublicPath } from '@/lib/server-utils'

export async function GET() {
  try {
    const workspace = await resolveWorkspace('maison-ete')
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'No workspace' }, { status: 404 })
    }
    const assets = await db.asset.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
      include: { analysis: true },
    })
    const data = assets.map((a) => ({
      id: a.id,
      type: a.type,
      filename: a.filename,
      filePath: a.filePath,
      publicPath: assetPublicPath(a.filePath),
      mimeType: a.mimeType,
      width: a.width,
      height: a.height,
      analysisStatus: a.analysisStatus,
      createdAt: a.createdAt.toISOString(),
      analysis: a.analysis
        ? {
            subject: a.analysis.subject,
            setting: a.analysis.setting,
            objects: parseJsonArray<string>(a.analysis.objects),
            peopleCount: a.analysis.peopleCount,
            emotion: a.analysis.emotion,
            product: a.analysis.product,
            quality: a.analysis.quality,
            visibleText: a.analysis.visibleText,
            suggestedUses: parseJsonArray<string>(a.analysis.suggestedUses),
          }
        : null,
    }))
    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
