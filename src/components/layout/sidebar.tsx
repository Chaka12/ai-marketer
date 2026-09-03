'use client'

import { useApp, type SectionId, SECTION_TITLES } from '@/components/providers/app-provider'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Sparkles,
  CheckCircle2,
  CalendarDays,
  Megaphone,
  BarChart3,
  BookOpen,
  Bot,
  Send,
  Settings,
} from 'lucide-react'
import Image from 'next/image'

const NAV: { id: SectionId; label: string; icon: React.ElementType; group?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { id: 'create', label: 'Create Week', icon: Sparkles, group: 'Workflow' },
  { id: 'approval', label: 'Approval', icon: CheckCircle2, group: 'Workflow' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, group: 'Workflow' },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone, group: 'Plan' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, group: 'Plan' },
  { id: 'brand', label: 'Brand Brain', icon: BookOpen, group: 'Configuration' },
  { id: 'distribution', label: 'Distribution', icon: Send, group: 'Configuration' },
  { id: 'assistant', label: 'Assistant', icon: Bot, group: 'Configuration' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'Configuration' },
]

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { section, navigate, workspaceName, workspaceLogoUrl } = useApp()

  const groups = NAV.reduce<Record<string, typeof NAV>>((acc, item) => {
    const g = item.group ?? 'Other'
    ;(acc[g] ??= []).push(item)
    return acc
  }, {})

  const initial = workspaceName?.trim()?.charAt(0)?.toUpperCase() ?? 'M'

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand header — fixed at top of sidebar */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4 py-4">
        {workspaceLogoUrl ? (
          <Image
            src={workspaceLogoUrl}
            alt={workspaceName}
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-md object-contain"
            unoptimized
          />
        ) : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary font-display text-lg font-semibold text-primary-foreground shadow-sm">
            {initial}
          </div>
        )}
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-display text-base font-semibold leading-tight">
            {workspaceName}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            AI Content Engine
          </span>
        </div>
      </div>

      {/* Navigation — scrolls if the viewport is short. The ScrollArea
          component handles both desktop (sticky sidebar) and mobile (Sheet)
          cases. On mobile the Sheet content area can be shorter than the nav
          list, so this scroll is essential. */}
      <ScrollArea className="min-h-0 flex-1 scroll-area-styled">
        <nav className="flex flex-col gap-5 px-3 py-4">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} className="flex flex-col gap-1">
              <span className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group}
              </span>
              {items.map(({ id, label, icon: Icon }) => {
                const active = section === id
                return (
                  <button
                    key={id}
                    onClick={() => {
                      navigate(id)
                      onNavigate?.()
                    }}
                    className={cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all',
                      'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      active && 'bg-sidebar-accent text-sidebar-accent-foreground',
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon
                      className={cn(
                        'size-4 shrink-0 transition-colors',
                        active
                          ? 'text-primary'
                          : 'text-muted-foreground group-hover:text-sidebar-accent-foreground',
                      )}
                    />
                    <span>{label}</span>
                    {active && (
                      <span className="ml-auto size-1.5 rounded-full bg-primary" aria-hidden />
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer — fixed at bottom of sidebar */}
      <div className="shrink-0 border-t border-sidebar-border px-4 py-3">
        <p className="truncate text-[11px] text-muted-foreground">
          {SECTION_TITLES[section]} · {workspaceName}
        </p>
      </div>
    </div>
  )
}
