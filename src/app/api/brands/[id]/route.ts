import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { brandToDTO, stringifyJsonArray } from '@/lib/server-utils'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const brand = await db.brand.findUnique({ where: { id } })
    if (!brand) {
      return NextResponse.json({ success: false, error: 'Brand not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    const stringFields = ['description', 'audience', 'location', 'personality', 'writingStyle', 'cta', 'name']
    for (const f of stringFields) {
      if (typeof body[f] === 'string') data[f] = body[f]
    }
    const arrayFields = ['avoid', 'vocabularyUse', 'vocabularyAvoid'] as const
    for (const f of arrayFields) {
      if (Array.isArray(body[f])) data[f] = stringifyJsonArray(body[f])
    }

    await db.brand.update({ where: { id }, data })

    // Products
    if (Array.isArray(body.products)) {
      await db.product.deleteMany({ where: { brandId: id } })
      for (const p of body.products) {
        if (!p?.name) continue
        await db.product.create({
          data: {
            brandId: id,
            name: p.name,
            price: p.price ?? null,
            description: p.description ?? null,
            features: stringifyJsonArray(p.features ?? []),
            url: p.url ?? null,
            promotion: p.promotion ?? null,
            promotionExpiry: p.promotionExpiry ? new Date(p.promotionExpiry) : null,
            availability: p.availability ?? null,
          },
        })
      }
    }

    // Brand rules
    if (Array.isArray(body.brandRules)) {
      await db.brandRule.deleteMany({ where: { brandId: id } })
      for (const r of body.brandRules) {
        if (!r?.rule) continue
        await db.brandRule.create({
          data: {
            brandId: id,
            type: r.type ?? 'guideline',
            rule: r.rule,
          },
        })
      }
    }

    const updated = await db.brand.findUnique({ where: { id } })
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Brand vanished' }, { status: 500 })
    }
    const dto = await brandToDTO(updated)
    return NextResponse.json({ success: true, data: dto })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
