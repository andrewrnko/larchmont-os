// Planner — Zustand store with optimistic mutations over Supabase.
// Mirrors the feel of components/creative-studio/store.ts but persists to DB,
// not localStorage. The store owns both concrete blocks AND repeat templates;
// UI consumers expand templates view-side via expandRepeating().

'use client'

import { create } from 'zustand'
import { plannerDb } from './planner-db'
import { db, type Task as AppTask, type Project as AppProject } from './db'
import {
  todayLocal,
  expandRepeating,
  isVirtualRepeat,
  parseVirtualId,
  blockDurationMinutes,
  normalizeDateString,
} from './planner-types'
import type {
  PlannerBlock,
  PlannerTask,
  PlannerBlockStatus,
  PlannerCategory,
} from './planner-types'
import { useTimerStore, useToastStore } from './store'

interface PlannerBlocksState {
  blocks: PlannerBlock[] // concrete rows (non-virtual). Includes repeat templates.
  tasks: PlannerTask[]
  hydrated: boolean
  loading: boolean

  // App-level tasks (from the `tasks` table used by /tasks). Loaded in-planner
  // so blocks AND due-tasks share a single view without a second data store.
  appTasks: AppTask[]
  appProjects: AppProject[]
  appTasksLoaded: boolean

  hydrate: () => Promise<void>
  loadRange: (start: string, end: string) => Promise<void>
  loadTasks: () => Promise<void>
  loadAppTasks: () => Promise<void>
  setAppTaskDone: (id: string, done: boolean) => Promise<void>
  updateAppTask: (
    id: string,
    patch: Partial<{
      name: string
      status: string
      priority: string
      due_date: string | null
      description: string | null
      project_id: string | null
    }>,
  ) => Promise<void>
  deleteAppTask: (id: string) => Promise<void>

  // Block mutations (optimistic)
  addBlock: (v: Partial<PlannerBlock> & {
    date: string
    start_time: string
    end_time: string
    title?: string
    category?: PlannerCategory
  }) => Promise<PlannerBlock | null>
  updateBlock: (id: string, patch: Partial<PlannerBlock>) => Promise<void>
  removeBlock: (id: string) => Promise<void>
  setBlockStatus: (id: string, status: PlannerBlockStatus) => Promise<void>

  // Timer
  startBlockTimer: (id: string) => Promise<void>
  stopBlockTimer: (id: string) => Promise<void>

  // Tasks
  addTask: (v: { title: string; priority?: number; estimated_minutes?: number | null; category?: PlannerCategory | null }) => Promise<void>
  updateTask: (id: string, patch: Partial<PlannerTask>) => Promise<void>
  removeTask: (id: string) => Promise<void>
  scheduleTask: (taskId: string, date: string, start_time: string, end_time: string) => Promise<void>

  // Selectors (synchronous helpers — see derived selectors at bottom)
  blocksForDay: (date: string) => PlannerBlock[]
  appTasksForDay: (date: string) => AppTask[]
  unscheduledAppTasks: () => AppTask[]
}

function toastError(message: string, err: unknown) {
  // Deferred import to avoid circular — useToastStore lives in ./store.
  const detail = err instanceof Error ? err.message : String(err)
  try {
    useToastStore.getState().addToast({ type: 'error', message: `${message}: ${detail}` })
  } catch {
    // During SSR or early boot, toast store may not be ready.
    // eslint-disable-next-line no-console
    console.error(message, err)
  }
}

export const usePlannerBlocksStore = create<PlannerBlocksState>((set, get) => ({
  blocks: [],
  tasks: [],
  hydrated: false,
  loading: false,
  appTasks: [],
  appProjects: [],
  appTasksLoaded: false,

  hydrate: async () => {
    if (get().hydrated) return
    set({ loading: true })
    try {
      // Load current week ± 14 days so week nav feels instant.
      const today = todayLocal()
      const start = offsetDate(today, -14)
      const end = offsetDate(today, 14)
      const [blocks, tasks] = await Promise.all([
        plannerDb.blocks.listForRange(start, end),
        plannerDb.tasks.listAll(),
      ])
      set({ blocks, tasks, hydrated: true, loading: false })
    } catch (err) {
      toastError('Planner hydrate failed', err)
      set({ hydrated: true, loading: false })
    }
  },

  loadRange: async (start, end) => {
    const nStart = normalizeDateString(start)
    const nEnd = normalizeDateString(end)
    try {
      const rows = await plannerDb.blocks.listForRange(nStart, nEnd)
      set((s) => {
        // Merge: keep rows outside the range, replace rows in-range.
        const outside = s.blocks.filter((b) => {
          if (b.is_repeating) return false
          const d = normalizeDateString(b.date)
          return d < nStart || d > nEnd
        })
        const templates = s.blocks.filter((b) => b.is_repeating)
        // Rows returned already include templates (OR clause). Dedupe by id.
        const byId = new Map<string, PlannerBlock>()
        for (const b of [...outside, ...templates, ...rows]) byId.set(b.id, b)
        return { blocks: Array.from(byId.values()) }
      })
    } catch (err) {
      toastError('Load range failed', err)
    }
  },

  loadTasks: async () => {
    try {
      const tasks = await plannerDb.tasks.listAll()
      set({ tasks })
    } catch (err) {
      toastError('Load tasks failed', err)
    }
  },

  addBlock: async (v) => {
    const optimistic: PlannerBlock = {
      id: `optimistic-${crypto.randomUUID()}`,
      date: v.date,
      title: v.title ?? '',
      category: v.category ?? 'deep_work',
      start_time: v.start_time,
      end_time: v.end_time,
      status: 'planned',
      notes: v.notes ?? null,
      actual_duration_minutes: null,
      timer_started_at: null,
      is_repeating: v.is_repeating ?? false,
      repeat_days: v.repeat_days ?? [],
      repeat_start_date: v.repeat_start_date ?? null,
      is_locked: v.is_locked ?? false,
      priority: v.priority ?? 3,
      color: v.color ?? null,
      parent_repeat_id: v.parent_repeat_id ?? null,
      created_at: new Date().toISOString(),
    }
    set((s) => ({ blocks: [...s.blocks, optimistic] }))
    try {
      const row = await plannerDb.blocks.insert({
        date: v.date,
        title: optimistic.title,
        category: optimistic.category,
        start_time: optimistic.start_time,
        end_time: optimistic.end_time,
        status: optimistic.status,
        notes: optimistic.notes,
        is_repeating: optimistic.is_repeating,
        repeat_days: optimistic.repeat_days,
        repeat_start_date: optimistic.repeat_start_date,
        is_locked: optimistic.is_locked,
        priority: optimistic.priority,
        color: optimistic.color,
        parent_repeat_id: optimistic.parent_repeat_id,
      })
      set((s) => ({
        blocks: s.blocks.map((b) => (b.id === optimistic.id ? row : b)),
      }))
      return row
    } catch (err) {
      set((s) => ({ blocks: s.blocks.filter((b) => b.id !== optimistic.id) }))
      toastError('Add block failed', err)
      return null
    }
  },

  updateBlock: async (id, patch) => {
    // Virtual repeat instances: materialise an override row instead of mutating the template.
    if (isVirtualRepeat(id)) {
      const parts = parseVirtualId(id)
      if (!parts) return
      const template = get().blocks.find((b) => b.id === parts.templateId)
      if (!template) return
      try {
        const row = await plannerDb.blocks.createRepeatOverride(template, parts.date, patch)
        set((s) => ({ blocks: [...s.blocks, row] }))
      } catch (err) {
        toastError('Update repeat instance failed', err)
      }
      return
    }
    const prev = get().blocks.find((b) => b.id === id)
    if (!prev) return
    set((s) => ({
      blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }))
    try {
      const row = await plannerDb.blocks.update(id, patch)
      set((s) => ({ blocks: s.blocks.map((b) => (b.id === id ? row : b)) }))
    } catch (err) {
      set((s) => ({ blocks: s.blocks.map((b) => (b.id === id ? prev : b)) }))
      toastError('Update block failed', err)
    }
  },

  removeBlock: async (id) => {
    if (isVirtualRepeat(id)) {
      // Deleting a virtual instance = skip this instance via an override with status='skipped'.
      const parts = parseVirtualId(id)
      if (!parts) return
      const template = get().blocks.find((b) => b.id === parts.templateId)
      if (!template) return
      try {
        const row = await plannerDb.blocks.createRepeatOverride(template, parts.date, {
          status: 'skipped',
        })
        set((s) => ({ blocks: [...s.blocks, row] }))
      } catch (err) {
        toastError('Skip repeat instance failed', err)
      }
      return
    }
    const prev = get().blocks.find((b) => b.id === id)
    if (!prev) return
    set((s) => ({ blocks: s.blocks.filter((b) => b.id !== id) }))
    try {
      await plannerDb.blocks.remove(id)
    } catch (err) {
      set((s) => ({ blocks: [...s.blocks, prev] }))
      toastError('Delete block failed', err)
    }
  },

  setBlockStatus: async (id, status) => {
    await get().updateBlock(id, { status })
  },

  startBlockTimer: async (id) => {
    // Stop any other running timer first (task OR block).
    const timer = useTimerStore.getState()
    if (timer.activeKind === 'task') timer.stopTimer()
    if (timer.activeKind === 'block' && timer.activeBlockId && timer.activeBlockId !== id) {
      await get().stopBlockTimer(timer.activeBlockId)
    }
    useTimerStore.getState().startBlockTimer(id)
    await get().updateBlock(id, {
      timer_started_at: new Date().toISOString(),
      status: 'in_progress',
    })
  },

  stopBlockTimer: async (id) => {
    const block = get().blocks.find((b) => b.id === id)
    const timer = useTimerStore.getState()
    const startedAt = block?.timer_started_at ?? timer.startedAt
    if (!startedAt) {
      useTimerStore.getState().clearTimer()
      return
    }
    const elapsedMs = Date.now() - new Date(startedAt).getTime()
    const elapsedMin = Math.max(1, Math.round(elapsedMs / 60_000))
    const prevActual = block?.actual_duration_minutes ?? 0
    useTimerStore.getState().stopBlockTimer()
    await get().updateBlock(id, {
      timer_started_at: null,
      actual_duration_minutes: prevActual + elapsedMin,
    })
  },

  addTask: async (v) => {
    const optimistic: PlannerTask = {
      id: `optimistic-${crypto.randomUUID()}`,
      title: v.title,
      priority: v.priority ?? 3,
      estimated_minutes: v.estimated_minutes ?? null,
      assigned_date: null,
      status: 'unscheduled',
      category: v.category ?? null,
      created_at: new Date().toISOString(),
    }
    set((s) => ({ tasks: [optimistic, ...s.tasks] }))
    try {
      const row = await plannerDb.tasks.insert(v)
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === optimistic.id ? row : t)) }))
    } catch (err) {
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== optimistic.id) }))
      toastError('Add task failed', err)
    }
  },

  updateTask: async (id, patch) => {
    const prev = get().tasks.find((t) => t.id === id)
    if (!prev) return
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
    try {
      const row = await plannerDb.tasks.update(id, patch)
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? row : t)) }))
    } catch (err) {
      set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? prev : t)) }))
      toastError('Update task failed', err)
    }
  },

  removeTask: async (id) => {
    const prev = get().tasks.find((t) => t.id === id)
    if (!prev) return
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
    try {
      await plannerDb.tasks.remove(id)
    } catch (err) {
      set((s) => ({ tasks: [prev, ...s.tasks] }))
      toastError('Delete task failed', err)
    }
  },

  scheduleTask: async (taskId, date, start_time, end_time) => {
    const task = get().tasks.find((t) => t.id === taskId)
    if (!task) return
    // Create a block from the task, then mark task scheduled.
    const block = await get().addBlock({
      date,
      start_time,
      end_time,
      title: task.title,
      category: task.category ?? 'deep_work',
      priority: task.priority,
    })
    if (block) {
      await get().updateTask(taskId, { assigned_date: date, status: 'scheduled' })
    }
  },

  loadAppTasks: async () => {
    try {
      const [tasks, projects] = await Promise.all([db.tasks.list(), db.projects.list()])
      set({ appTasks: tasks, appProjects: projects, appTasksLoaded: true })
    } catch (err) {
      toastError('Load tasks failed', err)
      set({ appTasksLoaded: true })
    }
  },

  setAppTaskDone: async (id, done) => {
    const prev = get().appTasks.find((t) => t.id === id)
    if (!prev) return
    const nextStatus = done ? 'Done' : 'Not Started'
    const nowIso = new Date().toISOString()
    set((s) => ({
      appTasks: s.appTasks.map((t) =>
        t.id === id
          ? { ...t, status: nextStatus, completedAt: done ? nowIso : undefined }
          : t,
      ),
    }))
    try {
      await db.tasks.update(id, {
        status: nextStatus,
        completed_at: done ? nowIso : null,
      })
    } catch (err) {
      set((s) => ({ appTasks: s.appTasks.map((t) => (t.id === id ? prev : t)) }))
      toastError('Update task failed', err)
    }
  },

  appTasksForDay: (date) => {
    const target = normalizeDateString(date)
    return get().appTasks.filter(
      (t) => t.dueDate && normalizeDateString(t.dueDate) === target && t.status !== 'Done',
    )
  },

  unscheduledAppTasks: () => {
    return get().appTasks.filter((t) => !t.dueDate && t.status !== 'Done')
  },

  updateAppTask: async (id, patch) => {
    const prev = get().appTasks.find((t) => t.id === id)
    if (!prev) return
    // Optimistic local update (map snake_case -> camelCase).
    const mapped: Partial<AppTask> = {}
    if (patch.name !== undefined) mapped.name = patch.name
    if (patch.status !== undefined) mapped.status = patch.status
    if (patch.priority !== undefined) mapped.priority = patch.priority
    if (patch.due_date !== undefined) mapped.dueDate = patch.due_date ?? undefined
    if (patch.description !== undefined) mapped.description = patch.description ?? undefined
    if (patch.project_id !== undefined) mapped.projectId = patch.project_id
    set((s) => ({
      appTasks: s.appTasks.map((t) => (t.id === id ? { ...t, ...mapped } : t)),
    }))
    try {
      const row = await db.tasks.update(id, patch)
      set((s) => ({ appTasks: s.appTasks.map((t) => (t.id === id ? row : t)) }))
    } catch (err) {
      set((s) => ({ appTasks: s.appTasks.map((t) => (t.id === id ? prev : t)) }))
      toastError('Update task failed', err)
    }
  },

  deleteAppTask: async (id) => {
    const prev = get().appTasks.find((t) => t.id === id)
    if (!prev) return
    set((s) => ({ appTasks: s.appTasks.filter((t) => t.id !== id) }))
    try {
      await db.tasks.delete(id)
    } catch (err) {
      set((s) => ({ appTasks: [prev, ...s.appTasks] }))
      toastError('Delete task failed', err)
    }
  },

  blocksForDay: (date) => {
    // Compare using normalised first-10-chars so we tolerate any accidental
    // ISO-timestamp shape coming from the DB layer. No Date conversion — a
    // Date parse would shift local Pacific dates into the wrong UTC day.
    const target = normalizeDateString(date)
    const s = get()
    const concrete = s.blocks.filter(
      (b) => !b.is_repeating && normalizeDateString(b.date) === target,
    )
    const templates = s.blocks.filter((b) => b.is_repeating)
    const overrides = concrete.filter((b) => b.parent_repeat_id)
    const virtuals = expandRepeating(templates, target, overrides)
    return [...concrete, ...virtuals].sort(
      (a, b) => a.start_time.localeCompare(b.start_time),
    )
  },
}))

// Local helper (mirrors addDays in planner-types without the import cycle risk).
function offsetDate(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  dt.setDate(dt.getDate() + n)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

// Re-export duration helper for convenience (lets consumers avoid two imports).
export { blockDurationMinutes }
