'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { UploadZone } from '@/components/upload-zone'
import { useAssets, useCampaigns, useGenerateWeek } from '@/hooks/use-dashboard'
import { useApp } from '@/components/providers/app-provider'
import { toast } from 'sonner'
import {
  CheckCircle2,
  Sparkles,
  Loader2,
  ImageIcon,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const OBJECTIVES = [
  { id: 'awareness', label: 'Awareness' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'sales', label: 'Sales' },
  { id: 'leads', label: 'Leads' },
  { id: 'event_promotion', label: 'Event promotion' },
]

const PROGRESS_STEPS = [
  'Analyzing assets…',
  'Generating strategy…',
  'Writing posts…',
  'Evaluating candidates…',
]

export function CreateSection() {
  const { data: assets, isLoading: assetsLoading } = useAssets()
  const { data: campaigns } = useCampaigns()
  const generate = useGenerateWeek()
  const { navigate } = useApp()

  const [step, setStep] = useState<1 | 2>(1)
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])
  const [brief, setBrief] = useState('')
  const [objectives, setObjectives] = useState<string[]>(['awareness'])
  const [campaignId, setCampaignId] = useState<string>('')
  const [progressIdx, setProgressIdx] = useState(0)

  const activeCampaign = campaigns?.find((c) => c.status === 'active')
  const selectedCampaignId = campaignId || activeCampaign?.id || ''

  const toggleAsset = (id: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const toggleObjective = (id: string) => {
    setObjectives((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleGenerate = async () => {
    if (selectedAssetIds.length === 0) {
      toast.error('Please select at least one asset')
      return
    }
    setProgressIdx(0)
    const interval = setInterval(() => {
      setProgressIdx((i) => Math.min(i + 1, PROGRESS_STEPS.length - 1))
    }, 1500)
    try {
      const result = await generate.mutateAsync({
        brief,
        objectives,
        assetIds: selectedAssetIds,
        campaignId: selectedCampaignId,
      })
      clearInterval(interval)
      toast.success(`${result.postsCreated.length} posts created`)
      navigate('approval')
    } catch (e) {
      clearInterval(interval)
      toast.error(e instanceof Error ? e.message : 'Generation failed')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        <StepDot active={step === 1} done={step > 1} label="1. Upload assets" />
        <ChevronRight className="size-4 text-muted-foreground" />
        <StepDot active={step === 2} done={false} label="2. Brief & generate" />
      </div>

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-4"
          >
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Content intake</CardTitle>
                <CardDescription>
                  Upload images for this week. The AI will analyze them automatically before
                  writing posts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UploadZone />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display">Select assets for this week</CardTitle>
                <CardDescription>
                  Tap to include assets in this week&apos;s strategy.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {assetsLoading ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="aspect-square w-full" />
                    ))}
                  </div>
                ) : !assets || assets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                    <ImageIcon className="mb-2 size-8 opacity-50" />
                    No assets yet — upload some above.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
                    {assets.map((a) => {
                      const selected = selectedAssetIds.includes(a.id)
                      return (
                        <button
                          key={a.id}
                          onClick={() => toggleAsset(a.id)}
                          className={cn(
                            'group relative aspect-square overflow-hidden rounded-md border-2 bg-muted transition-all',
                            selected
                              ? 'border-primary ring-2 ring-primary/30'
                              : 'border-transparent hover:border-border',
                          )}
                        >
                          <img
                            src={a.publicPath}
                            alt={a.filename}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          {selected && (
                            <div className="absolute inset-0 flex items-center justify-center bg-primary/30">
                              <CheckCircle2 className="size-7 text-primary-foreground" />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left">
                            <p className="truncate text-[10px] text-white">
                              {a.analysis?.subject ?? a.filename}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedAssetIds.length} asset{selectedAssetIds.length === 1 ? '' : 's'} selected
              </p>
              <Button onClick={() => setStep(2)} disabled={selectedAssetIds.length === 0}>
                Next: brief & generate
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-4"
          >
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Weekly brief</CardTitle>
                <CardDescription>
                  What&apos;s happening this week? The strategy engine will use this to plan the content mix.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="brief">Brief</Label>
                  <Textarea
                    id="brief"
                    rows={4}
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    placeholder="e.g. Launch week for the Summer Collection. 20% off the Été Tote. New in-store event on Saturday."
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Primary objective</Label>
                  <div className="flex flex-wrap gap-2">
                    {OBJECTIVES.map((o) => {
                      const active = objectives.includes(o.id)
                      return (
                        <button
                          key={o.id}
                          onClick={() => toggleObjective(o.id)}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-sm transition-all',
                            active
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-card hover:bg-accent',
                          )}
                        >
                          {o.label}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The first selected objective becomes the primary goal of the week.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="campaign">Campaign</Label>
                  <select
                    id="campaign"
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedCampaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                  >
                    {campaigns?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.status})
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            {generate.isPending && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    {PROGRESS_STEPS[progressIdx]}
                  </div>
                  <div className="flex gap-1">
                    {PROGRESS_STEPS.map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'h-1 flex-1 rounded-full transition-colors',
                          i <= progressIdx ? 'bg-primary' : 'bg-border',
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This typically takes 30–90 seconds depending on the number of assets.
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={generate.isPending}>
                Back
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generate.isPending || selectedAssetIds.length === 0}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Sparkles className="size-4" />
                Generate week
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary footer */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{selectedAssetIds.length} assets</Badge>
        <Badge variant="outline">{objectives.length} objectives</Badge>
        <Badge variant="outline">{activeCampaign?.name ?? 'No active campaign'}</Badge>
      </div>
    </div>
  )
}

function StepDot({
  active,
  done,
  label,
}: {
  active: boolean
  done: boolean
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
          done
            ? 'bg-primary text-primary-foreground'
            : active
              ? 'bg-primary/10 text-primary ring-2 ring-primary'
              : 'bg-muted text-muted-foreground',
        )}
      >
        {done ? '✓' : label.charAt(0)}
      </div>
      <span className={cn(active || done ? 'font-medium text-foreground' : 'text-muted-foreground')}>
        {label.replace(/^\d+\.\s*/, '')}
      </span>
    </div>
  )
}
