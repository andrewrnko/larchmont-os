// Week Planner canvas node. Renders a 7-day overview of planner_blocks,
// highlights today, flags overdue, and summons an AI assistant block with
// a prefilled "plan this week" prompt.

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCanvasStore, useActiveBoard } from '../store'
import { BlockWrapper } from '../BlockWrapper'
import type { WeekPlannerBlock, AssistantBlock, ChatMessage } from '../types'
import { CalendarRange, Sparkles, ExternalLink, Loader2 } from 'lucide-react'
import { usePlannerBlocksStore } from '@/lib/planner-store'
import { useToastStore } from '@/lib/store'
import {
  todayLocal,
  weekStartMonday,
  weekRange,
  parseLocalDate,
} from '@/lib/planner-types'
import type { PlannerCategory } from '@/lib/planner-types'

interface Props {
  block: WeekPlannerBlock
  onContextMenu?: (e: React.MouseEvent) => void
}

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function WeekPlannerBlockView({ block, onContextMenu }: Props) {
  const hydrate = usePlannerBlocksStore((s) => s.hydrate)
  const hydrated = usePlannerBlocksStore((s) => s.hydrated)
  const storeBlocks = usePlannerBlocksStore((s) => s.blocks)
  const tasks = usePlannerBlocksStore((s) => s.tasks)
  const blocksForDay = usePlannerBlocksStore((s) => s.blocksForDay)
  const addPlannerBlock = usePlannerBlocksStore((s) => s.addBlock)
  const addBlockAt = useCanvasStore((s) => s.addBlockAt)
  const updateBlock = useCanvasStore((s) => s.updateBlock)
  const board = useActiveBoard()
  const addToast = useToastStore((s) => s.addToast)
  const [planning, setPlanning] = useState(false)

  useEffect(() => {
    if (!hydrated) hydrate()
  }, [hydrated, hydrate])

  const today = todayLocal()
  const anchorDate = block.weekStart ?? today
  const mondayIso = weekStartMonday(anchorDate)
  const days = useMemo(() => weekRange(mondayIso), [mondayIso])

  const mondayLabel = (() => {
    const d = parseLocalDate(mondayIso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  })()

  // Derived per-day stats. Include storeBlocks in deps so the UI refreshes
  // when the store mutates optimistically.
  const dayStats = useMemo(() => {
    return days.map((date) => {
      const all = blocksForDay(date)
      const total = all.length
      const done = all.filter((b) => b.status === 'done').length
      const overdue =
        date < today && all.some((b) => b.status === 'planned' || b.status === 'in_progress')
      const pct = total === 0 ? 0 : Math.round((done / total) * 100)
      return { date, total, done, overdue, pct }
    })
    // Recompute when store mutates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, storeBlocks, today])

  const unscheduledCount = tasks.filter((t) => t.status === 'unscheduled').length

  const shiftWeek = (delta: number) => {
    const d = parseLocalDate(mondayIso)
    d.setDate(d.getDate() + delta * 7)
    const next = todayLocal(d)
    updateBlock(block.id, { weekStart: next } as Partial<WeekPlannerBlock>)
  }

  const jumpToDay = (date: string) => {
    window.open(`/planner/${date}`, '_self')
  }

  const openWeek = () => {
    window.open('/planner', '_self')
  }

  const planWithAI = async () => {
    if (planning) return
    setPlanning(true)
    const promptText =
      `Plan my week of ${mondayLabel}. I have ${unscheduledCount} unscheduled tasks ` +
      `and ${dayStats.reduce((n, d) => n + d.total, 0)} existing blocks across the week.`

    // Seed the canvas assistant block (if any) with a transcript entry so
    // the user sees the AI plan showed up there too.
    if (board) {
      const existing = board.blocks.find((b) => b.kind === 'assistant') as AssistantBlock | undefined
      const userSeed: ChatMessage = { role: 'user', content: promptText, timestamp: Date.now() }
      if (existing) {
        updateBlock(existing.id, { messages: [...existing.messages, userSeed] } as Partial<AssistantBlock>)
      } else {
        const id = addBlockAt('assistant', block.x + block.w + 80, block.y)
        if (id) updateBlock(id, { messages: [userSeed] } as Partial<AssistantBlock>)
      }
    }

    try {
      const res = await fetch('/api/planner/plan-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekStart: mondayIso,
          tasks: tasks.filter((t) => t.status === 'unscheduled'),
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
      }
      for (const b of data.blocks ?? []) {
        await addPlannerBlock(b)
      }
      addToast({
        type: 'success',
        message: `AI added ${data.blocks?.length ?? 0} blocks to the week`,
      })
    } catch (err) {
      addToast({
        type: 'error',
        message: 'Plan week failed: ' + (err instanceof Error ? err.message : 'unknown'),
      })
    } finally {
      setPlanning(false)
    }
  }

  return (
    <BlockWrapper block={block} kind="week-planner" onContextMenu={onContextMenu}>
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-lg border shadow-lg"
        style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <CalendarRange size={15} className="text-[color:var(--cs-accent)]" />
            <span
              className="font-mono text-[12px] uppercase tracking-[0.06em]"
              style={{ color: 'var(--text0)' }}
            >
              Week of {mondayLabel}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftWeek(-1)}
              className="rounded px-1.5 py-0.5 text-[12px] transition hover:opacity-100"
              style={{ color: 'var(--text2)' }}
              title="Previous week"
            >
              ‹
            </button>
            <button
              onClick={() => updateBlock(block.id, { weekStart: null } as Partial<WeekPlannerBlock>)}
              className="rounded px-2 py-0.5 text-[11px]"
              style={{ color: 'var(--text2)' }}
              title="Jump to this week"
            >
              Today
            </button>
            <button
              onClick={() => shiftWeek(1)}
              className="rounded px-1.5 py-0.5 text-[12px]"
              style={{ color: 'var(--text2)' }}
              title="Next week"
            >
              ›
            </button>
          </div>
        </div>

        {/* Day grid */}
        <div className="flex flex-1 gap-1.5 px-3 py-3">
          {dayStats.map((d, i) => {
            const isToday = d.date === today
            const overdue = d.overdue
            return (
              <button
                key={d.date}
                onClick={() => jumpToDay(d.date)}
                className="flex flex-1 flex-col items-stretch rounded-lg border px-2 py-2 text-left transition hover:scale-[1.01]"
                style={{
                  background: isToday ? 'color-mix(in srgb, var(--cs-accent) 14%, var(--bg2))' : 'var(--bg1)',
                  borderColor: isToday
                    ? 'var(--cs-accent)'
                    : overdue
                    ? '#ef6850'
                    : 'var(--border)',
                }}
              >
                <div className="flex items-baseline justify-between">
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.08em]"
                    style={{ color: isToday ? 'var(--text0)' : 'var(--text2)' }}
                  >
                    {DOW_LABELS[i]}
                  </span>
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: 'var(--text0)' }}
                  >
                    {new Date(parseLocalDate(d.date)).getDate()}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
                    {d.total} blocks
                  </span>
                </div>
                <div
                  className="mt-1 h-1 w-full overflow-hidden rounded-full"
                  style={{ background: 'var(--bg3)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${d.pct}%`,
                      background: overdue ? '#ef6850' : 'var(--cs-accent)',
                    }}
                  />
                </div>
                <div className="mt-1 text-[10px]" style={{ color: 'var(--text2)' }}>
                  {d.pct}% done{overdue ? ' · overdue' : ''}
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer actions */}
        <div
          className="flex items-center justify-between border-t px-3 py-2"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
            {unscheduledCount} unscheduled
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={planWithAI}
              disabled={planning}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition"
              style={{
                background: 'color-mix(in srgb, var(--cs-accent) 20%, transparent)',
                color: 'var(--text0)',
                opacity: planning ? 0.6 : 1,
              }}
            >
              {planning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {planning ? 'Planning…' : 'Plan with AI'}
            </button>
            <button
              onClick={openWeek}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
              style={{ color: 'var(--text1)' }}
            >
              <ExternalLink size={12} /> Open week
            </button>
          </div>
        </div>
      </div>
    </BlockWrapper>
  )
}
