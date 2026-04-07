'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutGrid, Table2, Upload, X, Download, Copy, Check, Trash2, Eye,
  ImageOff, FileImage,
} from 'lucide-react'
import { db, type AssetRecord } from '@/lib/db'
import { useToastStore } from '@/lib/store'
import { PageHeader } from '@/components/shared/page-header'
import { ViewSwitcher } from '@/components/shared/view-switcher'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'

type ViewMode = 'grid' | 'table'

function formatBytes(bytes?: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isImage(fileType?: string) {
  return fileType?.startsWith('image/') ?? false
}

// ── Preview Modal ─────────────────────────────────────────────────────────────

function PreviewModal({ asset, onClose, onDelete }: {
  asset: AssetRecord
  onClose: () => void
  onDelete: (id: string, path: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(asset.fileUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = async () => {
    setDeleting(true)
    onDelete(asset.id, asset.filePath)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-[12px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xl"
      >
        {/* Image */}
        <div className="relative flex items-center justify-center bg-[var(--surface-2)] min-h-[200px] max-h-[60vh] overflow-hidden">
          {isImage(asset.fileType) ? (
            <img src={asset.fileUrl} alt={asset.name} className="max-h-[60vh] w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2 py-16 text-[var(--text-tertiary)]">
              <FileImage className="h-12 w-12" />
              <span className="text-[13px]">{asset.fileType ?? 'Unknown type'}</span>
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-[var(--text-primary)]">{asset.name}</p>
            <p className="text-[12px] text-[var(--text-tertiary)]">
              {asset.fileType ?? 'Unknown'} · {formatBytes(asset.fileSize)} · {formatDate(asset.createdAt)}
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy URL'}
            </button>
            <a
              href={asset.fileUrl}
              download={asset.name}
              className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 rounded-[6px] border border-red-500/30 px-3 py-1.5 text-[12px] text-red-400 hover:border-red-500/60 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Upload Zone ───────────────────────────────────────────────────────────────

function DropZone({ onUpload, uploading }: { onUpload: (files: File[]) => void; uploading: boolean }) {
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    if (files.length) onUpload(files)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && fileRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[10px] border-2 border-dashed p-8 text-center transition-all mb-6',
        dragOver ? 'border-[var(--accent)] bg-[var(--accent-muted)]'
          : uploading ? 'border-[var(--border)] bg-[var(--surface-2)] cursor-not-allowed opacity-60'
          : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)]'
      )}
    >
      <Upload className={cn('h-8 w-8', dragOver ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]')} />
      <div>
        <p className="text-[14px] font-medium text-[var(--text-primary)]">
          {uploading ? 'Uploading…' : 'Drop images here'}
        </p>
        <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">PNG, JPG, GIF, WebP, SVG · or click to browse</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onUpload(files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [view, setView] = useState<ViewMode>('grid')
  const [preview, setPreview] = useState<AssetRecord | null>(null)
  const { addToast } = useToastStore()

  const load = useCallback(async () => {
    try {
      const data = await db.assets.list()
      setAssets(data)
    } catch {
      addToast({ type: 'error', message: 'Failed to load assets' })
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { load() }, [load])

  const handleUpload = async (files: File[]) => {
    setUploading(true)
    let successCount = 0
    for (const file of files) {
      try {
        const asset = await db.assets.upload(file)
        setAssets((prev) => [asset, ...prev])
        successCount++
      } catch {
        addToast({ type: 'error', message: `Failed to upload ${file.name}` })
      }
    }
    if (successCount > 0) addToast({ type: 'success', message: `${successCount} file${successCount > 1 ? 's' : ''} uploaded` })
    setUploading(false)
  }

  const handleDelete = async (id: string, filePath: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id))
    try {
      await db.assets.delete(id, filePath)
      addToast({ type: 'success', message: 'Asset deleted' })
    } catch {
      addToast({ type: 'error', message: 'Failed to delete asset' })
      load()
    }
  }

  const viewOptions = [
    { value: 'grid' as const, label: 'Grid', icon: LayoutGrid },
    { value: 'table' as const, label: 'Table', icon: Table2 },
  ]

  return (
    <div className="min-h-full p-6">
      <PageHeader
        title="Assets"
        description={`${assets.length} file${assets.length !== 1 ? 's' : ''}`}
        actions={<ViewSwitcher options={viewOptions} value={view} onChange={setView} />}
      />

      <DropZone onUpload={handleUpload} uploading={uploading} />

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-[8px] bg-[var(--surface-2)]" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={ImageOff}
          heading="No assets yet"
          subtext="Drop images above to upload them to your asset library."
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence>
            {assets.map((asset) => (
              <motion.div
                key={asset.id}
                layout
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                onClick={() => setPreview(asset)}
                className="group cursor-pointer rounded-[8px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--border-strong)] transition-all"
              >
                <div className="relative flex h-36 items-center justify-center bg-[var(--surface-2)] overflow-hidden">
                  {isImage(asset.fileType) ? (
                    <img src={asset.fileUrl} alt={asset.name} className="h-full w-full object-cover" />
                  ) : (
                    <FileImage className="h-10 w-10 text-[var(--text-tertiary)]" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                    <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="p-3">
                  <p className="truncate text-[12px] font-medium text-[var(--text-primary)]">{asset.name}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                    {formatBytes(asset.fileSize)} · {formatDate(asset.createdAt)}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['Preview', 'Name', 'Type', 'Size', 'Uploaded', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr
                  key={asset.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                  onClick={() => setPreview(asset)}
                >
                  <td className="px-4 py-3 w-12">
                    {isImage(asset.fileType) ? (
                      <img src={asset.fileUrl} alt="" className="h-9 w-9 rounded object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded bg-[var(--surface-2)]">
                        <FileImage className="h-4 w-4 text-[var(--text-tertiary)]" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-medium text-[var(--text-primary)] max-w-[200px]">
                    <span className="block truncate">{asset.name}</span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[var(--text-secondary)]">
                    {asset.fileType?.split('/')[1]?.toUpperCase() ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[var(--text-secondary)]">{formatBytes(asset.fileSize)}</td>
                  <td className="px-4 py-3 text-[12px] text-[var(--text-tertiary)] whitespace-nowrap">{formatDate(asset.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(asset.id, asset.filePath) }}
                      className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview modal */}
      <AnimatePresence>
        {preview && (
          <PreviewModal
            asset={preview}
            onClose={() => setPreview(null)}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
