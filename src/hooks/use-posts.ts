'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface DashboardStats {
  campaign?: { id: string; name: string; objective: string }
  contentSupplied: number
  postsGenerated: number
  postsScheduled: number
  postsPublished: number
  awaitingApproval: number
  failed: number
  totalEngagement: number
  engagementTrend: number
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Request failed')
  return json.data as T
}

export function useDashboard() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: () => fetchJson<DashboardStats>('/api/dashboard'),
  })
}

export interface PostSummary {
  id: string
  objective: string | null
  contentPillar: string | null
  hook: string | null
  caption: string
  cta: string | null
  hashtags: string[]
  altText: string | null
  status: string
  approvalMode: string | null
  scheduledAt: string | null
  publishedAt: string | null
  externalPostId: string | null
  failureReason: string | null
  retryCount: number
  score: number | null
  confidence: number | null
  recycledFromId: string | null
  createdAt: string
  updatedAt: string
  asset: {
    id: string
    filename: string
    filePath: string
    publicPath: string
    type: string
  } | null
  destination: {
    id: string
    name: string
    type: string
    platform: string
    automationStatus: string
  } | null
  campaign: { id: string; name: string } | null
  analytics: {
    reach: number
    impressions: number
    reactions: number
    comments: number
    shares: number
    clicks: number
    engagementRate: number
  } | null
}

export function usePosts(status?: string) {
  return useQuery<PostSummary[]>({
    queryKey: ['posts', status ?? 'all'],
    queryFn: () => {
      const url = status ? `/api/posts?status=${encodeURIComponent(status)}` : '/api/posts'
      return fetchJson<PostSummary[]>(url)
    },
  })
}

export function useUpdatePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const res = await fetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Update failed')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}

export function useRegeneratePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, instruction }: { id: string; instruction: string }) => {
      const res = await fetch(`/api/posts/${id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Regeneration failed')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}

export function usePublishPost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/posts/${id}/publish`, { method: 'POST' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Publish failed')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useApproveAll() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (postIds: string[]) => {
      const res = await fetch('/api/posts/approve-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postIds }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Approval failed')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}

export function useRecyclePost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/posts/${id}/recycle`, { method: 'POST' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Recycle failed')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}
