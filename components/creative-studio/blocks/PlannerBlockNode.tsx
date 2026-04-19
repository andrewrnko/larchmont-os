// Planner canvas node — compact launcher card + fullscreen modal.
//
// The node on the canvas is a small 280×160 card summarising the week. Click
// opens a fullscreen modal (portalled to document.body) that hosts the full
// week view and, on demand, a day time-grid. All data flows through the
// shared usePlannerBlocksStore so edits mirror /planner and /planner/[date]
// instantly.

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useCanvasStore } from '../store'
import { BlockWrapper } from '../BlockWrapper'
import type { PlannerBlockNode } from '../types'
import { usePlannerBlocksStore } from '@/lib/planner-store'
import { useToastStore } from '@/lib/store'
import {
  CATEGORY_COLORS,
  addDays,
  blockDurationMinutes,
  dueDateClass,
  minutesToTime,
  parseLocalDate,
  timeToMinutes,
  todayLocal,
  weekRange,
  weekStartMonday,
  formatTo12h,
} from '@/lib/planner-types'
import type {
  PlannerBlock,
  PlannerBlockStatus,
  PlannerCategory,
} from '@/lib/planner-types'
import type { Task as AppTask } from '@/lib/db'
import { PlannerBlockEditor } from '@/app/planner/PlannerBlockEditor'
import { PlannerContextMenu } from '@/app/planner/PlannerContextMenu'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const CARD_W = 280
const CARD_H = 160
// Time grid (day view inside modal)
const DAY_START_HOUR = 7
const DAY_END_HOUR = 20
const SLOT_MINUTES = 30
const SLOT_PX = 32
const MIN_BLOCK_HEIGHT = 42

interface Props {
  block: PlannerBlockNode
  onContextMenu?: (e: React.MouseEvent) => void
}

// ── Canvas card ───────────────────────────────────────────────────────────

export function PlannerBlockNodeView({ block, onContextMenu }: Props) {
  const updateCanvasBlock = useCanvasStore((s) => s.updateBlock)
  const hydrate = usePlannerBlocksStore((s) => s.hydrate)
  const hydrated = usePlannerBlocksStore((s) => s.hydrated)
  const loadAppTasks = usePlannerBlocksStore((s) => s.loadAppTasks)
  const appTasksLoaded = usePlannerBlocksStore((s) => s.appTasksLoaded)
  const storeBlocks = usePlannerBlocksStore((s) => s.blocks)
  const appTasks = usePlannerBlocksStore((s) => s.appTasks)
  const blocksForDay = usePlannerBlocksStore((s) => s.blocksForDay)
  const appTasksForDay = usePlannerBlocksStore((s) => s.appTasksForDay)

  // One-time normalise: the prior PlannerBlockNode default was 420×520. Shrink
  // existing-board nodes to the new launcher-card dimensions on first render.
  const didNormRef = useRef(false)
  useEffect(() => {
    if (didNormRef.current) return
    didNormRef.current = true
    if (block.w === 420 && block.h === 520) {
      updateCanvasBlock(block.id, { w: CARD_W, h: CARD_H })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated) hydrate()
  }, [hydrated, hydrate])
  useEffect(() => {
    if (!appTasksLoaded) loadAppTasks()
  }, [appTasksLoaded, loadAppTasks])

  const today = todayLocal()
  const mondayIso = weekStartMonday(today)
  const days = useMemo(() => weekRange(mondayIso), [mondayIso])

  const dayTones = useMemo(
    () =>
      days.map((d) => {
        const tasks = appTasksForDay(d)
        if (tasks.length === 0) return 'gray' as const
        if (d < today) return 'red' as const
        if (d === today) return 'amber' as const
        return 'green' as const
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days, today, appTasks, storeBlocks],
  )

  const taskCount = useMemo(
    () => days.reduce((n, d) => n + appTasksForDay(d).length, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days, appTasks],
  )
  const blockCount = useMemo(
    () => days.reduce((n, d) => n + blocksForDay(d).length, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days, storeBlocks],
  )

  const [modalOpen, setModalOpen] = useState(false)
  const openModal = () => setModalOpen(true)
  const closeModal = () => setModalOpen(false)

  return (
    <BlockWrapper block={block} kind="planner-block" onContextMenu={onContextMenu}>
      <div
        onClick={openModal}
        className="flex h-full w-full cursor-pointer flex-col gap-2 overflow-hidden rounded-lg border p-3 shadow-sm transition hover:shadow-md"
        style={{ background: 'var(--bg1)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <CalendarRange size={14} style={{ color: 'var(--accent)' }} />
          <span
            className="font-mono text-[11px] uppercase tracking-[0.06em]"
            style={{ color: 'var(--text1)' }}
          >
            Planner
          </span>
          <span className="ml-auto text-[11px]" style={{ color: 'var(--text2)' }}>
            {parseLocalDate(today).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1">
          {days.map((d, i) => {
            const tone = dayTones[i]
            const color =
              tone === 'red'
                ? '#ef4444'
                : tone === 'amber'
                ? '#fb923c'
                : tone === 'green'
                ? '#52a96a'
                : 'var(--border)'
            const isToday = d === today
            return (
              <div key={d} className="flex flex-1 flex-col items-center gap-1">
                <span
                  className="font-mono text-[9px] uppercase"
                  style={{ color: isToday ? 'var(--accent)' : 'var(--text2)' }}
                >
                  {DOW[i]}
                </span>
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    background: color,
                    outline: isToday ? `1px solid var(--accent)` : 'none',
                    outlineOffset: isToday ? 1 : 0,
                  }}
                />
              </div>
            )
          })}
        </div>
        <div className="text-[11px]" style={{ color: 'var(--text2)' }}>
          {taskCount} tasks due this week · {blockCount} blocks planned
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            openModal()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-auto w-full rounded-md py-1.5 text-[12px] font-medium"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          Open Planner
        </button>
      </div>

      {modalOpen && <PlannerModal onClose={closeModal} />}
    </BlockWrapper>
  )
}

// ── Fullscreen modal ──────────────────────────────────────────────────────

function PlannerModal({ onClose }: { onClose: () => void }) {
  const today = todayLocal()
  const [mondayIso, setMondayIso] = useState(() => weekStartMonday(today))
  const [view, setView] = useState<'week' | 'day'>('week')
  const [activeDay, setActiveDay] = useState(today)
  const [editorBlockId, setEditorBlockId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<
    { blockId: string; x: number; y: number } | null
  >(null)
  const [planning, setPlanning] = useState(false)
  const [draftTask, setDraftTask] = useState('')

  const addToast = useToastStore((s) => s.addToast)
  const storeBlocks = usePlannerBlocksStore((s) => s.blocks)
  const appTasks = usePlannerBlocksStore((s) => s.appTasks)
  const appProjects = usePlannerBlocksStore((s) => s.appProjects)
  const blocksForDay = usePlannerBlocksStore((s) => s.blocksForDay)
  const appTasksForDay = usePlannerBlocksStore((s) => s.appTasksForDay)
  const unscheduledAppTasks = usePlannerBlocksStore((s) => s.unscheduledAppTasks)
  const addBlock = usePlannerBlocksStore((s) => s.addBlock)
  const updateBlock = usePlannerBlocksStore((s) => s.updateBlock)
  const removeBlock = usePlannerBlocksStore((s) => s.removeBlock)
  const setBlockStatus = usePlannerBlocksStore((s) => s.setBlockStatus)
  const setAppTaskDone = usePlannerBlocksStore((s) => s.setAppTaskDone)
  const updateAppTask = usePlannerBlocksStore((s) => s.updateAppTask)
  const addTask = usePlannerBlocksStore((s) => s.addTask)
  const plannerTasks = usePlannerBlocksStore((s) => s.tasks)

  const days = useMemo(() => weekRange(mondayIso), [mondayIso])
  const weekRangeLabel = useMemo(() => {
    const a = parseLocalDate(mondayIso)
    const b = parseLocalDate(addDays(mondayIso, 6))
    const f = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `${f(a)} – ${f(b)}`
  }, [mondayIso])

  const editorBlock = useMemo(
    () => storeBlocks.find((b) => b.id === editorBlockId) ?? null,
    [storeBlocks, editorBlockId],
  )

  // Escape closes modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // If something sub-modal is open, let that handle Escape.
      if (editorBlockId) return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, editorBlockId])

  const shiftWeek = (delta: number) => setMondayIso((m) => addDays(m, delta * 7))
  const jumpToday = () => {
    setMondayIso(weekStartMonday(today))
    setActiveDay(today)
  }

  const onDayClick = (d: string) => {
    setActiveDay(d)
    setView('day')
  }
  const backToWeek = () => setView('week')

  const handleDrop = async (e: React.DragEvent, date: string) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/task-id')
    if (taskId) {
      await usePlannerBlocksStore.getState().scheduleTask(taskId, date, '09:00', '10:00')
      return
    }
    const blockId = e.dataTransfer.getData('text/planner-block-id')
    if (blockId) {
      const existing = usePlannerBlocksStore.getState().blocks.find((b) => b.id === blockId)
      if (existing && existing.date !== date) await updateBlock(blockId, { date })
      return
    }
    const appTaskId = e.dataTransfer.getData('text/app-task-id')
    if (appTaskId) await updateAppTask(appTaskId, { due_date: date })
  }

  const handlePlanWeek = async () => {
    setPlanning(true)
    try {
      const res = await fetch('/api/planner/plan-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart: mondayIso,
          tasks: plannerTasks.filter((t) => t.status === 'unscheduled'),
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
        error?: string
      }
      if (data.error) throw new Error(data.error)
      for (const b of data.blocks ?? []) await addBlock(b)
      addToast({ type: 'success', message: `AI proposed ${data.blocks?.length ?? 0} blocks` })
    } catch (err) {
      addToast({
        type: 'error',
        message: 'Plan week failed: ' + (err instanceof Error ? err.message : 'unknown'),
      })
    } finally {
      setPlanning(false)
    }
  }

  const handleQuickAddTask = async () => {
    const title = draftTask.trim()
    if (!title) return
    await addTask({ title })
    setDraftTask('')
  }

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ background: 'var(--bg1)' }}
      onMouseDown={(e) => {
        // Keep clicks inside the modal from hitting canvas behind it.
        e.stopPropagation()
      }}
    >
      {/* Top bar */}
      <div
        className="flex h-12 shrink-0 items-center gap-3 border-b px-4"
        style={{ borderColor: 'var(--border)', background: 'var(--bg0)' }}
      >
        <CalendarRange size={15} style={{ color: 'var(--accent)' }} />
        <span className="text-[14px] font-semibold" style={{ color: 'var(--text0)' }}>
          Planner
        </span>
        {view === 'day' && (
          <button
            onClick={backToWeek}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] hover:bg-[color:var(--bg2)]"
            style={{ color: 'var(--text1)' }}
          >
            <ArrowLeft size={12} /> Week
          </button>
        )}

        <div className="mx-auto flex items-center gap-1.5">
          <button
            onClick={() => shiftWeek(-1)}
            className="rounded p-1 hover:bg-[color:var(--bg2)]"
            style={{ color: 'var(--text2)' }}
            title="Previous week"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={jumpToday}
            className="rounded px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] hover:bg-[color:var(--bg2)]"
            style={{ color: 'var(--text1)' }}
          >
            This week
          </button>
          <button
            onClick={() => shiftWeek(1)}
            className="rounded p-1 hover:bg-[color:var(--bg2)]"
            style={{ color: 'var(--text2)' }}
            title="Next week"
          >
            <ChevronRight size={14} />
          </button>
          <span className="ml-2 text-[12px]" style={{ color: 'var(--text0)' }}>
            {weekRangeLabel}
          </span>
        </div>

        <button
          onClick={jumpToday}
          className="rounded-md px-2 py-1 text-[12px]"
          style={{ background: 'var(--bg2)', color: 'var(--text1)' }}
        >
          Today
        </button>
        <button
          onClick={handlePlanWeek}
          disabled={planning}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px]"
          style={{
            background: 'color-mix(in srgb, var(--accent) 20%, transparent)',
            color: 'var(--text0)',
            opacity: planning ? 0.6 : 1,
          }}
        >
          <Sparkles size={12} /> {planning ? 'Planning…' : 'Plan my week'}
        </button>
        <button
          onClick={onClose}
          className="rounded p-1 hover:bg-[color:var(--bg2)]"
          style={{ color: 'var(--text2)' }}
          title="Close (Esc)"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      {view === 'week' ? (
        <div className="flex min-h-0 flex-1">
          {/* Sidebar */}
          <aside
            className="flex w-[240px] shrink-0 flex-col border-r"
            style={{ borderColor: 'var(--border)', background: 'var(--bg0)' }}
          >
            <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <div
                className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--text2)' }}
              >
                {weekRangeLabel}
              </div>
              <div className="flex items-center gap-1">
                <input
                  value={draftTask}
                  onChange={(e) => setDraftTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleQuickAddTask()
                  }}
                  placeholder="Quick add task…"
                  className="flex-1 rounded-md border px-2 py-1 text-[12px] outline-none"
                  style={{
                    background: 'var(--bg2)',
                    borderColor: 'var(--border)',
                    color: 'var(--text0)',
                  }}
                />
                <button
                  onClick={handleQuickAddTask}
                  className="rounded-md p-1"
                  style={{ color: 'var(--text1)', background: 'var(--bg2)' }}
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
              <div
                className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--text2)' }}
              >
                Unscheduled · {unscheduledAppTasks().length + plannerTasks.filter((t) => t.status === 'unscheduled').length}
              </div>
              {unscheduledAppTasks().length === 0 &&
                plannerTasks.filter((t) => t.status === 'unscheduled').length === 0 && (
                  <div className="text-[12px]" style={{ color: 'var(--text2)' }}>
                    No unscheduled tasks.
                  </div>
                )}
              {unscheduledAppTasks().map((t) => (
                <div
                  key={`a-${t.id}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/app-task-id', t.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  className="flex items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-[12px]"
                  style={{
                    background: 'color-mix(in srgb, var(--bg2) 60%, transparent)',
                    borderColor: 'var(--border)',
                    color: 'var(--text0)',
                  }}
                  title="Drag onto a day to schedule"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: priorityColor(t.priority) }}
                  />
                  <span className="flex-1 truncate">{t.name}</span>
                </div>
              ))}
              {plannerTasks
                .filter((t) => t.status === 'unscheduled')
                .map((t) => (
                  <div
                    key={`p-${t.id}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/task-id', t.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-[12px]"
                    style={{
                      background: 'var(--bg2)',
                      borderColor: 'var(--border)',
                      color: 'var(--text0)',
                    }}
                    title="Drag onto a day to schedule"
                  >
                    <span className="flex-1 truncate">{t.title}</span>
                  </div>
                ))}
            </div>
          </aside>

          {/* Week grid */}
          <main className="flex min-h-0 flex-1 overflow-x-auto">
            <div
              className="grid h-full gap-2 p-3"
              style={{ gridTemplateColumns: 'repeat(7, minmax(180px, 1fr))', minWidth: 'max-content' }}
            >
              {days.map((d, i) => {
                const dayBlocks = blocksForDay(d)
                const dayTasks = appTasksForDay(d)
                const isToday = d === today
                return (
                  <div
                    key={d}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, d)}
                    className="flex min-w-0 flex-col overflow-hidden rounded-lg border"
                    style={{
                      borderColor: isToday ? 'var(--accent)' : 'var(--border)',
                      background: isToday
                        ? 'color-mix(in srgb, var(--accent) 10%, var(--bg0))'
                        : 'var(--bg0)',
                    }}
                  >
                    <button
                      onClick={() => onDayClick(d)}
                      className="flex items-baseline justify-between border-b px-3 py-2 text-left hover:opacity-80"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <div className="flex flex-col">
                        <span
                          className="font-mono text-[10px] uppercase tracking-[0.08em]"
                          style={{ color: isToday ? 'var(--text0)' : 'var(--text2)' }}
                        >
                          {DOW[i]}
                        </span>
                        <span
                          className="text-[16px] font-semibold"
                          style={{ color: 'var(--text0)' }}
                        >
                          {parseLocalDate(d).getDate()}
                        </span>
                      </div>
                      <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
                        {dayBlocks.length + dayTasks.length}
                      </span>
                    </button>
                    <div className="flex flex-col gap-1.5 overflow-y-auto p-2">
                      {dayTasks.map((t) => (
                        <DueTaskCard
                          key={`dt-${t.id}`}
                          task={t}
                          projectName={appProjects.find((p) => p.id === t.projectId)?.name}
                          onToggleDone={() =>
                            setAppTaskDone(t.id, t.status !== 'Done')
                          }
                        />
                      ))}
                      {dayBlocks.map((b) => (
                        <BlockCard
                          key={b.id}
                          block={b}
                          onClick={() => setEditorBlockId(b.id)}
                          onToggleDone={() =>
                            setBlockStatus(b.id, b.status === 'done' ? 'planned' : 'done')
                          }
                        />
                      ))}
                      {dayBlocks.length === 0 && dayTasks.length === 0 && (
                        <button
                          onClick={() => onDayClick(d)}
                          className="flex items-center justify-center rounded-md border border-dashed py-5"
                          style={{
                            borderColor: 'var(--border)',
                            color: 'var(--text2)',
                            opacity: 0.55,
                          }}
                        >
                          <Plus size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </main>
        </div>
      ) : (
        <DayGrid
          date={activeDay}
          shiftDay={(delta) => setActiveDay((d) => addDays(d, delta))}
          today={today}
          blocks={blocksForDay(activeDay).filter((b) => b.status !== 'skipped')}
          dueTasks={appTasksForDay(activeDay)}
          projectName={(pid) => appProjects.find((p) => p.id === pid)?.name}
          onBlockClick={(id) => setEditorBlockId(id)}
          onBlockContextMenu={(id, x, y) => setContextMenu({ blockId: id, x, y })}
          onToggleBlockDone={(id, done) => setBlockStatus(id, done ? 'done' : 'planned')}
          onToggleTaskDone={(t) => setAppTaskDone(t.id, t.status !== 'Done')}
          onAddBlock={async (start_time, end_time) => {
            await addBlock({
              date: activeDay,
              start_time,
              end_time,
              title: '',
              category: 'deep_work',
            })
          }}
        />
      )}

      {/* Block editor popup */}
      {editorBlock &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setEditorBlockId(null)
            }}
          >
            <div
              className="w-[440px] max-w-[92vw] overflow-hidden rounded-lg border shadow-xl"
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
                  Edit block · {editorBlock.date}
                </span>
                <button
                  onClick={() => setEditorBlockId(null)}
                  className="rounded p-1 hover:bg-[color:var(--bg2)]"
                  style={{ color: 'var(--text2)' }}
                >
                  <X size={14} />
                </button>
              </div>
              <PlannerBlockEditor
                block={editorBlock}
                onUpdate={(patch) => updateBlock(editorBlock.id, patch)}
                onRemove={async () => {
                  const id = editorBlock.id
                  setEditorBlockId(null)
                  await removeBlock(id)
                }}
                onSetStatus={(s: PlannerBlockStatus) => setBlockStatus(editorBlock.id, s)}
              />
            </div>
          </div>,
          document.body,
        )}

      {contextMenu && (
        <PlannerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: 'Edit',
              onSelect: () => setEditorBlockId(contextMenu.blockId),
            },
            {
              label: 'Delete',
              danger: true,
              onSelect: () => removeBlock(contextMenu.blockId),
            },
          ]}
        />
      )}
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}

// ── Week column cards ─────────────────────────────────────────────────────

function BlockCard({
  block,
  onClick,
  onToggleDone,
}: {
  block: PlannerBlock
  onClick: () => void
  onToggleDone: () => void
}) {
  const c = CATEGORY_COLORS[block.category]
  const isDone = block.status === 'done'
  const mins = blockDurationMinutes(block)
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/planner-block-id', block.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onClick}
      className="flex cursor-pointer flex-col gap-1 rounded-md border px-2.5 py-2 transition hover:-translate-y-px hover:shadow-sm"
      style={{
        background: c.bg,
        borderColor: c.fg + '55',
        borderLeft: `3px solid ${c.fg}`,
        opacity: isDone ? 0.6 : 1,
      }}
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
          className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-[3px] border"
          style={{ borderColor: c.fg, background: isDone ? c.fg : 'transparent' }}
        >
          {isDone && <Check size={9} strokeWidth={3} style={{ color: '#fff' }} />}
        </button>
        <div
          className="min-w-0 flex-1 truncate text-[12px] font-medium leading-tight"
          style={{
            color: 'var(--text0)',
            textDecoration: isDone ? 'line-through' : 'none',
          }}
        >
          {block.title || 'Untitled'}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tabular-nums" style={{ color: c.fg }}>
          {formatTo12h(block.start_time)}–{formatTo12h(block.end_time)}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text2)' }}>
          {mins}m
        </span>
      </div>
    </div>
  )
}

function DueTaskCard({
  task,
  projectName,
  onToggleDone,
}: {
  task: AppTask
  projectName: string | undefined
  onToggleDone: () => void
}) {
  const isDone = task.status === 'Done'
  const pri = priorityColor(task.priority)
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/app-task-id', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className="flex flex-col gap-1 rounded-md border border-dashed px-2.5 py-2"
      style={{
        background: 'color-mix(in srgb, var(--bg2) 60%, transparent)',
        borderColor: 'var(--border)',
        opacity: isDone ? 0.55 : 1,
      }}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleDone()
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-[3px] border"
          style={{ borderColor: pri, background: isDone ? pri : 'transparent' }}
        >
          {isDone && <Check size={9} strokeWidth={3} style={{ color: '#fff' }} />}
        </button>
        <span
          className="min-w-0 flex-1 truncate text-[12px] font-medium"
          style={{
            color: 'var(--text0)',
            textDecoration: isDone ? 'line-through' : 'none',
          }}
        >
          {task.name || 'Untitled'}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="rounded-sm px-1 font-mono text-[9px] uppercase tracking-[0.08em]"
          style={{ background: 'var(--bg3)', color: 'var(--text2)' }}
        >
          Task
        </span>
        <span className="font-mono text-[9px] font-semibold" style={{ color: pri }}>
          {task.priority}
        </span>
        {task.dueDate && (
          <span
            className={`font-mono text-[9px] tabular-nums ${dueDateClass(
              task.dueDate,
              isDone,
            )}`}
          >
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

// ── Day time grid (inside modal) ──────────────────────────────────────────

function DayGrid({
  date,
  today,
  shiftDay,
  blocks,
  dueTasks,
  projectName,
  onBlockClick,
  onBlockContextMenu,
  onToggleBlockDone,
  onToggleTaskDone,
  onAddBlock,
}: {
  date: string
  today: string
  shiftDay: (delta: number) => void
  blocks: PlannerBlock[]
  dueTasks: AppTask[]
  projectName: (projectId: string | null) => string | undefined
  onBlockClick: (id: string) => void
  onBlockContextMenu: (id: string, x: number, y: number) => void
  onToggleBlockDone: (id: string, done: boolean) => void
  onToggleTaskDone: (task: AppTask) => void
  onAddBlock: (start_time: string, end_time: string) => Promise<void>
}) {
  const totalSlots = ((DAY_END_HOUR - DAY_START_HOUR) * 60) / SLOT_MINUTES
  const gridHeight = totalSlots * SLOT_PX
  const isToday = date === today
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nowOffset = ((nowMinutes - DAY_START_HOUR * 60) / SLOT_MINUTES) * SLOT_PX

  const dateLabel = parseLocalDate(date).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  const handleSlotClick = (slotIndex: number) => {
    const start = DAY_START_HOUR * 60 + slotIndex * SLOT_MINUTES
    const end = start + 60
    if (end > DAY_END_HOUR * 60) return
    onAddBlock(minutesToTime(start), minutesToTime(end))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Day sub-header */}
      <div
        className="flex shrink-0 items-center gap-2 border-b px-4 py-2"
        style={{ borderColor: 'var(--border)', background: 'var(--bg0)' }}
      >
        <button
          onClick={() => shiftDay(-1)}
          className="rounded p-1 hover:bg-[color:var(--bg2)]"
          style={{ color: 'var(--text2)' }}
        >
          <ChevronLeft size={14} />
        </button>
        <span
          className="text-[13px] font-medium"
          style={{ color: isToday ? 'var(--accent)' : 'var(--text0)' }}
        >
          {dateLabel}
        </span>
        <button
          onClick={() => shiftDay(1)}
          className="rounded p-1 hover:bg-[color:var(--bg2)]"
          style={{ color: 'var(--text2)' }}
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Due-today banner */}
      {dueTasks.length > 0 && (
        <div
          className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2"
          style={{ borderColor: 'var(--border)', background: 'var(--bg0)' }}
        >
          <span
            className="font-mono text-[10px] uppercase tracking-[0.08em]"
            style={{ color: 'var(--text2)' }}
          >
            Due · {dueTasks.length}
          </span>
          {dueTasks.map((t) => {
            const isDone = t.status === 'Done'
            const pri = priorityColor(t.priority)
            return (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1"
                style={{
                  background: 'color-mix(in srgb, var(--bg2) 60%, transparent)',
                  borderColor: 'var(--border)',
                  opacity: isDone ? 0.55 : 1,
                }}
              >
                <button
                  type="button"
                  onClick={() => onToggleTaskDone(t)}
                  className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border"
                  style={{ borderColor: pri, background: isDone ? pri : 'transparent' }}
                >
                  {isDone && <Check size={9} strokeWidth={3} style={{ color: '#fff' }} />}
                </button>
                <span
                  className="text-[12px] font-medium"
                  style={{
                    color: 'var(--text0)',
                    textDecoration: isDone ? 'line-through' : 'none',
                  }}
                >
                  {t.name}
                </span>
                <span className="font-mono text-[10px] font-semibold" style={{ color: pri }}>
                  {t.priority}
                </span>
                {projectName(t.projectId) && (
                  <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
                    {projectName(t.projectId)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Time grid */}
      <div className="relative flex-1 overflow-auto px-5 py-3">
        <div className="flex">
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

          <div
            className="relative flex-1 rounded-md border"
            style={{ height: gridHeight, background: 'var(--bg0)', borderColor: 'var(--border)' }}
          >
            {Array.from({ length: totalSlots }, (_, i) => (
              <div
                key={i}
                onClick={() => handleSlotClick(i)}
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

            {isToday && nowOffset >= 0 && nowOffset <= gridHeight && (
              <div
                className="pointer-events-none absolute left-0 right-0"
                style={{ top: nowOffset }}
              >
                <div className="h-px w-full" style={{ background: 'var(--accent)' }} />
                <div
                  className="absolute -left-1 -top-1 h-2 w-2 rounded-full"
                  style={{ background: 'var(--accent)' }}
                />
              </div>
            )}

            {blocks.map((b) => (
              <TimeGridBlock
                key={b.id}
                block={b}
                onClick={() => onBlockClick(b.id)}
                onToggleDone={(done) => onToggleBlockDone(b.id, done)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onBlockContextMenu(b.id, e.clientX, e.clientY)
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TimeGridBlock({
  block,
  onClick,
  onToggleDone,
  onContextMenu,
}: {
  block: PlannerBlock
  onClick: () => void
  onToggleDone: (done: boolean) => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const c = CATEGORY_COLORS[block.category]
  const isDone = block.status === 'done'
  const startMin = timeToMinutes(block.start_time)
  const endMin = timeToMinutes(block.end_time)
  const duration = endMin - startMin
  const naturalHeight = (duration / 30) * SLOT_PX
  const height = Math.max(MIN_BLOCK_HEIGHT, naturalHeight)
  const top = ((startMin - DAY_START_HOUR * 60) / 30) * SLOT_PX

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="group absolute left-1 right-1 cursor-pointer overflow-hidden rounded-md border shadow-sm"
      style={{
        top,
        height,
        background: c.bg,
        borderColor: c.fg + '55',
        borderLeft: `3px solid ${c.fg}`,
        opacity: isDone ? 0.6 : 1,
        zIndex: 1,
      }}
    >
      <div className="flex items-center gap-2 px-2.5 py-2" style={{ minHeight: 36 }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleDone(!isDone)
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[4px] border"
          style={{ borderColor: c.fg, background: isDone ? c.fg : 'transparent' }}
        >
          {isDone && <Check size={11} strokeWidth={3} style={{ color: '#fff' }} />}
        </button>
        <span
          className="min-w-0 flex-1 truncate text-[13px] font-medium"
          style={{
            color: 'var(--text0)',
            textDecoration: isDone ? 'line-through' : 'none',
          }}
        >
          {block.title || 'Untitled'}
        </span>
        <span className="font-mono text-[11px] tabular-nums" style={{ color: c.fg }}>
          {formatTo12h(block.start_time)}–{formatTo12h(block.end_time)}
        </span>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function priorityColor(p: string): string {
  if (p === 'P0') return 'var(--accent)'
  if (p === 'P1') return '#fb923c'
  if (p === 'P2') return '#facc15'
  return 'var(--text3, var(--text2))'
}

// Silence TS for an unused import when tree-shaking differs across bundlers.
void Trash2
