'use client'

import { useState, useEffect } from 'react'
import { Plus, LayoutGrid, Table2, Film, Pencil, Trash2 } from 'lucide-react'
import { db, ContentItem, Project } from '@/lib/db'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { ViewSwitcher } from '@/components/shared/view-switcher'
import { EmptyState } from '@/components/shared/empty-state'
import { KanbanBoard } from '@/components/shared/kanban-board'
import { cn } from '@/lib/utils'

const PIPELINE_STAGES = [
  'Idea', 'Scripted', 'Shot', 'In Edit', 'Review', 'Scheduled', 'Published',
] as const

type PipelineStage = typeof PIPELINE_STAGES[number]

type ContentFormat = 'Short Form' | 'Long Form' | 'Documentary' | 'Paid Ad' | 'Email' | 'Blog' | 'Podcast'

const CONTENT_FORMATS: Array<ContentFormat | 'All'> = [
  'All', 'Short Form', 'Long Form', 'Documentary', 'Paid Ad', 'Email', 'Blog', 'Podcast',
]

const FORMAT_COLORS: Record<ContentFormat, string> = {
  'Short Form':  'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  'Long Form':   'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  'Documentary': 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  'Paid Ad':     'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  'Email':       'bg-green-500/10 text-green-400 border border-green-500/20',
  'Blog':        'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
  'Podcast':     'bg-pink-500/10 text-pink-400 border border-pink-500/20',
}

type ViewMode = 'kanban' | 'list'

type ModalMode = 'add' | 'edit'

interface ModalState {
  mode: ModalMode
  item?: ContentItem
}

// ── Content Card ─────────────────────────────────────────────────────────────

interface ContentCardProps {
  item: ContentItem
  projectName: string | null
  onEdit: (item: ContentItem) => void
  onDelete: (id: string) => void
}

function ContentCard({ item, projectName, onEdit, onDelete }: ContentCardProps) {
  const formatColor = FORMAT_COLORS[item.format as ContentFormat]
  return (
    <div className={cn(
      'rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3',
      'hover:border-[var(--border-strong)] transition-all duration-150'
    )}>
      <p className="mb-2 truncate text-[13px] font-medium text-[var(--text-primary)]">
        {item.title}
      </p>
      {item.format && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className={cn(
            'inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium',
            formatColor ?? 'bg-[var(--surface-2)] text-[var(--text-tertiary)]'
          )}>
            {item.format}
          </span>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        {projectName && (
          <span className="max-w-[100px] truncate rounded-[4px] bg-[var(--accent-muted)] px-1.5 py-0.5 text-[11px] text-[var(--accent)]">
            {projectName}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onEdit(item) }}
            className="rounded p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Edit"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
            className="rounded p-0.5 text-[var(--text-tertiary)] hover:text-red-400 transition-colors"
            aria-label="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────
function KanbanSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {PIPELINE_STAGES.map((stage) => (
        <div key={stage} className="w-[240px] flex-shrink-0">
          <div className="mb-2.5 flex items-center gap-2">
            <div className="h-4 w-20 animate-pulse rounded bg-[var(--surface-2)]" />
            <div className="h-4 w-5 animate-pulse rounded-full bg-[var(--surface-2)]" />
          </div>
          <div className="space-y-2">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="h-[68px] animate-pulse rounded-[8px] bg-[var(--surface-2)]"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────
interface ContentModalProps {
  mode: ModalMode
  item?: ContentItem
  projects: Project[]
  onClose: () => void
  onSave: (item: ContentItem) => void
}

function ContentModal({ mode, item, projects, onClose, onSave }: ContentModalProps) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [format, setFormat] = useState<ContentFormat>((item?.format as ContentFormat) ?? 'Short Form')
  const [status, setStatus] = useState<PipelineStage>((item?.status as PipelineStage) ?? 'Idea')
  const [projectId, setProjectId] = useState<string>(item?.projectId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (mode === 'add') {
        const created = await db.content.insert({
          title: title.trim(),
          format,
          status,
          project_id: projectId || null,
        })
        onSave(created)
      } else if (item) {
        const updated = await db.content.update(item.id, {
          title: title.trim(),
          format,
          status,
          project_id: projectId || null,
        })
        onSave(updated)
      }
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
        <h2 className="mb-4 text-[16px] font-semibold text-[var(--text-primary)]">
          {mode === 'add' ? 'Add Content' : 'Edit Content'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Title */}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Content title"
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          {/* Format */}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ContentFormat)}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            >
              {CONTENT_FORMATS.filter((f) => f !== 'All').map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PipelineStage)}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Project */}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">Project (optional)</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-[12px] text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-[6px] bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Saving…' : mode === 'add' ? 'Add Content' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────
export default function ContentPage() {
  const [content, setContent] = useState<ContentItem[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('kanban')
  const [formatFilter, setFormatFilter] = useState<ContentFormat | 'All'>('All')
  const [modal, setModal] = useState<ModalState | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([db.content.list(), db.projects.list()])
      .then(([c, p]) => {
        setContent(c)
        setProjects(p)
        setLoading(false)
      })
      .catch(console.error)
  }, [])

  const viewOptions = [
    { value: 'kanban' as const, label: 'Pipeline', icon: LayoutGrid },
    { value: 'list' as const, label: 'List', icon: Table2 },
  ]

  const filtered = content.filter((c) => {
    if (formatFilter !== 'All' && c.format !== formatFilter) return false
    return true
  })

  const getProjectName = (projectId?: string) => {
    if (!projectId) return null
    return projects.find((p) => p.id === projectId)?.name ?? null
  }

  const handleModalSave = (saved: ContentItem) => {
    if (modal?.mode === 'add') {
      setContent((prev) => [saved, ...prev])
    } else {
      setContent((prev) => prev.map((c) => (c.id === saved.id ? saved : c)))
    }
    setModal(null)
  }

  const handleDelete = async (id: string) => {
    const previous = content
    setContent((prev) => prev.filter((c) => c.id !== id))
    setDeleteConfirm(null)
    try {
      await db.content.delete(id)
    } catch {
      setContent(previous)
    }
  }

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    const item = content.find((c) => c.id === itemId)
    if (!item) return
    const oldStatus = item.status
    setContent((prev) => prev.map((c) => c.id === itemId ? { ...c, status: newStatus } : c))
    try {
      await db.content.update(itemId, { status: newStatus })
    } catch {
      setContent((prev) => prev.map((c) => c.id === itemId ? { ...c, status: oldStatus } : c))
    }
  }

  return (
    <div className="min-h-full p-6">
      <PageHeader
        title="Content Pipeline"
        description={`${content.length} item${content.length !== 1 ? 's' : ''} total`}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value as typeof formatFilter)}
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
              aria-label="Filter by format"
            >
              {CONTENT_FORMATS.map((f) => (
                <option key={f} value={f}>{f === 'All' ? 'All Formats' : f}</option>
              ))}
            </select>
            <ViewSwitcher options={viewOptions} value={view} onChange={setView} />
            <button
              onClick={() => setModal({ mode: 'add' })}
              className="flex items-center gap-1.5 rounded-[6px] bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Add Content
            </button>
          </div>
        }
      />

      {/* ── Kanban View ── */}
      {view === 'kanban' && (
        <>
          {loading ? (
            <KanbanSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Film}
              heading="No content found"
              subtext="Try adjusting the format filter, or add your first content item."
            />
          ) : (
            <KanbanBoard
              items={filtered}
              columns={PIPELINE_STAGES}
              onStatusChange={handleStatusChange}
              columnWidth="w-[240px]"
              renderCard={(item) => (
                <ContentCard
                  item={item}
                  projectName={getProjectName(item.projectId)}
                  onEdit={(i) => setModal({ mode: 'edit', item: i })}
                  onDelete={setDeleteConfirm}
                />
              )}
            />
          )}
        </>
      )}

      {/* ── List View ── */}
      {view === 'list' && (
        <>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="h-10 animate-pulse rounded-[6px] bg-[var(--surface-2)]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Film}
              heading="No content found"
              subtext="Try adjusting the format filter, or add your first content item."
            />
          ) : (
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {['Title', 'Format', 'Status', 'Project'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]"
                      >
                        {h}
                      </th>
                    ))}
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const projectName = getProjectName(item.projectId)
                    const formatColor = FORMAT_COLORS[item.format as ContentFormat]
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors"
                      >
                        {/* Title */}
                        <td className="max-w-[200px] px-4 py-3">
                          <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                            {item.title}
                          </p>
                        </td>

                        {/* Format */}
                        <td className="px-4 py-3">
                          {item.format ? (
                            <span
                              className={cn(
                                'inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium',
                                formatColor ?? 'bg-[var(--surface-2)] text-[var(--text-tertiary)]'
                              )}
                            >
                              {item.format}
                            </span>
                          ) : (
                            <span className="text-[12px] text-[var(--text-tertiary)]">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusBadge status={item.status} size="sm" />
                        </td>

                        {/* Project */}
                        <td className="px-4 py-3">
                          {projectName ? (
                            <span className="max-w-[120px] truncate rounded-[4px] bg-[var(--accent-muted)] px-1.5 py-0.5 text-[11px] text-[var(--accent)]">
                              {projectName}
                            </span>
                          ) : (
                            <span className="text-[12px] text-[var(--text-tertiary)]">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setModal({ mode: 'edit', item })}
                              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                              aria-label="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(item.id)}
                              className="text-[var(--text-tertiary)] hover:text-red-400 transition-colors"
                              aria-label="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Add / Edit Modal ── */}
      {modal && (
        <ContentModal
          mode={modal.mode}
          item={modal.item}
          projects={projects}
          onClose={() => setModal(null)}
          onSave={handleModalSave}
        />
      )}

      {/* ── Delete Confirmation ── */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null) }}
        >
          <div className="w-full max-w-sm rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl">
            <h2 className="mb-2 text-[16px] font-semibold text-[var(--text-primary)]">Delete content?</h2>
            <p className="mb-4 text-[13px] text-[var(--text-secondary)]">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="rounded-[6px] bg-red-500 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
