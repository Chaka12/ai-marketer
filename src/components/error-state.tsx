'use client'

import { Button } from '@/components/ui/button'
import { AlertTriangle, RotateCw } from 'lucide-react'

interface Props {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
      <AlertTriangle className="size-8 text-destructive" />
      <p className="font-display text-base font-semibold">Something went wrong</p>
      <p className="max-w-md text-sm text-muted-foreground">
        {message ?? 'We could not load this content. Please try again.'}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw className="size-3.5" /> Retry
        </Button>
      )}
    </div>
  )
}
