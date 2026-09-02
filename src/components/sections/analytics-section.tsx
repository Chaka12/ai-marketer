'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useAnalytics } from '@/hooks/use-dashboard'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  Eye,
  Heart,
  MessageCircle,
  Share2,
  MousePointerClick,
  TrendingUp,
  Lightbulb,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'

const PILLAR_COLORS: Record<string, string> = {
  product: '#10b981',
  educational: '#14b8a6',
  lifestyle: '#f59e0b',
  social_proof: '#f43f5e',
  engagement: '#8b5cf6',
  community: '#06b6d4',
  promotional: '#fb923c',
  unknown: '#a3a3a3',
}

const OBJECTIVE_COLORS: Record<string, string> = {
  awareness: '#10b981',
  engagement: '#14b8a6',
  sales: '#f59e0b',
  leads: '#f43f5e',
  event_promotion: '#8b5cf6',
  unknown: '#a3a3a3',
}

const OBJECTIVE_LABEL: Record<string, string> = {
  awareness: 'Awareness',
  engagement: 'Engagement',
  sales: 'Sales',
  leads: 'Leads',
  event_promotion: 'Event',
  unknown: 'Unknown',
}

export function AnalyticsSection() {
  const { data, isLoading } = useAnalytics()

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const pillarData = data.byPillar.map((p) => ({
    name: p.pillar.replace(/_/g, ' '),
    engagement: Number((p.avgEngagement * 100).toFixed(2)),
    reach: p.avgReach,
  }))

  const objectiveData = data.byObjective.map((p) => ({
    name: OBJECTIVE_LABEL[p.objective] ?? p.objective,
    engagement: Number((p.avgEngagement * 100).toFixed(2)),
  }))

  return (
    <div className="flex flex-col gap-6">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi icon={Eye} label="Total reach" value={(data.totals.reach ?? 0).toLocaleString()} />
        <Kpi
          icon={Heart}
          label="Total engagement"
          value={(
            data.totals.reactions +
            data.totals.comments +
            data.totals.shares
          ).toLocaleString()}
        />
        <Kpi
          icon={TrendingUp}
          label="Avg engagement rate"
          value={`${(data.totals.engagementRate * 100).toFixed(2)}%`}
        />
        <Kpi icon={MessageCircle} label="Posts published" value={data.byPillar.reduce((s, p) => s + p.posts, 0)} />
      </div>

      {/* Engagement breakdown */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <MiniStat icon={Heart} label="Reactions" value={data.totals.reactions} />
        <MiniStat icon={MessageCircle} label="Comments" value={data.totals.comments} />
        <MiniStat icon={Share2} label="Shares" value={data.totals.shares} />
        <MiniStat icon={MousePointerClick} label="Clicks" value={data.totals.clicks} />
        <MiniStat icon={Eye} label="Impressions" value={data.totals.impressions} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Engagement by content pillar</CardTitle>
              <CardDescription>Average engagement rate (%) per pillar</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={pillarData} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#78716c' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#78716c' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e7e5e4',
                      fontSize: 12,
                    }}
                    formatter={(v: any) => [`${v}%`, 'Engagement']}
                  />
                  <Bar dataKey="engagement" radius={[4, 4, 0, 0]}>
                    {pillarData.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={
                          PILLAR_COLORS[
                            Object.keys(PILLAR_COLORS).find((k) =>
                              entry.name.includes(k.replace(/_/g, ' ')),
                            ) ?? 'unknown'
                          ] ?? '#10b981'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Engagement by objective</CardTitle>
              <CardDescription>Average engagement rate (%) per objective</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={objectiveData} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#78716c' }}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#78716c' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e7e5e4', fontSize: 12 }}
                    formatter={(v: any) => [`${v}%`, 'Engagement']}
                  />
                  <Bar dataKey="engagement" radius={[4, 4, 0, 0]}>
                    {objectiveData.map((entry, idx) => {
                      const colorKey =
                        Object.keys(OBJECTIVE_LABEL).find(
                          (k) => OBJECTIVE_LABEL[k] === entry.name,
                        ) ?? 'unknown'
                      return <Cell key={idx} fill={OBJECTIVE_COLORS[colorKey] ?? '#10b981'} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Top posts + insights */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display">Top performing posts</CardTitle>
            <CardDescription>Ranked by engagement rate</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.topPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No published posts with analytics yet.</p>
            ) : (
              data.topPosts.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-start gap-3 rounded-md border border-border bg-card p-3"
                >
                  <span className="font-display text-2xl font-semibold text-muted-foreground/40">
                    {idx + 1}
                  </span>
                  {p.asset && (
                    <img
                      src={p.asset.publicPath}
                      alt={p.caption}
                      className="size-12 rounded-md object-cover"
                    />
                  )}
                  <div className="flex flex-1 flex-col gap-1">
                    <p className="line-clamp-2 text-sm">{p.caption}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {p.contentPillar && (
                        <Badge variant="outline" className="capitalize">
                          {p.contentPillar.replace(/_/g, ' ')}
                        </Badge>
                      )}
                      <span>Reach: {p.reach.toLocaleString()}</span>
                      <span>·</span>
                      <span>ER: {(p.engagementRate * 100).toFixed(1)}%</span>
                      {p.publishedAt && (
                        <>
                          <span>·</span>
                          <span>{format(parseISO(p.publishedAt), 'MMM d')}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="size-4 text-primary" />
              <CardTitle className="font-display">AI insights</CardTitle>
            </div>
            <CardDescription>Generated by the Learning Engine</CardDescription>
          </CardHeader>
          <CardContent>
            {!data.insights || data.insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Insights appear once you have at least 5 published posts with analytics.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {data.insights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string | number
}) {
  return (
    <Card className="card-hover gap-0 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="rounded-md bg-secondary p-1.5">
          <Icon className="size-3.5 text-secondary-foreground" />
        </span>
      </div>
      <p className="mt-3 font-display text-2xl font-semibold">{value}</p>
    </Card>
  )
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
      <Icon className="size-3.5 text-muted-foreground" />
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-sm font-medium">{value.toLocaleString()}</span>
      </div>
    </div>
  )
}
