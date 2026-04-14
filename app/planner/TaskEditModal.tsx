// Edit modal for /tasks rows opened from inside the planner. Mirrors the
// block-edit modal but speaks the `tasks` table shape (snake_case in DB,
// camelCase in app). Closes on backdrop click or Escape — diff is saved
// optimistically through usePlannerBlocksStore.updateAppTask.

'use client'

import { useEffect, useState } from 'react'
import { Trash2, X } from 'lucide-react'
import type { Task as AppTask, Project as AppProject } from '@/lib/db'

const STATUSES = ['Not Started', 'In Progress', 'Blocked', 'Done'] as const
const PRIORITIES = ['P0', 'P1', 'P2', 'P3'] as const

interface Props {
  task: AppTask
  project?: AppProject
  onClose: () => void
  onPatch: (patch: {
    name?: string
    status?: string
    priority?: string
    due_date?: string | null
    description?: string | null
  }) => Promise<void> | void
  onDelete: () => void | Promise<void>
}

export function TaskEditModal({ task, project, onClose, onPatch, onDelete }: Props) {
  const [name, setName] = useState(task.name)
  const [status, setStatus] = useState(task.status)
  const [priority, setPriority] = useState(task.priority)
  const [dueDate, setDueDate] = useState(task.dueDate ?? '')
  const [description, setDescription] = useState(task.description ?? '')

  const handleSaveAndClose = async () => {
    const patch: {
      name?: string
      status?: string
      priority?: string
      due_date?: string | null
      description?: string | null
    } = {}
    if (name !== task.name) patch.name = name
    if (status !== task.status) patch.status = status
    if (priority !== task.priority) patch.priority = priority
    const originalDue = task.dueDate ?? ''
    if (dueDate !== originalDue) patch.due_date = dueDate || null
    if ((description || '') !== (task.description ?? '')) {
      patch.description = description || null
    }
    if (Object.keys(patch).length > 0) await onPatch(patch)
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleSaveAndClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, status, priority, dueDate, description])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleSaveAndClose()
      }}
    >
      <div
        className="w-[460px] max-w-[92vw] rounded-lg border shadow-xl"
        style={{ background: 'var(--bg1)', borderColor: 'var(--border)' }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <span
            className="font-mono text-[11px] uppercase tracking-[0.08em]"
            style={{ color: 'var(--text2)' }}
          >
            Edit task {project?.name ? `· ${project.name}` : ''}
          </span>
          <button
            onClick={handleSaveAndClose}
            className="rounded p-1 hover:bg-[color:var(--bg2)]"
            style={{ color: 'var(--text2)' }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-4 py-3">
          <label className="flex flex-col gap-1">
            <span
              className="font-mono text-[10px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--text2)' }}
            >
              Title
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Task title"
              autoFocus
              className="rounded-md border px-2 py-1.5 text-[13px] outline-none"
              style={{ background: 'var(--bg2)', borderColor: 'var(--border)', color: 'var(--text0)' }}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--text2)' }}
              >
                Status
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-md px-2 py-1.5 text-[12px]"
                style={{
                  background: 'var(--bg2)',
                  color: 'var(--text0)',
                  border: '1px solid var(--border)',
                }}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--text2)' }}
              >
                Priority
              </span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="rounded-md px-2 py-1.5 text-[12px]"
                style={{
                  background: 'var(--bg2)',
                  color: 'var(--text0)',
                  border: '1px solid var(--border)',
                }}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-2 flex flex-col gap-1">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--text2)' }}
              >
                Due date
              </span>
              <input
                type="date"
                value={dueDate ? dueDate.slice(0, 10) : ''}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-md px-2 py-1.5 text-[12px]"
                style={{
                  background: 'var(--bg2)',
                  color: 'var(--text0)',
                  border: '1px solid var(--border)',
                }}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span
              className="font-mono text-[10px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--text2)' }}
            >
              Notes
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Details, links, context…"
              className="w-full resize-none rounded-md border px-2 py-1.5 text-[12px] outline-none"
              style={{ background: 'var(--bg2)', borderColor: 'var(--border)', color: 'var(--text0)' }}
            />
          </label>

          {project?.name && (
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--text2)' }}
              >
                Project
              </span>
              <span
                className="rounded-[4px] px-1.5 py-0.5 text-[11px]"
                style={{ background: 'var(--bg3)', color: 'var(--text2)' }}
              >
                {project.name}
              </span>
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-between border-t px-4 py-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            onClick={onDelete}
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px]"
            style={{ background: 'var(--bg2)', color: '#ef6850' }}
          >
            <Trash2 size={12} /> Delete
          </button>
          <button
            onClick={handleSaveAndClose}
            className="rounded-md px-3 py-1.5 text-[12px]"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
