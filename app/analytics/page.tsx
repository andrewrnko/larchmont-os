'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { db } from '@/lib/db'
import type { PerformanceMetric, DailyDebrief, WeeklyReview, Task, Project } from '@/lib/db'
import { cn } from '@/lib/utils'
import { ErrorBoundary } from '@/components/error-boundary'
import { CompletionHeatmap, type HeatmapDay } from '@/components/analytics/completion-heatmap'
import { subDays, format, startOfWeek, endOfWeek } from 'date-fns'

type Range = '7d' | '30d' | '90d' | 'all'

// ── Skeleton ──────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-[8px] bg-[var(--surface-2)]', className)} />
}

// ── Empty chart placeholder ───────────────────────────────────

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-[13px] text-[var(--text-tertiary)]">
      {message}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────

function KpiCard({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: 'up' | 'down' | 'flat' }) {
  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-1 text-[12px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">{label}</div>
      <div className="flex items-end gap-2">
        <span className="text-[28px] font-bold leading-none text-[var(--text-primary)]">{value}</span>
        {trend && (
          <span className={cn('mb-0.5 flex items-center gap-0.5 text-[12px]',
            trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-[var(--text-tertiary)]')}>
            {trend === 'up' ? <TrendingUp className="h-3.5 w-3.5" /> : trend === 'down' ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3 w-3" />}
          </span>
        )}
      </div>
      {sub && <div className="mt-1 text-[12px] text-[var(--text-tertiary)]">{sub}</div>}
    </div>
  )
}

// ── Data fetching ──────────────────────────────────────────────

interface AnalyticsData {
  metrics: PerformanceMetric[]
  debriefs: DailyDebrief[]
  reviews: WeeklyReview[]
  tasks: Task[]
  projects: Project[]
}

async function fetchAnalytics(range: Range): Promise<AnalyticsData> {
  const now = new Date()
  const sinceDays = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365
  const since = format(subDays(now, sinceDays), 'yyyy-MM-dd')

  const [metrics, debriefs, reviews, tasks, projects] = await Promise.all([
    db.metrics.list({ since }),
    db.debriefs.list(sinceDays),
    db.weeklyReviews.list(Math.ceil(sinceDays / 7)),
    db.tasks.listSince(subDays(now, sinceDays).toISOString()),
    db.projects.list(),
  ])

  return { metrics, debriefs, reviews, tasks, projects }
}

// ── Analytics page ─────────────────────────────────────────────

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>('30d')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (r: Range, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const result = await fetchAnalytics(r)
      setData(result)
    } catch {
      // leave stale data
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load(range) }, [range, load])

  // ── Derived data ──────────────────────────────────────────

  const completionRateMetrics = data?.metrics.filter((m) => m.metricType === 'completion_rate') ?? []
  const p0HitMetrics = data?.metrics.filter((m) => m.metricType === 'p0_hit') ?? []
  const energyMetrics = data?.metrics.filter((m) => m.metricType === 'energy_level') ?? []
  const projectSnapshots = data?.metrics.filter((m) => m.metricType === 'project_snapshot') ?? []

  const avgCompletionRate = completionRateMetrics.length > 0
    ? Math.round(completionRateMetrics.reduce((s, m) => s + (m.metricValue ?? 0), 0) / completionRateMetrics.length)
    : null

  const p0HitRate = p0HitMetrics.length > 0
    ? Math.round((p0HitMetrics.filter((m) => (m.metricValue ?? 0) > 0).length / p0HitMetrics.length) * 100)
    : null

  const tasksCompleted = data?.tasks.filter((t) => t.status === 'Done').length ?? 0

  const totalMinutesTracked = data?.tasks.reduce((s, t) => s + (t.actualMinutes ?? 0), 0) ?? 0
  const totalTimeDisplay = totalMinutesTracked === 0
    ? '—'
    : totalMinutesTracked >= 60
      ? `${Math.floor(totalMinutesTracked / 60)}h ${totalMinutesTracked % 60}m`
      : `${totalMinutesTracked}m`

  const avgEnergy = energyMetrics.length > 0
    ? (energyMetrics.reduce((s, m) => s + (m.metricValue ?? 3), 0) / energyMetrics.length).toFixed(1)
    : null

  const energyLabels: Record<string, string> = { '5': '⚡', '4': '✅', '3': '😐', '2': '😓', '1': '💀' }
  const energyDisplay = avgEnergy ? `${energyLabels[Math.round(Number(avgEnergy)).toString()] ?? '—'} ${avgEnergy}` : '—'

  // Trend: compare first half vs second half of the period
  function getTrend(metrics: PerformanceMetric[]): 'up' | 'down' | 'flat' {
    if (metrics.length < 4) return 'flat'
    const half = Math.floor(metrics.length / 2)
    const first = metrics.slice(0, half).reduce((s, m) => s + (m.metricValue ?? 0), 0) / half
    const second = metrics.slice(half).reduce((s, m) => s + (m.metricValue ?? 0), 0) / (metrics.length - half)
    if (second > first + 5) return 'up'
    if (second < first - 5) return 'down'
    return 'flat'
  }

  // Line chart data: daily completion rate
  const lineData = completionRateMetrics.map((m) => ({
    date: format(new Date(m.date), 'MMM d'),
    rate: m.metricValue ?? 0,
    p0: p0HitMetrics.find((p) => p.date === m.date)?.metricValue === 1,
  }))

  // Rolling 7-day average
  const lineDataWithRolling = lineData.map((d, i) => {
    const window = lineData.slice(Math.max(0, i - 6), i + 1)
    const rolling = Math.round(window.reduce((s, w) => s + w.rate, 0) / window.length)
    return { ...d, rolling }
  })

  // Project velocity bar chart
  const projectVelocityData = (() => {
    const now = new Date()
    const latestSnapshots = new Map<string, number>()
    const earliestSnapshots = new Map<string, number>()
    projectSnapshots.forEach((s) => {
      if (!latestSnapshots.has(s.metricKey)) latestSnapshots.set(s.metricKey, s.metricValue ?? 0)
      earliestSnapshots.set(s.metricKey, s.metricValue ?? 0)
    })
    return data?.projects.map((p) => {
      const current = p.progress
      const earliest = earliestSnapshots.get(p.id) ?? current
      const velocity = Math.max(0, current - earliest)
      const daysSinceUpdate = projectSnapshots.filter((s) => s.metricKey === p.id).length === 0
        ? (now.getTime() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        : 0
      return {
        name: p.name.length > 18 ? p.name.slice(0, 16) + '…' : p.name,
        velocity,
        stalled: daysSinceUpdate > 7 || velocity === 0,
        progress: current,
      }
    }) ?? []
  })()

  // Heatmap data from debriefs
  const heatmapData: HeatmapDay[] = data?.debriefs.map((d) => ({
    date: d.date,
    completionRate: d.completionRate ?? 0,
    tasksDone: d.completedTasks.length,
    tasksPlanned: d.completedTasks.length + d.incompleteTasks.length,
    p0Hit: d.p0Hit,
    energyLevel: d.energyLevel,
  })) ?? []

  // Time estimates vs reality
  const timedTasks = data?.tasks.filter((t) => t.estimatedMinutes != null && t.actualMinutes != null) ?? []
  const timeDeltaData = timedTasks
    .map((t) => ({
      name: t.name.length > 25 ? t.name.slice(0, 23) + '…' : t.name,
      estimated: t.estimatedMinutes!,
      actual: t.actualMinutes!,
      delta: t.actualMinutes! - t.estimatedMinutes!,
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 10)

  // Weekly trend table
  const weeklyTableData = data?.reviews.map((r) => ({
    week: `${format(new Date(r.weekStart), 'MMM d')} – ${format(new Date(r.weekEnd), 'MMM d')}`,
    weekStart: r.weekStart,
    done: r.completionRate != null ? `${r.completionRate}%` : '—',
    p0Rate: r.p0HitRate != null ? `${r.p0HitRate}%` : '—',
    wins: (r.topWins[0] as { win?: string } | undefined)?.win ?? '—',
  })).slice(0, 12) ?? []

  // ── Render ────────────────────────────────────────────────

  const RANGES: { label: string; value: Range }[] = [
    { label: '7d', value: '7d' }, { label: '30d', value: '30d' },
    { label: '90d', value: '90d' }, { label: 'All', value: 'all' },
  ]

  return (
    <ErrorBoundary>
      <div className="min-h-full p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text-primary)]">Performance</h1>
            <p className="mt-0.5 text-[14px] text-[var(--text-secondary)]">
              {range === '7d' ? 'Last 7 days' : range === '30d' ? 'Last 30 days' : range === '90d' ? 'Last 90 days' : 'All time'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-1">
              {RANGES.map((r) => (
                <button key={r.value} onClick={() => setRange(r.value)}
                  className={cn('rounded-[6px] px-3 py-1 text-[12px] font-medium transition-colors',
                    range === r.value ? 'bg-[var(--accent)] text-[var(--accent-fg)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]')}>
                  {r.label}
                </button>
              ))}
            </div>
            <button onClick={() => load(range, true)} disabled={refreshing}
              className="flex items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50">
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* Row 1: KPI Cards */}
        <div className="mb-6 grid grid-cols-5 gap-4">
          {loading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[88px]" />) : (<>
            <KpiCard label="Avg Completion Rate" value={avgCompletionRate != null ? `${avgCompletionRate}%` : '—'} sub={completionRateMetrics.length > 0 ? `${completionRateMetrics.length} days tracked` : 'No debrief data yet'} trend={getTrend(completionRateMetrics)} />
            <KpiCard label="P0 Hit Rate" value={p0HitRate != null ? `${p0HitRate}%` : '—'} sub={p0HitMetrics.length > 0 ? `${p0HitMetrics.filter(m => (m.metricValue ?? 0) > 0).length}/${p0HitMetrics.length} days` : 'No debrief data yet'} trend={getTrend(p0HitMetrics)} />
            <KpiCard label="Tasks Completed" value={String(tasksCompleted)} sub={`of ${data?.tasks.length ?? 0} total in period`} />
            <KpiCard label="Time Tracked" value={totalTimeDisplay} sub={totalMinutesTracked > 0 ? `across ${data?.tasks.filter(t => (t.actualMinutes ?? 0) > 0).length ?? 0} tasks` : 'Use task timers to log time'} />
            <KpiCard label="Avg Energy" value={energyDisplay} sub={energyMetrics.length > 0 ? `${energyMetrics.length} days tracked` : 'From debriefs'} />
          </>)}
        </div>

        {/* Row 2: Charts */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          {/* Completion Rate Line Chart */}
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="mb-4 text-[14px] font-semibold text-[var(--text-primary)]">Daily Completion Rate</h3>
            {loading ? <Skeleton className="h-[200px]" /> : lineDataWithRolling.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={lineDataWithRolling} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [`${v}%`]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="rate" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent)' }} name="Rate" />
                  <Line type="monotone" dataKey="rolling" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="7d avg" />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="h-[200px]"><ChartEmpty message="No debrief data yet — complete your first debrief to see trends" /></div>}
          </div>

          {/* Project Velocity Bar Chart */}
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="mb-4 text-[14px] font-semibold text-[var(--text-primary)]">Project Velocity</h3>
            {loading ? <Skeleton className="h-[200px]" /> : projectVelocityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={projectVelocityData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v: unknown, name: unknown) => [name === 'velocity' ? `+${v}%` : `${v}%`, name === 'velocity' ? 'Progress gain' : 'Current']} />
                  <Bar dataKey="progress" fill="var(--surface-2)" name="Current progress" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="velocity" fill="var(--accent)" name="Gain this period" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[200px]"><ChartEmpty message="No projects yet" /></div>}
          </div>
        </div>

        {/* Row 3: Heatmap */}
        <div className="mb-6 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="mb-4 text-[14px] font-semibold text-[var(--text-primary)]">Task Completion Heatmap</h3>
          {loading ? <Skeleton className="h-[80px]" /> : (
            <ErrorBoundary>
              <CompletionHeatmap data={heatmapData} days={range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 180} />
            </ErrorBoundary>
          )}
        </div>

        {/* Row 4: Bottleneck + Time Estimates */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          {/* Bottleneck Analysis */}
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="mb-4 text-[14px] font-semibold text-[var(--text-primary)]">Bottleneck Analysis</h3>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            ) : data && data.tasks.length > 0 ? (
              <div className="space-y-4">
                {/* Top incomplete task types by priority */}
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Most Frequently Incomplete</p>
                  {(() => {
                    const open = data.tasks.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled')
                    const byPriority = ['P0', 'P1', 'P2', 'P3'].map((p) => ({
                      priority: p,
                      count: open.filter((t) => t.priority === p).length,
                    })).filter((x) => x.count > 0).slice(0, 4)
                    if (byPriority.length === 0) return <p className="text-[13px] text-[var(--text-tertiary)]">No open tasks — clean board</p>
                    return byPriority.map((x) => (
                      <div key={x.priority} className="flex items-center justify-between py-1">
                        <span className="text-[13px] text-[var(--text-primary)]">{x.priority} tasks</span>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(x.count * 12, 80)}px` }} />
                          <span className="text-[12px] tabular-nums text-[var(--text-tertiary)]">{x.count}</span>
                        </div>
                      </div>
                    ))
                  })()}
                </div>

                {/* Gap reasons from debriefs */}
                {data.debriefs.some((d) => d.gaps) && (
                  <div>
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Recurring Gap Reasons</p>
                    {data.debriefs.filter((d) => d.gaps).slice(0, 3).map((d, i) => (
                      <div key={i} className="mb-1.5 rounded-[6px] bg-[var(--surface-2)] px-3 py-2 text-[12px] text-[var(--text-secondary)] line-clamp-2">
                        {d.gaps}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : <ChartEmpty message="No data yet — complete debriefs to see patterns" />}
          </div>

          {/* Time Estimates vs Reality */}
          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <h3 className="mb-4 text-[14px] font-semibold text-[var(--text-primary)]">Time Estimates vs Reality</h3>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            ) : timeDeltaData.length > 0 ? (
              <div>
                <div className="mb-2 grid grid-cols-[1fr_60px_60px_60px] gap-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                  <span>Task</span><span className="text-right">Est.</span><span className="text-right">Actual</span><span className="text-right">Delta</span>
                </div>
                <div className="space-y-1.5">
                  {timeDeltaData.map((t, i) => (
                    <div key={i} className="grid grid-cols-[1fr_60px_60px_60px] items-center gap-2 rounded-[6px] py-1.5 text-[12px]">
                      <span className="truncate text-[var(--text-primary)]">{t.name}</span>
                      <span className="text-right tabular-nums text-[var(--text-tertiary)]">{t.estimated}m</span>
                      <span className="text-right tabular-nums text-[var(--text-tertiary)]">{t.actual}m</span>
                      <span className={cn('text-right tabular-nums font-medium', t.delta > 0 ? 'text-red-400' : 'text-green-400')}>
                        {t.delta > 0 ? '+' : ''}{t.delta}m
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <ChartEmpty message="No timer data yet — use Start/Stop timer on tasks to track time" />
            )}
          </div>
        </div>

        {/* Row 5: Weekly Trend Table */}
        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="mb-4 text-[14px] font-semibold text-[var(--text-primary)]">Weekly Trend</h3>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : weeklyTableData.length > 0 ? (
            <div>
              <div className="mb-2 grid grid-cols-[200px_1fr_80px_80px_1fr] gap-4 text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                <span>Week</span><span>Top Win</span><span>Completion</span><span>P0 Rate</span><span>Notes</span>
              </div>
              <div className="space-y-1">
                {weeklyTableData.map((row, i) => {
                  const isCurrentWeek = row.weekStart === format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
                  return (
                    <div key={i} className={cn(
                      'grid grid-cols-[200px_1fr_80px_80px_1fr] items-center gap-4 rounded-[6px] px-3 py-2.5 text-[13px]',
                      isCurrentWeek ? 'border border-[var(--accent)]/30 bg-[var(--accent-muted)]' : 'hover:bg-[var(--surface-2)] transition-colors'
                    )}>
                      <span className={cn('font-medium', isCurrentWeek ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]')}>{row.week}</span>
                      <span className="truncate text-[var(--text-secondary)]">{row.wins}</span>
                      <span className="tabular-nums text-[var(--text-secondary)]">{row.done}</span>
                      <span className="tabular-nums text-[var(--text-secondary)]">{row.p0Rate}</span>
                      <span className="text-[var(--text-tertiary)]">{isCurrentWeek ? '← current' : ''}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <ChartEmpty message="No weekly reviews yet — complete your first weekly review to see trends" />
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}
