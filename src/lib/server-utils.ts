/**
 * Helpers shared across API routes and server components.
 */
import 'server-only'
import { db } from './db'
import { WORKSPACE_SLUG, assetPublicPath, resolveUploadFsPath, UPLOADS_DIR } from './config'
import type { Brand, Workspace } from '@prisma/client'

// ── JSON helpers (SQLite stores JSON as plain text) ────────

export function parseJsonArray<T = string>(value: string | null | undefined): T[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

export function stringifyJsonArray<T>(value: T[]): string {
  return JSON.stringify(value)
}

export function parseJsonObject<T = Record<string, unknown>>(
  value: string | null | undefined,
): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

// ── Brand → DTO ────────────────────────────────────────────

export async function brandToDTO(brand: Brand): Promise<import('./types').BrandDTO> {
  const [rules, products] = await Promise.all([
    db.brandRule.findMany({ where: { brandId: brand.id } }),
    db.product.findMany({ where: { brandId: brand.id } }),
  ])

  return {
    id: brand.id,
    name: brand.name,
    description: brand.description,
    audience: brand.audience,
    location: brand.location,
    personality: brand.personality,
    writingStyle: brand.writingStyle,
    cta: brand.cta,
    avoid: parseJsonArray<string>(brand.avoid),
    vocabularyUse: parseJsonArray<string>(brand.vocabularyUse),
    vocabularyAvoid: parseJsonArray<string>(brand.vocabularyAvoid),
    brandRules: rules.map((r) => ({ type: r.type, rule: r.rule })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description,
      features: parseJsonArray<string>(p.features),
      url: p.url,
      promotion: p.promotion,
      promotionExpiry: p.promotionExpiry?.toISOString() ?? null,
      availability: p.availability,
    })),
  }
}

// ── Workspace resolution ───────────────────────────────────

/**
 * Resolve the workspace for the current deployment.
 *
 * The system is single-tenant — it resolves ONE workspace. By default it
 * uses WORKSPACE_SLUG from config (which reads from the WORKSPACE_SLUG
 * env var, falling back to 'maison-ete'). If the slug isn't found, it
 * falls back to the first workspace in the DB.
 *
 * Pass a slug argument to override the default (used by some API routes
 * that accept a workspace slug in the URL).
 */
export async function resolveWorkspace(slug?: string): Promise<Workspace | null> {
  const targetSlug = slug || WORKSPACE_SLUG
  if (targetSlug) {
    const bySlug = await db.workspace.findUnique({ where: { slug: targetSlug } })
    if (bySlug) return bySlug
  }
  const first = await db.workspace.findFirst({
    orderBy: { createdAt: 'asc' },
  })
  return first
}

// ── Audit log ──────────────────────────────────────────────

export async function writeAudit(params: {
  workspaceId?: string
  userId?: string
  action: string
  entityType: string
  entityId?: string
  details?: Record<string, unknown>
}) {
  await db.auditLog.create({
    data: {
      workspaceId: params.workspaceId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details ? JSON.stringify(params.details) : null,
    },
  })
}

// ── Scheduling helpers ─────────────────────────────────────

const DAY_MAP: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
}

const DEFAULT_TIME_BY_PILLAR: Record<string, string> = {
  product: '09:00',
  educational: '13:00',
  lifestyle: '11:00',
  social_proof: '15:00',
  engagement: '18:00',
  community: '10:00',
  promotional: '17:00',
}

/**
 * Pick the next occurrence of `dayName` at the pillar's default time, then
 * return a Date. The scheduler will publish when scheduledAt <= now.
 */
export function nextOccurrence(dayName: string, pillar: string, from = new Date()): Date {
  const targetDay = DAY_MAP[dayName] ?? 1
  const time = DEFAULT_TIME_BY_PILLAR[pillar] ?? '09:00'
  const [hours, minutes] = time.split(':').map(Number)

  const result = new Date(from)
  result.setHours(hours, minutes, 0, 0)
  const currentDay = result.getDay()
  let diff = (targetDay - currentDay + 7) % 7
  if (diff === 0 && result.getTime() <= from.getTime()) {
    diff = 7
  }
  result.setDate(result.getDate() + diff)
  return result
}

// ── Path helpers for assets ────────────────────────────────
//
// Re-exported from config.ts so routes that already import from
// server-utils get them automatically. These are PORTABLE — they work
// on any machine, not just /home/z/my-project.

export { assetPublicPath, resolveUploadFsPath, UPLOADS_DIR, WORKSPACE_SLUG }
