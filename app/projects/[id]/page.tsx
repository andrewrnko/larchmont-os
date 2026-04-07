'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, CheckSquare, Calendar, FolderOpen, X, Check, Play, Square, Clock } from 'lucide-react'
import { db } from '@/lib/db'
import type { Project, Task } from '@/lib/db'
import { useToastStore, useTimerStore } from '@/lib/store'
import { StatusBadge } from '@/components/shared/status-badge'
import { ProgressBar } from '@/components/shared/progress-bar'
import { PriorityDot } from '@/components/shared/priority-dot'
import { KanbanBoard } from '@/components/shared/kanban-board'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'

// ── Helpers ────────────────────────────────────────────────────

function formatDate(d?: string) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isOverdue(d?: string) {
  if (!d) return false
  return new Date(d) < new Date()
}

// ── Skeleton ───────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-[6px] bg-[var(--surface-2)]', className)} />
  )
}

function LoadingSkeleton() {
  return (
    <div className="min-h-full p-6">
      <Skeleton className="mb-6 h-4 w-20" />
      <Skeleton className="mb-4 h-8 w-64" />
      <div className="mb-6 flex gap-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="mb-8 h-2 w-full" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 2 }).map((_, j) => (
              <Skeleton key={j} className="h-16 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Task Card ──────────────────────────────────────────────────

function TaskCard({
  task,
  onStatusChange,
  onAddTime,
  onClick,
}: {
  task: Task
  onStatusChange: (id: string, status: string) => void
  onAddTime: (taskId: string, minutes: number) => void
  onClick?: () => void
}) {
  const isDone = task.status === 'Done'

  return (
    <div
      onClick={onClick}
      className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3 hover:border-[var(--border-strong)] transition-colors cursor-pointer"
    >
      <div className="mb-2 flex items-start gap-2">
        <PriorityDot priority={task.priority} className="mt-0.5 flex-shrink-0" />
        <span
          className={cn(
            'flex-1 text-[13px] leading-snug',
            isDone ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text-primary)]'
          )}
        >
          {task.name}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={task.status} size="sm" />
        {task.dueDate && (
          <span
            className={cn(
              'flex items-center gap-1 text-[11px] tabular-nums',
              isOverdue(task.dueDate) && !isDone ? 'text-red-400' : 'text-[var(--text-tertiary)]'
            )}
          >
            <Calendar className="h-2.5 w-2.5" />
            {formatDate(task.dueDate)}
          </span>
        )}
      </div>
      {!isDone && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, 'Done') }}
            className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
          >
            <CheckSquare className="h-3 w-3" />
            Mark done
          </button>
          <TaskTimer task={task} compact onStop={onAddTime} />
        </div>
      )}
    </div>
  )
}

// ── Add Task Form ──────────────────────────────────────────────

type AddTaskFormProps = {
  projectId: string
  columnStatus: string
  onAdd: (task: Task) => void
  onCancel: () => void
}

function AddTaskForm({ projectId, columnStatus, onAdd, onCancel }: AddTaskFormProps) {
  const [name, setName] = useState('')
  const [priority, setPriority] = useState('P2')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const task = await db.tasks.insert({
        name: name.trim(),
        project_id: projectId,
        priority,
        status: columnStatus,
        due_date: dueDate || null,
      })
      onAdd(task)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[8px] border border-[var(--accent)]/40 bg-[var(--surface)] p-3 space-y-2"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Task name..."
        className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
      />
      <div className="flex gap-2">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="flex-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-[12px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
        >
          <option value="P0">P0 — Critical</option>
          <option value="P1">P1 — High</option>
          <option value="P2">P2 — Medium</option>
          <option value="P3">P3 — Low</option>
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="flex-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-[12px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[6px] px-3 py-1.5 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="rounded-[6px] bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-[var(--accent-fg)] hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {saving ? 'Adding...' : 'Add Task'}
        </button>
      </div>
    </form>
  )
}

// ── Timer helpers ─────────────────────────────────────────────

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatMinutes(minutes: number) {
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  return `${minutes}m`
}

function TaskTimer({
  task,
  compact = false,
  onStop,
}: {
  task: Task
  compact?: boolean
  onStop: (taskId: string, minutes: number) => void
}) {
  const { activeTaskId, startedAt, startTimer, stopTimer } = useTimerStore()
  const isActive = activeTaskId === task.id
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!isActive || !startedAt) { setElapsed(0); return }
    const update = () => setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [isActive, startedAt])

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    startTimer(task.id)
  }

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation()
    const result = stopTimer()
    if (!result) return
    const minutes = Math.round((Date.now() - new Date(result.startedAt).getTime()) / 60000)
    if (minutes > 0) onStop(result.taskId, minutes)
  }

  if (compact) {
    return (
      <button
        onClick={isActive ? handleStop : handleStart}
        className={cn(
          'flex items-center gap-1 text-[11px] transition-colors',
          isActive ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--accent)]'
        )}
        title={isActive ? 'Stop timer' : 'Start timer'}
      >
        {isActive ? (
          <>
            <Square className="h-3 w-3 fill-current" />
            <span className="tabular-nums font-mono">{formatElapsed(elapsed)}</span>
          </>
        ) : (
          <Play className="h-3 w-3" />
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={isActive ? handleStop : handleStart}
        className={cn(
          'flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[12px] font-medium transition-colors',
          isActive
            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
            : 'bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20'
        )}
      >
        {isActive ? (
          <><Square className="h-3 w-3 fill-current" />Stop — {formatElapsed(elapsed)}</>
        ) : (
          <><Play className="h-3 w-3" />Start Timer</>
        )}
      </button>
      {task.actualMinutes != null && task.actualMinutes > 0 && (
        <span className="flex items-center gap-1 text-[12px] text-[var(--text-tertiary)]">
          <Clock className="h-3 w-3" />
          {formatMinutes(task.actualMinutes)} logged
        </span>
      )}
    </div>
  )
}

// ── Due date color helper ─────────────────────────────────────

function dueDateColor(dueDate: string, status: string) {
  if (status === 'Done') return 'text-[var(--text-secondary)]'
  const diff = (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (diff < 0) return 'text-red-400'
  if (diff < 7) return 'text-amber-400'
  return 'text-[var(--text-secondary)]'
}

// ── Task Detail Panel ─────────────────────────────────────────

function TaskDetailPanel({
  task,
  onClose,
  onTaskUpdate,
  onAddTime,
}: {
  task: Task
  onClose: () => void
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>
  onAddTime: (taskId: string, minutes: number) => void
}) {
  const [mounted, setMounted] = useState(false)

  // Inline name editing
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(task.name)

  // Inline description editing
  const [editingDesc, setEditingDesc] = useState(false)
  const [descValue, setDescValue] = useState(task.description ?? '')

  // Save indicator
  const [saved, setSaved] = useState(false)
  const savedTimer = useState<ReturnType<typeof setTimeout> | null>(null)

  // Keep local state in sync when task prop updates (e.g. from kanban drag)
  useEffect(() => { setNameValue(task.name) }, [task.name])
  useEffect(() => { setDescValue(task.description ?? '') }, [task.description])

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const flashSaved = () => {
    setSaved(true)
    if (savedTimer[0]) clearTimeout(savedTimer[0])
    savedTimer[0] = setTimeout(() => setSaved(false), 1500)
  }

  const save = async (updates: Partial<Task>) => {
    await onTaskUpdate(task.id, updates)
    flashSaved()
  }

  const commitName = async () => {
    setEditingName(false)
    const trimmed = nameValue.trim()
    if (!trimmed || trimmed === task.name) return
    await save({ name: trimmed })
  }

  const commitDesc = async () => {
    setEditingDesc(false)
    const v = descValue.trim()
    if (v === (task.description ?? '')) return
    await save({ description: v || undefined })
  }

  if (!mounted) return null

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998] bg-black/20" onPointerDown={onClose} />

      <div className="fixed right-0 top-0 z-[9999] flex h-screen w-[340px] flex-col border-l border-[var(--border)] bg-[var(--surface)]">
        {/* Header */}
        <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-[var(--text-secondary)]">Task</span>
            {/* Save indicator */}
            <span className={cn(
              'flex items-center gap-1 text-[11px] text-green-500 transition-opacity duration-300',
              saved ? 'opacity-100' : 'opacity-0'
            )}>
              <Check className="h-3 w-3" /> Saved
            </span>
          </div>
          <button
            onPointerDown={(e) => { e.stopPropagation(); onClose() }}
            className="rounded-[6px] p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" onPointerDown={(e) => e.stopPropagation()}>

          {/* ── Task Name ── */}
          <div className="border-b border-[var(--border)] px-5 py-4">
            {editingName ? (
              <input
                autoFocus
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitName() } if (e.key === 'Escape') { setNameValue(task.name); setEditingName(false) } }}
                className="w-full bg-transparent text-[18px] font-semibold text-[var(--text-primary)] focus:outline-none leading-snug"
              />
            ) : (
              <p
                onClick={() => setEditingName(true)}
                className="cursor-text text-[18px] font-semibold leading-snug text-[var(--text-primary)] hover:bg-[var(--surface-2)] rounded-[4px] px-1 -mx-1 py-0.5 transition-colors"
              >
                {task.name}
              </p>
            )}
          </div>

          {/* ── Fields ── */}
          <div className="space-y-0 divide-y divide-[var(--border)]">

            {/* Status */}
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-[12px] text-[var(--text-tertiary)] w-24 flex-shrink-0">Status</span>
              <select
                value={task.status}
                onChange={(e) => save({ status: e.target.value })}
                className="flex-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-[12px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors text-right"
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Blocked">Blocked</option>
                <option value="Done">Done</option>
              </select>
            </div>

            {/* Priority */}
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-[12px] text-[var(--text-tertiary)] w-24 flex-shrink-0">Priority</span>
              <select
                value={task.priority}
                onChange={(e) => save({ priority: e.target.value })}
                className="flex-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-[12px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors text-right"
              >
                <option value="P0">P0 — Critical</option>
                <option value="P1">P1 — High</option>
                <option value="P2">P2 — Medium</option>
                <option value="P3">P3 — Low</option>
              </select>
            </div>

            {/* Due Date */}
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-[12px] text-[var(--text-tertiary)] w-24 flex-shrink-0">Deadline</span>
              <div className="flex flex-1 items-center justify-end gap-2">
                {task.dueDate && (
                  <span className={cn('text-[12px] tabular-nums', dueDateColor(task.dueDate, task.status))}>
                    {formatDate(task.dueDate)}
                  </span>
                )}
                <input
                  type="date"
                  value={task.dueDate ?? ''}
                  onChange={(e) => save({ dueDate: e.target.value || undefined })}
                  className="w-[32px] cursor-pointer rounded-[4px] border-0 bg-transparent p-0 text-[12px] text-[var(--text-tertiary)] opacity-50 hover:opacity-100 focus:outline-none transition-opacity [color-scheme:dark]"
                  title="Set deadline"
                />
              </div>
            </div>

            {/* Est. Time */}
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-[12px] text-[var(--text-tertiary)] w-24 flex-shrink-0">Est. Time</span>
              <div className="flex flex-1 items-center justify-end gap-1.5">
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={task.estimatedMinutes ?? ''}
                  onChange={(e) => {
                    const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10)
                    if (v === undefined || (!isNaN(v) && v >= 0)) {
                      onTaskUpdate(task.id, { estimatedMinutes: v })
                    }
                  }}
                  placeholder="—"
                  className="w-16 rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[12px] text-[var(--text-primary)] text-right placeholder-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[12px] text-[var(--text-tertiary)]">min</span>
              </div>
            </div>

          </div>

          {/* ── Timer ── */}
          <div className="border-t border-[var(--border)] px-5 py-4">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Time Tracking</p>
            <TaskTimer task={task} onStop={onAddTime} />
          </div>

          {/* ── Description ── */}
          <div className="border-t border-[var(--border)] px-5 py-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Description</p>
            {editingDesc ? (
              <textarea
                autoFocus
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                onBlur={commitDesc}
                onKeyDown={(e) => { if (e.key === 'Escape') { setDescValue(task.description ?? ''); setEditingDesc(false) } }}
                rows={5}
                placeholder="Add a description..."
                className="w-full resize-none rounded-[6px] border border-[var(--accent)]/40 bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none transition-colors leading-relaxed"
              />
            ) : (
              <div
                onClick={() => setEditingDesc(true)}
                className={cn(
                  'min-h-[60px] cursor-text rounded-[6px] px-3 py-2 text-[13px] leading-relaxed transition-colors hover:bg-[var(--surface-2)]',
                  task.description ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)] italic'
                )}
              >
                {task.description || 'Add a description...'}
              </div>
            )}
          </div>

        </div>
      </div>
    </>,
    document.body
  )
}

// ── Kanban columns ────────────────────────────────────────────

const COLUMNS = ['Not Started', 'In Progress', 'Blocked', 'Done'] as const

// ── Page ──────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const { addToast } = useToastStore()

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [addTaskColumn, setAddTaskColumn] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([db.projects.list(), db.tasks.list(id)])
      .then(([projects, projectTasks]) => {
        const found = projects.find((p) => p.id === id) ?? null
        if (!found) {
          setNotFound(true)
        } else {
          setProject(found)
          setTasks(projectTasks)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  // Keep project.progress in sync with actual task completion
  useEffect(() => {
    if (!project || tasks.length === 0) return
    const done = tasks.filter((t) => t.status === 'Done').length
    const computed = Math.round((done / tasks.length) * 100)
    if (computed === project.progress) return
    setProject((p) => (p ? { ...p, progress: computed } : p))
    db.projects.update(project.id, { progress: computed }).catch(console.error)
  }, [tasks]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTaskAdd = (task: Task) => {
    setTasks((prev) => [task, ...prev])
  }

  // Unified update — used by panel AND kanban drag
  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>): Promise<void> => {
    const prev = tasks.find((t) => t.id === taskId)
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, ...updates } : t)))
    setSelectedTask((sel) => (sel?.id === taskId ? { ...sel, ...updates } : sel))
    try {
      // Map camelCase Task fields → snake_case DB fields
      const dbUpdates: Parameters<typeof db.tasks.update>[1] = {}
      if (updates.name !== undefined) dbUpdates.name = updates.name
      if (updates.status !== undefined) dbUpdates.status = updates.status
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority
      if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate ?? null
      if ('dueDate' in updates && updates.dueDate === undefined) dbUpdates.due_date = null
      if (updates.description !== undefined) dbUpdates.description = updates.description ?? null
      if (updates.actualMinutes !== undefined) dbUpdates.actual_minutes = updates.actualMinutes ?? null
      if (updates.estimatedMinutes !== undefined) dbUpdates.estimated_minutes = updates.estimatedMinutes ?? null
      await db.tasks.update(taskId, dbUpdates)
    } catch (err) {
      console.error(err)
      // Revert optimistic update
      if (prev) {
        setTasks((ts) => ts.map((t) => (t.id === taskId ? prev : t)))
        setSelectedTask((sel) => (sel?.id === taskId ? prev : sel))
      }
      addToast({ type: 'error', message: 'Failed to save — changes reverted' })
    }
  }

  const handleTaskStatusChange = async (taskId: string, newStatus: string): Promise<void> => {
    await handleTaskUpdate(taskId, { status: newStatus })
  }

  const handleAddTime = (taskId: string, minutes: number) => {
    const current = tasks.find((t) => t.id === taskId)?.actualMinutes ?? 0
    handleTaskUpdate(taskId, { actualMinutes: current + minutes })
  }

  const renderTaskCard = (task: Task) => (
    <TaskCard
      task={task}
      onStatusChange={handleTaskStatusChange}
      onAddTime={handleAddTime}
      onClick={() => setSelectedTask(task)}
    />
  )

  const renderColumnHeader = (column: string, count: number) => (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-medium text-[var(--text-primary)]">{column}</span>
        <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-tertiary)]">
          {count}
        </span>
      </div>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setAddTaskColumn(column)}
        className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)] transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )

  const renderColumnFooter = (column: string) => {
    if (addTaskColumn !== column) return null
    return (
      <AddTaskForm
        projectId={id}
        columnStatus={column}
        onAdd={(task) => { handleTaskAdd(task); setAddTaskColumn(null) }}
        onCancel={() => setAddTaskColumn(null)}
      />
    )
  }

  if (loading) return <LoadingSkeleton />

  if (notFound || !project) {
    return (
      <div className="min-h-full p-6">
        <Link
          href="/projects"
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Projects
        </Link>
        <EmptyState
          icon={FolderOpen}
          heading="Project not found"
          subtext="This project doesn't exist or may have been removed."
          cta={
            <Link
              href="/projects"
              className="rounded-[6px] bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-90 transition-opacity"
            >
              Back to Projects
            </Link>
          }
        />
      </div>
    )
  }

  const doneTasks = tasks.filter((t) => t.status === 'Done').length
  const progress = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : (project?.progress ?? 0)

  return (
    <div className="min-h-full">
      {/* Back button */}
      <div className="px-6 pt-5">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Projects
        </Link>
      </div>

      {/* Project header */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text-primary)] leading-tight truncate">
              {project.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {project.category && (
                <span className="rounded-[4px] border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-tertiary)]">
                  {project.category}
                </span>
              )}
              <StatusBadge status={project.status} />
              {project.deadline && (
                <span
                  className={cn(
                    'flex items-center gap-1 text-[12px]',
                    isOverdue(project.deadline) ? 'text-red-400' : 'text-[var(--text-secondary)]'
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  {formatDate(project.deadline)}
                </span>
              )}
            </div>
          </div>
        </div>

        {project.description && (
          <p className="mt-3 max-w-2xl text-[13px] text-[var(--text-secondary)] leading-relaxed">
            {project.description}
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="mx-6 mb-6 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-[24px] font-semibold tabular-nums text-[var(--text-primary)]">
              {progress}%
            </span>
            <span className="text-[13px] text-[var(--text-secondary)]">complete</span>
          </div>
          {tasks.length > 0 && (
            <span className="text-[12px] text-[var(--text-tertiary)]">
              {doneTasks} / {tasks.length} tasks done
            </span>
          )}
        </div>
        <ProgressBar value={progress} color="accent" />
      </div>

      {/* Kanban board */}
      <div className="px-6 pb-8">
        <KanbanBoard
          items={tasks}
          columns={COLUMNS}
          onStatusChange={handleTaskStatusChange}
          renderCard={renderTaskCard}
          renderColumnHeader={renderColumnHeader}
          renderColumnFooter={renderColumnFooter}
          columnWidth="w-[260px]"
        />
      </div>

      {/* Task detail panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onTaskUpdate={handleTaskUpdate}
          onAddTime={handleAddTime}
        />
      )}
    </div>
  )
}
