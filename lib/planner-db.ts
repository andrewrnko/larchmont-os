// Planner — Supabase CRUD for planner_blocks and planner_tasks.
// Matches the pattern in lib/db.ts: async functions, snake_case rows.

import { supabase } from './supabase'
import type {
  PlannerBlock,
  PlannerTask,
  PlannerCategory,
  PlannerBlockStatus,
  PlannerTaskStatus,
} from './planner-types'

type BlockRow = PlannerBlock
type TaskRow = PlannerTask

// ── Blocks ─────────────────────────────────────────────────────────────────

export const plannerDb = {
  blocks: {
    /**
     * Fetch concrete blocks for a date range PLUS every active repeat template.
     * Caller expands templates view-side via expandRepeating().
     */
    async listForRange(start: string, end: string): Promise<BlockRow[]> {
      const { data, error } = await supabase
        .from('planner_blocks')
        .select('*')
        .or(
          // either falls inside the range, or is a repeat template (date stored = repeat_start_date or first seen)
          `and(date.gte.${start},date.lte.${end}),is_repeating.eq.true`,
        )
        .order('start_time', { ascending: true })
      if (error) throw error
      return (data as BlockRow[]) ?? []
    },

    async listForDay(date: string): Promise<BlockRow[]> {
      return this.listForRange(date, date)
    },

    async insert(v: Partial<BlockRow> & {
      date: string
      start_time: string
      end_time: string
    }): Promise<BlockRow> {
      const { data, error } = await supabase
        .from('planner_blocks')
        .insert([v])
        .select()
        .single()
      if (error) throw error
      return data as BlockRow
    },

    async update(id: string, patch: Partial<BlockRow>): Promise<BlockRow> {
      const { data, error } = await supabase
        .from('planner_blocks')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as BlockRow
    },

    async remove(id: string): Promise<void> {
      const { error } = await supabase.from('planner_blocks').delete().eq('id', id)
      if (error) throw error
    },

    async setStatus(id: string, status: PlannerBlockStatus): Promise<BlockRow> {
      return this.update(id, { status })
    },

    async startTimer(id: string): Promise<BlockRow> {
      return this.update(id, {
        timer_started_at: new Date().toISOString(),
        status: 'in_progress',
      })
    },

    async stopTimer(id: string, actual_duration_minutes: number): Promise<BlockRow> {
      return this.update(id, {
        timer_started_at: null,
        actual_duration_minutes,
      })
    },

    /**
     * When a virtual repeat instance is edited "just this day", materialise
     * an override row that supersedes the template for `date`. The renderer
     * filters out the template's virtual instance for that date.
     */
    async createRepeatOverride(
      parent: BlockRow,
      date: string,
      patch: Partial<BlockRow>,
    ): Promise<BlockRow> {
      const override: Partial<BlockRow> = {
        date,
        title: patch.title ?? parent.title,
        category: patch.category ?? parent.category,
        start_time: patch.start_time ?? parent.start_time,
        end_time: patch.end_time ?? parent.end_time,
        status: patch.status ?? 'planned',
        notes: patch.notes ?? parent.notes,
        is_repeating: false,
        repeat_days: [],
        repeat_start_date: null,
        is_locked: patch.is_locked ?? parent.is_locked,
        priority: patch.priority ?? parent.priority,
        color: patch.color ?? parent.color,
        parent_repeat_id: parent.id,
      }
      return this.insert(override as Parameters<typeof this.insert>[0])
    },
  },

  tasks: {
    async listUnscheduled(): Promise<TaskRow[]> {
      const { data, error } = await supabase
        .from('planner_tasks')
        .select('*')
        .eq('status', 'unscheduled')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as TaskRow[]) ?? []
    },

    async listAll(): Promise<TaskRow[]> {
      const { data, error } = await supabase
        .from('planner_tasks')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as TaskRow[]) ?? []
    },

    async insert(v: {
      title: string
      priority?: number
      estimated_minutes?: number | null
      category?: PlannerCategory | null
    }): Promise<TaskRow> {
      const { data, error } = await supabase
        .from('planner_tasks')
        .insert([{ status: 'unscheduled' as PlannerTaskStatus, ...v }])
        .select()
        .single()
      if (error) throw error
      return data as TaskRow
    },

    async update(id: string, patch: Partial<TaskRow>): Promise<TaskRow> {
      const { data, error } = await supabase
        .from('planner_tasks')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as TaskRow
    },

    async assignToDate(id: string, date: string | null): Promise<TaskRow> {
      return this.update(id, {
        assigned_date: date,
        status: date ? 'scheduled' : 'unscheduled',
      })
    },

    async remove(id: string): Promise<void> {
      const { error } = await supabase.from('planner_tasks').delete().eq('id', id)
      if (error) throw error
    },
  },
}
