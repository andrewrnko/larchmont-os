// Shared editor form for a single planner block. Extracted from the expanded
// BlockPill body in PlannerDayClient so the PlannerBlockNode (and any future
// surface) can pop it open without replicating the control wiring.
//
// This component renders ONLY the form — callers own their drag handles, the
// collapsed header row, and any outer positioning / portal mounting.

'use client'

import { Lock, Play, Repeat, Square, Trash2 } from 'lucide-react'
import {
  CATEGORY_COLORS,
  blockDurationMinutes,
} from '@/lib/planner-types'
import type {
  PlannerBlock,
  PlannerBlockStatus,
  PlannerCategory,
} from '@/lib/planner-types'

const CATEGORIES: PlannerCategory[] = ['deep_work', 'admin', 'client', 'personal', 'travel', 'buffer']
const STATUS_ORDER: PlannerBlockStatus[] = ['planned', 'in_progress', 'done', 'skipped']

export interface PlannerBlockEditorProps {
  block: PlannerBlock
  onUpdate: (patch: Partial<PlannerBlock>) => void
  onRemove: () => void
  onSetStatus: (s: PlannerBlockStatus) => void
  onStartTimer?: () => void
  onStopTimer?: () => void
  /** ISO timestamp of when a timer started on this block; null/undefined = not running. */
  timerStartedAt?: string | null
  /** Pretty-printed elapsed time derived by the parent (day view uses useElapsed). */
  elapsedLabel?: string
}

export function PlannerBlockEditor({
  block,
  onUpdate,
  onRemove,
  onSetStatus,
  onStartTimer,
  onStopTimer,
  timerStartedAt,
  elapsedLabel,
}: PlannerBlockEditorProps) {
  const running = Boolean(timerStartedAt)
  const canTimer = Boolean(onStartTimer && onStopTimer)

  return (
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
        {canTimer && running && (
          <button
            onClick={onStopTimer}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            <Square size={11} /> {elapsedLabel ?? 'Stop'}
          </button>
        )}
        {canTimer && !running && (
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
  )
}
