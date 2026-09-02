'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, RefreshCw, Check, Send, Sparkles } from 'lucide-react'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  useUpdatePost,
  useRegeneratePost,
  usePublishPost,
  type PostSummary,
} from '@/hooks/use-posts'
import { cn } from '@/lib/utils'

const OBJECTIVE_LABEL: Record<string, string> = {
  awareness: 'Awareness',
  engagement: 'Engagement',
  sales: 'Sales',
  leads: 'Leads',
  event_promotion: 'Event',
}

const PILLAR_LABEL: Record<string, string> = {
  product: 'Product',
  educational: 'Educational',
  lifestyle: 'Lifestyle',
  social_proof: 'Social proof',
  engagement: 'Engagement',
  community: 'Community',
  promotional: 'Promotional',
}

const STATUS_COLORS: Record<string, string> = {
  pending_approval: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  scheduled: 'bg-sky-100 text-sky-800 border-sky-200',
  publishing: 'bg-violet-100 text-violet-800 border-violet-200',
  published: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  rejected: 'bg-stone-200 text-stone-700 border-stone-300',
  draft: 'bg-stone-100 text-stone-700 border-stone-200',
}

interface Props {
  post: PostSummary
  showActions?: boolean
  onApprove?: () => void
  compact?: boolean
}

export function PostCard({ post, showActions = true, onApprove, compact = false }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [regenOpen, setRegenOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const updatePost = useUpdatePost()
  const regenPost = useRegeneratePost()
  const publishPost = usePublishPost()

  const statusColor = STATUS_COLORS[post.status] ?? STATUS_COLORS.draft
  const captionTooLong = post.caption.length > 240
  const shownCaption = expanded || !captionTooLong ? post.caption : post.caption.slice(0, 240) + '…'

  return (
    <Card className="card-hover overflow-hidden p-0 gap-0">
      <div className="flex flex-col sm:flex-row">
        {post.asset && (
          <div className="relative sm:w-36 sm:shrink-0 aspect-square sm:aspect-auto bg-muted overflow-hidden">
            <img
              src={post.asset.publicPath}
              alt={post.altText ?? post.asset.filename}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn('border', statusColor)}>
              {post.status.replace(/_/g, ' ')}
            </Badge>
            {post.objective && (
              <Badge variant="secondary" className="font-medium">
                {OBJECTIVE_LABEL[post.objective] ?? post.objective}
              </Badge>
            )}
            {post.contentPillar && (
              <Badge variant="outline" className="text-muted-foreground">
                {PILLAR_LABEL[post.contentPillar] ?? post.contentPillar}
              </Badge>
            )}
            {post.destination && (
              <span className="text-xs text-muted-foreground">
                → {post.destination.name}
              </span>
            )}
            {typeof post.score === 'number' && (
              <span className="ml-auto text-xs text-muted-foreground">
                score {(post.score * 100).toFixed(0)}
              </span>
            )}
          </div>

          {post.hook && (
            <h3 className="font-display text-base font-semibold leading-snug">
              {post.hook}
            </h3>
          )}

          <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
            {shownCaption}
          </p>
          {captionTooLong && (
            <button
              className="self-start text-xs font-medium text-primary hover:underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}

          {post.cta && (
            <p className="text-sm italic text-muted-foreground">→ {post.cta}</p>
          )}

          {post.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {post.hashtags.map((tag, i) => (
                <span
                  key={i}
                  className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {post.analytics && (
            <div className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-5 mt-1">
              <Metric label="Reach" value={post.analytics.reach} />
              <Metric label="Reactions" value={post.analytics.reactions} />
              <Metric label="Comments" value={post.analytics.comments} />
              <Metric label="Shares" value={post.analytics.shares} />
              <Metric
                label="ER"
                value={`${(post.analytics.engagementRate * 100).toFixed(1)}%`}
              />
            </div>
          )}

          {post.failureReason && (
            <p className="text-xs text-destructive">⚠ {post.failureReason}</p>
          )}

          {!compact && showActions && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-3.5" /> Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRegenOpen(true)}
              >
                <RefreshCw className="size-3.5" /> Regenerate
              </Button>
              {onApprove && (
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={onApprove}
                >
                  <Check className="size-3.5" /> Approve
                </Button>
              )}
              {(post.status === 'approved' || post.status === 'failed' || post.status === 'scheduled') && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    publishPost.mutate(post.id, {
                      onSuccess: () => toast.success('Post published'),
                      onError: (e) => toast.error(e.message),
                    })
                  }}
                  disabled={publishPost.isPending}
                >
                  <Send className="size-3.5" /> Publish now
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit post</DialogTitle>
          </DialogHeader>
          <EditForm
            post={post}
            onCancel={() => setEditOpen(false)}
            onSave={async (values) => {
              await updatePost.mutateAsync({ id: post.id, patch: values })
              toast.success('Post updated')
              setEditOpen(false)
            }}
            saving={updatePost.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Regenerate dialog */}
      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Regenerate with AI</DialogTitle>
          </DialogHeader>
          <RegenForm
            onCancel={() => setRegenOpen(false)}
            onSubmit={async (instruction) => {
              await regenPost.mutateAsync({ id: post.id, instruction })
              toast.success('Post regenerated')
              setRegenOpen(false)
            }}
            saving={regenPost.isPending}
          />
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border bg-card px-2 py-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </div>
  )
}

function EditForm({
  post,
  onCancel,
  onSave,
  saving,
}: {
  post: PostSummary
  onCancel: () => void
  onSave: (values: Record<string, unknown>) => Promise<void>
  saving: boolean
}) {
  const [hook, setHook] = useState(post.hook ?? '')
  const [caption, setCaption] = useState(post.caption)
  const [cta, setCta] = useState(post.cta ?? '')
  const [hashtags, setHashtags] = useState(post.hashtags.join(' '))
  const [altText, setAltText] = useState(post.altText ?? '')
  const [scheduledAt, setScheduledAt] = useState(
    post.scheduledAt ? post.scheduledAt.slice(0, 16) : '',
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hook">Hook</Label>
        <Input id="hook" value={hook} onChange={(e) => setHook(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="caption">Caption</Label>
        <Textarea
          id="caption"
          rows={5}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cta">Call to action</Label>
        <Input id="cta" value={cta} onChange={(e) => setCta(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hashtags">Hashtags (space-separated)</Label>
        <Input
          id="hashtags"
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="alt">Alt text</Label>
        <Input id="alt" value={altText} onChange={(e) => setAltText(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sched">Schedule at</Label>
        <Input
          id="sched"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={() =>
            onSave({
              hook,
              caption,
              cta,
              hashtags: hashtags.split(/\s+/).filter(Boolean),
              altText,
              scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
            })
          }
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
          <Sparkles className="size-3.5" />
        </Button>
      </DialogFooter>
    </div>
  )
}

function RegenForm({
  onCancel,
  onSubmit,
  saving,
}: {
  onCancel: () => void
  onSubmit: (instruction: string) => Promise<void>
  saving: boolean
}) {
  const [instruction, setInstruction] = useState('')
  const presets = [
    'Make it less salesy',
    'Add more emotion',
    'Shorten the caption',
    'Be more conversational',
  ]
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Describe how the AI should rewrite this post. It will keep the brand voice and asset context.
      </p>
      <Textarea
        rows={3}
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="e.g. Make it less salesy and add a question for the audience."
      />
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-accent"
            onClick={() => setInstruction(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={() => instruction && onSubmit(instruction)}
          disabled={saving || !instruction}
        >
          {saving ? 'Regenerating…' : 'Regenerate'}
          <RefreshCw className="size-3.5" />
        </Button>
      </DialogFooter>
    </div>
  )
}
