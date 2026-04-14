// Week view — 7 day columns + unscheduled task bank sidebar.

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus, Sparkles, Trash2, X, ArrowLeftRight, Check } from 'lucide-react'
import { useToastStore } from '@/lib/store'
import { usePlannerBlocksStore } from '@/lib/planner-store'
import {
  todayLocal,
  weekStartMonday,
  weekRange,
  parseLocalDate,
  addDays,
  CATEGORY_COLORS,
  blockDurationMinutes,
} from '@/lib/planner-types'
import type {
  PlannerBlock,
  PlannerTask,
  PlannerCategory,
  PlannerBlockStatus,
} from '@/lib/planner-types'
import type { Task as AppTask } from '@/lib/db'
import { PlannerContextMenu } from './PlannerContextMenu'
import { TaskEditModal } from './TaskEditModal'
import { dueDateClass } from '@/lib/planner-types'

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const CATEGORIES: PlannerCategory[] = ['deep_work', 'admin', 'client', 'personal', 'travel', 'buffer']
const STATUSES: PlannerBlockStatus[] = ['planned', 'in_progress', 'done', 'skipped']

export function PlannerWeekClient() {
  const router = useRouter()
  const addToast = useToastStore((s) => s.addToast)
  const hydrate = usePlannerBlocksStore((s) => s.hydrate)
  const hydrated = usePlannerBlocksStore((s) => s.hydrated)
  const tasks = usePlannerBlocksStore((s) => s.tasks)
  const storeBlocks = usePlannerBlocksStore((s) => s.blocks)
  const blocksForDay = usePlannerBlocksStore((s) => s.blocksForDay)
  const addTask = usePlannerBlocksStore((s) => s.addTask)
  const removeTask = usePlannerBlocksStore((s) => s.removeTask)
  const scheduleTask = usePlannerBlocksStore((s) => s.scheduleTask)
  const loadRange = usePlannerBlocksStore((s) => s.loadRange)
  const updateBlock = usePlannerBlocksStore((s) => s.updateBlock)
  const removeBlock = usePlannerBlocksStore((s) => s.removeBlock)
  const loadAppTasks = usePlannerBlocksStore((s) => s.loadAppTasks)
  const appTasks = usePlannerBlocksStore((s) => s.appTasks)
  const appProjects = usePlannerBlocksStore((s) => s.appProjects)
  const appTasksForDay = usePlannerBlocksStore((s) => s.appTasksForDay)
  const unscheduledAppTasks = usePlannerBlocksStore((s) => s.unscheduledAppTasks)
  const setAppTaskDone = usePlannerBlocksStore((s) => s.setAppTaskDone)
  const updateAppTask = usePlannerBlocksStore((s) => s.updateAppTask)
  const deleteAppTask = usePlannerBlocksStore((s) => s.deleteAppTask)

  const [mondayIso, setMondayIso] = useState(() => weekStartMonday(todayLocal()))
  const [draftTitle, setDraftTitle] = useState('')
  const [planning, setPlanning] = useState(false)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<
    | { kind: 'block'; blockId: string; x: number; y: number }
    | { kind: 'task'; taskId: string; x: number; y: number }
    | null
  >(null)
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)

  useEffect(() => {
    if (!hydrated) hydrate()
  }, [hydrated, hydrate])

  useEffect(() => {
    loadAppTasks()
  }, [loadAppTasks])

  useEffect(() => {
    const start = mondayIso
    const end = addDays(mondayIso, 6)
    loadRange(start, end)
  }, [mondayIso, loadRange])

  const days = useMemo(() => weekRange(mondayIso), [mondayIso])
  const today = todayLocal()

  const handleShift = (delta: number) => {
    setMondayIso((m) => addDays(m, delta * 7))
  }
  const jumpToThisWeek = () => setMondayIso(weekStartMonday(todayLocal()))

  const handleAddTask = async () => {
    const title = draftTitle.trim()
    if (!title) return
    await addTask({ title })
    setDraftTitle('')
  }

  const unscheduled = tasks.filter((t) => t.status === 'unscheduled')

  const handleDropOnDay = async (e: React.DragEvent, date: string) => {
    e.preventDefault()
    setDragOverDay(null)
    const taskId = e.dataTransfer.getData('text/task-id')
    if (taskId) {
      await scheduleTask(taskId, date, '09:00', '10:00')
      return
    }
    const blockId = e.dataTransfer.getData('text/planner-block-id')
    if (blockId) {
      // Cross-day block move: only change date; preserve time window.
      const existing = usePlannerBlocksStore.getState().blocks.find((b) => b.id === blockId)
      if (!existing) return
      if (existing.date === date) return
      await updateBlock(blockId, { date })
      return
    }
    const appTaskId = e.dataTransfer.getData('text/app-task-id')
    if (appTaskId) {
      // Move a /tasks row to a new due_date (whether it had one or not).
      await updateAppTask(appTaskId, { due_date: date })
    }
  }

  const handlePlanWeek = async () => {
    setPlanning(true)
    try {
      const res = await fetch('/api/planner/plan-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart: mondayIso,
          tasks: unscheduled,
          existingBlocks: days.flatMap((d) => blocksForDay(d)),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as {
        blocks: Array<{
          date: string
          start_time: string
          end_time: string
          title: string
          category: PlannerCategory
          priority?: number
        }>
        tier?: string
        error?: string
      }
      if (data.error) throw new Error(data.error)
      for (const b of data.blocks ?? []) {
        await usePlannerBlocksStore.getState().addBlock(b)
      }
      addToast({ type: 'success', message: `AI proposed ${data.blocks?.length ?? 0} blocks` })
    } catch (err) {
      addToast({ type: 'error', message: 'Plan week failed: ' + (err instanceof Error ? err.message : 'unknown') })
    } finally {
      setPlanning(false)
    }
  }

  const selectedBlock = useMemo(() => {
    if (!selectedBlockId) return null
    for (const d of days) {
      const hit = blocksForDay(d).find((b) => b.id === selectedBlockId)
      if (hit) return hit
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBlockId, days, storeBlocks])

  const mondayLabel = useMemo(() => {
    const a = parseLocalDate(mondayIso)
    const b = parseLocalDate(addDays(mondayIso, 6))
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `${fmt(a)} – ${fmt(b)}`
  }, [mondayIso])

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg1)' }}>
      {/* Top bar: week nav + Plan my week */}
      <div
        className="flex h-11 shrink-0 items-center gap-2 border-b px-4"
        style={{ borderColor: 'var(--border)', background: 'var(--bg0)' }}
      >
        <button
          onClick={() => handleShift(-1)}
          className="rounded p-1 hover:bg-[color:var(--bg2)]"
          style={{ color: 'var(--text2)' }}
          title="Previous week"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={jumpToThisWeek}
          className="rounded px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] hover:bg-[color:var(--bg2)]"
          style={{ color: 'var(--text1)' }}
          title="Jump to this week"
        >
          This week
        </button>
        <button
          onClick={() => handleShift(1)}
          className="rounded p-1 hover:bg-[color:var(--bg2)]"
          style={{ color: 'var(--text2)' }}
          title="Next week"
        >
          <ChevronRight size={16} />
        </button>
        <span className="ml-2 text-[13px] font-medium" style={{ color: 'var(--text0)' }}>
          {mondayLabel}
        </span>
        <div className="ml-auto">
          <button
            onClick={handlePlanWeek}
            disabled={planning}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] transition"
            style={{
              background: 'color-mix(in srgb, var(--accent) 20%, transparent)',
              color: 'var(--text0)',
              opacity: planning ? 0.6 : 1,
            }}
          >
            <Sparkles size={13} />
            {planning ? 'Planning…' : 'Plan my week'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: task bank only */}
        <aside
          className="flex w-[260px] flex-shrink-0 flex-col border-r"
          style={{ borderColor: 'var(--border)', background: 'var(--bg0)' }}
        >
          <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-1">
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTask()
                }}
                placeholder="Quick add task…"
                className="flex-1 rounded-md border px-2 py-1 text-[13px] outline-none"
                style={{ background: 'var(--bg2)', borderColor: 'var(--border)', color: 'var(--text0)' }}
              />
              <button
                onClick={handleAddTask}
                className="rounded-md p-1"
                style={{ color: 'var(--text1)', background: 'var(--bg2)' }}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
            <div
              className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--text3, var(--text2))' }}
            >
              Unscheduled · {unscheduled.length + unscheduledAppTasks().length}
            </div>
            {unscheduled.length === 0 && unscheduledAppTasks().length === 0 && (
              <div className="text-[12px]" style={{ color: 'var(--text2)' }}>
                No unscheduled tasks.
              </div>
            )}
            {unscheduledAppTasks().map((t) => (
              <UnscheduledAppTaskItem
                key={`app-${t.id}`}
                task={t}
                projectName={appProjects.find((p) => p.id === t.projectId)?.name}
                onClick={() => setSelectedTaskId(t.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setContextMenu({ kind: 'task', taskId: t.id, x: e.clientX, y: e.clientY })
                }}
              />
            ))}
            {unscheduled.map((t) => (
              <TaskBankItem key={t.id} task={t} onRemove={() => removeTask(t.id)} />
            ))}
          </div>
        </aside>

        {/* Week grid — horizontally scrollable, each column min 180px */}
        <main className="flex flex-1 overflow-x-auto overflow-y-hidden">
          <div
            className="grid h-full gap-2 p-3"
            style={{
              gridTemplateColumns: 'repeat(7, minmax(180px, 1fr))',
              minWidth: 'max-content',
            }}
          >
            {days.map((d, i) => {
              const dayBlocks = blocksForDay(d)
              const dayTasks = appTasksForDay(d)
              const isToday = d === today
              const isDragTarget = dragOverDay === d
              return (
                <div
                  key={d}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (dragOverDay !== d) setDragOverDay(d)
                  }}
                  onDragLeave={(e) => {
                    // Only clear if leaving the column entirely.
                    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
                      if (dragOverDay === d) setDragOverDay(null)
                    }
                  }}
                  onDrop={(e) => handleDropOnDay(e, d)}
                  className="flex min-w-0 flex-col overflow-hidden rounded-lg border transition"
                  style={{
                    borderColor: isDragTarget
                      ? 'var(--accent)'
                      : isToday
                      ? 'var(--accent)'
                      : 'var(--border)',
                    background: isDragTarget
                      ? 'color-mix(in srgb, var(--accent) 10%, var(--bg0))'
                      : 'var(--bg0)',
                    boxShadow: isDragTarget
                      ? '0 0 0 2px color-mix(in srgb, var(--accent) 40%, transparent)'
                      : undefined,
                  }}
                >
                  <button
                    onClick={() => router.push(`/planner/${d}`)}
                    className="flex items-baseline justify-between border-b px-3 py-2 text-left transition hover:opacity-80"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="flex flex-col">
                      <span
                        className="font-mono text-[10px] uppercase tracking-[0.08em]"
                        style={{ color: isToday ? 'var(--text0)' : 'var(--text2)' }}
                      >
                        {DOW_LABELS[i]}
                      </span>
                      <span className="text-[16px] font-semibold" style={{ color: 'var(--text0)' }}>
                        {parseLocalDate(d).getDate()}
                      </span>
                    </div>
                    <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
                      {dayBlocks.length}
                    </span>
                  </button>
                  <div className="flex flex-col gap-1.5 overflow-y-auto p-2">
                    {dayTasks.map((t) => (
                      <DueTaskPill
                        key={`task-${t.id}`}
                        task={t}
                        projectName={appProjects.find((p) => p.id === t.projectId)?.name}
                        onToggleDone={() => setAppTaskDone(t.id, t.status !== 'Done')}
                        onClick={() => setSelectedTaskId(t.id)}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setContextMenu({ kind: 'task', taskId: t.id, x: e.clientX, y: e.clientY })
                        }}
                      />
                    ))}
                    {dayBlocks.length === 0 && dayTasks.length === 0 ? (
                      <button
                        onClick={() => router.push(`/planner/${d}`)}
                        className="flex items-center justify-center rounded-md border border-dashed py-5 transition hover:opacity-100"
                        style={{
                          borderColor: 'var(--border)',
                          color: 'var(--text2)',
                          opacity: 0.55,
                        }}
                        title="Add blocks for this day"
                      >
                        <Plus size={16} />
                      </button>
                    ) : (
                      dayBlocks.map((b) => (
                        <CompactBlock
                          key={b.id}
                          block={b}
                          onClick={() => setSelectedBlockId(b.id)}
                          onToggleDone={() =>
                            updateBlock(b.id, {
                              status: b.status === 'done' ? 'planned' : 'done',
                            })
                          }
                          onContextMenu={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setContextMenu({ kind: 'block', blockId: b.id, x: e.clientX, y: e.clientY })
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </main>
      </div>

      {/* Block edit modal */}
      {selectedBlock && (
        <BlockEditModal
          block={selectedBlock}
          sameDayBlocks={blocksForDay(selectedBlock.date).filter((b) => b.id !== selectedBlock.id)}
          onClose={() => setSelectedBlockId(null)}
          onPatch={(patch) => updateBlock(selectedBlock.id, patch)}
          onDelete={async () => {
            const id = selectedBlock.id
            setSelectedBlockId(null)
            await removeBlock(id)
          }}
          onSwap={async (otherId) => {
            const other = blocksForDay(selectedBlock.date).find((b) => b.id === otherId)
            if (!other) return
            const a = { start_time: selectedBlock.start_time, end_time: selectedBlock.end_time }
            const b = { start_time: other.start_time, end_time: other.end_time }
            await updateBlock(selectedBlock.id, b)
            await updateBlock(other.id, a)
          }}
        />
      )}

      {/* Right-click context menu */}
      {contextMenu && contextMenu.kind === 'block' && (
        <PlannerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: 'Edit',
              onSelect: () => setSelectedBlockId(contextMenu.blockId),
            },
            {
              label: 'Duplicate',
              onSelect: async () => {
                const src = usePlannerBlocksStore
                  .getState()
                  .blocks.find((b) => b.id === contextMenu.blockId)
                if (!src) return
                await usePlannerBlocksStore.getState().addBlock({
                  date: src.date,
                  start_time: src.start_time,
                  end_time: src.end_time,
                  title: src.title,
                  category: src.category,
                  priority: src.priority,
                  notes: src.notes,
                })
              },
            },
            {
              label: 'Delete',
              danger: true,
              onSelect: () => removeBlock(contextMenu.blockId),
            },
          ]}
        />
      )}

      {contextMenu && contextMenu.kind === 'task' && (
        <PlannerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            { label: 'Edit', onSelect: () => setSelectedTaskId(contextMenu.taskId) },
            {
              label: 'Mark Done',
              onSelect: () => setAppTaskDone(contextMenu.taskId, true),
            },
            {
              label: 'Delete',
              danger: true,
              onSelect: () => deleteAppTask(contextMenu.taskId),
            },
          ]}
        />
      )}

      {selectedTaskId && (() => {
        const t = appTasks.find((x) => x.id === selectedTaskId)
        if (!t) return null
        const p = appProjects.find((pp) => pp.id === t.projectId)
        return (
          <TaskEditModal
            task={t}
            project={p}
            onClose={() => setSelectedTaskId(null)}
            onPatch={(patch) => updateAppTask(t.id, patch)}
            onDelete={async () => {
              const id = t.id
              setSelectedTaskId(null)
              await deleteAppTask(id)
            }}
          />
        )
      })()}

      {/* Invisible subscription helper. */}
      <span className="hidden">{storeBlocks.length}</span>
    </div>
  )
}

function UnscheduledAppTaskItem({
  task,
  projectName,
  onClick,
  onContextMenu,
}: {
  task: AppTask
  projectName: string | undefined
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const pri = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.P3
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/app-task-id', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      role="button"
      tabIndex={0}
      className="group flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-[13px]"
      style={{
        background: 'color-mix(in srgb, var(--bg2) 60%, transparent)',
        borderColor: 'var(--border)',
        color: 'var(--text0)',
      }}
      title="Task with no due date — drag onto a day to schedule"
    >
      <span
        className="h-2 w-2 flex-shrink-0 rounded-full"
        style={{ background: pri }}
        title={task.priority}
      />
      <span className="flex-1 truncate">{task.name}</span>
      {projectName && (
        <span
          className="rounded-[4px] px-1 text-[10px]"
          style={{ background: 'var(--bg3)', color: 'var(--text2)' }}
        >
          {projectName}
        </span>
      )}
    </div>
  )
}

function TaskBankItem({ task, onRemove }: { task: PlannerTask; onRemove: () => void }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/task-id', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className="group flex items-center gap-2 rounded-md border px-2 py-1.5 text-[13px]"
      style={{ background: 'var(--bg2)', borderColor: 'var(--border)', color: 'var(--text0)' }}
    >
      <span className="flex-1 truncate">{task.title}</span>
      <button
        onClick={onRemove}
        className="opacity-0 transition group-hover:opacity-100"
        style={{ color: 'var(--text2)' }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

function CompactBlock({
  block,
  onClick,
  onContextMenu,
  onToggleDone,
}: {
  block: PlannerBlock
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onToggleDone: () => void
}) {
  const colors = CATEGORY_COLORS[block.category]
  const mins = blockDurationMinutes(block)
  const timeLabel = `${block.start_time.slice(0, 5)}–${block.end_time.slice(0, 5)}`
  const isDone = block.status === 'done'
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/planner-block-id', block.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      role="button"
      tabIndex={0}
      className="flex w-full cursor-pointer flex-col gap-1 rounded-md border px-2.5 py-2 text-left transition hover:-translate-y-px hover:shadow-sm"
      style={{
        background: colors.bg,
        borderColor: colors.fg + '55',
        color: 'var(--text0)',
        borderLeft: `3px solid ${colors.fg}`,
        opacity: isDone ? 0.6 : 1,
      }}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={isDone}
          aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
          onClick={(e) => {
            e.stopPropagation()
            onToggleDone()
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-[3px] border transition"
          style={{
            borderColor: colors.fg,
            background: isDone ? colors.fg : 'transparent',
          }}
        >
          {isDone && <Check size={9} strokeWidth={3} style={{ color: '#fff' }} />}
        </button>
        <div
          className="min-w-0 flex-1 truncate text-[12px] font-medium leading-tight"
          style={{
            textDecoration: isDone ? 'line-through' : 'none',
            textDecorationColor: 'var(--text2)',
          }}
        >
          {block.title || 'Untitled'}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tabular-nums" style={{ color: colors.fg }}>
          {timeLabel}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text2)' }}>
          {mins}m
        </span>
      </div>
    </div>
  )
}

// ── Due-task pill ─────────────────────────────────────────────────────────
// Read-only card rendered in the week grid for a `tasks` row whose due_date
// falls on that day. Not draggable to other times (the row owns its date).
// Checking marks the task Done via db.tasks.update.

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'var(--accent)',
  P1: '#fb923c',
  P2: '#facc15',
  P3: 'var(--text3, var(--text2))',
}

function DueTaskPill({
  task,
  projectName,
  onToggleDone,
  onClick,
  onContextMenu,
}: {
  task: AppTask
  projectName: string | undefined
  onToggleDone: () => void
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const isDone = task.status === 'Done'
  const pri = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.P3
  const dueClass = dueDateClass(task.dueDate, isDone)
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/app-task-id', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      role="button"
      tabIndex={0}
      className="group flex w-full cursor-pointer flex-col gap-1 rounded-md border border-dashed px-2.5 py-2 transition hover:-translate-y-px hover:shadow-sm"
      style={{
        background: 'color-mix(in srgb, var(--bg2) 60%, transparent)',
        borderColor: 'var(--border)',
        opacity: isDone ? 0.55 : 1,
      }}
      title="Task from /tasks — click to edit, drag to move"
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={isDone}
          onClick={(e) => {
            e.stopPropagation()
            onToggleDone()
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-[3px] border transition"
          style={{
            borderColor: pri,
            background: isDone ? pri : 'transparent',
          }}
        >
          {isDone && <Check size={9} strokeWidth={3} style={{ color: '#fff' }} />}
        </button>
        <div
          className="min-w-0 flex-1 truncate text-[12px] font-medium leading-tight"
          style={{
            color: 'var(--text0)',
            textDecoration: isDone ? 'line-through' : 'none',
            textDecorationColor: 'var(--text2)',
          }}
        >
          {task.name || 'Untitled'}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="rounded-sm px-1 font-mono text-[9px] uppercase tracking-[0.08em]"
          style={{
            background: 'color-mix(in srgb, var(--bg3) 60%, transparent)',
            color: 'var(--text2)',
          }}
        >
          Task
        </span>
        <span className="font-mono text-[9px] font-semibold" style={{ color: pri }}>
          {task.priority}
        </span>
        {task.dueDate && (
          <span className={`font-mono text-[9px] tabular-nums ${dueClass}`}>
            {task.dueDate.slice(5, 10)}
          </span>
        )}
        {projectName && (
          <span className="ml-auto truncate text-[10px]" style={{ color: 'var(--text2)' }}>
            {projectName}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Block edit modal ──────────────────────────────────────────────────────

interface ModalProps {
  block: PlannerBlock
  sameDayBlocks: PlannerBlock[]
  onClose: () => void
  onPatch: (patch: Partial<PlannerBlock>) => Promise<void> | void
  onDelete: () => void
  onSwap: (otherBlockId: string) => Promise<void>
}

function BlockEditModal({ block, sameDayBlocks, onClose, onPatch, onDelete, onSwap }: ModalProps) {
  const [title, setTitle] = useState(block.title)
  const [category, setCategory] = useState<PlannerCategory>(block.category)
  const [status, setStatus] = useState<PlannerBlockStatus>(block.status)
  const [startTime, setStartTime] = useState(block.start_time.slice(0, 5))
  const [endTime, setEndTime] = useState(block.end_time.slice(0, 5))
  const [notes, setNotes] = useState(block.notes ?? '')
  const [swapTargetId, setSwapTargetId] = useState<string>(sameDayBlocks[0]?.id ?? '')

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
  }, [title, category, status, startTime, endTime, notes])

  const handleSaveAndClose = async () => {
    const patch: Partial<PlannerBlock> = {}
    if (title !== block.title) patch.title = title
    if (category !== block.category) patch.category = category
    if (status !== block.status) patch.status = status
    if (startTime !== block.start_time.slice(0, 5)) patch.start_time = startTime
    if (endTime !== block.end_time.slice(0, 5)) patch.end_time = endTime
    if ((notes || null) !== block.notes) patch.notes = notes || null
    if (Object.keys(patch).length > 0) await onPatch(patch)
    onClose()
  }

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
            Edit block · {block.date}
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
            <span className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text2)' }}>
              Title
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled block"
              className="rounded-md border px-2 py-1.5 text-[13px] outline-none"
              style={{ background: 'var(--bg2)', borderColor: 'var(--border)', color: 'var(--text0)' }}
              autoFocus
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text2)' }}>
                Category
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PlannerCategory)}
                className="rounded-md px-2 py-1.5 text-[12px]"
                style={{ background: 'var(--bg2)', color: 'var(--text0)', border: '1px solid var(--border)' }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_COLORS[c].name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text2)' }}>
                Status
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PlannerBlockStatus)}
                className="rounded-md px-2 py-1.5 text-[12px]"
                style={{ background: 'var(--bg2)', color: 'var(--text0)', border: '1px solid var(--border)' }}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text2)' }}>
                Start
              </span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-md px-2 py-1.5 text-[12px]"
                style={{ background: 'var(--bg2)', color: 'var(--text0)', border: '1px solid var(--border)' }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text2)' }}>
                End
              </span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="rounded-md px-2 py-1.5 text-[12px]"
                style={{ background: 'var(--bg2)', color: 'var(--text0)', border: '1px solid var(--border)' }}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text2)' }}>
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Details, links, context…"
              className="w-full resize-none rounded-md border px-2 py-1.5 text-[12px] outline-none"
              style={{ background: 'var(--bg2)', borderColor: 'var(--border)', color: 'var(--text0)' }}
            />
          </label>

          {sameDayBlocks.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text2)' }}>
                Swap times with
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={swapTargetId}
                  onChange={(e) => setSwapTargetId(e.target.value)}
                  className="flex-1 rounded-md px-2 py-1.5 text-[12px]"
                  style={{ background: 'var(--bg2)', color: 'var(--text0)', border: '1px solid var(--border)' }}
                >
                  {sameDayBlocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title || 'Untitled'} · {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                    </option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    if (swapTargetId) await onSwap(swapTargetId)
                    onClose()
                  }}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px]"
                  style={{ background: 'var(--bg2)', color: 'var(--text0)' }}
                >
                  <ArrowLeftRight size={12} /> Swap
                </button>
              </div>
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
