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
  const { section, navigate } = useApp()

  const groups = NAV.reduce<Record<string, typeof NAV>>((acc, item) => {
    const g = item.group ?? 'Other'
    ;(acc[g] ??= []).push(item)
    return acc
  }, {})

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <div className="size-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-display text-lg font-semibold shadow-sm">
          M
        </div>
        <div className="flex flex-col">
          <span className="font-display text-base font-semibold leading-tight">
            Maison Été
          </span>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            AI Content Engine
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3 py-4 scroll-area-styled">
        <nav className="flex flex-col gap-5">
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

      <div className="border-t border-sidebar-border px-5 py-3">
        <p className="text-[11px] text-muted-foreground">
          {SECTION_TITLES[section]} · workspace <span className="font-medium">maison-ete</span>
        </p>
      </div>
    </div>
  )
}
