import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { brandToDTO, parseJsonArray, stringifyJsonArray, writeAudit } from '@/lib/server-utils'
import { generatePostCandidates } from '@/lib/ai'
import type { ContentPillar, Objective, AssetAnalysisDTO } from '@/lib/types'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const original = await db.post.findUnique({
      where: { id },
      include: {
        asset: { include: { analysis: true } },
        brand: true,
        destination: true,
        campaign: true,
      },
    })
    if (!original) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 })
    }
    if (!original.brand) {
      return NextResponse.json({ success: false, error: 'Brand missing' }, { status: 400 })
    }

    const brandDTO = await brandToDTO(original.brand)

    const assetAnalysis: AssetAnalysisDTO | undefined = original.asset?.analysis
      ? {
          subject: original.asset.analysis.subject ?? undefined,
          setting: original.asset.analysis.setting ?? undefined,
          objects: parseJsonArray<string>(original.asset.analysis.objects),
          peopleCount: original.asset.analysis.peopleCount ?? 0,
          emotion: original.asset.analysis.emotion ?? undefined,
          product: original.asset.analysis.product ?? undefined,
          quality: original.asset.analysis.quality ?? undefined,
          visibleText: original.asset.analysis.visibleText ?? undefined,
          suggestedUses: parseJsonArray<string>(original.asset.analysis.suggestedUses),
        }
      : undefined

    const angles = [
      'Take a fresh storytelling angle — focus on the customer\'s emotional journey.',
      'Take a fresh educational angle — explain something specific about the product.',
      'Take a fresh community angle — invite the audience to participate.',
    ]

    const created: { id: string }[] = []

    // First try: ask the model for 3 distinct variations in a single call.
    // This is more reliable than 3 separate calls (some of which may return empty).
    try {
      const candidates = await generatePostCandidates({
        brand: brandDTO,
        pillar: (original.contentPillar ?? 'engagement') as ContentPillar,
        objective: (original.objective ?? 'engagement') as Objective,
        focus: `Recycled variation of a previously published post. Try angles: ${angles.join(' | ')}`,
        day: 'Recycled',
        assetAnalysis,
        destinationName: original.destination?.name ?? 'Facebook Page',
        destinationType: (original.destination?.type as 'page' | 'group') ?? 'page',
        count: 3,
      })

      for (const c of candidates) {
        const post = await db.post.create({
          data: {
            workspaceId: original.workspaceId,
            brandId: original.brandId,
            campaignId: original.campaignId,
            assetId: original.assetId,
            destinationId: original.destinationId,
            objective: original.objective,
            contentPillar: original.contentPillar,
            hook: c.hook,
            caption: c.caption,
            cta: c.cta,
            hashtags: stringifyJsonArray(c.hashtags),
            altText: c.altText || original.altText,
            status: 'pending_approval',
            approvalMode: original.approvalMode,
            recycledFromId: original.id,
            confidence: c.confidence ?? null,
          },
        })
        created.push({ id: post.id })
      }
    } catch {
      // Fall through to angle-by-angle fallback below.
    }

    // Fallback: if the batch returned fewer than 3, top up with per-angle calls.
    let angleIdx = 0
    while (created.length < 3 && angleIdx < angles.length) {
      const angle = angles[angleIdx++]
      try {
        const candidates = await generatePostCandidates({
          brand: brandDTO,
          pillar: (original.contentPillar ?? 'engagement') as ContentPillar,
          objective: (original.objective ?? 'engagement') as Objective,
          focus: `${original.contentPillar ?? 'engagement'} — recycled variation. ${angle}`,
          day: 'Recycled',
          assetAnalysis,
          destinationName: original.destination?.name ?? 'Facebook Page',
          destinationType: (original.destination?.type as 'page' | 'group') ?? 'page',
          count: 1,
        })
        const c = candidates[0]
        if (!c) continue
        const post = await db.post.create({
          data: {
            workspaceId: original.workspaceId,
            brandId: original.brandId,
            campaignId: original.campaignId,
            assetId: original.assetId,
            destinationId: original.destinationId,
            objective: original.objective,
            contentPillar: original.contentPillar,
            hook: c.hook,
            caption: c.caption,
            cta: c.cta,
            hashtags: stringifyJsonArray(c.hashtags),
            altText: c.altText || original.altText,
            status: 'pending_approval',
            approvalMode: original.approvalMode,
            recycledFromId: original.id,
            confidence: c.confidence ?? null,
          },
        })
        created.push({ id: post.id })
      } catch {
        // skip this angle
      }
    }

    await writeAudit({
      workspaceId: original.workspaceId,
      action: 'post.recycle',
      entityType: 'post',
      entityId: id,
      details: { variationsCreated: created.length },
    })

    return NextResponse.json({ success: true, data: { variations: created, count: created.length } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
