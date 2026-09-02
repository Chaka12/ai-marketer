'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboard, usePosts } from '@/hooks'
import { useApp } from '@/components/providers/app-provider'
import { PostCard } from '@/components/post-card'
import { useApproveAll } from '@/hooks/use-posts'
import { ErrorState } from '@/components/error-state'
import { toast } from 'sonner'
import {
  Images,
  FileText,
  CalendarClock,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Sparkles,
} from 'lucide-react'

const OBJECTIVE_LABEL: Record<string, string> = {
  awareness: 'Awareness',
  engagement: 'Engagement',
  sales: 'Sales',
  leads: 'Leads',
  event_promotion: 'Event promotion',
}

export function DashboardSection() {
  const { data: stats, isLoading, isError, refetch, error } = useDashboard()
  const { data: posts } = usePosts()
  const { navigate } = useApp()
  const approveAll = useApproveAll()

  const pending = (posts ?? []).filter((p) => p.status === 'pending_approval').slice(0, 3)
  const published = (posts ?? [])
    .filter((p) => p.status === 'published')
    .slice(0, 3)
  const trendUp = (stats?.engagementTrend ?? 0) >= 0

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Failed to load dashboard'}
        onRetry={() => refetch()}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="overflow-hidden border-border bg-gradient-to-br from-primary/5 via-card to-card">
          <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
                  This week
                </span>
                <span className="h-px flex-1 bg-border sm:hidden" />
              </div>
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                {stats?.campaign?.name ?? 'Loading campaign…'}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>
                  Objective:{' '}
                  <span className="font-medium text-foreground">
                    {stats?.campaign?.objective
                      ? OBJECTIVE_LABEL[stats.campaign.objective] ?? stats.campaign.objective
                      : '—'}
                  </span>
                </span>
                <span className="text-border">·</span>
                <span>
                  Workspace: <span className="font-medium text-foreground">maison-ete</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => navigate('approval')} variant="outline">
                Review week
                <ArrowRight className="size-4" />
              </Button>
              <Button onClick={() => navigate('create')} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Sparkles className="size-4" />
                New week
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile
          icon={Images}
          label="Content supplied"
          value={stats?.contentSupplied}
          loading={isLoading}
        />
        <KpiTile
          icon={FileText}
          label="Posts generated"
          value={stats?.postsGenerated}
          loading={isLoading}
        />
        <KpiTile
          icon={CalendarClock}
          label="Posts scheduled"
          value={stats?.postsScheduled}
          loading={isLoading}
        />
        <KpiTile
          icon={CheckCircle2}
          label="Awaiting approval"
          value={stats?.awaitingApproval}
          loading={isLoading}
          highlight={!!stats?.awaitingApproval}
        />
      </div>

      {/* Engagement summary */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Engagement</CardTitle>
          <CardDescription>
            Total across published posts · compared to the previous 7 days
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-baseline gap-4">
          <span className="font-display text-3xl font-semibold">
            {(stats?.totalEngagement ?? 0).toLocaleString()}
          </span>
          <Badge
            variant="outline"
            className={trendUp ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}
          >
            {trendUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {Math.abs(stats?.engagementTrend ?? 0)}%
          </Badge>
          <span className="text-sm text-muted-foreground">
            {stats?.failed ?? 0} failed posts
          </span>
        </CardContent>
      </Card>

      {/* Two-column lists */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Awaiting approval</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('approval')}>
              View all <ArrowRight className="size-3.5" />
            </Button>
          </div>
          {pending.length === 0 ? (
            <EmptyState message="No posts awaiting approval." />
          ) : (
            <div className="flex flex-col gap-3">
              {pending.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  compact
                  showActions={false}
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
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Recently published</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('analytics')}>
              View analytics <ArrowRight className="size-3.5" />
            </Button>
          </div>
          {published.length === 0 ? (
            <EmptyState message="No published posts yet." />
          ) : (
            <div className="flex flex-col gap-3">
              {published.map((p) => (
                <PostCard key={p.id} post={p} compact showActions={false} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function KpiTile({
  icon: Icon,
  label,
  value,
  loading,
  highlight,
}: {
  icon: React.ElementType
  label: string
  value?: number
  loading?: boolean
  highlight?: boolean
}) {
  return (
    <Card
      className={`card-hover gap-0 p-4 ${
        highlight ? 'border-primary/40 bg-primary/5' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="rounded-md bg-secondary p-1.5">
          <Icon className="size-3.5 text-secondary-foreground" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-12" />
      ) : (
        <p className="mt-3 font-display text-2xl font-semibold">{value ?? 0}</p>
      )}
    </Card>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-8 text-sm text-muted-foreground">
      {message}
    </div>
  )
}
