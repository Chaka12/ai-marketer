'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useCalendar } from '@/hooks/use-dashboard'
import { PostCard } from '@/components/post-card'
import { usePosts } from '@/hooks/use-posts'
import {
  format,
  startOfDay,
  addDays,
  isSameDay,
  parseISO,
} from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'scheduled' | 'published' | 'pending'

const STATUS_COLOR: Record<string, string> = {
  scheduled: 'bg-sky-100 text-sky-800 border-sky-200',
  published: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  pending_approval: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

export function CalendarSection() {
  const { data: calendarPosts, isLoading } = useCalendar()
  const { data: allPosts } = usePosts()
  const [filter, setFilter] = useState<Filter>('all')
  const [windowStart, setWindowStart] = useState(() => startOfDay(new Date()))
  const [openPostId, setOpenPostId] = useState<string | null>(null)

  const days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(windowStart, i)),
    [windowStart],
  )

  const filtered = useMemo(() => {
    if (!calendarPosts) return []
    return calendarPosts.filter((p: any) => {
      if (filter === 'all') return true
      if (filter === 'pending') return p.status === 'pending_approval'
      return p.status === filter
    })
  }, [calendarPosts, filter])

  const postsByDay = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const p of filtered) {
      const dateStr = p.scheduledAt ?? p.publishedAt
      if (!dateStr) continue
      const d = startOfDay(parseISO(dateStr))
      const key = format(d, 'yyyy-MM-dd')
      ;(map[key] ??= []).push(p)
    }
    return map
  }, [filtered])

  const openPost = (allPosts ?? []).find((p) => p.id === openPostId)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWindowStart((d) => addDays(d, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium">
            {format(windowStart, 'MMM d')} — {format(addDays(windowStart, 13), 'MMM d, yyyy')}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWindowStart((d) => addDays(d, 7))}
            aria-label="Next week"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWindowStart(startOfDay(new Date()))}>
            Today
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {(['all', 'scheduled', 'published', 'pending'] as Filter[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className={cn(filter === f && 'bg-primary text-primary-foreground hover:bg-primary/90')}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-7">
          {Array.from({ length: 14 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          {days.map((day, idx) => {
            const key = format(day, 'yyyy-MM-dd')
            const dayPosts = postsByDay[key] ?? []
            const isToday = isSameDay(day, new Date())
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: idx * 0.02 }}
                className={cn(
                  'flex min-h-32 flex-col gap-1 rounded-md border border-border bg-card p-2',
                  isToday && 'border-primary ring-1 ring-primary/30',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {format(day, 'EEE')}
                  </span>
                  <span className={cn('text-sm font-semibold', isToday && 'text-primary')}>
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {dayPosts.slice(0, 3).map((p: any) => {
                    const dateStr = p.scheduledAt ?? p.publishedAt
                    const time = dateStr ? format(parseISO(dateStr), 'HH:mm') : '—'
                    const colorClass = STATUS_COLOR[p.status] ?? 'bg-stone-100 text-stone-700 border-stone-200'
                    return (
                      <button
                        key={p.id}
                        onClick={() => setOpenPostId(p.id)}
                        className="group flex flex-col gap-0.5 rounded border border-border bg-background px-1.5 py-1 text-left text-xs transition-colors hover:border-primary hover:bg-accent"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{time}</span>
                          <span className={cn('size-1.5 rounded-full', colorClass.split(' ')[0].replace('bg-', 'bg-'))} />
                        </div>
                        <p className="line-clamp-2 text-foreground/70">
                          {p.hook ?? p.caption}
                        </p>
                      </button>
                    )
                  })}
                  {dayPosts.length > 3 && (
                    <span className="px-1 text-[10px] text-muted-foreground">
                      +{dayPosts.length - 3} more
                    </span>
                  )}
                  {dayPosts.length === 0 && (
                    <span className="text-[10px] text-muted-foreground/50">—</span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <Dialog open={!!openPost} onOpenChange={(o) => !o && setOpenPostId(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display">Post details</DialogTitle>
            <DialogDescription>
              {openPost
                ? `Status: ${openPost.status.replace(/_/g, ' ')}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {openPost && (
            <div className="flex flex-col gap-2">
              {openPost.scheduledAt && (
                <p className="text-sm text-muted-foreground">
                  Scheduled: {format(parseISO(openPost.scheduledAt), 'EEE, MMM d · HH:mm')}
                </p>
              )}
              {openPost.publishedAt && (
                <p className="text-sm text-muted-foreground">
                  Published: {format(parseISO(openPost.publishedAt), 'EEE, MMM d · HH:mm')}
                </p>
              )}
              <PostCard post={openPost} showActions />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <CalendarDays className="size-3.5" />
        <span>Showing {filtered.length} posts over 14 days.</span>
      </div>
    </div>
  )
}
