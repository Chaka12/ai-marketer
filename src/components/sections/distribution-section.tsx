'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useDistributionAccounts,
  useConnectAccount,
  useDisconnectAccount,
  useAddDestination,
  useRemoveDestination,
  useUpdateDestination,
} from '@/hooks'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useState } from 'react'
import {
  Facebook,
  Send,
  Users,
  Globe,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Pencil,
  MoreVertical,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Destination {
  id: string
  type: string
  name: string
  externalId: string | null
  platform?: string
  automationStatus: string
  contentStyleHint: string | null
  allowedFrequency: string | null
  lastPostAt: string | null
}

interface SocialAccount {
  id: string
  platform: string
  name: string
  accountId: string | null
  status: string
  destinations: Destination[]
}

export function DistributionSection() {
  const qc = useQueryClient()
  const { data: accounts, isLoading } = useDistributionAccounts()
  const connectAccount = useConnectAccount()
  const disconnectAccount = useDisconnectAccount()
  const addDestination = useAddDestination()
  const removeDestination = useRemoveDestination()
  const updateDestination = useUpdateDestination()

  // Connect-account dialog state
  const [connectOpen, setConnectOpen] = useState(false)
  const [connectForm, setConnectForm] = useState({
    accountName: '',
    accountId: '',
    accessToken: '',
    destType: 'page' as 'page' | 'group',
    destName: '',
    destExternalId: '',
    automationStatus: 'automated' as 'automated' | 'manual',
    contentStyleHint: '',
  })

  // Add-destination dialog state (per account)
  const [addDestFor, setAddDestFor] = useState<SocialAccount | null>(null)
  const [destForm, setDestForm] = useState({
    type: 'page' as 'page' | 'group',
    name: '',
    externalId: '',
    automationStatus: 'automated' as 'automated' | 'manual',
    contentStyleHint: '',
    allowedFrequency: '',
  })

  // Edit destination dialog state
  const [editDest, setEditDest] = useState<Destination | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    automationStatus: 'automated' as 'automated' | 'manual',
    contentStyleHint: '',
    allowedFrequency: '',
  })

  async function handleConnect() {
    if (!connectForm.accountName.trim()) {
      toast.error('Account name is required')
      return
    }
    try {
      await connectAccount.mutateAsync({
        platform: 'facebook',
        accountName: connectForm.accountName.trim(),
        accountId: connectForm.accountId || undefined,
        accessToken: connectForm.accessToken || undefined,
        destination:
          connectForm.destName.trim() || connectForm.accountName.trim()
            ? {
                type: connectForm.destType,
                name: (connectForm.destName || connectForm.accountName).trim(),
                externalId: connectForm.destExternalId || undefined,
                automationStatus: connectForm.automationStatus,
                contentStyleHint: connectForm.contentStyleHint || undefined,
              }
            : undefined,
      })
      toast.success('Facebook account connected')
      setConnectOpen(false)
      setConnectForm({
        accountName: '',
        accountId: '',
        accessToken: '',
        destType: 'page',
        destName: '',
        destExternalId: '',
        automationStatus: 'automated',
        contentStyleHint: '',
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Connect failed')
    }
  }

  async function handleAddDestination() {
    if (!addDestFor) return
    if (!destForm.name.trim()) {
      toast.error('Destination name is required')
      return
    }
    try {
      await addDestination.mutateAsync({
        socialAccountId: addDestFor.id,
        type: destForm.type,
        name: destForm.name.trim(),
        externalId: destForm.externalId || undefined,
        automationStatus: destForm.automationStatus,
        contentStyleHint: destForm.contentStyleHint || undefined,
        allowedFrequency: destForm.allowedFrequency || undefined,
      })
      toast.success(`${destForm.type === 'page' ? 'Page' : 'Group'} added`)
      setAddDestFor(null)
      setDestForm({
        type: 'page',
        name: '',
        externalId: '',
        automationStatus: 'automated',
        contentStyleHint: '',
        allowedFrequency: '',
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Add failed')
    }
  }

  async function handleDisconnect(account: SocialAccount) {
    if (
      !window.confirm(
        `Disconnect "${account.name}"? This removes the account and all its destinations. ` +
          `Existing posts are kept but their destination is cleared.`,
      )
    )
      return
    try {
      await disconnectAccount.mutateAsync(account.id)
      toast.success('Account disconnected')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Disconnect failed')
    }
  }

  async function handleRemoveDestination(dest: Destination) {
    if (!window.confirm(`Remove "${dest.name}"? Existing posts are kept.`)) return
    try {
      await removeDestination.mutateAsync(dest.id)
      toast.success('Destination removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed')
    }
  }

  function openEdit(dest: Destination) {
    setEditDest(dest)
    setEditForm({
      name: dest.name,
      automationStatus: dest.automationStatus as 'automated' | 'manual',
      contentStyleHint: dest.contentStyleHint ?? '',
      allowedFrequency: dest.allowedFrequency ?? '',
    })
  }

  async function handleSaveEdit() {
    if (!editDest) return
    try {
      await updateDestination.mutateAsync({
        id: editDest.id,
        patch: {
          name: editForm.name,
          automationStatus: editForm.automationStatus,
          contentStyleHint: editForm.contentStyleHint,
          allowedFrequency: editForm.allowedFrequency,
        },
      })
      toast.success('Destination updated')
      setEditDest(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    )
  }

  const platforms = accounts ?? []

  return (
    <div className="flex flex-col gap-6">
      {/* Header card with connect button */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="font-display">Connected accounts</CardTitle>
              <CardDescription>
                Connect Facebook Pages and Groups. Each account can manage multiple destinations.
              </CardDescription>
            </div>
            <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" />
                  Connect Facebook Page
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Connect a Facebook account</DialogTitle>
                  <DialogDescription>
                    In production this would launch the Facebook OAuth flow. In the sandbox, fill
                    in the details below to simulate connecting a Page.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="accountName">Account name *</Label>
                    <Input
                      id="accountName"
                      placeholder="e.g. ABC Restaurant — Facebook Page"
                      value={connectForm.accountName}
                      onChange={(e) => setConnectForm({ ...connectForm, accountName: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="accountId">Facebook Page ID</Label>
                      <Input
                        id="accountId"
                        placeholder="1234567890"
                        value={connectForm.accountId}
                        onChange={(e) => setConnectForm({ ...connectForm, accountId: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="accessToken">Access token</Label>
                      <Input
                        id="accessToken"
                        placeholder="auto-generated in production"
                        value={connectForm.accessToken}
                        onChange={(e) => setConnectForm({ ...connectForm, accessToken: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <p className="mb-3 text-xs font-medium text-muted-foreground">
                      First destination (optional — you can add more later)
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="destType">Type</Label>
                        <Select
                          value={connectForm.destType}
                          onValueChange={(v) => setConnectForm({ ...connectForm, destType: v as 'page' | 'group' })}
                        >
                          <SelectTrigger id="destType">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="page">Page</SelectItem>
                            <SelectItem value="group">Group</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="destName">Destination name</Label>
                        <Input
                          id="destName"
                          placeholder="e.g. ABC Restaurant Page"
                          value={connectForm.destName}
                          onChange={(e) => setConnectForm({ ...connectForm, destName: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="destExternalId">External ID</Label>
                        <Input
                          id="destExternalId"
                          placeholder="1234567890"
                          value={connectForm.destExternalId}
                          onChange={(e) => setConnectForm({ ...connectForm, destExternalId: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="destAutomation">Automation</Label>
                        <Select
                          value={connectForm.automationStatus}
                          onValueChange={(v) =>
                            setConnectForm({
                              ...connectForm,
                              automationStatus: v as 'automated' | 'manual',
                            })
                          }
                        >
                          <SelectTrigger id="destAutomation">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="automated">Automated (API)</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      <Label htmlFor="destStyle">Content style hint</Label>
                      <Textarea
                        id="destStyle"
                        rows={2}
                        placeholder="e.g. Polished, brand-led tone."
                        value={connectForm.contentStyleHint}
                        onChange={(e) => setConnectForm({ ...connectForm, contentStyleHint: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleConnect} disabled={connectAccount.isPending}>
                    {connectAccount.isPending ? 'Connecting…' : 'Connect'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {platforms.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center text-sm text-muted-foreground">
            <Send className="size-8" />
            No social accounts connected yet. Click “Connect Facebook Page” above to add one.
          </CardContent>
        </Card>
      ) : (
        platforms.map((account) => {
          const connected = account.status === 'connected'
          return (
            <div key={account.id} className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary">
                        <Facebook className="size-5 text-secondary-foreground" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="font-display text-lg">{account.name}</CardTitle>
                        <CardDescription className="truncate">
                          Account ID: {account.accountId ?? '—'} · Platform: {account.platform} ·{' '}
                          {account.destinations.length} destination(s)
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          connected
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }
                      >
                        {connected ? (
                          <>
                            <CheckCircle2 className="size-3" /> Connected
                          </>
                        ) : (
                          <>
                            <XCircle className="size-3" /> {account.status}
                          </>
                        )}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(account)}
                        disabled={disconnectAccount.isPending}
                      >
                        <Trash2 className="size-3.5" />
                        Disconnect
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Destinations */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {account.destinations.map((d) => (
                  <Card key={d.id} className="card-hover">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                            {d.type === 'page' ? (
                              <Globe className="size-4" />
                            ) : (
                              <Users className="size-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="truncate font-display text-base">{d.name}</CardTitle>
                            <CardDescription className="capitalize">
                              {d.type} · {d.platform ?? account.platform}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Badge
                            variant="outline"
                            className={
                              d.automationStatus === 'automated'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-amber-200 bg-amber-50 text-amber-700'
                            }
                          >
                            {d.automationStatus}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7" aria-label="Destination actions">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(d)}>
                                <Pencil className="size-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleRemoveDestination(d)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="size-4" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 text-sm">
                      {d.contentStyleHint && (
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Style:</span>{' '}
                          {d.contentStyleHint}
                        </p>
                      )}
                      {d.allowedFrequency && (
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Frequency:</span>{' '}
                          {d.allowedFrequency}
                        </p>
                      )}
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Last post:</span>{' '}
                        {d.lastPostAt ? format(new Date(d.lastPostAt), 'MMM d, yyyy HH:mm') : 'never'}
                      </p>
                    </CardContent>
                  </Card>
                ))}

                {/* Add destination card */}
                <Card className="border-dashed">
                  <CardContent className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                    <Plus className="size-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Add another page or group</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAddDestFor(account)
                        setDestForm({
                          type: 'page',
                          name: '',
                          externalId: '',
                          automationStatus: 'automated',
                          contentStyleHint: '',
                          allowedFrequency: '',
                        })
                      }}
                    >
                      Add destination
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Add destination dialog */}
              <Dialog
                open={!!addDestFor}
                onOpenChange={(o) => !o && setAddDestFor(null)}
              >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add a destination to {addDestFor?.name}</DialogTitle>
                    <DialogDescription>
                      Add another Page or Group managed by this account.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 py-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="d-type">Type</Label>
                        <Select
                          value={destForm.type}
                          onValueChange={(v) => setDestForm({ ...destForm, type: v as 'page' | 'group' })}
                        >
                          <SelectTrigger id="d-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="page">Page</SelectItem>
                            <SelectItem value="group">Group</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="d-name">Name *</Label>
                        <Input
                          id="d-name"
                          value={destForm.name}
                          onChange={(e) => setDestForm({ ...destForm, name: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="d-ext">External ID</Label>
                        <Input
                          id="d-ext"
                          value={destForm.externalId}
                          onChange={(e) => setDestForm({ ...destForm, externalId: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="d-auto">Automation</Label>
                        <Select
                          value={destForm.automationStatus}
                          onValueChange={(v) =>
                            setDestForm({ ...destForm, automationStatus: v as 'automated' | 'manual' })
                          }
                        >
                          <SelectTrigger id="d-auto">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="automated">Automated (API)</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="d-style">Content style hint</Label>
                      <Textarea
                        id="d-style"
                        rows={2}
                        value={destForm.contentStyleHint}
                        onChange={(e) => setDestForm({ ...destForm, contentStyleHint: e.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="d-freq">Allowed frequency</Label>
                      <Input
                        id="d-freq"
                        placeholder="e.g. 1x per week"
                        value={destForm.allowedFrequency}
                        onChange={(e) => setDestForm({ ...destForm, allowedFrequency: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleAddDestination} disabled={addDestination.isPending}>
                      {addDestination.isPending ? 'Adding…' : 'Add destination'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )
        })
      )}

      {/* Edit destination dialog */}
      <Dialog open={!!editDest} onOpenChange={(o) => !o && setEditDest(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit destination</DialogTitle>
            <DialogDescription>
              Update the name, automation status, or content style hint.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="e-name">Name</Label>
              <Input
                id="e-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="e-auto">Automation</Label>
              <Select
                value={editForm.automationStatus}
                onValueChange={(v) =>
                  setEditForm({ ...editForm, automationStatus: v as 'automated' | 'manual' })
                }
              >
                <SelectTrigger id="e-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="automated">Automated (API)</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="e-style">Content style hint</Label>
              <Textarea
                id="e-style"
                rows={2}
                value={editForm.contentStyleHint}
                onChange={(e) => setEditForm({ ...editForm, contentStyleHint: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="e-freq">Allowed frequency</Label>
              <Input
                id="e-freq"
                value={editForm.allowedFrequency}
                onChange={(e) => setEditForm({ ...editForm, allowedFrequency: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveEdit} disabled={updateDestination.isPending}>
              {updateDestination.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
