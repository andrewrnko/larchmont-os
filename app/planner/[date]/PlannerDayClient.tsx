// Day hyperplanner — 30-min time grid, time-blocked schedule, timer, AI.

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FileText,
  Trash2,
  Play,
  Square,
  Lock,
  Repeat,
  Plus,
  ArrowLeftRight,
  Check,
} from 'lucide-react'
import { useTimerStore, useToastStore } from '@/lib/store'
import { usePlannerBlocksStore } from '@/lib/planner-store'
import {
  addDays,
  parseLocalDate,
  todayLocal,
  timeToMinutes,
  minutesToTime,
  blockDurationMinutes,
  CATEGORY_COLORS,
  isVirtualRepeat,
} from '@/lib/planner-types'
import type { PlannerBlock, PlannerCategory, PlannerBlockStatus } from '@/lib/planner-types'
import type { Task as AppTask } from '@/lib/db'
import { PlannerContextMenu } from '../PlannerContextMenu'
import { TaskEditModal } from '../TaskEditModal'
import { dueDateClass } from '@/lib/planner-types'

const DAY_START_HOUR = 7
const DAY_END_HOUR = 20
const SLOT_MINUTES = 30
const SLOT_PX = 36 // height of one 30-min slot (taller for comfort)
const MIN_BLOCK_HEIGHT = 48
const DRAG_SNAP_MINUTES = 15
const DRAG_THRESHOLD_PX = 4

const CATEGORIES: PlannerCategory[] = ['deep_work', 'admin', 'client', 'personal', 'travel', 'buffer']
const STATUS_ORDER: PlannerBlockStatus[] = ['planned', 'in_progress', 'done', 'skipped']

function formatLongDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

function useTick(intervalMs: number) {
  const [, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}

function useElapsed(startedAt: string | null): string {
  const [elapsed, setElapsed] = useState('')
  useEffect(() => {
    if (!startedAt) {
      setElapsed('')
      return
    }
    const update = () => {
      const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
      const h = Math.floor(secs / 3600)
      const m = Math.floor((secs % 3600) / 60)
      const s = secs % 60
      setElapsed(
        h > 0
          ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
          : `${m}:${String(s).padStart(2, '0')}`,
      )
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  return elapsed
}

interface Props {
  date: string
}

export function PlannerDayClient({ date }: Props) {
  const router = useRouter()
  const addToast = useToastStore((s) => s.addToast)
  const hydrate = usePlannerBlocksStore((s) => s.hydrate)
  const hydrated = usePlannerBlocksStore((s) => s.hydrated)
  const storeBlocks = usePlannerBlocksStore((s) => s.blocks)
  const blocksForDay = usePlannerBlocksStore((s) => s.blocksForDay)
  const loadRange = usePlannerBlocksStore((s) => s.loadRange)
  const addBlock = usePlannerBlocksStore((s) => s.addBlock)
  const updateBlock = usePlannerBlocksStore((s) => s.updateBlock)
  const removeBlock = usePlannerBlocksStore((s) => s.removeBlock)
  const setBlockStatus = usePlannerBlocksStore((s) => s.setBlockStatus)
  const startBlockTimer = usePlannerBlocksStore((s) => s.startBlockTimer)
  const stopBlockTimer = usePlannerBlocksStore((s) => s.stopBlockTimer)

  const timerBlockId = useTimerStore((s) => s.activeBlockId)
  const timerStartedAt = useTimerStore((s) => s.startedAt)

  const loadAppTasks = usePlannerBlocksStore((s) => s.loadAppTasks)
  const appTasksForDay = usePlannerBlocksStore((s) => s.appTasksForDay)
  const appProjects = usePlannerBlocksStore((s) => s.appProjects)
  const setAppTaskDone = usePlannerBlocksStore((s) => s.setAppTaskDone)
  const appTasksState = usePlannerBlocksStore((s) => s.appTasks)
  const updateAppTask = usePlannerBlocksStore((s) => s.updateAppTask)
  const deleteAppTask = usePlannerBlocksStore((s) => s.deleteAppTask)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [taskContextMenu, setTaskContextMenu] = useState<{ taskId: string; x: number; y: number } | null>(null)

  useEffect(() => {
    loadAppTasks()
  }, [loadAppTasks])

  // Expanded block state — only one block is editable at a time.
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ blockId: string; x: number; y: number } | null>(null)

  const handleDuplicateBlock = async (blockId: string) => {
    const b = blocks.find((x) => x.id === blockId)
    if (!b) return
    const dur = timeToMinutes(b.end_time) - timeToMinutes(b.start_time)
    const startMin = timeToMinutes(b.end_time)
    const endMin = Math.min(DAY_END_HOUR * 60, startMin + dur)
    if (endMin <= startMin) {
      addToast({ type: 'error', message: 'Not enough room to duplicate before day end' })
      return
    }
    await addBlock({
      date,
      title: b.title,
      category: b.category,
      start_time: minutesToTime(startMin),
      end_time: minutesToTime(endMin),
      priority: b.priority,
      notes: b.notes,
    })
  }
  useEffect(() => {
    if (!expandedBlockId) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest('[data-planner-block]')) return
      if (target.closest('[data-planner-keep-open]')) return
      setExpandedBlockId(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [expandedBlockId])

  useEffect(() => {
    if (!hydrated) hydrate()
  }, [hydrated, hydrate])

  useEffect(() => {
    loadRange(date, date)
  }, [date, loadRange])

  // Force re-render each minute so current-time indicator ticks.
  useTick(60_000)

  const blocks = useMemo(() => {
    return blocksForDay(date).filter((b) => b.status !== 'skipped')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, storeBlocks])

  const dueTasks = useMemo(() => appTasksForDay(date), [date, appTasksForDay, appTasksState])

  const plannedMinutes = blocks.reduce((n, b) => n + blockDurationMinutes(b), 0)
  const actualMinutes = blocks.reduce((n, b) => n + (b.actual_duration_minutes ?? 0), 0)
  const doneCount = blocks.filter((b) => b.status === 'done').length
  const totalCount = blocks.length
  const completionPct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100)

  const handleShiftDay = (delta: number) => {
    router.push(`/planner/${addDays(date, delta)}`)
  }

  const handleSlotClick = async (minutesFromDayStart: number) => {
    const start = DAY_START_HOUR * 60 + minutesFromDayStart
    const end = start + 60
    await addBlock({
      date,
      start_time: minutesToTime(start),
      end_time: minutesToTime(end),
      title: '',
      category: 'deep_work',
    })
  }

  const [nlInput, setNlInput] = useState('')
  const [nlBusy, setNlBusy] = useState(false)
  const handleNaturalLanguage = async () => {
    const text = nlInput.trim()
    if (!text) return
    setNlBusy(true)
    try {
      const res = await fetch('/api/planner/natural-language-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, date }),
      })
      if (!res.ok) throw new Error(await res.text())
      const parsed = (await res.json()) as {
        start_time: string
        end_time: string
        title: string
        category: PlannerCategory
      }
      await addBlock({
        date,
        start_time: parsed.start_time,
        end_time: parsed.end_time,
        title: parsed.title ?? '',
        category: parsed.category ?? 'deep_work',
      })
      setNlInput('')
    } catch (err) {
      addToast({ type: 'error', message: 'Could not parse block: ' + (err instanceof Error ? err.message : 'unknown') })
    } finally {
      setNlBusy(false)
    }
  }

  const [planning, setPlanning] = useState(false)
  const handlePlanDay = async () => {
    setPlanning(true)
    try {
      const res = await fetch('/api/planner/plan-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, existingBlocks: blocks }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as {
        blocks: Array<{
          start_time: string
          end_time: string
          title: string
          category: PlannerCategory
          priority?: number
        }>
        error?: string
      }
      if (data.error) throw new Error(data.error)
      for (const b of data.blocks ?? []) {
        await addBlock({ ...b, date })
      }
      addToast({ type: 'success', message: `AI proposed ${data.blocks?.length ?? 0} blocks` })
    } catch (err) {
      addToast({ type: 'error', message: 'Plan day failed: ' + (err instanceof Error ? err.message : 'unknown') })
    } finally {
      setPlanning(false)
    }
  }

  const [summarizing, setSummarizing] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const handleSummarizeDay = async () => {
    setSummarizing(true)
    try {
      const res = await fetch('/api/planner/summarize-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, blocks }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as { summary: string }
      setSummary(data.summary)
    } catch (err) {
      addToast({ type: 'error', message: 'Summary failed: ' + (err instanceof Error ? err.message : 'unknown') })
    } finally {
      setSummarizing(false)
    }
  }

  const handleAutoArrange = async () => {
    try {
      if (blocks.length === 0) {
        addToast({ type: 'info', message: 'No blocks to arrange' })
        return
      }

      const categoryRank: Record<PlannerCategory, number> = {
        client: 1,
        deep_work: 2,
        admin: 3,
        personal: 4,
        travel: 5,
        buffer: 6,
      }

      const nonLocked = blocks
        .filter((b) => !b.is_locked)
        .slice()
        .sort((a, b) => {
          const p = a.priority - b.priority
          if (p !== 0) return p
          return categoryRank[a.category] - categoryRank[b.category]
        })

      const locked = blocks.filter((b) => b.is_locked)
      const lockedIntervals: Array<[number, number]> = locked
        .map((b) => [timeToMinutes(b.start_time), timeToMinutes(b.end_time)] as [number, number])
        .sort((a, b) => a[0] - b[0])

      // Start cursor from the earliest existing block's start time.
      const earliestStart = Math.min(
        ...blocks.map((b) => timeToMinutes(b.start_time)),
      )
      const dayEndMin = DAY_END_HOUR * 60
      const dayStartMin = DAY_START_HOUR * 60
      let cursor = Math.max(dayStartMin, isFinite(earliestStart) ? earliestStart : dayStartMin)

      let overflowed = 0
      for (const b of nonLocked) {
        const dur = Math.max(15, blockDurationMinutes(b))

        // Advance cursor past any locked interval it collides with.
        let safety = 0
        while (safety++ < 50) {
          const collision = lockedIntervals.find(
            ([s, e]) => cursor < e && cursor + dur > s,
          )
          if (!collision) break
          cursor = collision[1]
        }

        if (cursor + dur > dayEndMin) {
          overflowed++
          continue
        }

        const newStart = minutesToTime(cursor)
        const newEnd = minutesToTime(cursor + dur)
        if (newStart !== b.start_time.slice(0, 5) || newEnd !== b.end_time.slice(0, 5)) {
          await updateBlock(b.id, { start_time: newStart, end_time: newEnd })
        }
        cursor += dur
      }

      if (overflowed > 0) {
        addToast({
          type: 'info',
          message: `Auto-arranged — ${overflowed} block(s) couldn't fit before ${DAY_END_HOUR}:00`,
        })
      } else {
        addToast({ type: 'success', message: 'Auto-arranged by priority' })
      }
    } catch (err) {
      console.error('[auto-arrange] failed', err)
      addToast({
        type: 'error',
        message: 'Auto-arrange failed: ' + (err instanceof Error ? err.message : 'unknown'),
      })
    }
  }

  // Grid layout
  const totalSlots = ((DAY_END_HOUR - DAY_START_HOUR) * 60) / SLOT_MINUTES
  const gridHeight = totalSlots * SLOT_PX
  const gridRef = useRef<HTMLDivElement | null>(null)

  const isToday = date === todayLocal()
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nowOffset = ((nowMinutes - DAY_START_HOUR * 60) / SLOT_MINUTES) * SLOT_PX

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg1)' }}>
      <div
        className="flex h-10 shrink-0 items-center gap-2 border-b px-4"
        style={{ borderColor: 'var(--border)', background: 'var(--bg0)' }}
      >
        <button
          onClick={() => handleShiftDay(-1)}
          className="rounded p-1 hover:bg-[color:var(--bg2)]"
          style={{ color: 'var(--text2)' }}
          title="Previous day"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-[13px] font-medium" style={{ color: 'var(--text0)' }}>
          {formatLongDate(date)}
        </span>
        <button
          onClick={() => handleShiftDay(1)}
          className="rounded p-1 hover:bg-[color:var(--bg2)]"
          style={{ color: 'var(--text2)' }}
          title="Next day"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => router.push(`/planner/${todayLocal()}`)}
          className="rounded px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] hover:bg-[color:var(--bg2)]"
          style={{ color: 'var(--text1)' }}
        >
          Today
        </button>
        <div className="mx-2 h-4 w-px" style={{ background: 'var(--border)' }} />
        <button
          onClick={() => router.push('/planner')}
          className="rounded px-2 py-1 text-[12px] hover:bg-[color:var(--bg2)]"
          style={{ color: 'var(--text1)' }}
        >
          Week view
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleAutoArrange}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px]"
            style={{ background: 'var(--bg2)', color: 'var(--text1)' }}
          >
            <ArrowLeftRight size={12} /> Auto-arrange
          </button>
          <button
            onClick={handlePlanDay}
            disabled={planning}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px]"
            style={{
              background: 'color-mix(in srgb, var(--accent) 20%, transparent)',
              color: 'var(--text0)',
              opacity: planning ? 0.6 : 1,
            }}
          >
            <Sparkles size={12} /> {planning ? 'Planning…' : 'Plan my day'}
          </button>
          <button
            onClick={handleSummarizeDay}
            disabled={summarizing}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px]"
            style={{ background: 'var(--bg2)', color: 'var(--text1)', opacity: summarizing ? 0.6 : 1 }}
          >
            <FileText size={12} /> Summarize
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div
        className="flex items-center gap-4 border-b px-5 py-2 text-[12px]"
        style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
      >
        <span>
          <span style={{ color: 'var(--text0)' }}>{completionPct}%</span> done ({doneCount}/{totalCount})
        </span>
        <span>
          <span style={{ color: 'var(--text0)' }}>{Math.round(plannedMinutes / 60 * 10) / 10}h</span> planned
        </span>
        <span>
          <span style={{ color: 'var(--text0)' }}>{Math.round(actualMinutes / 60 * 10) / 10}h</span> actual
        </span>
      </div>

      {summary && (
        <div
          className="mx-5 my-3 rounded-md border p-3 text-[13px]"
          style={{ background: 'var(--bg2)', borderColor: 'var(--border)', color: 'var(--text1)' }}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text2)' }}>
              EOD summary
            </span>
            <button onClick={() => setSummary(null)} style={{ color: 'var(--text2)' }}>
              ×
            </button>
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{summary}</div>
        </div>
      )}

      {dueTasks.length > 0 && (
        <div
          className="flex shrink-0 flex-wrap items-center gap-2 border-b px-5 py-2"
          style={{ borderColor: 'var(--border)', background: 'var(--bg0)' }}
        >
          <span
            className="font-mono text-[10px] uppercase tracking-[0.08em]"
            style={{ color: 'var(--text2)' }}
          >
            Due today · {dueTasks.length}
          </span>
          {dueTasks.map((t) => (
            <DueTaskRow
              key={t.id}
              task={t}
              projectName={appProjects.find((p) => p.id === t.projectId)?.name}
              onToggleDone={() => setAppTaskDone(t.id, t.status !== 'Done')}
              onClick={() => setSelectedTaskId(t.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setTaskContextMenu({ taskId: t.id, x: e.clientX, y: e.clientY })
              }}
            />
          ))}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Time grid */}
        <div className="relative flex-1 overflow-auto px-5 py-3">
          <div className="flex">
            {/* Hour labels column */}
            <div className="w-14 flex-shrink-0">
              {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => {
                const hour = DAY_START_HOUR + i
                return (
                  <div
                    key={hour}
                    className="relative"
                    style={{ height: SLOT_PX * 2, color: 'var(--text2)' }}
                  >
                    <span className="absolute -top-1.5 right-2 font-mono text-[10px]">
                      {hour.toString().padStart(2, '0')}:00
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Slot grid + absolute-positioned blocks */}
            <div
              ref={gridRef}
              className="relative flex-1 rounded-md border"
              style={{ height: gridHeight, background: 'var(--bg0)', borderColor: 'var(--border)' }}
            >
              {Array.from({ length: totalSlots }, (_, i) => (
                <div
                  key={i}
                  onClick={() => handleSlotClick(i * SLOT_MINUTES)}
                  className="group relative cursor-pointer border-b hover:bg-[color:var(--bg2)]/30"
                  style={{
                    height: SLOT_PX,
                    borderColor: i % 2 === 1 ? 'var(--border)' : 'transparent',
                  }}
                >
                  <span
                    className="pointer-events-none absolute left-1/2 top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full opacity-0 transition group-hover:opacity-70"
                    style={{ background: 'var(--bg2)', color: 'var(--text1)' }}
                  >
                    <Plus size={10} />
                  </span>
                </div>
              ))}

              {/* Current-time indicator */}
              {isToday && nowOffset >= 0 && nowOffset <= gridHeight && (
                <div
                  className="pointer-events-none absolute left-0 right-0"
                  style={{ top: nowOffset }}
                >
                  <div
                    className="h-px w-full"
                    style={{ background: 'var(--accent)' }}
                  />
                  <div
                    className="absolute -left-1 -top-1 h-2 w-2 rounded-full"
                    style={{ background: 'var(--accent)' }}
                  />
                </div>
              )}

              {/* Blocks */}
              {blocks.map((b) => (
                <BlockPill
                  key={b.id}
                  block={b}
                  slotPx={SLOT_PX}
                  dayStartMin={DAY_START_HOUR * 60}
                  dayEndMin={DAY_END_HOUR * 60}
                  expanded={expandedBlockId === b.id}
                  onExpand={() => setExpandedBlockId(b.id)}
                  onCollapse={() => setExpandedBlockId(null)}
                  timerStartedAt={timerBlockId === b.id ? timerStartedAt : null}
                  onUpdate={(patch) => updateBlock(b.id, patch)}
                  onRemove={() => removeBlock(b.id)}
                  onSetStatus={(s) => setBlockStatus(b.id, s)}
                  onStartTimer={() => startBlockTimer(b.id)}
                  onStopTimer={() => stopBlockTimer(b.id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setContextMenu({ blockId: b.id, x: e.clientX, y: e.clientY })
                  }}
                />
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center">
            <button
              onClick={async () => {
                // Place after last block or start of day.
                const lastEnd = blocks.length
                  ? Math.max(...blocks.map((b) => timeToMinutes(b.end_time)))
                  : DAY_START_HOUR * 60
                const start = Math.max(DAY_START_HOUR * 60, lastEnd)
                const end = Math.min(DAY_END_HOUR * 60, start + 60)
                if (end <= start) {
                  addToast({ type: 'error', message: 'No room left before day end' })
                  return
                }
                await addBlock({
                  date,
                  start_time: minutesToTime(start),
                  end_time: minutesToTime(end),
                  title: '',
                  category: 'deep_work',
                })
              }}
              className="flex items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-[12px] transition hover:opacity-100"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text2)',
                background: 'transparent',
              }}
            >
              <Plus size={13} /> Add block
            </button>
          </div>
        </div>
      </div>

      {/* Context menu (planner block) */}
      {contextMenu && (
        <PlannerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: 'Edit',
              onSelect: () => setExpandedBlockId(contextMenu.blockId),
            },
            {
              label: 'Duplicate',
              onSelect: () => handleDuplicateBlock(contextMenu.blockId),
            },
            {
              label: 'Delete',
              danger: true,
              onSelect: () => removeBlock(contextMenu.blockId),
            },
          ]}
        />
      )}

      {/* Context menu (task) */}
      {taskContextMenu && (
        <PlannerContextMenu
          x={taskContextMenu.x}
          y={taskContextMenu.y}
          onClose={() => setTaskContextMenu(null)}
          items={[
            {
              label: 'Edit',
              onSelect: () => setSelectedTaskId(taskContextMenu.taskId),
            },
            {
              label: 'Mark Done',
              onSelect: () => setAppTaskDone(taskContextMenu.taskId, true),
            },
            {
              label: 'Delete',
              danger: true,
              onSelect: () => deleteAppTask(taskContextMenu.taskId),
            },
          ]}
        />
      )}

      {/* Task edit modal */}
      {selectedTaskId && (() => {
        const t = appTasksState.find((x) => x.id === selectedTaskId)
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

      {/* NL input footer */}
      <div
        className="flex items-center gap-2 border-t px-5 py-2"
        style={{ borderColor: 'var(--border)', background: 'var(--bg0)' }}
      >
        <Sparkles size={13} style={{ color: 'var(--accent)' }} />
        <input
          value={nlInput}
          onChange={(e) => setNlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleNaturalLanguage()
          }}
          disabled={nlBusy}
          placeholder="Add a block in plain English — e.g. '2hr deep work at 9am'"
          className="flex-1 rounded-md border px-3 py-1.5 text-[13px] outline-none"
          style={{
            background: 'var(--bg2)',
            borderColor: 'var(--border)',
            color: 'var(--text0)',
            opacity: nlBusy ? 0.6 : 1,
          }}
        />
      </div>
    </div>
  )
}

// ── Individual block pill ──────────────────────────────────────────────────

interface BlockPillProps {
  block: PlannerBlock
  slotPx: number
  dayStartMin: number
  dayEndMin: number
  expanded: boolean
  onExpand: () => void
  onCollapse: () => void
  timerStartedAt: string | null
  onUpdate: (patch: Partial<PlannerBlock>) => void
  onRemove: () => void
  onSetStatus: (s: PlannerBlockStatus) => void
  onStartTimer: () => void
  onStopTimer: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

function BlockPill({
  block,
  slotPx,
  dayStartMin,
  dayEndMin,
  expanded,
  onExpand,
  onCollapse,
  timerStartedAt,
  onUpdate,
  onRemove,
  onSetStatus,
  onStartTimer,
  onStopTimer,
  onContextMenu,
}: BlockPillProps) {
  const elapsed = useElapsed(timerStartedAt)
  const colors = CATEGORY_COLORS[block.category]

  // Visual offset while dragging — nulls out when released.
  const [dragOffsetPx, setDragOffsetPx] = useState<number | null>(null)

  const startMin = timeToMinutes(block.start_time)
  const endMin = timeToMinutes(block.end_time)
  const duration = endMin - startMin
  const naturalHeight = (duration / 30) * slotPx
  const renderHeight = expanded
    ? Math.max(MIN_BLOCK_HEIGHT, naturalHeight, 280)
    : Math.max(MIN_BLOCK_HEIGHT, naturalHeight)
  const baseTop = ((startMin - dayStartMin) / 30) * slotPx
  const top = baseTop + (dragOffsetPx ?? 0)

  const running = Boolean(timerStartedAt)
  const isDone = block.status === 'done'

  const toggleDone = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation()
    onSetStatus(isDone ? 'planned' : 'done')
  }

  // ── Drag-to-move ─────────────────────────────────────────────────────────
  const dragStateRef = useRef<{
    pointerId: number
    startY: number
    committed: boolean
    moved: boolean
  } | null>(null)

  const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only left button.
    if (e.button !== 0) return
    // Don't initiate drag when clicking interactive children.
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('input') || target.closest('select') || target.closest('textarea')) {
      return
    }
    if (block.is_locked) return
    dragStateRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      committed: false,
      moved: false,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragStateRef.current
    if (!s || s.pointerId !== e.pointerId) return
    const dy = e.clientY - s.startY
    if (!s.committed && Math.abs(dy) < DRAG_THRESHOLD_PX) return
    s.committed = true
    s.moved = true
    // Snap the preview to nearest DRAG_SNAP_MINUTES.
    const snapPx = (slotPx / 30) * DRAG_SNAP_MINUTES
    const snapped = Math.round(dy / snapPx) * snapPx
    setDragOffsetPx(snapped)
  }

  const onHeaderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = dragStateRef.current
    if (!s || s.pointerId !== e.pointerId) return
    const moved = s.moved
    const offset = dragOffsetPx ?? 0
    dragStateRef.current = null
    setDragOffsetPx(null)
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {}

    if (!moved) {
      // Treat as click — toggle expansion.
      if (expanded) onCollapse()
      else onExpand()
      return
    }

    if (offset === 0) return
    // Commit the move: convert offset px to minutes, snap, clamp to day.
    const deltaMin = Math.round((offset / slotPx) * 30 / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES
    let newStart = startMin + deltaMin
    let newEnd = endMin + deltaMin
    if (newStart < dayStartMin) {
      const shift = dayStartMin - newStart
      newStart += shift
      newEnd += shift
    }
    if (newEnd > dayEndMin) {
      const shift = newEnd - dayEndMin
      newStart -= shift
      newEnd -= shift
    }
    if (newStart === startMin) return
    onUpdate({ start_time: minutesToTime(newStart), end_time: minutesToTime(newEnd) })
  }

  return (
    <div
      data-planner-block
      onContextMenu={onContextMenu}
      className="group absolute left-1 right-1 overflow-hidden rounded-md border shadow-sm transition-[box-shadow,transform]"
      style={{
        top,
        height: renderHeight,
        // Expanded uses the neutral dark surface so labels and inputs read
        // cleanly; collapsed keeps the category tint for at-a-glance scan.
        background: expanded ? 'var(--bg1)' : colors.bg,
        borderColor: expanded ? 'var(--border)' : colors.fg + '55',
        borderWidth: 1,
        color: 'var(--text0)',
        zIndex: expanded ? 20 : dragOffsetPx != null ? 15 : 1,
        opacity: isDone && !expanded ? 0.6 : 1,
        boxShadow: expanded
          ? '0 8px 24px rgba(0,0,0,0.35)'
          : dragOffsetPx != null
          ? '0 4px 12px rgba(0,0,0,0.4)'
          : undefined,
      }}
    >
      {/* Left category accent bar */}
      <div
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: colors.fg }}
      />
      {/* Header row — drag handle + primary info. Click toggles expand. */}
      <div
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
        className="flex items-center gap-2 pl-3 pr-2.5 py-2 select-none hover:bg-[color:var(--bg1)]/20"
        style={{
          cursor: block.is_locked ? 'default' : dragOffsetPx != null ? 'grabbing' : 'grab',
          minHeight: 40,
        }}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={isDone}
          aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
          onClick={toggleDone}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[4px] border transition"
          style={{
            borderColor: colors.fg,
            background: isDone ? colors.fg : 'transparent',
          }}
          title={`${colors.name} · ${block.status}`}
        >
          {isDone && <Check size={11} strokeWidth={3} style={{ color: '#fff' }} />}
        </button>
        <input
          value={block.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Untitled block"
          className="flex-1 bg-transparent text-[13px] font-medium outline-none placeholder:opacity-50"
          style={{
            color: 'var(--text0)',
            textDecoration: isDone ? 'line-through' : 'none',
            textDecorationColor: 'var(--text2)',
          }}
        />
        {(block.is_repeating || isVirtualRepeat(block.id)) && (
          <Repeat size={12} style={{ color: 'var(--text2)' }} />
        )}
        {block.is_locked && <Lock size={12} style={{ color: 'var(--text2)' }} />}
        <span
          className="font-mono text-[11px] tabular-nums"
          style={{ color: colors.fg }}
        >
          {block.start_time.slice(0, 5)}–{block.end_time.slice(0, 5)}
        </span>
      </div>

      {expanded && (
        <div
          data-planner-keep-open
          className="flex flex-col gap-3 border-t px-3 py-3"
          style={{ borderColor: 'var(--border)', background: 'var(--bg1)' }}
        >
          {/* Row 1: category + status + times */}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text2)' }}>
                Category
              </span>
              <select
                value={block.category}
                onChange={(e) => onUpdate({ category: e.target.value as PlannerCategory })}
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
                value={block.status}
                onChange={(e) => onSetStatus(e.target.value as PlannerBlockStatus)}
                className="rounded-md px-2 py-1.5 text-[12px]"
                style={{ background: 'var(--bg2)', color: 'var(--text0)', border: '1px solid var(--border)' }}
              >
                {STATUS_ORDER.map((s) => (
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
                value={block.start_time.slice(0, 5)}
                onChange={(e) => onUpdate({ start_time: e.target.value })}
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
                value={block.end_time.slice(0, 5)}
                onChange={(e) => onUpdate({ end_time: e.target.value })}
                className="rounded-md px-2 py-1.5 text-[12px]"
                style={{ background: 'var(--bg2)', color: 'var(--text0)', border: '1px solid var(--border)' }}
              />
            </label>
          </div>

          {/* Row 2: notes */}
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text2)' }}>
              Notes
            </span>
            <textarea
              value={block.notes ?? ''}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="Details, links, context…"
              rows={3}
              className="w-full resize-none rounded-md border px-2 py-1.5 text-[12px] outline-none"
              style={{ background: 'var(--bg2)', borderColor: 'var(--border)', color: 'var(--text0)' }}
            />
          </label>

          {/* Row 3: toggles + timer + delete */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onUpdate({ is_locked: !block.is_locked })}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
              style={{
                background: block.is_locked ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'var(--bg2)',
                color: block.is_locked ? 'var(--text0)' : 'var(--text1)',
              }}
            >
              <Lock size={12} /> {block.is_locked ? 'Locked' : 'Lock'}
            </button>
            <button
              onClick={() =>
                onUpdate({
                  is_repeating: !block.is_repeating,
                  repeat_days: !block.is_repeating ? [1, 2, 3, 4, 5] : [],
                  repeat_start_date: !block.is_repeating ? block.date : null,
                })
              }
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
              style={{
                background: block.is_repeating ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'var(--bg2)',
                color: block.is_repeating ? 'var(--text0)' : 'var(--text1)',
              }}
            >
              <Repeat size={12} /> {block.is_repeating ? 'Repeating' : 'Repeat'}
            </button>
            {running ? (
              <button
                onClick={onStopTimer}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
                style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                <Square size={11} /> {elapsed}
              </button>
            ) : (
              <button
                onClick={onStartTimer}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
                style={{ background: 'var(--bg2)', color: 'var(--text0)' }}
              >
                <Play size={11} /> Start timer
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              {block.actual_duration_minutes != null && (
                <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
                  Actual {block.actual_duration_minutes}m · Planned {blockDurationMinutes(block)}m
                </span>
              )}
              <button
                onClick={onRemove}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
                style={{ background: 'var(--bg2)', color: '#ef6850' }}
              >
                <Trash2 size={11} /> Delete
              </button>
            </div>
          </div>

          {block.is_repeating && (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--text2)' }}>
                Repeat on
              </span>
              <div className="flex items-center gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => {
                  const on = block.repeat_days.includes(i)
                  return (
                    <button
                      key={d}
                      onClick={() => {
                        const next = on
                          ? block.repeat_days.filter((x) => x !== i)
                          : [...block.repeat_days, i].sort()
                        onUpdate({ repeat_days: next })
                      }}
                      className="rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wide"
                      style={{
                        background: on ? 'var(--accent)' : 'var(--bg2)',
                        color: on ? 'var(--accent-fg)' : 'var(--text1)',
                      }}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Due-task row (day view banner) ────────────────────────────────────────
// Read-only chip for a `tasks` row whose due_date matches this day. Checkbox
// marks the task Done via db.tasks.update.

const DUE_TASK_PRIORITY: Record<string, string> = {
  P0: 'var(--accent)',
  P1: '#fb923c',
  P2: '#facc15',
  P3: 'var(--text3, var(--text2))',
}

function DueTaskRow({
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
  const pri = DUE_TASK_PRIORITY[task.priority] ?? DUE_TASK_PRIORITY.P3
  const dueClass = dueDateClass(task.dueDate, isDone)
  return (
    <div
      draggable
      onDragStart={(e) => {
        // Display-order only in the day view, but we still expose the id so
        // the week-view drop handler can relocate if this bubbles up.
        e.dataTransfer.setData('text/app-task-id', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      role="button"
      tabIndex={0}
      className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-2.5 py-1 transition hover:-translate-y-px hover:shadow-sm"
      style={{
        background: 'color-mix(in srgb, var(--bg2) 60%, transparent)',
        borderColor: 'var(--border)',
        opacity: isDone ? 0.55 : 1,
      }}
      title="Task from /tasks — click to edit"
    >
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
      <span
        className="text-[12px] font-medium"
        style={{
          color: 'var(--text0)',
          textDecoration: isDone ? 'line-through' : 'none',
          textDecorationColor: 'var(--text2)',
        }}
      >
        {task.name || 'Untitled'}
      </span>
      <span
        className="rounded-sm px-1 font-mono text-[9px] uppercase tracking-[0.08em]"
        style={{
          background: 'color-mix(in srgb, var(--bg3) 60%, transparent)',
          color: 'var(--text2)',
        }}
      >
        Task
      </span>
      <span className="font-mono text-[10px] font-semibold" style={{ color: pri }}>
        {task.priority}
      </span>
      {task.dueDate && (
        <span className={`font-mono text-[10px] tabular-nums ${dueClass}`}>
          {task.dueDate.slice(5, 10)}
        </span>
      )}
      {projectName && (
        <span className="ml-auto truncate text-[11px]" style={{ color: 'var(--text2)' }}>
          {projectName}
        </span>
      )}
    </div>
  )
}
