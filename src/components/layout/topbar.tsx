'use client'

import { useApp, SECTION_TITLES, SECTION_DESCRIPTIONS } from '@/components/providers/app-provider'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sidebar } from './sidebar'
import { Sparkles, Menu, ChevronDown, Plus, Building2, Check } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useState } from 'react'

interface WorkspaceItem {
  id: string
  name: string
  slug: string
  approvalMode: string
  logoUrl: string | null
  brandCount: number
  postCount: number
  memberCount: number
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Request failed')
  return json.data as T
}

export function Topbar() {
  const { section, navigate, workspaceName, workspaceId, workspaceLogoUrl, setWorkspace } = useApp()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)

  const { data: workspaces } = useQuery<WorkspaceItem[]>({
    queryKey: ['workspaces'],
    queryFn: () => fetchJson<WorkspaceItem[]>('/api/workspaces'),
  })

  async function createWorkspace() {
    const name = window.prompt('New workspace name (e.g. "ABC Restaurant"):')
    if (!name?.trim()) return
    setCreating(true)
    try {
      const created = await fetchJson<WorkspaceItem>('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      setWorkspace(created.id, created.name, created.slug, created.logoUrl)
      qc.invalidateQueries({ queryKey: ['workspaces'] })
      toast.success(`Workspace "${created.name}" created`)
      navigate('brand')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-6">
        {/* Mobile sidebar trigger */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 sm:w-80" aria-describedby={undefined}>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {/* Sidebar fills the Sheet content. Its internal ScrollArea
                handles vertical scrolling when the nav list is taller than
                the viewport. */}
            <div className="h-full">
              <Sidebar />
            </div>
          </SheetContent>
        </Sheet>

        {/* Section title — truncate on small screens */}
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate font-display text-base font-semibold leading-tight sm:text-lg lg:text-xl">
            {SECTION_TITLES[section]}
          </h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            {SECTION_DESCRIPTIONS[section]}
          </p>
        </div>

        {/* Workspace switcher — dropdown for multi-workspace (agency mode) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="hidden shrink-0 gap-2 md:flex"
              aria-label="Switch workspace"
            >
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="max-w-[120px] truncate">{workspaceName}</span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              Workspaces
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(workspaces ?? []).map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => {
                  setWorkspace(ws.id, ws.name, ws.slug, ws.logoUrl)
                  qc.invalidateQueries()
                  toast.success(`Switched to ${ws.name}`)
                }}
                className="flex items-center justify-between gap-2"
              >
                <span className="truncate">{ws.name}</span>
                {ws.id === workspaceId && <Check className="size-4 shrink-0 text-primary" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={createWorkspace} disabled={creating}>
              <Plus className="size-4" />
              New workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Create week CTA */}
        <Button
          onClick={() => navigate('create')}
          size="sm"
          className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Sparkles className="size-4" />
          <span className="hidden sm:inline">Create week</span>
        </Button>
      </div>
    </header>
  )
}
