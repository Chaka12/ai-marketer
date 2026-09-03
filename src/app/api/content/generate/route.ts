import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  resolveWorkspace,
  brandToDTO,
  parseJsonArray,
  stringifyJsonArray,
  writeAudit,
} from '@/lib/server-utils'
import { analyzeAsset, generateAndPickBest, generateWeeklyStrategy } from '@/lib/ai'
import type { Objective, ContentPillar, AssetAnalysisDTO } from '@/lib/types'

export async function POST(req: Request) {
  try {
    const workspace = await resolveWorkspace('maison-ete')
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'No workspace' }, { status: 404 })
    }
    const brand = await db.brand.findFirst({ where: { workspaceId: workspace.id } })
    if (!brand) {
      return NextResponse.json({ success: false, error: 'No brand configured' }, { status: 400 })
    }
    const brandDTO = await brandToDTO(brand)

    const body = await req.json().catch(() => ({}))
    const brief: string = (body.brief ?? '').trim() || 'No specific brief provided this week.'
    const objectives: string[] = Array.isArray(body.objectives) ? body.objectives : []
    const primaryObjective: Objective =
      (objectives[0] as Objective) || (body.objective as Objective) || 'awareness'
    const assetIds: string[] = Array.isArray(body.assetIds) ? body.assetIds : []
    const campaignId: string | undefined = body.campaignId

    // Resolve campaign
    let campaign = campaignId
      ? await db.campaign.findUnique({ where: { id: campaignId } })
      : null
    if (!campaign) {
      campaign = await db.campaign.findFirst({
        where: { workspaceId: workspace.id, status: 'active' },
        orderBy: { createdAt: 'desc' },
      })
    }
    if (!campaign) {
      campaign = await db.campaign.create({
        data: {
          workspaceId: workspace.id,
          brandId: brand.id,
          name: 'Weekly Content',
          objective: primaryObjective,
          status: 'active',
          startDate: new Date(),
        },
      })
    }

    // Find assets — either explicitly provided, or all in workspace.
    let assets = assetIds.length
      ? await db.asset.findMany({
          where: { id: { in: assetIds } },
          include: { analysis: true, brand: true },
        })
      : await db.asset.findMany({
          where: { workspaceId: workspace.id },
          include: { analysis: true, brand: true },
          orderBy: { createdAt: 'asc' },
        })

    if (assets.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No assets available — please upload at least one first.' },
        { status: 400 },
      )
    }

    // Make sure every asset has been analyzed.
    for (const asset of assets) {
      if (!asset.analysis) {
        const brandContext = asset.brand
          ? `${asset.brand.name} — ${asset.brand.description ?? ''}`
          : undefined
        const analysis = await analyzeAsset(asset.filePath, brandContext)
        await db.assetAnalysis.create({
          data: {
            assetId: asset.id,
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
        await db.asset.update({ where: { id: asset.id }, data: { analysisStatus: 'analyzed' } })
        asset.analysis = {
          assetId: asset.id,
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
        } as never
      }
    }

    // Previous performance — avg engagement by pillar (last 30 days published).
    const recentPosts = await db.post.findMany({
      where: {
        workspaceId: workspace.id,
        status: 'published',
        contentPillar: { not: null },
        publishedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, contentPillar: true, analytics: { select: { engagementRate: true } } },
    })
    const byPillar: Record<string, number[]> = {}
    for (const p of recentPosts) {
      if (!p.contentPillar) continue
      const er = p.analytics?.engagementRate ?? 0
      ;(byPillar[p.contentPillar] ??= []).push(er)
    }
    const previousPerformance = Object.entries(byPillar).map(([pillar, rates]) => ({
      pillar,
      avgEngagement: rates.reduce((a, b) => a + b, 0) / rates.length,
    }))

    // Strategy
    const strategy = await generateWeeklyStrategy({
      brand: brandDTO,
      objective: primaryObjective,
      brief,
      assetCount: assets.length,
      previousPerformance,
    })

    // Resolve destination — prefer the automated page destination
    const destinations = await db.destination.findMany({
      where: { socialAccount: { workspaceId: workspace.id } },
      include: { socialAccount: true },
    })
    const pageDestination =
      destinations.find((d) => d.type === 'page' && d.automationStatus === 'automated') ??
      destinations.find((d) => d.type === 'page') ??
      destinations[0]

    // Recent captions to avoid repetition
    const recent = await db.post.findMany({
      where: { workspaceId: workspace.id, status: { in: ['published', 'scheduled', 'pending_approval'] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { caption: true },
    })
    const recentCaptions = recent.map((p) => p.caption)

    // Round-robin pick assets across the daily plan.
    const createdPosts = []
    for (let i = 0; i < strategy.dailyPlan.length; i++) {
      const plan = strategy.dailyPlan[i]
      const asset = assets[i % assets.length]

      const assetAnalysis: AssetAnalysisDTO | undefined = asset.analysis
        ? {
            subject: asset.analysis.subject ?? undefined,
            setting: asset.analysis.setting ?? undefined,
            objects: parseJsonArray<string>(asset.analysis.objects),
            peopleCount: asset.analysis.peopleCount ?? 0,
            emotion: asset.analysis.emotion ?? undefined,
            product: asset.analysis.product ?? undefined,
            quality: asset.analysis.quality ?? undefined,
            visibleText: asset.analysis.visibleText ?? undefined,
            suggestedUses: parseJsonArray<string>(asset.analysis.suggestedUses),
          }
        : undefined

      let winning: { hook: string; caption: string; cta: string; hashtags: string[]; score?: number; confidence?: number } | null = null
      try {
        const candidate = await generateAndPickBest({
          brand: brandDTO,
          pillar: plan.pillar as ContentPillar,
          objective: plan.objective as Objective,
          focus: plan.focus,
          day: plan.day,
          assetAnalysis,
          destinationName: pageDestination?.name ?? 'Facebook Page',
          destinationType: (pageDestination?.type as 'page' | 'group') ?? 'page',
          recentCaptions,
        })
        winning = {
          hook: candidate.hook,
          caption: candidate.caption,
          cta: candidate.cta,
          hashtags: candidate.hashtags,
          score: candidate.evaluation.score,
          confidence: candidate.evaluation.confidence,
        }
      } catch (err) {
        console.error(`[generate] day ${plan.day} failed:`, err instanceof Error ? err.message : err)
        // Continue without a winning candidate — skip slot.
      }
      if (!winning) continue

      const post = await db.post.create({
        data: {
          workspaceId: workspace.id,
          brandId: brand.id,
          campaignId: campaign.id,
          assetId: asset.id,
          destinationId: pageDestination?.id,
          objective: plan.objective,
          contentPillar: plan.pillar,
          hook: winning.hook,
          caption: winning.caption,
          cta: winning.cta,
          hashtags: stringifyJsonArray(winning.hashtags),
          altText: assetAnalysis?.subject ?? 'Brand content',
          status: 'pending_approval',
          approvalMode: workspace.approvalMode,
          confidence: winning.confidence ?? null,
          score: winning.score ?? null,
        },
      })
      createdPosts.push({ id: post.id, day: plan.day, pillar: plan.pillar })

      // Small delay between days to stay friendly to the AI rate limiter.
      // The withRetry wrapper in ai.ts handles 429s, but pacing helps avoid
      // hitting the limit in the first place.
      if (i < strategy.dailyPlan.length - 1) {
        await new Promise((r) => setTimeout(r, 1500))
      }
    }

    // Update campaign content mix
    if (strategy.contentMix.length > 0) {
      await db.campaign.update({
        where: { id: campaign.id },
        data: { contentMix: stringifyJsonArray(strategy.contentMix) },
      })
    }

    await writeAudit({
      workspaceId: workspace.id,
      action: 'content.generate',
      entityType: 'campaign',
      entityId: campaign.id,
      details: {
        brief,
        objective: primaryObjective,
        assetCount: assets.length,
        postsCreated: createdPosts.length,
      },
    })

    return NextResponse.json({
      success: true,
      data: { strategy, postsCreated: createdPosts },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
