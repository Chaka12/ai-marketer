'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useWorkspaces, useUpdateWorkspace, useAudit, usePosts, useRecyclePost } from '@/hooks'
import { PostCard } from '@/components/post-card'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { History, Recycle, ShieldCheck } from 'lucide-react'

const APPROVAL_MODES = [
  {
    id: 'manual',
    label: 'Manual',
    description:
      'Every post is reviewed and approved by a human before it can be scheduled or published.',
  },
  {
    id: 'assisted',
    label: 'Assisted',
    description:
      'AI generates and evaluates content. Humans approve before publishing — recommended default.',
  },
  {
    id: 'autonomous',
    label: 'Autonomous',
    description:
      'AI generates, evaluates, and schedules posts automatically. Still subject to brand rules.',
  },
]

export function SettingsSection() {
  const { data: workspaces, isLoading: wsLoading } = useWorkspaces()
  const { data: audit, isLoading: auditLoading } = useAudit()
  const { data: posts } = usePosts()
  const updateWorkspace = useUpdateWorkspace()
  const recycle = useRecyclePost()

  const workspace = workspaces?.[0]
  const recyclable = (posts ?? [])
    .filter((p) => p.status === 'published' && (p.analytics?.engagementRate ?? 0) > 0.04)
    .slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      {/* Approval mode */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <div>
                <CardTitle className="font-display">Approval mode</CardTitle>
                <CardDescription>
                  Controls how much autonomy the AI has across the workspace.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {wsLoading || !workspace ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <RadioGroup
                value={workspace.approvalMode}
                onValueChange={async (v) => {
                  try {
                    await updateWorkspace.mutateAsync({
                      id: workspace.id,
                      patch: { approvalMode: v },
                    })
                    toast.success(`Approval mode set to ${v}`)
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Update failed')
                  }
                }}
                className="grid grid-cols-1 gap-3 sm:grid-cols-3"
              >
                {APPROVAL_MODES.map((m) => (
                  <Label
                    key={m.id}
                    htmlFor={`mode-${m.id}`}
                    className={`cursor-pointer rounded-lg border p-4 transition-all hover:bg-accent ${
                      workspace.approvalMode === m.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value={m.id} id={`mode-${m.id}`} className="mt-1" />
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{m.label}</span>
                        <span className="text-xs text-muted-foreground">{m.description}</span>
                      </div>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Recycle bin */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Recycle className="size-5 text-primary" />
            <div>
              <CardTitle className="font-display">Recycle bin</CardTitle>
              <CardDescription>
                Top-performing historical posts. Recycle one to generate 3 fresh variations.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {recyclable.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No high-performing posts available to recycle yet.
            </p>
          ) : (
            recyclable.map((p) => (
              <div key={p.id} className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="flex-1">
                  <PostCard post={p} compact showActions={false} />
                </div>
                <Button
                  variant="outline"
                  className="sm:self-center"
                  disabled={recycle.isPending}
                  onClick={async () => {
                    try {
                      const result = await recycle.mutateAsync(p.id)
                      toast.success(`${result.count} fresh variations created`)
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Recycle failed')
                    }
                  }}
                >
                  <Recycle className="size-4" /> Recycle
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Audit log */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="size-5 text-primary" />
            <div>
              <CardTitle className="font-display">Audit log</CardTitle>
              <CardDescription>Recent workspace activity.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {auditLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !audit || audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto scroll-area-styled rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Time</TableHead>
                    <TableHead className="w-44">Action</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(log.createdAt), 'MMM d, HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.details ? (
                          <pre className="whitespace-pre-wrap break-words font-mono">
                            {JSON.stringify(log.details)}
                          </pre>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
