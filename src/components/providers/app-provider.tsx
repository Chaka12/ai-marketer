'use client'

import { createContext, useContext, useState, useCallback, useMemo } from 'react'

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
  workspaceSlug: string
  workspaceName: string
  setWorkspaceName: (s: string) => void
  navigate: (s: SectionId) => void
}

const Ctx = createContext<AppCtx | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [section, setSection] = useState<SectionId>('dashboard')
  const [workspaceName, setWorkspaceName] = useState('Maison Été')
  const workspaceSlug = 'maison-ete'

  const navigate = useCallback((s: SectionId) => {
    setSection(s)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  const value = useMemo(
    () => ({ section, setSection, workspaceSlug, workspaceName, setWorkspaceName, navigate }),
    [section, workspaceName, navigate],
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
