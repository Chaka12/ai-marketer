'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useCampaigns } from '@/hooks/use-dashboard'
import { usePosts } from '@/hooks/use-posts'
import { PostCard } from '@/components/post-card'
import { ChevronDown, Megaphone } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

const PILLAR_COLORS: Record<string, string> = {
  product: 'bg-emerald-500',
  educational: 'bg-teal-500',
  lifestyle: 'bg-amber-500',
  social_proof: 'bg-rose-500',
  engagement: 'bg-violet-500',
  community: 'bg-cyan-500',
  promotional: 'bg-orange-500',
}

const OBJECTIVE_LABEL: Record<string, string> = {
  awareness: 'Awareness',
  engagement: 'Engagement',
  sales: 'Sales',
  leads: 'Leads',
  event_promotion: 'Event promotion',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  draft: 'bg-stone-100 text-stone-700 border-stone-200',
  completed: 'bg-blue-100 text-blue-800 border-blue-200',
  archived: 'bg-stone-200 text-stone-700 border-stone-300',
}

export function CampaignsSection() {
  const { data: campaigns, isLoading } = useCampaigns()
  const { data: posts } = usePosts()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    )
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-2 p-10 text-center text-sm text-muted-foreground">
          <Megaphone className="size-8" />
          No campaigns yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {campaigns.map((c: any, idx: number) => {
        const expanded = expandedId === c.id
        const campaignPosts = (posts ?? []).filter((p) => p.campaign?.id === c.id).slice(0, 5)
        return (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.04 }}
          >
            <Card className="card-hover">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="font-display text-lg">{c.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {c.startDate && format(parseISO(c.startDate), 'MMM d')}
                      {c.endDate && ` → ${format(parseISO(c.endDate), 'MMM d, yyyy')}`}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {c.objective && (
                      <Badge variant="secondary">
                        {OBJECTIVE_LABEL[c.objective] ?? c.objective}
                      </Badge>
                    )}
                    <Badge variant="outline" className={cn('border', STATUS_COLORS[c.status] ?? '')}>
                      {c.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Content mix bar */}
                {Array.isArray(c.contentMix) && c.contentMix.length > 0 && (
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Content mix</span>
                      <span>{c.postCount} posts · {c.assetCount} assets</span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full">
                      {c.contentMix.map((m: any, i: number) => (
                        <div
                          key={i}
                          className={cn('h-full', PILLAR_COLORS[m.pillar] ?? 'bg-stone-400')}
                          style={{ width: `${m.percentage}%` }}
                          title={`${m.pillar}: ${m.percentage}%`}
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {c.contentMix.map((m: any, i: number) => (
                        <div key={i} className="flex items-center gap-1 text-xs">
                          <span className={cn('size-2 rounded-sm', PILLAR_COLORS[m.pillar] ?? 'bg-stone-400')} />
                          <span className="capitalize text-muted-foreground">{m.pillar.replace(/_/g, ' ')}</span>
                          <span className="font-medium">{m.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Posts" value={c.postCount ?? 0} />
                  <Stat label="Reach" value={(c.totalReach ?? 0).toLocaleString()} />
                  <Stat label="Engagement" value={(c.totalEngagement ?? 0).toLocaleString()} />
                </div>

                <Collapsible open={expanded} onOpenChange={(o) => setExpandedId(o ? c.id : null)}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full">
                      <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
                      {expanded ? 'Hide posts' : `Show ${campaignPosts.length} posts`}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 flex flex-col gap-3">
                    {campaignPosts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No posts yet.</p>
                    ) : (
                      campaignPosts.map((p) => <PostCard key={p.id} post={p} compact showActions={false} />)
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-base font-semibold">{value}</p>
    </div>
  )
}
