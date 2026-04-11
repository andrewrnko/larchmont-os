'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, ExternalLink, BookOpen, Trash2, Pencil, X, Check } from 'lucide-react'
import { db, type Resource } from '@/lib/db'
import { useToastStore } from '@/lib/store'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'

const CATEGORIES = ['All', 'Psychology', 'Brand Strategy', 'Cinematography', 'Color', 'Copy', 'Design', 'Business', 'Legal', 'Ops', 'Other']

const CATEGORY_COLORS: Record<string, string> = {
  Psychology:       'bg-violet-500/10 text-violet-500 border border-violet-500/20',
  'Brand Strategy': 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
  Cinematography:   'bg-blue-500/10 text-blue-500 border border-blue-500/20',
  Color:            'bg-pink-500/10 text-pink-500 border border-pink-500/20',
  Copy:             'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
  Design:           'bg-cyan-500/10 text-cyan-500 border border-cyan-500/20',
  Business:         'bg-orange-500/10 text-orange-500 border border-orange-500/20',
  Legal:            'bg-red-500/10 text-red-500 border border-red-500/20',
  Ops:              'bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]',
  Other:            'bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Resource Modal ────────────────────────────────────────────────────────────

interface ResourceFormFields {
  title: string
  category: string
  content: string
  url: string
}

const EMPTY_FIELDS: ResourceFormFields = { title: '', category: 'Other', content: '', url: '' }

function ResourceModal({ initial, onClose, onSave }: {
  initial?: Partial<ResourceFormFields>
  onClose: () => void
  onSave: (fields: ResourceFormFields) => void
}) {
  const [fields, setFields] = useState<ResourceFormFields>({ ...EMPTY_FIELDS, ...initial })
  const set = (k: keyof ResourceFormFields, v: string) => setFields((p) => ({ ...p, [k]: v }))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
            {initial?.title ? 'Edit Resource' : 'Add Resource'}
          </h2>
          <button onClick={onClose} className="rounded-[6px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); if (fields.title.trim()) onSave(fields) }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">Title <span className="text-red-400">*</span></label>
            <input
              required autoFocus value={fields.title} onChange={(e) => set('title', e.target.value)}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none"
              placeholder="Resource title"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">Category</label>
            <select
              value={fields.category} onChange={(e) => set('category', e.target.value)}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            >
              {CATEGORIES.filter((c) => c !== 'All').map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">URL / Link</label>
            <input
              type="url" value={fields.url} onChange={(e) => set('url', e.target.value)}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">Notes / Content</label>
            <textarea
              value={fields.content} onChange={(e) => set('content', e.target.value)}
              rows={3}
              className="w-full resize-none rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none"
              placeholder="Key takeaways, notes, context…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-[6px] border border-[var(--border)] px-4 py-1.5 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors">Cancel</button>
            <button type="submit" className="rounded-[6px] bg-[var(--accent)] px-4 py-1.5 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-90 transition-opacity">
              {initial?.title ? 'Save Changes' : 'Add Resource'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Resource | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { addToast } = useToastStore()

  const load = useCallback(async () => {
    try {
      const data = await db.resources.list()
      setResources(data)
    } catch {
      addToast({ type: 'error', message: 'Failed to load resources' })
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      const catOk = activeCategory === 'All' || r.category === activeCategory
      const q = search.toLowerCase().trim()
      const searchOk = !q || r.title.toLowerCase().includes(q) || (r.content ?? '').toLowerCase().includes(q)
      return catOk && searchOk
    })
  }, [resources, activeCategory, search])

  const handleSave = async (fields: ResourceFormFields) => {
    setModalOpen(false)
    if (editTarget) {
      const prev = resources
      setResources((rs) => rs.map((r) => r.id === editTarget.id ? { ...r, title: fields.title, category: fields.category, content: fields.content, url: fields.url } : r))
      try {
        const updated = await db.resources.update(editTarget.id, { title: fields.title, category: fields.category, content: fields.content, url: fields.url })
        setResources((rs) => rs.map((r) => r.id === updated.id ? updated : r))
      } catch {
        setResources(prev)
        addToast({ type: 'error', message: 'Failed to update resource' })
      }
      setEditTarget(null)
    } else {
      const tempId = `temp-${Date.now()}`
      const optimistic: Resource = { id: tempId, title: fields.title, category: fields.category, content: fields.content, url: fields.url, metadata: {}, createdAt: new Date().toISOString() }
      setResources((rs) => [optimistic, ...rs])
      try {
        const created = await db.resources.insert({ title: fields.title, category: fields.category || undefined, content: fields.content || undefined, url: fields.url || undefined })
        setResources((rs) => rs.map((r) => r.id === tempId ? created : r))
        addToast({ type: 'success', message: 'Resource added' })
      } catch {
        setResources((rs) => rs.filter((r) => r.id !== tempId))
        addToast({ type: 'error', message: 'Failed to add resource' })
      }
    }
  }

  const handleDelete = async (id: string) => {
    setDeleteId(null)
    const prev = resources
    setResources((rs) => rs.filter((r) => r.id !== id))
    try {
      await db.resources.delete(id)
      addToast({ type: 'success', message: 'Resource deleted' })
    } catch {
      setResources(prev)
      addToast({ type: 'error', message: 'Failed to delete' })
    }
  }

  return (
    <div className="min-h-full p-6">
      <PageHeader
        title="Resource Library"
        description={`${filtered.length} of ${resources.length} resource${resources.length !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="h-8 w-44 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] pl-8 pr-3 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
            <button
              onClick={() => { setEditTarget(null); setModalOpen(true) }}
              className="flex items-center gap-1.5 rounded-[6px] bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Add Resource
            </button>
          </div>
        }
      />

      {/* Category pills */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat
          const count = cat === 'All' ? resources.length : resources.filter((r) => r.category === cat).length
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'rounded-[6px] border px-2.5 py-1 text-[12px] font-medium transition-all',
                isActive
                  ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
              )}
            >
              {cat}
              <span className={cn('ml-1.5 rounded-full px-1 text-[11px]', isActive ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-[var(--surface-2)] text-[var(--text-tertiary)]')}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-[8px] bg-[var(--surface-2)]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          heading={search || activeCategory !== 'All' ? 'No matching resources' : 'No resources yet'}
          subtext={search || activeCategory !== 'All' ? 'Try adjusting your search or category.' : 'Add articles, guides, and references to your library.'}
          cta={!search && activeCategory === 'All' ? (
            <button onClick={() => setModalOpen(true)} className="rounded-[6px] bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-90 transition-opacity">
              Add Your First Resource
            </button>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {filtered.map((resource) => (
              <motion.div
                key={resource.id}
                layout
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="group flex flex-col rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--border-strong)] transition-all"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="flex-1 text-[14px] font-semibold leading-snug text-[var(--text-primary)]">{resource.title}</h3>
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditTarget(resource); setModalOpen(true) }}
                      className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {deleteId === resource.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(resource.id)} className="rounded-[4px] p-1 text-red-400 hover:bg-red-500/10 transition-colors"><Check className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setDeleteId(null)} className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] transition-colors"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteId(resource.id)} className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-400 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mb-3 flex items-center gap-2">
                  {resource.category && (
                    <span className={cn('inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium', CATEGORY_COLORS[resource.category] ?? CATEGORY_COLORS.Other)}>
                      {resource.category}
                    </span>
                  )}
                </div>

                {resource.content && (
                  <p className="mb-3 line-clamp-3 flex-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    {resource.content}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] pt-3">
                  <span className="text-[11px] text-[var(--text-tertiary)]">{formatDate(resource.createdAt)}</span>
                  {resource.url && (
                    <a href={resource.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline">
                      <ExternalLink className="h-3 w-3" />
                      Open
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {modalOpen && (
        <ResourceModal
          initial={editTarget ? { title: editTarget.title, category: editTarget.category ?? 'Other', content: editTarget.content ?? '', url: editTarget.url ?? '' } : undefined}
          onClose={() => { setModalOpen(false); setEditTarget(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
