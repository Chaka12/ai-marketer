'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  useWorkspaces,
  useUpdateWorkspace,
  useUploadWorkspaceLogo,
  useAudit,
  usePosts,
  useRecyclePost,
} from '@/hooks'
import { useApp } from '@/components/providers/app-provider'
import { PostCard } from '@/components/post-card'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useRef, useState } from 'react'
import { History, Recycle, ShieldCheck, Upload, Building2, Trash2 } from 'lucide-react'

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
  const uploadLogo = useUploadWorkspaceLogo()
  const recycle = useRecyclePost()
  const { setWorkspace, workspaceId } = useApp()

  const workspace = workspaces?.find((w) => w.id === workspaceId) ?? workspaces?.[0]
  const recyclable = (posts ?? [])
    .filter((p) => p.status === 'published' && (p.analytics?.engagementRate ?? 0) > 0.04)
    .slice(0, 5)

  // Local state for the name input so typing feels instant. We track the
  // "source" name so we can resync when the workspace changes (e.g. after
  // switching workspaces in the topbar).
  const [nameDraft, setNameDraft] = useState(workspace?.name ?? '')
  const [lastSyncedName, setLastSyncedName] = useState<string | undefined>(workspace?.name)
  if (workspace?.name !== lastSyncedName) {
    setLastSyncedName(workspace?.name)
    setNameDraft(workspace?.name ?? '')
  }

  const fileRef = useRef<HTMLInputElement>(null)

  async function handleLogoChange(file: File) {
    if (!workspace) return
    try {
      const result = await uploadLogo.mutateAsync({ id: workspace.id, file })
      // Update the app context so the sidebar/topbar reflect the new logo
      // immediately without a full reload.
      setWorkspace(workspace.id, workspace.name, workspace.slug, result.logoUrl)
      toast.success('Logo uploaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Logo upload failed')
    }
  }

  async function handleSaveName() {
    if (!workspace) return
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === workspace.name) return
    try {
      const result = await updateWorkspace.mutateAsync({ id: workspace.id, patch: { name: trimmed } })
      setWorkspace(workspace.id, result.name, workspace.slug, workspace.logoUrl ?? null)
      toast.success('Workspace name updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  async function handleClearLogo() {
    if (!workspace) return
    try {
      const result = await updateWorkspace.mutateAsync({
        id: workspace.id,
        patch: { logoUrl: '' },
      })
      setWorkspace(workspace.id, workspace.name, workspace.slug, null)
      toast.success('Logo cleared')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Clear failed')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Workspace profile (name + logo) */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              <div>
                <CardTitle className="font-display">Workspace profile</CardTitle>
                <CardDescription>
                  Change the workspace name and upload a custom logo (PNG, JPEG, WebP or SVG, up to 2 MB).
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {wsLoading || !workspace ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                {/* Logo */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                    {workspace.logoUrl ? (
                      <img
                        src={workspace.logoUrl}
                        alt={workspace.name}
                        className="size-full object-contain"
                      />
                    ) : (
                      <span className="font-display text-2xl font-semibold text-muted-foreground">
                        {workspace.name?.charAt(0)?.toUpperCase() ?? '?'}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploadLogo.isPending}
                      >
                        <Upload className="size-4" />
                        {uploadLogo.isPending ? 'Uploading…' : 'Upload logo'}
                      </Button>
                      {workspace.logoUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearLogo}
                          disabled={uploadLogo.isPending}
                        >
                          <Trash2 className="size-4" />
                          Clear
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Recommended: square image, at least 256×256px. Larger images are resized
                      automatically.
                    </p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleLogoChange(f)
                        e.target.value = ''
                      }}
                    />
                  </div>
                </div>

                {/* Name */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="workspace-name">Workspace name</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="workspace-name"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      placeholder="e.g. Maison Été"
                      className="sm:max-w-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName()
                      }}
                    />
                    <Button
                      onClick={handleSaveName}
                      disabled={updateWorkspace.isPending || !nameDraft.trim() || nameDraft.trim() === workspace.name}
                      size="sm"
                    >
                      Save name
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Slug: <code className="font-mono">{workspace.slug}</code> ·{' '}
                    {workspace.brandCount} brand(s) · {workspace.postCount} post(s)
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

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
