'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Facebook,
  Send,
  Users,
  Globe,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

interface SocialAccount {
  id: string
  platform: string
  name: string
  accountId: string | null
  status: string
  destinations: Destination[]
}

interface Destination {
  id: string
  type: string
  name: string
  externalId: string | null
  automationStatus: string
  contentStyleHint: string | null
  allowedFrequency: string | null
  lastPostAt: string | null
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Request failed')
  return json.data as T
}

export function DistributionSection() {
  const qc = useQueryClient()
  const { data: accounts, isLoading } = useQuery<SocialAccount[]>({
    queryKey: ['distribution-accounts'],
    queryFn: async () => {
      // The system exposes a single demo workspace. We'll fetch all destinations indirectly.
      const ws = await fetchJson<{ id: string }>('/api/workspaces').then((w) => w?.[0] ?? { id: '' })
      return fetchJson<SocialAccount[]>(`/api/distribution/accounts?workspaceId=${ws.id}`)
    },
  })

  const reconnect = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/distribution/accounts/${id}/reconnect`, { method: 'POST' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Reconnect failed')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distribution-accounts'] })
      toast.success('Account reconnected (simulated)')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Reconnect failed'),
  })

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

  if (platforms.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center text-sm text-muted-foreground">
          <Send className="size-8" />
          No social accounts connected yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {platforms.map((account) => {
        const connected = account.status === 'connected'
        return (
          <div key={account.id} className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 items-center justify-center rounded-md bg-secondary">
                      <Facebook className="size-5 text-secondary-foreground" />
                    </div>
                    <div>
                      <CardTitle className="font-display text-lg">{account.name}</CardTitle>
                      <CardDescription>
                        Account ID: {account.accountId ?? '—'} · Platform: {account.platform}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
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
                    {!connected && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reconnect.mutate(account.id)}
                        disabled={reconnect.isPending}
                      >
                        <RefreshCw className="size-3.5" />
                        Reconnect
                      </Button>
                    )}
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
                      <div className="flex items-start gap-2">
                        <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                          {d.type === 'page' ? (
                            <Globe className="size-4" />
                          ) : (
                            <Users className="size-4" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="font-display text-base">{d.name}</CardTitle>
                          <CardDescription className="capitalize">
                            {d.type} · {d.platform ?? account.platform}
                          </CardDescription>
                        </div>
                      </div>
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
            </div>
          </div>
        )
      })}
    </div>
  )
}
