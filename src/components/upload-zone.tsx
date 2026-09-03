'use client'

import { useCallback, useRef, useState } from 'react'
import { UploadCloud, X, ImageIcon } from 'lucide-react'
import { useUploadAssets } from '@/hooks/use-dashboard'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
  onUploaded?: (paths: { id: string; publicPath: string; filename: string }[]) => void
  selectedIds?: string[]
  onSelectToggle?: (id: string) => void
}

export function UploadZone({ onUploaded, selectedIds = [], onSelectToggle }: Props) {
  const [dragActive, setDragActive] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadAssets()

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/'),
      )
      if (files.length === 0) {
        toast.error('Please drop image files only')
        return
      }
      setPendingFiles((prev) => [...prev, ...files])
    },
    [],
  )

  const onPick = useCallback((files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'))
    setPendingFiles((prev) => [...prev, ...arr])
  }, [])

  const uploadNow = useCallback(async () => {
    if (pendingFiles.length === 0) return
    try {
      const created = await upload.mutateAsync(pendingFiles)
      toast.success(`${created.length} file${created.length === 1 ? '' : 's'} uploaded`)
      onUploaded?.(
        created.map((c: any) => ({
          id: c.id,
          publicPath: c.publicPath,
          filename: c.filename,
        })),
      )
      setPendingFiles([])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    }
  }, [pendingFiles, upload, onUploaded])

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-border bg-muted/30 hover:bg-muted/60',
        )}
      >
        <UploadCloud className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">
          Drag &amp; drop images here, or click to browse
        </p>
        <p className="text-xs text-muted-foreground">PNG, JPG, WEBP, GIF · up to 10 files</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onPick(e.target.files)}
        />
      </div>

      {pendingFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {pendingFiles.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-xs"
              >
                <ImageIcon className="size-3.5 text-muted-foreground" />
                <span className="max-w-32 truncate">{f.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Remove"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={uploadNow}
            disabled={upload.isPending}
            className="self-start rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {upload.isPending ? 'Uploading…' : `Upload ${pendingFiles.length} file${pendingFiles.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}

      {onSelectToggle && (
        <p className="text-xs text-muted-foreground">
          Tap an uploaded thumbnail to select it for this week.
        </p>
      )}
    </div>
  )
}
