'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PostCard } from '@/components/post-card'
import { usePosts, useApproveAll } from '@/hooks/use-posts'
import { toast } from 'sonner'
import { CheckCircle2, Inbox, Sparkles } from 'lucide-react'

const DAY_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export function ApprovalSection() {
  const { data: posts, isLoading } = usePosts('pending_approval')
  const approveAll = useApproveAll()

  const grouped = useMemo(() => {
    const map: Record<string, typeof posts> = {}
    // Sort by createdAt ASC so the order the AI planned them in is preserved
    // (the API returns DESC). We then assign posts to days Monday→Sunday by index,
    // which matches how the strategy engine emits a daily plan.
    const sorted = [...(posts ?? [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    sorted.forEach((p, idx) => {
      const day = DAY_ORDER[idx % 7]
      ;(map[day] ??= []).push(p)
    })
    return map
  }, [posts])

  const sortedDays = DAY_ORDER.filter((d) => (grouped[d]?.length ?? 0) > 0)
  const total = posts?.length ?? 0

  const handleApproveAll = async () => {
    if (!posts || posts.length === 0) return
    const ids = posts.map((p) => p.id)
    try {
      const result = await approveAll.mutateAsync(ids)
      toast.success(`${result.approved} post${result.approved === 1 ? '' : 's'} approved & scheduled`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approval failed')
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    )
  }

  if (!posts || posts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
          <Inbox className="size-10 text-muted-foreground" />
          <p className="font-display text-lg font-semibold">No posts awaiting approval</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Generate a new week of content, or check the Calendar to see what&apos;s already scheduled.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total} post{total === 1 ? '' : 's'} ready for review · grouped by planned day
        </p>
        <Button
          onClick={handleApproveAll}
          disabled={approveAll.isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {approveAll.isPending ? 'Scheduling…' : `Approve all (${total})`}
          <CheckCircle2 className="size-4" />
        </Button>
      </div>

      {sortedDays.map((day, dayIdx) => (
        <motion.section
          key={day}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: dayIdx * 0.05 }}
          className="flex flex-col gap-3"
        >
          <div className="flex items-baseline gap-2">
            <h3 className="font-display text-xl font-semibold">{day}</h3>
            <span className="text-xs text-muted-foreground">
              {grouped[day]!.length} post{grouped[day]!.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {grouped[day]!.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                onApprove={async () => {
                  try {
                    await approveAll.mutateAsync([p.id])
                    toast.success('Post approved & scheduled')
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Approval failed')
                  }
                }}
              />
            ))}
          </div>
        </motion.section>
      ))}

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="size-4 text-primary" />
            <span>
              Approving moves all posts to <strong>Scheduled</strong> with sensible times for the
              upcoming week.
            </span>
          </div>
          <Button
            onClick={handleApproveAll}
            disabled={approveAll.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {approveAll.isPending ? 'Scheduling…' : `Approve all ${total}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
