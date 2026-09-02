'use client'

import { useApp, SECTION_TITLES, SECTION_DESCRIPTIONS } from '@/components/providers/app-provider'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { Sidebar } from './sidebar'
import { Sparkles, Menu } from 'lucide-react'

export function Topbar() {
  const { section, navigate, workspaceName } = useApp()

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        {/* Mobile sidebar trigger */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Sidebar />
          </SheetContent>
        </Sheet>

        {/* Section title */}
        <div className="flex flex-1 flex-col">
          <h1 className="font-display text-lg font-semibold leading-tight sm:text-xl">
            {SECTION_TITLES[section]}
          </h1>
          <p className="hidden text-xs text-muted-foreground sm:block">
            {SECTION_DESCRIPTIONS[section]}
          </p>
        </div>

        {/* Workspace switcher (single-workspace demo) */}
        <div className="hidden md:flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5">
          <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-medium">{workspaceName}</span>
        </div>

        {/* Create week CTA */}
        <Button
          onClick={() => navigate('create')}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Sparkles className="size-4" />
          <span className="hidden sm:inline">Create week</span>
        </Button>
      </div>
    </header>
  )
}
