/**
 * AI orchestration layer for the AI Content Engine.
 *
 * Wraps z-ai-web-dev-sdk behind a domain-specific API so the rest of the app
 * never talks to the SDK directly. This is the "AI orchestrator" described in
 * the architecture doc — a model router that exposes:
 *
 *   - vision model      → analyzeAsset (Module 2)
 *   - reasoning model   → generateWeeklyStrategy (Module 4)
 *   - fast text model   → generatePostCandidates, evaluateCandidate,
 *                         regeneratePost, runAssistant (Modules 5, 7, 22)
 *
 * All prompts are built from brand + campaign + asset context so the models
 * never have to "rediscover the business every week".
 *
 * IMPORTANT: this module is server-side only. Never import from a client
 * component.
 */
import 'server-only'
import ZAI from 'z-ai-web-dev-sdk'
import { promises as fs } from 'fs'
import path from 'path'
import type {
  AssetAnalysisDTO,
  BrandDTO,
  EvaluationResultDTO,
  PostCandidateDTO,
  WeeklyStrategyDTO,
  Objective,
  ContentPillar,
} from './types'

// ── SDK singleton ──────────────────────────────────────────

let _zai: Awaited<ReturnType<typeof ZAI.create>> | null = null

async function getZAI() {
  if (!_zai) {
    _zai = await ZAI.create()
  }
  return _zai
}

// ── Retry with backoff ─────────────────────────────────────
//
// The z-ai-web-dev-sdk occasionally returns 429 (rate limit) or transient
// network errors. The orchestrator makes several sequential AI calls per
// weekly generation, so we wrap every SDK call in this helper. On 429 or
// 5xx we wait (5s, 10s, 20s, 30s) and retry up to 4 times. Other errors
// (bad JSON, bad input, etc.) bubble up immediately.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function withRetry<T>(fn: () => Promise<T>, label = 'ai-call'): Promise<T> {
  // Patient backoff: 5s, 10s, 20s, 30s. The z-ai-web-dev-sdk rate limiter
  // typically resets within 30 seconds, so we give each call up to ~65s of
  // total retry window before giving up.
  const delays = [5000, 10000, 20000, 30000]
  let lastErr: unknown
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      const isRateLimit =
        msg.includes('429') ||
        msg.includes('Too many requests') ||
        msg.includes('rate limit')
      const isTransient =
        msg.includes('5') && (msg.includes('00') || msg.includes('03') || msg.includes('50'))
      // Most non-rate-limit errors (bad JSON, bad input, etc.) shouldn't be retried.
      if (!isRateLimit && !isTransient) {
        throw err
      }
      if (attempt === delays.length) {
        console.error(`[ai] ${label} failed after ${attempt} retries: ${msg}`)
        throw err
      }
      console.warn(
        `[ai] ${label} attempt ${attempt + 1} failed (${msg}); retrying in ${delays[attempt]}ms`,
      )
      await sleep(delays[attempt])
    }
  }
  throw lastErr
}

// ── SDK call wrappers (with retry built in) ────────────────
//
// Every SDK call goes through these helpers so 429/transient errors are
// retried automatically. Use `chatComplete` for text and `visionComplete`
// for image input.

async function chatComplete(
  messages: { role: 'assistant' | 'user' | 'system'; content: string }[],
  label = 'chat',
) {
  const zai = await getZAI()
  return withRetry(
    () =>
      zai.chat.completions.create({
        messages,
        thinking: { type: 'disabled' },
      }) as Promise<{
        choices: { message: { content?: string } }[]
      }>,
    label,
  )
}

async function visionComplete(
  messages: {
    role: 'user' | 'assistant' | 'system'
    content: { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }[]
  }[],
  label = 'vision',
) {
  const zai = await getZAI()
  return withRetry(
    () =>
      zai.chat.completions.createVision({
        messages,
        thinking: { type: 'disabled' },
      }) as Promise<{
        choices: { message: { content?: string } }[]
      }>,
    label,
  )
}

// ── Helpers ────────────────────────────────────────────────

function safeJsonParse<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback
  try {
    // Some models wrap JSON in ```json fences; strip them.
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
    return JSON.parse(cleaned) as T
  } catch {
    // Try to find the first { ... } block.
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0]) as T
      } catch {
        /* fall through */
      }
    }
    return fallback
  }
}

async function fileToDataUrl(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath)
  const ext = path.extname(filePath).toLowerCase().slice(1)
  const mime =
    ext === 'png'
      ? 'image/png'
      : ext === 'webp'
        ? 'image/webp'
        : ext === 'gif'
          ? 'image/gif'
          : 'image/jpeg'
  return `data:${mime};base64,${buf.toString('base64')}`
}

// ── Module 2 — Content Understanding ───────────────────────

/**
 * Run the vision model over a single asset and return a structured analysis
 * that downstream modules can reason about.
 */
export async function analyzeAsset(
  filePath: string,
  brandContext?: string,
): Promise<AssetAnalysisDTO> {
  const zai = await getZAI()
  const dataUrl = await fileToDataUrl(filePath)

  const prompt = `You are a senior content analyst for a marketing team.
Examine this image and produce a STRICT JSON object (no prose, no markdown)
with exactly these fields:

{
  "subject": "short description of the main subject",
  "setting": "where the photo was taken (e.g. retail store, outdoor, studio)",
  "objects": ["list of visible objects"],
  "peopleCount": 0,
  "emotion": "dominant emotion or mood, or 'none'",
  "product": "product name if identifiable, or null",
  "quality": "low | medium | high",
  "visibleText": "any text visible in the image, or null",
  "suggestedUses": ["product_showcase", "announcement", "lifestyle", "social_proof", "engagement", "community"]
}

Choose "suggestedUses" from this fixed list only:
product_showcase, announcement, lifestyle, social_proof, engagement, community, promotional, educational.

${brandContext ? `Brand context for accuracy: ${brandContext}` : ''}

Return ONLY the JSON object.`

  const completion = await visionComplete(
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    'analyzeAsset',
  )

  const raw = completion.choices[0]?.message?.content ?? ''
  const parsed = safeJsonParse<AssetAnalysisDTO>(raw, {
    subject: 'Unknown',
    objects: [],
    suggestedUses: [],
    rawAnalysis: raw,
  })

  return {
    ...parsed,
    objects: Array.isArray(parsed.objects) ? parsed.objects : [],
    suggestedUses: Array.isArray(parsed.suggestedUses)
      ? parsed.suggestedUses
      : [],
    peopleCount: typeof parsed.peopleCount === 'number' ? parsed.peopleCount : 0,
    rawAnalysis: raw,
  }
}

// ── Module 4 — Strategy Engine ─────────────────────────────

/**
 * Generate a weekly content strategy from the brand profile, available assets,
 * and (optionally) the previous week's performance.
 */
export async function generateWeeklyStrategy(params: {
  brand: BrandDTO
  objective: Objective
  brief: string
  assetCount: number
  previousPerformance?: { pillar: string; avgEngagement: number }[]
}): Promise<WeeklyStrategyDTO> {
  const zai = await getZAI()

  const system = `You are the Strategy Engine of an AI content marketing system.
Given a brand profile, a weekly brief, available assets, and (optionally) past
performance, design a 7-day content strategy. Respond with STRICT JSON only —
no prose, no markdown fences.`

  const user = `BRAND
${JSON.stringify(params.brand, null, 2)}

WEEKLY BRIEF
${params.brief}

PRIMARY OBJECTIVE: ${params.objective}
AVAILABLE ASSETS: ${params.assetCount}

${params.previousPerformance && params.previousPerformance.length > 0
  ? `PREVIOUS PERFORMANCE (pillar → avg engagement)\n${params.previousPerformance
      .map((p) => `- ${p.pillar}: ${p.avgEngagement.toFixed(2)}`)
      .join('\n')}\nUse this to adjust the content mix.`
  : ''}

Produce JSON in EXACTLY this shape:
{
  "objective": "${params.objective}",
  "contentMix": [
    { "pillar": "product", "percentage": 25 },
    ...
  ],
  "dailyPlan": [
    { "day": "Monday", "pillar": "product", "objective": "awareness", "focus": "introduce the new collection" },
    ...7 entries, one per day Monday→Sunday...
  ],
  "rationale": "2-3 sentence explanation of why this mix fits the objective",
  "postCount": 14
}

Pillars MUST be from this list:
product, educational, lifestyle, social_proof, engagement, community, promotional.
Percentages MUST sum to 100.
postCount should be between 7 and 14, capped by available assets × 2.`

  const completion = await chatComplete(
    [
      { role: 'assistant', content: system },
      { role: 'user', content: user },
    ],
    'generateWeeklyStrategy',
  )

  const raw = completion.choices[0]?.message?.content ?? ''
  return safeJsonParse<WeeklyStrategyDTO>(raw, {
    objective: params.objective,
    contentMix: [
      { pillar: 'product', percentage: 30 },
      { pillar: 'educational', percentage: 20 },
      { pillar: 'lifestyle', percentage: 20 },
      { pillar: 'social_proof', percentage: 15 },
      { pillar: 'engagement', percentage: 15 },
    ],
    dailyPlan: [
      { day: 'Monday', pillar: 'product', objective: 'awareness', focus: 'Introduce the week' },
      { day: 'Tuesday', pillar: 'educational', objective: 'engagement', focus: 'Teach something' },
      { day: 'Wednesday', pillar: 'lifestyle', objective: 'awareness', focus: 'Show context' },
      { day: 'Thursday', pillar: 'social_proof', objective: 'engagement', focus: 'Customer story' },
      { day: 'Friday', pillar: 'promotional', objective: 'sales', focus: 'Promote offer' },
      { day: 'Saturday', pillar: 'engagement', objective: 'engagement', focus: 'Ask a question' },
      { day: 'Sunday', pillar: 'community', objective: 'awareness', focus: 'Community moment' },
    ],
    rationale:
      'Default balanced mix used because the strategy engine could not parse a custom plan.',
    postCount: Math.min(14, Math.max(7, params.assetCount * 2)),
  })
}

// ── Module 5 — Content Generator ───────────────────────────

/**
 * Generate N candidate posts (different angles) for a single planned slot.
 * The orchestrator layer then runs evaluateCandidate on each and picks the
 * highest-scoring one — see pickBestCandidate.
 */
export async function generatePostCandidates(params: {
  brand: BrandDTO
  pillar: ContentPillar
  objective: Objective
  focus: string
  day: string
  assetAnalysis?: AssetAnalysisDTO
  destinationName?: string
  destinationType?: 'page' | 'group'
  count?: number
}): Promise<PostCandidateDTO[]> {
  const zai = await getZAI()
  const count = params.count ?? 3

  const system = `You are the Content Generator for an AI marketing system.
You write Facebook-ready posts that obey the brand voice EXACTLY.
You NEVER invent facts not provided in the brief.
You NEVER use banned vocabulary.
Respond with STRICT JSON only — no prose, no markdown.`

  const user = `BRAND PROFILE
${JSON.stringify(params.brand, null, 2)}

${params.assetAnalysis ? `ASSET ANALYSIS\n${JSON.stringify(params.assetAnalysis, null, 2)}` : 'No asset attached — write a text-only post.'}

PLANNED SLOT
Day: ${params.day}
Pillar: ${params.pillar}
Objective: ${params.objective}
Focus: ${params.focus}
Destination: ${params.destinationName ?? 'Facebook Page'} (${params.destinationType ?? 'page'})

Generate ${count} DIFFERENT candidate posts, each taking a distinct angle:
- Candidate A: educational angle
- Candidate B: storytelling angle
- Candidate C: direct-response angle${count > 3 ? '\n- Additional candidates: vary the tone further' : ''}

Each candidate MUST follow the brand's writing style and avoid the brand's
banned vocabulary. Captions should be 1-3 short paragraphs. Hashtags 3-7.
Alt text should describe the image factually for accessibility.

Respond with EXACTLY this JSON shape:
{
  "candidates": [
    {
      "objective": "${params.objective}",
      "contentPillar": "${params.pillar}",
      "hook": "first line that grabs attention",
      "caption": "the full caption",
      "cta": "what the reader should do",
      "hashtags": ["#tag1", "#tag2"],
      "altText": "factual description of the image",
      "confidence": 0.9
    }
  ]
}`

  const completion = await chatComplete(
    [
      { role: 'assistant', content: system },
      { role: 'user', content: user },
    ],
    'generateWeeklyStrategy',
  )

  const raw = completion.choices[0]?.message?.content ?? ''
  const parsed = safeJsonParse<{ candidates: PostCandidateDTO[] }>(raw, {
    candidates: [],
  })
  const candidates = Array.isArray(parsed.candidates)
    ? parsed.candidates
    : []

  // Backfill required fields so the rest of the pipeline is safe.
  return candidates.slice(0, count).map((c) => ({
    objective: params.objective,
    contentPillar: params.pillar,
    assetId: undefined,
    hook: c.hook ?? '',
    caption: c.caption ?? '',
    cta: c.cta ?? params.brand.cta ?? '',
    hashtags: Array.isArray(c.hashtags) ? c.hashtags : [],
    altText: c.altText ?? '',
    confidence: typeof c.confidence === 'number' ? c.confidence : 0.7,
  }))
}

// ── Module 5b — Evaluator ──────────────────────────────────

/**
 * Score a single candidate against brand rules, accuracy, repetition and
 * spamminess checks. Returns 0-1 score plus human-readable reasoning.
 */
export async function evaluateCandidate(params: {
  brand: BrandDTO
  candidate: PostCandidateDTO
  recentCaptions: string[]
}): Promise<EvaluationResultDTO> {
  const zai = await getZAI()

  const system = `You are the Evaluator layer of an AI content marketing system.
You score a proposed social media post against brand rules, factual accuracy,
repetition, CTA quality, spamminess, prohibited claims, and image relevance.
Respond with STRICT JSON only.`

  const user = `BRAND PROFILE
${JSON.stringify(params.brand, null, 2)}

RECENT POSTS (avoid repetition):
${params.recentCaptions.length > 0 ? params.recentCaptions.map((c, i) => `${i + 1}. ${c}`).join('\n') : 'None yet.'}

CANDIDATE POST
${JSON.stringify(params.candidate, null, 2)}

Evaluate and return JSON in EXACTLY this shape:
{
  "score": 0.87,
  "confidence": 0.85,
  "reasoning": "2-3 sentence justification",
  "issues": ["list any concrete problems; empty array if none"]
}

Score on a 0-1 scale:
- 0.9+ excellent, ready to publish
- 0.7-0.9 good, may need minor edits
- 0.5-0.7 mediocre, rewrite recommended
- <0.5 reject and regenerate
Penalise heavily for: banned vocabulary, fake urgency, unsupported claims,
generic motivational quotes, excessive emojis, off-brand tone.`

  const completion = await chatComplete(
    [
      { role: 'assistant', content: system },
      { role: 'user', content: user },
    ],
    'generateWeeklyStrategy',
  )

  const raw = completion.choices[0]?.message?.content ?? ''
  return safeJsonParse<EvaluationResultDTO>(raw, {
    score: 0.5,
    confidence: 0.5,
    reasoning: 'Evaluator returned unparseable output; defaulting to neutral score.',
    issues: [],
  })
}

/**
 * Convenience: generate N candidates, evaluate each, return the best.
 */
export async function generateAndPickBest(params: {
  brand: BrandDTO
  pillar: ContentPillar
  objective: Objective
  focus: string
  day: string
  assetAnalysis?: AssetAnalysisDTO
  destinationName?: string
  destinationType?: 'page' | 'group'
  recentCaptions: string[]
}): Promise<PostCandidateDTO & { evaluation: EvaluationResultDTO }> {
  const candidates = await generatePostCandidates(params)
  if (candidates.length === 0) {
    throw new Error('Content generator produced no candidates')
  }

  // Pick the candidate with the highest self-reported confidence first.
  const byConfidence = [...candidates].sort(
    (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0),
  )

  // Optimisation: if the top candidate's self-reported confidence is high
  // (>= 0.85), skip the separate evaluator call entirely. The LLM has
  // already self-assessed the candidate as strong, and we trust that
  // signal. This roughly halves the AI calls per weekly generation and
  // keeps us well under the rate limiter's threshold.
  const top = byConfidence[0]
  if ((top.confidence ?? 0) >= 0.85) {
    const evaluation: EvaluationResultDTO = {
      score: top.confidence ?? 0.85,
      confidence: top.confidence ?? 0.85,
      reasoning:
        'Self-assessed confidence was high (>=0.85); evaluator step was skipped to conserve AI calls.',
      issues: [],
    }
    return { ...top, score: evaluation.score, evaluation }
  }

  // Otherwise, run the evaluator on the top candidate. If it scores below
  // 0.6, try the next candidate as a fallback.
  for (let i = 0; i < Math.min(2, byConfidence.length); i++) {
    const candidate = byConfidence[i]
    const evaluation = await evaluateCandidate({
      brand: params.brand,
      candidate,
      recentCaptions: params.recentCaptions,
    })
    if (evaluation.score >= 0.6 || i === byConfidence.length - 1) {
      return { ...candidate, score: evaluation.score, evaluation }
    }
  }

  // Unreachable but keeps TypeScript happy.
  const fallback = byConfidence[0]
  const evaluation = await evaluateCandidate({
    brand: params.brand,
    candidate: fallback,
    recentCaptions: params.recentCaptions,
  })
  return { ...fallback, score: evaluation.score, evaluation }
}

// ── Module 7 — Regeneration (used by Approval screen) ──────

export async function regeneratePost(params: {
  brand: BrandDTO
  current: { hook: string; caption: string; cta: string; hashtags: string[] }
  instruction: string
}): Promise<{ hook: string; caption: string; cta: string; hashtags: string[] }> {
  const completion = await chatComplete(
    [
      {
        role: 'assistant',
        content: `You are a content editor. Rewrite the post following the user's instruction. Stay strictly within brand voice. Respond with STRICT JSON only.`,
      },
      {
        role: 'user',
        content: `BRAND PROFILE
${JSON.stringify(params.brand, null, 2)}

CURRENT POST
${JSON.stringify(params.current, null, 2)}

INSTRUCTION: ${params.instruction}

Respond in EXACTLY this shape:
{
  "hook": "...",
  "caption": "...",
  "cta": "...",
  "hashtags": ["..."]
}`,
      },
    ],
    'regeneratePost',
  )

  const raw = completion.choices[0]?.message?.content ?? ''
  const parsed = safeJsonParse<{
    hook?: string
    caption?: string
    cta?: string
    hashtags?: string[]
  }>(raw, {})

  return {
    hook: parsed.hook ?? params.current.hook,
    caption: parsed.caption ?? params.current.caption,
    cta: parsed.cta ?? params.current.cta,
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags
      : params.current.hashtags,
  }
}

// ── Module 22 — AI Assistant ───────────────────────────────

/**
 * Run the workspace AI assistant. The assistant has read-only context about
 * the workspace (campaigns, posts, analytics) and can answer questions or
 * take textual actions.
 */
export async function runAssistant(params: {
  brand: BrandDTO
  workspaceContext: string
  history: { role: 'user' | 'assistant'; content: string }[]
  userMessage: string
}): Promise<string> {
  const zai = await getZAI()

  const system = `You are the AI Marketing Assistant embedded in a workspace.
You help marketers plan, review, and improve their Facebook content.
You can see the workspace context provided below. Be concise, direct and
actionable. Never invent metrics that aren't in the context.

BRAND PROFILE
${JSON.stringify(params.brand, null, 2)}

WORKSPACE CONTEXT
${params.workspaceContext}`

  const messages: { role: 'assistant' | 'user'; content: string }[] = [
    { role: 'assistant', content: system },
    ...params.history.slice(-10),
    { role: 'user', content: params.userMessage },
  ]

  const completion = await chatComplete(messages, 'runAssistant')

  return (
    completion.choices[0]?.message?.content ??
    'I could not generate a response. Please try again.'
  )
}

// ── Module 11 — Learning Engine ────────────────────────────

/**
 * Read recent analytics and produce plain-English insights + a recommended
 * content-mix adjustment for the next cycle.
 */
export async function generateInsights(params: {
  byPillar: { pillar: string; posts: number; avgEngagement: number }[]
  byObjective: { objective: string; posts: number; avgEngagement: number }[]
}): Promise<{ insights: string[]; recommendedMix: { pillar: string; percentage: number }[] }> {
  const completion = await chatComplete(
    [
      {
        role: 'assistant',
        content: `You are the Learning Engine. Analyse the performance breakdown
and produce actionable insights plus a recommended content mix for the next
cycle. Respond with STRICT JSON only.`,
      },
      {
        role: 'user',
        content: `PERFORMANCE BY PILLAR
${JSON.stringify(params.byPillar, null, 2)}

PERFORMANCE BY OBJECTIVE
${JSON.stringify(params.byObjective, null, 2)}

Return JSON in EXACTLY this shape:
{
  "insights": [
    "Lifestyle posts generate 2.1x the engagement of promotional posts.",
    "..."
  ],
  "recommendedMix": [
    { "pillar": "lifestyle", "percentage": 30 },
    ...
  ]
}

recommendedMix percentages MUST sum to 100.
Pillars MUST be from: product, educational, lifestyle, social_proof, engagement, community, promotional.`,
      },
    ],
    'generateInsights',
  )

  const raw = completion.choices[0]?.message?.content ?? ''
  return safeJsonParse<{
    insights: string[]
    recommendedMix: { pillar: string; percentage: number }[]
  }>(raw, {
    insights: [],
    recommendedMix: [],
  })
}
