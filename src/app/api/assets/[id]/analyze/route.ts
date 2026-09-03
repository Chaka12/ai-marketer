import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { analyzeAsset } from '@/lib/ai'
import { brandToDTO, stringifyJsonArray } from '@/lib/server-utils'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const asset = await db.asset.findUnique({
      where: { id },
      include: { brand: true, analysis: true },
    })
    if (!asset) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 })
    }

    await db.asset.update({ where: { id }, data: { analysisStatus: 'analyzing' } })

    const brandDTO = asset.brand ? await brandToDTO(asset.brand) : undefined
    const brandContext = brandDTO
      ? `${brandDTO.name} — ${brandDTO.description ?? ''} (audience: ${brandDTO.audience ?? 'unknown'})`
      : undefined

    const analysis = await analyzeAsset(asset.filePath, brandContext)

    if (asset.analysis) {
      await db.assetAnalysis.update({
        where: { assetId: id },
        data: {
          subject: analysis.subject,
          setting: analysis.setting,
          objects: stringifyJsonArray(analysis.objects),
          peopleCount: analysis.peopleCount,
          emotion: analysis.emotion,
          product: analysis.product,
          quality: analysis.quality,
          visibleText: analysis.visibleText,
          suggestedUses: stringifyJsonArray(analysis.suggestedUses),
          rawAnalysis: analysis.rawAnalysis,
        },
      })
    } else {
      await db.assetAnalysis.create({
        data: {
          assetId: id,
          subject: analysis.subject,
          setting: analysis.setting,
          objects: stringifyJsonArray(analysis.objects),
          peopleCount: analysis.peopleCount,
          emotion: analysis.emotion,
          product: analysis.product,
          quality: analysis.quality,
          visibleText: analysis.visibleText,
          suggestedUses: stringifyJsonArray(analysis.suggestedUses),
          rawAnalysis: analysis.rawAnalysis,
        },
      })
    }

    await db.asset.update({ where: { id }, data: { analysisStatus: 'analyzed' } })

    return NextResponse.json({ success: true, data: analysis })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    try {
      await db.asset.update({ where: { id }, data: { analysisStatus: 'failed' } })
    } catch {
      /* ignore */
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
