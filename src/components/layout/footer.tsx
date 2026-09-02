'use client'

import { BookOpen } from 'lucide-react'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-display text-sm font-semibold text-foreground">AI Content Engine</span>
          <span className="text-border">·</span>
          <span>Operated content for {`Maison Été`}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <a
            href="#"
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            onClick={(e) => e.preventDefault()}
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
