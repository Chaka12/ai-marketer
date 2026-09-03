'use client'

import { useApp } from '@/components/providers/app-provider'
import { BookOpen } from 'lucide-react'

export function Footer() {
  const { workspaceName } = useApp()
  return (
    <footer className="mt-auto border-t border-border bg-background">
      {/* The key fix: removed max-w-7xl constraint (which was centering the
          footer and making it look disconnected from the sidebar layout on
          wide screens) and used full width with responsive horizontal
          padding that matches the topbar. The flex-wrap ensures the two
          halves stack gracefully on narrow screens instead of overflowing. */}
      <div className="flex w-full flex-col items-center justify-between gap-2 px-4 py-4 text-center sm:flex-row sm:gap-4 sm:px-6 sm:text-left lg:px-8">
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground sm:justify-start">
          <span className="font-display text-sm font-semibold text-foreground">
            AI Content Engine
          </span>
          <span className="text-border" aria-hidden>·</span>
          <span className="truncate">Operated content for {workspaceName}</span>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
          <a
            href="/README.md"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <BookOpen className="size-3" />
            Documentation
          </a>
          <span>v1.0 · sandbox</span>
        </div>
      </div>
    </footer>
  )
}
