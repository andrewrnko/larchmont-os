// Creative Studio → Analytics tracking layer.
// Writes events to Supabase performance_metrics so they appear in the analytics page.
// Metric types used:
//   cs_task_completed  — a Hyperplanner priority task was marked done
//   cs_focus_session   — a focus session ended (metadata has duration + completed flag)
//   cs_daily_summary   — daily reset summary (completion rate, total tasks, focus minutes)
//   cs_board_activity   — board was modified (block count delta)

import { db } from '@/lib/db'

const today = () => new Date().toISOString().slice(0, 10)

export async function trackTaskCompleted(task: { rank: number; title: string; estimateMin?: number }) {
  try {
    await db.metrics.insert({
      date: today(),
      metric_type: 'cs_task_completed',
      metric_key: `p${task.rank}`,
      metric_value: 1,
      metadata: { title: task.title, rank: task.rank, estimateMin: task.estimateMin },
    })
  } catch {}
}

export async function trackFocusSession(opts: {
  taskTitle: string
  rank: number
  durationMs: number
  completed: boolean
}) {
  try {
    await db.metrics.insert({
      date: today(),
      metric_type: 'cs_focus_session',
      metric_key: `p${opts.rank}`,
      metric_value: Math.round(opts.durationMs / 60000), // minutes
      metadata: {
        title: opts.taskTitle,
        rank: opts.rank,
        durationMs: opts.durationMs,
        completed: opts.completed,
      },
    })
  } catch {}
}

export async function trackDailySummary(opts: {
  totalTasks: number
  completedTasks: number
  totalFocusMin: number
}) {
  try {
    const rate = opts.totalTasks > 0 ? Math.round((opts.completedTasks / opts.totalTasks) * 100) : 0
    await db.metrics.insert({
      date: today(),
      metric_type: 'cs_daily_summary',
      metric_key: 'daily',
      metric_value: rate,
      metadata: {
        totalTasks: opts.totalTasks,
        completedTasks: opts.completedTasks,
        totalFocusMin: opts.totalFocusMin,
      },
    })
  } catch {}
}
