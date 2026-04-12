'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckSquare2, List, Kanban, Plus, X, Trash2, Check, AlertCircle,
  Play, Square,
} from 'lucide-react'
import { db, type Task, type Project } from '@/lib/db'
import { useToastStore, useTimerStore } from '@/lib/store'
import { PageHeader } from '@/components/shared/page-header'
import { ViewSwitcher } from '@/components/shared/view-switcher'
import { EmptyState } from '@/components/shared/empty-state'
import { KanbanBoard } from '@/components/shared/kanban-board'
import { cn } from '@/lib/utils'

const KANBAN_COLUMNS = ['Not Started', 'In Progress', 'Blocked', 'Done'] as const
type KanbanStatus = typeof KANBAN_COLUMNS[number]
const PRIORITIES = ['P0', 'P1', 'P2', 'P3']

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-500', P1: 'bg-orange-400', P2: 'bg-yellow-400', P3: 'bg-[var(--text-tertiary)]',
}

const STATUS_COLORS: Record<string, string> = {
  'Not Started': 'text-[var(--text-tertiary)]',
  'In Progress': 'text-blue-400',
  'Blocked': 'text-orange-400',
  'Done': 'text-green-400',
}

const COLUMN_COLORS: Record<string, string> = {
  'Not Started': 'border-[var(--border)]',
  'In Progress': 'border-blue-500/30',
  'Blocked': 'border-orange-500/30',
  'Done': 'border-green-500/30',
}

function formatDate(d?: string) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function PriorityPip({ priority }: { priority: string }) {
  return <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${PRIORITY_COLORS[priority] ?? 'bg-gray-400'}`} />
}

function useElapsed(startedAt: string | null): string {
  const [elapsed, setElapsed] = useState('')
  useEffect(() => {
    if (!startedAt) { setElapsed(''); return }
    const update = () => {
      const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
      const h = Math.floor(secs / 3600)
      const m = Math.floor((secs % 3600) / 60)
      const s = secs % 60
      setElapsed(h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  return elapsed
}

// ── Add Task inline form ──────────────────────────────────────────────────────

interface AddTaskFormProps {
  projects: Project[]
  defaultStatus?: string
  onAdd: (v: { name: string; priority: string; status: string; projectId: string | null; dueDate?: string }) => Promise<void>
  onCancel: () => void
}

function AddTaskForm({ projects, defaultStatus = 'Not Started', onAdd, onCancel }: AddTaskFormProps) {
  const [name, setName] = useState('')
  const [priority, setPriority] = useState('P1')
  const [status] = useState(defaultStatus)
  const [projectId, setProjectId] = useState<string>('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onAdd({ name: name.trim(), priority, status, projectId: projectId || null, dueDate: dueDate || undefined })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onPointerDown={(e) => e.stopPropagation()}
      className="rounded-[8px] border border-[var(--accent)]/40 bg-[var(--surface)] p-3"
    >
      <input
        value={name} onChange={(e) => setName(e.target.value)} autoFocus required
        placeholder="Task name..."
        className="mb-2 w-full bg-transparent text-[13px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select value={priority} onChange={(e) => setPriority(e.target.value)}
          className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[11px] text-[var(--text-secondary)] focus:outline-none">
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
          className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[11px] text-[var(--text-secondary)] focus:outline-none">
          <option value="">No project</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
          className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[11px] text-[var(--text-secondary)] focus:outline-none" />
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={onCancel} className="rounded-[6px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
          <button type="submit" disabled={saving || !name.trim()}
            className="rounded-[6px] bg-[var(--accent)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-fg)] hover:opacity-90 disabled:opacity-50 transition-opacity">
            {saving ? '...' : 'Add'}
          </button>
        </div>
      </div>
    </form>
  )
}

// ── Task Card (no dnd-kit — SortableWrapper in KanbanBoard handles drag) ──────

interface TaskCardProps {
  task: Task
  projects: Project[]
  onDelete: (id: string) => void
  onTimerStart: (taskId: string) => void
  onTimerStop: (taskId: string) => void
}

function TaskCard({ task, projects, onDelete, onTimerStart, onTimerStop }: TaskCardProps) {
  const { activeTaskId, startedAt } = useTimerStore()
  const isActive = activeTaskId === task.id
  const elapsed = useElapsed(isActive ? startedAt : null)
  const project = projects.find((p) => p.id === task.projectId)

  return (
    <div className={cn(
      'group relative rounded-[6px] border px-3 py-2.5',
      'transition-colors duration-100',
      isActive ? 'border-blue-500/50' : 'border-[var(--border)]',
      'hover:border-[color:var(--border2)] hover:bg-[color:var(--bg3)]'
    )}
    style={{ background: 'var(--bg2)' }}>
      <div className="mb-2 flex items-start gap-2">
        <PriorityPip priority={task.priority} />
        <span className="flex-1 text-[12px] font-medium leading-snug text-[var(--text-primary)]">
          {task.name}
        </span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
          className="flex-shrink-0 rounded-[4px] p-0.5 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {project && (
          <span className="rounded-[4px] bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--text-tertiary)] truncate max-w-[100px]">
            {project.name}
          </span>
        )}
        {task.dueDate && (
          <span className={cn('text-[11px] tabular-nums', new Date(task.dueDate) < new Date() && task.status !== 'Done' ? 'text-red-400' : 'text-[var(--text-tertiary)]')}>
            {formatDate(task.dueDate)}
          </span>
        )}
        {task.status !== 'Done' && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); isActive ? onTimerStop(task.id) : onTimerStart(task.id) }}
            className={cn(
              'ml-auto flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[11px] transition-all',
              isActive
                ? 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25'
                : 'bg-[var(--surface-2)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] opacity-0 group-hover:opacity-100'
            )}
          >
            {isActive ? (
              <><Square className="h-2.5 w-2.5" /><span className="tabular-nums">{elapsed}</span></>
            ) : (
              <><Play className="h-2.5 w-2.5" /><span>Start</span></>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

// ── List row ──────────────────────────────────────────────────────────────────

function TaskListRow({ task, projects, onComplete, onDelete, completing }: {
  task: Task; projects: Project[]; onComplete: (id: string) => void
  onDelete: (id: string) => void; completing: boolean
}) {
  const isDone = task.status === 'Done'
  const project = projects.find((p) => p.id === task.projectId)
  return (
    <div className={cn(
      'group flex items-center gap-3 rounded-[6px] px-3 py-2',
      'hover:bg-[var(--surface-2)] transition-colors',
      completing && 'opacity-40'
    )}>
      <button onClick={() => !isDone && onComplete(task.id)} disabled={isDone}
        className={cn('flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded-full border transition-all',
          isDone ? 'border-green-500/60 bg-green-500/20 cursor-default' : 'border-[var(--border-strong)] hover:border-[var(--accent)] hover:bg-[var(--accent-muted)] cursor-pointer')}>
        {isDone && <Check className="h-2 w-2 text-green-400" />}
      </button>
      <PriorityPip priority={task.priority} />
      <span className={cn('flex-1 min-w-0 truncate text-[13px]', isDone ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-primary)]')}>
        {task.name}
      </span>
      {task.status === 'Blocked' && <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-orange-400" />}
      <span className={cn('text-[11px]', STATUS_COLORS[task.status] ?? '')}>{task.status}</span>
      {task.dueDate && (
        <span className={cn('flex-shrink-0 rounded-[4px] px-1.5 py-0.5 text-[11px]',
          new Date(task.dueDate) < new Date() && !isDone ? 'bg-red-500/10 text-red-400' : 'bg-[var(--surface-2)] text-[var(--text-tertiary)]')}>
          {formatDate(task.dueDate)}
        </span>
      )}
      {project && (
        <span className="hidden md:inline-flex rounded-[4px] border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--text-tertiary)] max-w-[80px] truncate">{project.name}</span>
      )}
      <button onClick={() => onDelete(task.id)}
        className="flex-shrink-0 rounded-[4px] p-1 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all">
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'kanban'>('kanban')
  const [addingInColumn, setAddingInColumn] = useState<string | null>(null)
  const [showAddList, setShowAddList] = useState(false)
  const [completing, setCompleting] = useState<string | null>(null)
  const { addToast } = useToastStore()
  const { activeTaskId: timerTaskId, startedAt: timerStartedAt, startTimer, stopTimer } = useTimerStore()

  const handleTimerStart = useCallback(async (taskId: string) => {
    if (timerTaskId && timerTaskId !== taskId) {
      const prev = stopTimer()
      if (prev) {
        const elapsedMins = Math.round((Date.now() - new Date(prev.startedAt).getTime()) / 60000)
        db.tasks.update(prev.taskId, { actual_minutes: elapsedMins }).catch(() => {})
      }
    }
    startTimer(taskId)
    const now = new Date().toISOString()
    db.tasks.update(taskId, { started_at: now, status: 'In Progress' }).then((updated) => {
      setTasks((prev) => prev.map((t) => t.id === taskId ? updated : t))
    }).catch(() => {})
  }, [timerTaskId, startTimer, stopTimer])

  const handleTimerStop = useCallback(async (taskId: string) => {
    const result = stopTimer()
    if (!result) return
    const elapsedMins = Math.round((Date.now() - new Date(result.startedAt).getTime()) / 60000)
    const now = new Date().toISOString()
    db.tasks.update(taskId, { actual_minutes: elapsedMins, completed_at: now }).then((updated) => {
      setTasks((prev) => prev.map((t) => t.id === taskId ? updated : t))
    }).catch(() => {})
    const today = new Date().toISOString().split('T')[0]
    const task = tasks.find((t) => t.id === taskId)
    if (task) {
      db.metrics.insert({ date: today, metric_type: 'task_time', metric_key: taskId, metric_value: elapsedMins, metadata: { taskName: task.name, priority: task.priority, projectId: task.projectId } }).catch(() => {})
    }
  }, [stopTimer, tasks])

  const load = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([db.tasks.list(), db.projects.list()])
      setTasks(t)
      setProjects(p)
    } catch {
      addToast({ type: 'error', message: 'Failed to load tasks' })
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { load() }, [load])

  const handleAdd = async (v: { name: string; priority: string; status: string; projectId: string | null; dueDate?: string }) => {
    const opt: Task = {
      id: 'temp-' + Date.now(),
      name: v.name, priority: v.priority, status: v.status,
      projectId: v.projectId, dueDate: v.dueDate, createdAt: new Date().toISOString(),
    }
    setTasks((prev) => [opt, ...prev])
    setAddingInColumn(null)
    setShowAddList(false)
    try {
      const created = await db.tasks.insert({
        name: v.name, priority: v.priority, status: v.status,
        project_id: v.projectId, due_date: v.dueDate ?? null,
      })
      setTasks((prev) => prev.map((t) => t.id === opt.id ? created : t))
      addToast({ type: 'success', message: 'Task added' })
    } catch {
      setTasks((prev) => prev.filter((t) => t.id !== opt.id))
      addToast({ type: 'error', message: 'Failed to add task' })
    }
  }

  const handleComplete = (id: string) => {
    setCompleting(id)
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    if (timerTaskId === id) {
      const result = stopTimer()
      if (result) {
        const elapsedMins = Math.round((Date.now() - new Date(result.startedAt).getTime()) / 60000)
        db.tasks.update(id, { actual_minutes: elapsedMins }).catch(() => {})
      }
    }
    setTimeout(async () => {
      const now = new Date().toISOString()
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: 'Done', completedAt: now } : t))
      setCompleting(null)
      try {
        await db.tasks.update(id, { status: 'Done', completed_at: now })
        const today = new Date().toISOString().split('T')[0]
        db.metrics.insert({ date: today, metric_type: 'task_complete', metric_key: id, metadata: { taskName: task.name, priority: task.priority, projectId: task.projectId } }).catch(() => {})
      } catch {
        setTasks((prev) => prev.map((t) => t.id === id ? task : t))
        addToast({ type: 'error', message: 'Failed to update task' })
      }
    }, 350)
  }

  const handleDelete = async (id: string) => {
    const task = tasks.find((t) => t.id === id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
    try {
      await db.tasks.delete(id)
    } catch {
      if (task) setTasks((prev) => [task, ...prev])
      addToast({ type: 'error', message: 'Failed to delete task' })
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    const oldStatus = task.status
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t))
    try {
      await db.tasks.update(taskId, { status: newStatus })
    } catch {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: oldStatus } : t))
      addToast({ type: 'error', message: 'Failed to move task' })
    }
  }

  const viewOptions = [
    { value: 'kanban' as const, label: 'Kanban', icon: Kanban },
    { value: 'list' as const, label: 'List', icon: List },
  ]

  const openCount = tasks.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled').length
  const doneCount = tasks.filter((t) => t.status === 'Done').length

  if (loading) {
    return (
      <div className="min-h-full p-6">
        <PageHeader title="Tasks" description="Loading..." />
        <div className="flex gap-4">
          {KANBAN_COLUMNS.map((c) => (
            <div key={c} className="w-[260px] flex-shrink-0">
              <div className="mb-3 h-5 w-24 animate-pulse rounded bg-[var(--surface-2)]" />
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-[8px] bg-[var(--surface-2)]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full p-6">
      <PageHeader
        title="Tasks"
        description={`${openCount} open · ${doneCount} done`}
        actions={
          <div className="flex items-center gap-2">
            <ViewSwitcher options={viewOptions} value={view} onChange={setView} />
            <button
              onClick={() => { view === 'list' ? setShowAddList(true) : setAddingInColumn('Not Started') }}
              className="flex items-center gap-1.5 rounded-[6px] bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Add Task
            </button>
          </div>
        }
      />

      {tasks.length === 0 && !addingInColumn && !showAddList ? (
        <EmptyState
          icon={CheckSquare2}
          heading="No tasks yet"
          subtext="Add your first task to start tracking work."
          cta={
            <button onClick={() => setShowAddList(true)}
              className="rounded-[6px] bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-90 transition-opacity">
              Add Your First Task
            </button>
          }
        />
      ) : (
        <>
          {/* Kanban View */}
          {view === 'kanban' && (
            <KanbanBoard
              items={tasks}
              columns={KANBAN_COLUMNS}
              onStatusChange={handleStatusChange}
              renderCard={(task) => (
                <TaskCard
                  task={task}
                  projects={projects}
                  onDelete={handleDelete}
                  onTimerStart={handleTimerStart}
                  onTimerStop={handleTimerStop}
                />
              )}
              renderOverlay={(task) => (
                <TaskCard
                  task={task}
                  projects={projects}
                  onDelete={() => {}}
                  onTimerStart={() => {}}
                  onTimerStop={() => {}}
                />
              )}
              renderColumnHeader={(column, count) => {
                // Anytype-style compact column header: colored square badge with
                // a short label, full column name, and a muted count.
                const badge =
                  column === 'Not Started' ? { label: 'P3', bg: 'rgba(74,156,245,0.2)',  fg: '#4a9cf5', bd: 'rgba(74,156,245,0.3)'  } :
                  column === 'In Progress' ? { label: 'P1', bg: 'rgba(212,162,52,0.2)',  fg: '#d4a234', bd: 'rgba(212,162,52,0.3)'  } :
                  column === 'Blocked'     ? { label: 'P0', bg: 'rgba(232,93,58,0.2)',   fg: '#e85d3a', bd: 'rgba(232,93,58,0.3)'   } :
                                             { label: 'P2', bg: 'rgba(82,169,106,0.2)',  fg: '#52a96a', bd: 'rgba(82,169,106,0.3)'  }
                return (
                  <div className="mb-2 flex h-7 items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-[4px] border text-[11px] font-semibold"
                      style={{ background: badge.bg, color: badge.fg, borderColor: badge.bd }}
                    >
                      {badge.label}
                    </span>
                    <span className="text-[13px] font-medium" style={{ color: 'var(--text0)' }}>
                      {column}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
                      {count}
                    </span>
                  </div>
                )
              }}
              renderColumnFooter={(column) => (
                addingInColumn === column ? (
                  <AddTaskForm
                    projects={projects}
                    defaultStatus={column}
                    onAdd={handleAdd}
                    onCancel={() => setAddingInColumn(null)}
                  />
                ) : (
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setAddingInColumn(column)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-[6px] border border-dashed px-2 py-1.5 text-[12px] transition-colors duration-100 hover:bg-[color:var(--bg3)] hover:text-[color:var(--text1)]"
                    style={{ borderColor: 'var(--border)', color: 'var(--text3)' }}
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                )
              )}
              getColumnBorderClass={(col) => COLUMN_COLORS[col]}
            />
          )}

          {/* List View */}
          {view === 'list' && (
            <div className="space-y-1">
              {showAddList && (
                <div className="mb-3">
                  <AddTaskForm
                    projects={projects} defaultStatus="Not Started"
                    onAdd={handleAdd}
                    onCancel={() => setShowAddList(false)}
                  />
                </div>
              )}
              <AnimatePresence mode="popLayout">
                {tasks.map((task) => (
                  <motion.div
                    key={task.id} layout
                    exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    transition={{ duration: 0.2 }}
                  >
                    <TaskListRow
                      task={task} projects={projects}
                      onComplete={handleComplete} onDelete={handleDelete}
                      completing={completing === task.id}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  )
}
