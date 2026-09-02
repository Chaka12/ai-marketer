'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useBrands, useUpdateBrand } from '@/hooks/use-dashboard'
import { toast } from 'sonner'
import {
  Save,
  Plus,
  X,
  BookOpen,
  Tag,
  AlertTriangle,
} from 'lucide-react'
import type { BrandDTO, ProductDTO } from '@/lib/types'

const RULE_TYPES = ['prohibition', 'guideline', 'preference']

function cloneBrand(brand: BrandDTO): BrandDTO {
  return JSON.parse(JSON.stringify(brand)) as BrandDTO
}

export function BrandSection() {
  const { data: brands, isLoading } = useBrands()
  const updateBrand = useUpdateBrand()
  // Initialise draft lazily once brands load. We use a controlled key so the
  // editor resets when the user picks a different brand.
  const [draft, setDraft] = useState<BrandDTO | null>(null)
  const [loadedBrandId, setLoadedBrandId] = useState<string | null>(null)

  // Sync from query result. This is the canonical "store the prop into state"
  // pattern — safe because we only run it when brand identity changes.
  if (brands && brands.length > 0) {
    const first = brands[0]
    if (loadedBrandId !== first.id) {
      setLoadedBrandId(first.id)
      setDraft(cloneBrand(first))
    }
  }

  if (isLoading || !draft) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    )
  }

  const set = <K extends keyof BrandDTO>(key: K, value: BrandDTO[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleSave = async () => {
    try {
      await updateBrand.mutateAsync({ id: draft.id, patch: draft })
      toast.success('Brand profile saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">{draft.name}</h2>
          <p className="text-sm text-muted-foreground">
            The Brand Brain — defines the AI&apos;s voice, rules, and product context.
          </p>
        </div>
        <Button onClick={handleSave} disabled={updateBrand.isPending}>
          <Save className="size-4" />
          {updateBrand.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Profile</CardTitle>
          <CardDescription>The core identity the AI uses for every post.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input value={draft.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Location">
            <Input value={draft.location ?? ''} onChange={(e) => set('location', e.target.value)} />
          </Field>
          <Field label="Description" full>
            <Textarea
              rows={3}
              value={draft.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>
          <Field label="Audience">
            <Input value={draft.audience ?? ''} onChange={(e) => set('audience', e.target.value)} />
          </Field>
          <Field label="Personality">
            <Input value={draft.personality ?? ''} onChange={(e) => set('personality', e.target.value)} />
          </Field>
          <Field label="Writing style" full>
            <Textarea
              rows={2}
              value={draft.writingStyle ?? ''}
              onChange={(e) => set('writingStyle', e.target.value)}
            />
          </Field>
          <Field label="Default CTA" full>
            <Input value={draft.cta ?? ''} onChange={(e) => set('cta', e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {/* Vocabulary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <VocabularyCard
          title="Words to use"
          description="Preferred phrasing."
          icon={Tag}
          items={draft.vocabularyUse}
          onChange={(v) => set('vocabularyUse', v)}
          color="emerald"
        />
        <VocabularyCard
          title="Words to avoid"
          description="Banned vocabulary."
          icon={AlertTriangle}
          items={draft.vocabularyAvoid}
          onChange={(v) => set('vocabularyAvoid', v)}
          color="rose"
        />
      </div>

      {/* Brand rules */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display">Brand rules</CardTitle>
              <CardDescription>
                Prohibitions, guidelines, and preferences enforced by the evaluator.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                set('brandRules', [
                  ...draft.brandRules,
                  { type: 'guideline', rule: '' },
                ])
              }
            >
              <Plus className="size-4" /> Add rule
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {draft.brandRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rules yet.</p>
          ) : (
            draft.brandRules.map((rule, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={rule.type}
                  onChange={(e) => {
                    const next = [...draft.brandRules]
                    next[idx] = { ...next[idx], type: e.target.value }
                    set('brandRules', next)
                  }}
                >
                  {RULE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <Input
                  className="flex-1"
                  value={rule.rule}
                  onChange={(e) => {
                    const next = [...draft.brandRules]
                    next[idx] = { ...next[idx], rule: e.target.value }
                    set('brandRules', next)
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    set('brandRules', draft.brandRules.filter((_, i) => i !== idx))
                  }
                  aria-label="Remove rule"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Products */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display">Products</CardTitle>
              <CardDescription>
                Products the AI can reference in posts.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                set('products', [
                  ...draft.products,
                  {
                    id: `tmp-${Date.now()}`,
                    name: '',
                    price: '',
                    description: '',
                    features: [],
                    url: '',
                    promotion: '',
                    promotionExpiry: null,
                    availability: 'In stock',
                  } as ProductDTO,
                ])
              }
            >
              <Plus className="size-4" /> Add product
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {draft.products.length === 0 ? (
            <p className="text-sm text-muted-foreground">No products yet.</p>
          ) : (
            draft.products.map((product, idx) => (
              <div key={product.id} className="rounded-md border border-border bg-card p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Field label="Name">
                    <Input
                      value={product.name}
                      onChange={(e) => {
                        const next = [...draft.products]
                        next[idx] = { ...next[idx], name: e.target.value }
                        set('products', next)
                      }}
                    />
                  </Field>
                  <Field label="Price">
                    <Input
                      value={product.price ?? ''}
                      onChange={(e) => {
                        const next = [...draft.products]
                        next[idx] = { ...next[idx], price: e.target.value }
                        set('products', next)
                      }}
                    />
                  </Field>
                  <Field label="Availability">
                    <Input
                      value={product.availability ?? ''}
                      onChange={(e) => {
                        const next = [...draft.products]
                        next[idx] = { ...next[idx], availability: e.target.value }
                        set('products', next)
                      }}
                    />
                  </Field>
                  <Field label="Description" full>
                    <Textarea
                      rows={2}
                      value={product.description ?? ''}
                      onChange={(e) => {
                        const next = [...draft.products]
                        next[idx] = { ...next[idx], description: e.target.value }
                        set('products', next)
                      }}
                    />
                  </Field>
                  <Field label="URL" full>
                    <Input
                      value={product.url ?? ''}
                      onChange={(e) => {
                        const next = [...draft.products]
                        next[idx] = { ...next[idx], url: e.target.value }
                        set('products', next)
                      }}
                    />
                  </Field>
                  <Field label="Promotion">
                    <Input
                      value={product.promotion ?? ''}
                      onChange={(e) => {
                        const next = [...draft.products]
                        next[idx] = { ...next[idx], promotion: e.target.value }
                        set('products', next)
                      }}
                    />
                  </Field>
                  <Field label="Features (comma-separated)" full>
                    <Input
                      value={product.features.join(', ')}
                      onChange={(e) => {
                        const next = [...draft.products]
                        next[idx] = {
                          ...next[idx],
                          features: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        }
                        set('products', next)
                      }}
                    />
                  </Field>
                </div>
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      set('products', draft.products.filter((_, i) => i !== idx))
                    }
                  >
                    <X className="size-3.5" /> Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="size-3.5" />
        <span>Changes affect all future content generation.</span>
        <Badge variant="outline">{draft.brandRules.length} rules</Badge>
        <Badge variant="outline">{draft.products.length} products</Badge>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  full,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? 'sm:col-span-full' : ''}`}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function VocabularyCard({
  title,
  description,
  icon: Icon,
  items,
  onChange,
  color,
}: {
  title: string
  description: string
  icon: React.ElementType
  items: string[]
  onChange: (v: string[]) => void
  color: 'emerald' | 'rose'
}) {
  const [input, setInput] = useState('')
  const chipColor =
    color === 'emerald'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : 'bg-rose-100 text-rose-800 border-rose-200'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <div>
            <CardTitle className="font-display text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {items.length === 0 && (
            <span className="text-xs text-muted-foreground">No words yet.</span>
          )}
          {items.map((word, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${chipColor}`}
            >
              {word}
              <button
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                aria-label="Remove"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const w = input.trim()
            if (w && !items.includes(w)) onChange([...items, w])
            setInput('')
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add a word…"
          />
          <Button type="submit" variant="outline" size="icon">
            <Plus className="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
