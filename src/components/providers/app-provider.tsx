'use client'

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'

export type SectionId =
  | 'dashboard'
  | 'create'
  | 'approval'
  | 'calendar'
  | 'campaigns'
  | 'analytics'
  | 'brand'
  | 'assistant'
  | 'distribution'
  | 'settings'

interface AppCtx {
  section: SectionId
  setSection: (s: SectionId) => void
  workspaceId: string | null
  workspaceSlug: string
  workspaceName: string
  workspaceLogoUrl: string | null
  setWorkspace: (id: string, name: string, slug: string, logoUrl?: string | null) => void
  navigate: (s: SectionId) => void
}

const Ctx = createContext<AppCtx | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [section, setSection] = useState<SectionId>('dashboard')
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [workspaceName, setWorkspaceName] = useState('Maison Été')
  const [workspaceSlug, setWorkspaceSlug] = useState('maison-ete')
  const [workspaceLogoUrl, setWorkspaceLogoUrl] = useState<string | null>(null)

  // On mount, fetch the default workspace so the sidebar shows the right
  // name + logo immediately. The first workspace in the DB is the default.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/workspaces')
        const json = await res.json()
        if (!json.success || !json.data?.length) return
        const ws = json.data[0]
        if (cancelled) return
        setWorkspaceId(ws.id)
        setWorkspaceName(ws.name)
        setWorkspaceSlug(ws.slug)
        setWorkspaceLogoUrl(ws.logoUrl ?? null)
      } catch {
        // ignore — fallback to defaults
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const navigate = useCallback((s: SectionId) => {
    setSection(s)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  const setWorkspace = useCallback(
    (id: string, name: string, slug: string, logoUrl?: string | null) => {
      setWorkspaceId(id)
      setWorkspaceName(name)
      setWorkspaceSlug(slug)
      setWorkspaceLogoUrl(logoUrl ?? null)
      // Persist the active workspace so it survives reloads.
      if (typeof window !== 'undefined') {
        localStorage.setItem('activeWorkspaceId', id)
      }
    },
    [],
  )

  const value = useMemo(
    () => ({
      section,
      setSection,
      workspaceId,
      workspaceSlug,
      workspaceName,
      workspaceLogoUrl,
      setWorkspace,
      navigate,
    }),
    [section, workspaceId, workspaceSlug, workspaceName, workspaceLogoUrl, setWorkspace, navigate],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export const SECTION_TITLES: Record<SectionId, string> = {
  dashboard: 'Dashboard',
  create: 'Create Week',
  approval: 'Approval Queue',
  calendar: 'Calendar',
  campaigns: 'Campaigns',
  analytics: 'Analytics',
  brand: 'Brand Brain',
  assistant: 'AI Assistant',
  distribution: 'Distribution',
  settings: 'Settings',
}

export const SECTION_DESCRIPTIONS: Record<SectionId, string> = {
  dashboard: 'A snapshot of this week\'s content engine',
  create: 'Upload assets and generate the week\'s posts',
  approval: 'Review and approve AI-generated posts',
  calendar: 'A 14-day view of scheduled and published posts',
  campaigns: 'Manage campaigns and their content mix',
  analytics: 'Engagement by pillar, objective, and post',
  brand: 'Edit the brand profile, rules, and products',
  assistant: 'Ask the workspace AI assistant anything',
  distribution: 'Social accounts and posting destinations',
  settings: 'Workspace approval mode and audit log',
}
