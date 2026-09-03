'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Request failed')
  return json.data as T
}

export interface AssetItem {
  id: string
  type: string
  filename: string
  filePath: string
  publicPath: string
  mimeType: string | null
  width: number | null
  height: number | null
  analysisStatus: string
  createdAt: string
  analysis: {
    subject?: string | null
    setting?: string | null
    objects: string[]
    peopleCount?: number | null
    emotion?: string | null
    product?: string | null
    quality?: string | null
    visibleText?: string | null
    suggestedUses: string[]
  } | null
}

export function useAssets() {
  return useQuery<AssetItem[]>({
    queryKey: ['assets'],
    queryFn: () => fetchJson<AssetItem[]>('/api/assets'),
  })
}

export function useUploadAssets() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (files: File[]) => {
      const fd = new FormData()
      for (const f of files) fd.append('files', f)
      const res = await fetch('/api/assets/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Upload failed')
      return json.data as AssetItem[]
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useAnalyzeAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/assets/${id}/analyze`, { method: 'POST' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Analysis failed')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] })
    },
  })
}

interface GenerateResponse {
  strategy: {
    objective: string
    contentMix: { pillar: string; percentage: number }[]
    dailyPlan: { day: string; pillar: string; objective: string; focus: string }[]
    rationale: string
    postCount: number
  }
  postsCreated: { id: string; day: string; pillar: string }[]
}

export function useGenerateWeek() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      brief: string
      objectives: string[]
      assetIds: string[]
      campaignId?: string
    }) => {
      const res = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Generation failed')
      return json.data as GenerateResponse
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      qc.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: () => fetchJson<any[]>('/api/campaigns'),
  })
}

export function useCalendar() {
  return useQuery({
    queryKey: ['calendar'],
    queryFn: () => fetchJson<any[]>('/api/calendar'),
  })
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
    asset?: { id: string; filename: string; publicPath?: string } | null
  }[]
  insights: string[]
}

export function useAnalytics() {
  return useQuery<AnalyticsSummary>({
    queryKey: ['analytics'],
    queryFn: () => fetchJson<AnalyticsSummary>('/api/analytics'),
  })
}

export function useBrands() {
  return useQuery<any[]>({
    queryKey: ['brands'],
    queryFn: () => fetchJson<any[]>('/api/brands'),
  })
}

export function useUpdateBrand() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const res = await fetch(`/api/brands/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Update failed')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brands'] })
    },
  })
}

export function useWorkspaces() {
  return useQuery<any[]>({
    queryKey: ['workspaces'],
    queryFn: () => fetchJson<any[]>('/api/workspaces'),
  })
}

export function useUpdateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const res = await fetch(`/api/workspaces/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Update failed')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })
}

export function useUploadWorkspaceLogo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/workspaces/${id}/logo`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Logo upload failed')
      return json.data as { logoUrl: string }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })
}

export function useDistributionAccounts() {
  return useQuery<any[]>({
    queryKey: ['distribution-accounts'],
    queryFn: async () => {
      const ws = await fetchJson<any[]>('/api/workspaces')
      const workspaceId = ws?.[0]?.id ?? ''
      return fetchJson<any[]>(`/api/distribution/accounts?workspaceId=${workspaceId}`)
    },
  })
}

export function useConnectAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/distribution/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Connect failed')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distribution-accounts'] })
    },
  })
}

export function useDisconnectAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/distribution/accounts/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Disconnect failed')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distribution-accounts'] })
    },
  })
}

export function useAddDestination() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/distribution/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Add destination failed')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distribution-accounts'] })
    },
  })
}

export function useUpdateDestination() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const res = await fetch(`/api/distribution/destinations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Update failed')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distribution-accounts'] })
    },
  })
}

export function useRemoveDestination() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/distribution/destinations/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Remove failed')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distribution-accounts'] })
    },
  })
}

export function useAudit() {
  return useQuery<any[]>({
    queryKey: ['audit'],
    queryFn: () => fetchJson<any[]>('/api/audit'),
  })
}
