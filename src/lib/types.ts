// Shared TypeScript types used across the AI Content Engine.
// Mirrors the Prisma models but as plain types so the client doesn't have to
// import @prisma/client.

export type ApprovalMode = 'manual' | 'assisted' | 'autonomous'
export type PostStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'rejected'

export type Role = 'owner' | 'admin' | 'content_manager' | 'client' | 'viewer'

export type Objective =
  | 'awareness'
  | 'engagement'
  | 'sales'
  | 'leads'
  | 'event_promotion'

export type ContentPillar =
  | 'product'
  | 'educational'
  | 'lifestyle'
  | 'social_proof'
  | 'engagement'
  | 'community'
  | 'promotional'

export type Platform = 'facebook' | 'instagram' | 'tiktok' | 'x' | 'linkedin'

export type DestinationType = 'page' | 'group'

export type AssetType = 'image' | 'video' | 'pdf' | 'url' | 'text'

export type AssetAnalysisStatus = 'pending' | 'analyzing' | 'analyzed' | 'failed'

// ── Plain DTOs ─────────────────────────────────────────────

export interface BrandDTO {
  id: string
  name: string
  description?: string | null
  audience?: string | null
  location?: string | null
  personality?: string | null
  writingStyle?: string | null
  cta?: string | null
  avoid: string[]
  vocabularyUse: string[]
  vocabularyAvoid: string[]
  brandRules: { type: string; rule: string }[]
  products: ProductDTO[]
}

export interface ProductDTO {
  id: string
  name: string
  price?: string | null
  description?: string | null
  features: string[]
  url?: string | null
  promotion?: string | null
  promotionExpiry?: string | null
  availability?: string | null
}

export interface AssetAnalysisDTO {
  subject?: string
  setting?: string
  objects: string[]
  peopleCount?: number
  emotion?: string
  product?: string
  quality?: string
  visibleText?: string
  suggestedUses: string[]
  rawAnalysis?: string
}

export interface PostCandidateDTO {
  objective: Objective
  contentPillar: ContentPillar
  assetId?: string
  hook: string
  caption: string
  cta: string
  hashtags: string[]
  altText: string
  score?: number
  confidence?: number
  reasoning?: string
}

export interface WeeklyStrategyDTO {
  objective: string
  contentMix: { pillar: ContentPillar; percentage: number }[]
  dailyPlan: { day: string; pillar: ContentPillar; objective: Objective; focus: string }[]
  rationale: string
  postCount: number
}

export interface EvaluationResultDTO {
  score: number
  confidence: number
  reasoning: string
  issues: string[]
}

// ── API response wrappers ──────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// ── Dashboard ──────────────────────────────────────────────

export interface DashboardStats {
  campaign?: {
    id: string
    name: string
    objective: string
  }
  contentSupplied: number
  postsGenerated: number
  postsScheduled: number
  postsPublished: number
  awaitingApproval: number
  failed: number
  totalEngagement: number
  engagementTrend: number // percentage change vs previous period
}

export interface CalendarPost {
  id: string
  scheduledAt: string | null
  publishedAt: string | null
  status: PostStatus
  caption: string
  hook?: string | null
  objective?: string | null
  contentPillar?: string | null
  asset?: {
    id: string
    filename: string
    filePath: string
    type: string
  } | null
  destination?: {
    id: string
    name: string
    type: string
    platform: string
  } | null
  campaign?: {
    id: string
    name: string
  } | null
}

export interface AnalyticsSummary {
  totals: {
    reach: number
    impressions: number
    reactions: number
    comments: number
    shares: number
    clicks: number
    engagementRate: number
  }
  byPillar: { pillar: string; posts: number; avgEngagement: number; avgReach: number }[]
  byObjective: { objective: string; posts: number; avgEngagement: number }[]
  topPosts: {
    id: string
    caption: string
    contentPillar?: string | null
    reach: number
    engagementRate: number
    publishedAt: string | null
  }[]
  insights: string[]
}
