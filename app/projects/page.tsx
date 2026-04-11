'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, LayoutGrid, Table2, List, FolderKanban, Pencil, Trash2, X } from 'lucide-react'
import { db, type Project } from '@/lib/db'
import { useToastStore } from '@/lib/store'
import { PageHeader } from '@/components/shared/page-header'
import { ViewSwitcher } from '@/components/shared/view-switcher'
import { EmptyState } from '@/components/shared/empty-state'
import { KanbanBoard } from '@/components/shared/kanban-board'
import { cn } from '@/lib/utils'

type ViewMode = 'board' | 'table' | 'gallery'

const STATUS_COLUMNS = ['Planning', 'Active', 'In Review', 'Complete', 'Paused']
const CATEGORIES = ['Brand', 'Video', 'Web', 'Events', 'Paid Ads', 'Print', 'Ops', 'Strategy']
const STATUSES = ['Planning', 'Active', 'In Review', 'Complete', 'Paused']

function formatDate(d?: string) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isOverdue(d?: string | null) {
  if (!d) return false
  return new Date(d) < new Date()
}

function isUpcomingSoon(d?: string | null) {
  if (!d) return false
  const deadline = new Date(d)
  const now = new Date()
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return deadline >= now && deadline <= sevenDays
}

function DeadlinePill({ deadline, done }: { deadline?: string | null; done?: boolean }) {
  if (!deadline) return null
  if (done) return <span className="text-[11px] text-[var(--text-tertiary)]">{formatDate(deadline)}</span>
  const overdue = isOverdue(deadline)
  const soon = isUpcomingSoon(deadline)
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium',
      overdue ? 'bg-red-500/10 text-red-400' : soon ? 'bg-amber-500/10 text-amber-400' : 'text-[var(--text-tertiary)]'
    )}>
      {(overdue || soon) && <span className={cn('h-1.5 w-1.5 rounded-full', overdue ? 'bg-red-400' : 'bg-amber-400')} />}
      {formatDate(deadline)}
    </span>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'Active': 'bg-green-400', 'Planning': 'bg-blue-400',
    'In Review': 'bg-yellow-400', 'Complete': 'bg-[var(--text-tertiary)]',
    'Paused': 'bg-orange-400',
  }
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[status] ?? 'bg-gray-400'}`} />
}

// ── Add/Edit Modal ────────────────────────────────────────────────────────────

interface ProjectModalProps {
  project?: Project
  onClose: () => void
  onSave: (data: { name: string; category: string; status: string; deadline?: string; description?: string }) => Promise<void>
}

function ProjectModal({ project, onClose, onSave }: ProjectModalProps) {
  const [name, setName] = useState(project?.name ?? '')
  const [category, setCategory] = useState(project?.category ?? 'Video')
  const [status, setStatus] = useState(project?.status ?? 'Active')
  const [deadline, setDeadline] = useState(project?.deadline ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), category, status, deadline: deadline || undefined, description: description || undefined })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        className="relative w-full max-w-[480px] rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-modal)]"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
            {project ? 'Edit Project' : 'New Project'}
          </h2>
          <button onClick={onClose} className="rounded-[6px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--text-secondary)]">Project Name *</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)} required autoFocus
              className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[14px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
              placeholder="e.g. Brand Refresh 2025"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[var(--text-secondary)]">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[14px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[var(--text-secondary)]">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[14px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors">
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--text-secondary)]">Deadline</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[14px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors" />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--text-secondary)]">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full resize-none rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[14px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
              placeholder="What is this project about?" />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="rounded-[8px] border border-[var(--border)] px-4 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || !name.trim()}
              className="flex items-center gap-2 rounded-[8px] bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-90 disabled:opacity-50 transition-opacity">
              {saving && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--accent-fg)] border-t-transparent" />}
              {project ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Progress bar (read-only) ───────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
        <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-300" style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right text-[12px] tabular-nums text-[var(--text-secondary)]">{value}%</span>
    </div>
  )
}

// ── Delete confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-[380px] rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-6"
      >
        <h3 className="mb-2 text-[16px] font-semibold text-[var(--text-primary)]">Delete Project?</h3>
        <p className="mb-5 text-[13px] text-[var(--text-secondary)]">
          &ldquo;{name}&rdquo; and all its tasks will be permanently deleted. This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 rounded-[8px] border border-[var(--border)] py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 rounded-[8px] bg-red-500 py-2 text-[13px] font-medium text-white hover:bg-red-600 transition-colors">
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Project Board Card ────────────────────────────────────────────────────────

interface ProjectBoardCardProps {
  project: Project
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
}

function ProjectBoardCard({ project, onEdit, onDelete }: ProjectBoardCardProps) {
  return (
    <div className="group rounded-[8px] border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] transition-all overflow-hidden">
      <div className="h-[5px] w-full bg-[var(--border)]">
        <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${project.progress}%` }} />
      </div>
      <div className="p-3">
        <div className="mb-1 flex items-start justify-between gap-2">
          <Link href={`/projects/${project.id}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-[13px] font-medium leading-snug text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors">
            {project.name}
          </Link>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onEdit(project) }}
              className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)] transition-colors">
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDelete(project) }}
              className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-400 transition-colors">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="mb-2 flex items-center gap-1.5">
          <span className="rounded-[4px] bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--text-tertiary)]">{project.category}</span>
          <DeadlinePill deadline={project.deadline} done={project.status === 'Complete'} />
        </div>
        <ProgressBar value={project.progress} />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('board')
  const [showModal, setShowModal] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [deleteProject, setDeleteProject] = useState<Project | null>(null)
  const { addToast } = useToastStore()

  const load = useCallback(async () => {
    try {
      const data = await db.projects.list()
      setProjects(data)
    } catch {
      addToast({ type: 'error', message: 'Failed to load projects' })
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { load() }, [load])

  const handleAdd = async (data: Parameters<typeof db.projects.insert>[0]) => {
    const optimistic: Project = {
      id: 'temp-' + Date.now(),
      ...data, category: data.category ?? '', status: data.status ?? 'Active',
      progress: 0, createdAt: new Date().toISOString(),
    }
    setProjects((p) => [optimistic, ...p])
    try {
      const created = await db.projects.insert(data)
      setProjects((p) => p.map((x) => (x.id === optimistic.id ? created : x)))
      addToast({ type: 'success', message: 'Project created' })
    } catch {
      setProjects((p) => p.filter((x) => x.id !== optimistic.id))
      addToast({ type: 'error', message: 'Failed to create project' })
    }
  }

  const handleEdit = async (data: Parameters<typeof db.projects.insert>[0]) => {
    if (!editProject) return
    const prev = editProject
    setProjects((p) => p.map((x) => x.id === prev.id ? { ...x, ...data } : x))
    try {
      const updated = await db.projects.update(prev.id, data)
      setProjects((p) => p.map((x) => (x.id === prev.id ? updated : x)))
      addToast({ type: 'success', message: 'Project updated' })
    } catch {
      setProjects((p) => p.map((x) => (x.id === prev.id ? prev : x)))
      addToast({ type: 'error', message: 'Failed to update project' })
    }
  }

  const handleDelete = async () => {
    if (!deleteProject) return
    const prev = deleteProject
    setDeleteProject(null)
    setProjects((p) => p.filter((x) => x.id !== prev.id))
    try {
      await db.projects.delete(prev.id)
      addToast({ type: 'success', message: 'Project deleted' })
    } catch {
      setProjects((p) => [prev, ...p])
      addToast({ type: 'error', message: 'Failed to delete project' })
    }
  }

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    const project = projects.find((p) => p.id === projectId)
    if (!project) return
    const oldStatus = project.status
    setProjects((p) => p.map((x) => x.id === projectId ? { ...x, status: newStatus } : x))
    try {
      await db.projects.update(projectId, { status: newStatus })
    } catch {
      setProjects((p) => p.map((x) => x.id === projectId ? { ...x, status: oldStatus } : x))
      addToast({ type: 'error', message: 'Failed to move project' })
    }
  }

  const viewOptions = [
    { value: 'board' as const, label: 'Board', icon: LayoutGrid },
    { value: 'table' as const, label: 'Table', icon: Table2 },
    { value: 'gallery' as const, label: 'Gallery', icon: List },
  ]

  if (loading) {
    return (
      <div className="min-h-full p-6">
        <PageHeader title="Projects" description="Loading..." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-[8px] bg-[var(--surface-2)]" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full p-6">
      <PageHeader
        title="Projects"
        description={`${projects.length} project${projects.length !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <ViewSwitcher options={viewOptions} value={view} onChange={setView} />
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 rounded-[6px] bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              New Project
            </button>
          </div>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          heading="No projects yet"
          subtext="Create your first project to start organizing your work."
          cta={
            <button onClick={() => setShowModal(true)}
              className="rounded-[6px] bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-90 transition-opacity">
              Add Your First Project
            </button>
          }
        />
      ) : (
        <>
          {/* Board View */}
          {view === 'board' && (
            <KanbanBoard
              items={projects}
              columns={STATUS_COLUMNS}
              onStatusChange={handleStatusChange}
              renderCard={(project) => (
                <ProjectBoardCard
                  project={project}
                  onEdit={setEditProject}
                  onDelete={setDeleteProject}
                />
              )}
              renderColumnHeader={(column, count) => (
                <div className="mb-3 flex items-center gap-2">
                  <StatusDot status={column} />
                  <span className="text-[13px] font-medium text-[var(--text-primary)]">{column}</span>
                  <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] text-[var(--text-tertiary)]">{count}</span>
                </div>
              )}
            />
          )}

          {/* Table View */}
          {view === 'table' && (
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {['Name', 'Status', 'Category', 'Deadline', 'Progress', ''].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id} className="group border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/projects/${p.id}`} className="text-[13px] font-medium text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors">
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3"><span className="flex items-center gap-1.5"><StatusDot status={p.status} /><span className="text-[12px] text-[var(--text-secondary)]">{p.status}</span></span></td>
                      <td className="px-4 py-3 text-[12px] text-[var(--text-secondary)]">{p.category}</td>
                      <td className="px-4 py-3">
                        {p.deadline ? <DeadlinePill deadline={p.deadline} done={p.status === 'Complete'} /> : <span className="text-[12px] text-[var(--text-tertiary)]">—</span>}
                      </td>
                      <td className="px-4 py-3 w-36">
                        <ProgressBar value={p.progress} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditProject(p)} className="rounded-[4px] p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)] transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setDeleteProject(p)} className="rounded-[4px] p-1.5 text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Gallery View */}
          {view === 'gallery' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <div key={project.id} className="group rounded-[8px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--border-strong)] transition-all">
                  <div className="flex h-[140px] items-center justify-center bg-[var(--surface-2)]">
                    <span className="text-[48px] font-bold text-[var(--border-strong)]">{project.name[0]}</span>
                  </div>
                  <div className="p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <Link href={`/projects/${project.id}`}
                        className="text-[16px] font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors">
                        {project.name}
                      </Link>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditProject(project)} className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setDeleteProject(project)} className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <StatusDot status={project.status} />
                      <span className="text-[12px] text-[var(--text-secondary)]">{project.status}</span>
                      <span className="text-[12px] text-[var(--text-tertiary)]">·</span>
                      <span className="text-[12px] text-[var(--text-tertiary)]">{project.category}</span>
                      {project.deadline && (
                        <>
                          <span className="text-[12px] text-[var(--text-tertiary)]">·</span>
                          <DeadlinePill deadline={project.deadline} done={project.status === 'Complete'} />
                        </>
                      )}
                    </div>
                    <ProgressBar value={project.progress} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <AnimatePresence>
        {(showModal || editProject) && (
          <ProjectModal
            project={editProject ?? undefined}
            onClose={() => { setShowModal(false); setEditProject(null) }}
            onSave={editProject ? handleEdit : handleAdd}
          />
        )}
        {deleteProject && (
          <DeleteConfirm
            name={deleteProject.name}
            onConfirm={handleDelete}
            onCancel={() => setDeleteProject(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
