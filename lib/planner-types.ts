// Planner types + repeat expansion helpers.
// Data shape mirrors supabase/migrations/add_planner_blocks_tasks.sql.

export type PlannerCategory =
  | 'deep_work'
  | 'admin'
  | 'client'
  | 'personal'
  | 'travel'
  | 'buffer'

export type PlannerBlockStatus =
  | 'planned'
  | 'in_progress'
  | 'done'
  | 'skipped'

export type PlannerTaskStatus =
  | 'unscheduled'
  | 'scheduled'
  | 'done'

export interface PlannerBlock {
  id: string
  date: string // YYYY-MM-DD (local)
  title: string
  category: PlannerCategory
  start_time: string // HH:MM:SS or HH:MM
  end_time: string
  status: PlannerBlockStatus
  notes: string | null
  actual_duration_minutes: number | null
  timer_started_at: string | null // ISO timestamptz
  is_repeating: boolean
  repeat_days: number[] // 0=Sun .. 6=Sat
  repeat_start_date: string | null // YYYY-MM-DD
  is_locked: boolean
  priority: number // 1..5
  color: string | null
  parent_repeat_id: string | null
  created_at: string
}

export interface PlannerTask {
  id: string
  title: string
  priority: number
  estimated_minutes: number | null
  assigned_date: string | null
  status: PlannerTaskStatus
  category: PlannerCategory | null
  created_at: string
}

// ── Category colors ────────────────────────────────────────────────────────
// CSS custom properties should resolve via `var(--planner-<category>)` tokens
// that we set in globals.css, but we also ship a concrete hex fallback so the
// canvas node can render outside of a CSS-variable context if needed.
// Deep Work uses the system accent (red) so the default planner block matches
// the Larchmont OS theme. Other categories stay semantically-scoped:
// admin=slate, client=coral (lighter accent-family), personal=green,
// travel=gold, buffer=neutral-gray.
export const CATEGORY_COLORS: Record<PlannerCategory, { bg: string; fg: string; name: string }> = {
  deep_work: { bg: 'rgba(232,93,58,0.18)',   fg: '#e85d3a', name: 'Deep Work' },
  admin:     { bg: 'rgba(147,165,180,0.18)', fg: '#93a5b4', name: 'Admin' },
  client:    { bg: 'rgba(240,122,90,0.18)',  fg: '#f07a5a', name: 'Client' },
  personal:  { bg: 'rgba(82,169,106,0.18)',  fg: '#52a96a', name: 'Personal' },
  travel:    { bg: 'rgba(212,162,52,0.18)',  fg: '#d4a234', name: 'Travel' },
  buffer:    { bg: 'rgba(107,114,128,0.18)', fg: '#9ca3af', name: 'Buffer' },
}

// ── Date/time helpers ──────────────────────────────────────────────────────

/** ISO YYYY-MM-DD in the browser's local timezone (not UTC). */
export function todayLocal(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse YYYY-MM-DD into a Date at local midnight. */
export function parseLocalDate(s: string): Date {
  // Accept "YYYY-MM-DD" or any ISO-ish string; normalise to the date part.
  const iso = normalizeDateString(s)
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/**
 * Defensive normaliser for a `date` column. Postgres `date` values come back
 * as "YYYY-MM-DD", but some proxies / client configurations surface them as
 * ISO timestamps ("YYYY-MM-DDTHH:mm:ss..."). Strip to the first 10 chars so
 * the local calendar date is preserved regardless of the shape we receive.
 * Never parses through a Date — avoids any UTC offset shifts.
 */
export function normalizeDateString(s: string | null | undefined): string {
  if (!s) return ''
  return s.slice(0, 10)
}

export function addDays(s: string, n: number): string {
  const d = parseLocalDate(s)
  d.setDate(d.getDate() + n)
  return todayLocal(d)
}

/** Monday of the week containing `s`. ISO week starts Monday. */
export function weekStartMonday(s: string): string {
  const d = parseLocalDate(s)
  const dow = d.getDay() // 0=Sun..6=Sat
  const offset = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + offset)
  return todayLocal(d)
}

export function weekRange(mondayIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayIso, i))
}

// ── Time helpers ───────────────────────────────────────────────────────────

/** Convert HH:MM[:SS] to minutes since midnight. Always interpreted as
 * wall-clock time; never parses through Date so no UTC shift happens. */
export function timeToMinutes(t: string): number {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** Extract "HH:MM" from any HH:MM[:SS][...] value. Pure string op. */
export function formatTimeLabel(t: string | null | undefined): string {
  if (!t) return ''
  return t.slice(0, 5)
}

// ── Task due-date tone helpers ────────────────────────────────────────────
// Shared by the /tasks page, TaskBoardBlock, and planner task blocks so the
// "overdue / today / future / done" coloring stays consistent.

export type DueDateTone = 'overdue' | 'today' | 'future' | 'done' | 'none'

export function dueDateTone(
  dueDate: string | null | undefined,
  isDone: boolean,
): DueDateTone {
  if (!dueDate) return 'none'
  if (isDone) return 'done'
  const target = normalizeDateString(dueDate)
  const today = todayLocal()
  if (target < today) return 'overdue'
  if (target === today) return 'today'
  return 'future'
}

/** Tailwind class list keyed by tone. Uses the project's semantic palette. */
export const DUE_DATE_CLASSES: Record<DueDateTone, string> = {
  overdue: 'text-red-400',
  today: 'text-orange-400',
  future: 'text-green-400',
  done: 'text-[var(--text-tertiary,var(--text2))]',
  none: '',
}

export function dueDateClass(
  dueDate: string | null | undefined,
  isDone: boolean,
): string {
  return DUE_DATE_CLASSES[dueDateTone(dueDate, isDone)]
}

export function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(mins)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function blockDurationMinutes(b: Pick<PlannerBlock, 'start_time' | 'end_time'>): number {
  return Math.max(0, timeToMinutes(b.end_time) - timeToMinutes(b.start_time))
}

// ── Repeat expansion ───────────────────────────────────────────────────────

/**
 * Project virtual block instances for `date` from repeat templates.
 * A template is a row where `is_repeating=true`. Its `repeat_days` contains
 * 0=Sun..6=Sat; `repeat_start_date` (if set) blocks retroactive projection.
 *
 * Concrete overrides (rows with `parent_repeat_id` AND `is_repeating=false`
 * AND matching `date`) SUPERSEDE the virtual instance for that day — callers
 * are expected to filter those out of the virtual set.
 *
 * Virtual ids use the synthetic form `<templateId>::<date>` so callers can
 * detect virtual instances via `id.includes('::')`.
 */
export function expandRepeating(
  templates: PlannerBlock[],
  date: string,
  overrides: PlannerBlock[] = [],
): PlannerBlock[] {
  const target = normalizeDateString(date)
  const d = parseLocalDate(target)
  const dow = d.getDay()
  const overriddenTemplateIds = new Set(
    overrides
      .filter((o) => o.parent_repeat_id && normalizeDateString(o.date) === target)
      .map((o) => o.parent_repeat_id as string),
  )
  const result: PlannerBlock[] = []
  for (const t of templates) {
    if (!t.is_repeating) continue
    if (!t.repeat_days || !t.repeat_days.includes(dow)) continue
    if (t.repeat_start_date && target < normalizeDateString(t.repeat_start_date)) continue
    if (overriddenTemplateIds.has(t.id)) continue
    result.push({
      ...t,
      id: `${t.id}::${target}`,
      date: target,
      is_repeating: false,
      parent_repeat_id: t.id,
      // Timer/status on a virtual instance don't persist; start clean.
      timer_started_at: null,
      actual_duration_minutes: null,
      status: 'planned',
    })
  }
  return result
}

/** True if the block id is a synthetic virtual repeat instance. */
export function isVirtualRepeat(id: string): boolean {
  return id.includes('::')
}

/** Parse a virtual id back into its parts. Returns null for concrete ids. */
export function parseVirtualId(id: string): { templateId: string; date: string } | null {
  if (!id.includes('::')) return null
  const [templateId, date] = id.split('::')
  return { templateId, date }
}
