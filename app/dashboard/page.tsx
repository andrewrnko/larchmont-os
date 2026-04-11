'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckSquare2, FolderKanban, Film, CalendarDays,
  Check, AlertCircle, Sun, Sparkles
} from 'lucide-react'
import { useBriefingStore } from '@/lib/store'
import { db, Task, Project, ContentItem, AppEvent, Campaign, InboxItem, PerformanceMetric } from '@/lib/db'
import { StatCard } from '@/components/shared/stat-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PriorityDot } from '@/components/shared/priority-dot'
import { ProgressBar } from '@/components/shared/progress-bar'
import { PageHeader } from '@/components/shared/page-header'
import { KanbanBoard } from '@/components/shared/kanban-board'
import { cn } from '@/lib/utils'

type ProjectStatus = 'Planning' | 'Active' | 'In Review'

const PROJECT_COLUMNS: ProjectStatus[] = ['Planning', 'Active', 'In Review']

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isOverdue(dateStr?: string) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

function isUpcomingSoon(dateStr?: string) {
  if (!dateStr) return false
  const deadline = new Date(dateStr)
  const now = new Date()
  return deadline >= now && deadline <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const CONTENT_STAGES = ['Idea', 'Scripted', 'Shot', 'In Edit', 'Review', 'Scheduled'] as const

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [content, setContent] = useState<ContentItem[]>([])
  const [events, setEvents] = useState<AppEvent[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([])
  const [csMetrics, setCsMetrics] = useState<PerformanceMetric[]>([])
  const [loading, setLoading] = useState(true)

  const [completingTask, setCompletingTask] = useState<string | null>(null)
  const [activeStage, setActiveStage] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const { hasTodaysMorningBriefing, hasTodaysAfternoonBriefing } = useBriefingStore()
  const currentHour = mounted ? new Date().getHours() : 9
  const showBriefingBanner = mounted && !hasTodaysMorningBriefing() && !hasTodaysAfternoonBriefing()

  useEffect(() => {
    const since7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    Promise.all([
      db.tasks.list(),
      db.projects.list(),
      db.content.list(),
      db.events.list(),
      db.campaigns.list(),
      db.inbox.list(),
      db.metrics.list({ since: since7 }),
    ]).then(([t, p, c, e, ca, i, m]) => {
      setTasks(t); setProjects(p); setContent(c)
      setEvents(e); setCampaigns(ca); setInboxItems(i)
      setCsMetrics(m.filter((x) => x.metricType.startsWith('cs_')))
      setLoading(false)
    }).catch(console.error)
  }, [])

  const handleProjectStatusChange = async (projectId: string, newStatus: string): Promise<void> => {
    setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, status: newStatus } : p))
    try {
      await db.projects.update(projectId, { status: newStatus })
    } catch (err) {
      console.error(err)
      db.projects.list().then(setProjects).catch(console.error)
    }
  }

  const todayP0 = tasks.filter((t) => t.priority === 'P0' && t.status !== 'Done' && t.status !== 'Cancelled')
  const liveProjects = projects.filter((p) => p.status === 'Active')
  const avgProgress = liveProjects.length
    ? Math.round(liveProjects.reduce((s, p) => s + p.progress, 0) / liveProjects.length)
    : 0

  const pipelineContent = content.filter((c) => c.status !== 'Published' && c.status !== 'Archived')
  const upcomingEvents = events
    .filter((e) => e.dateTime && new Date(e.dateTime) > new Date())
    .sort((a, b) => new Date(a.dateTime ?? '').getTime() - new Date(b.dateTime ?? '').getTime())
  const nextEvent = upcomingEvents[0]

  const todayTasks = tasks
    .filter((t) => t.status !== 'Done' && t.status !== 'Cancelled')
    .sort((a, b) => {
      const order: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }
      return (order[a.priority] ?? 3) - (order[b.priority] ?? 3)
    })
    .slice(0, 8)

  const activeBriefs = projects.filter((p) => p.status === 'Active').slice(0, 5)

  const unreadInbox = inboxItems.filter((i) => i.status === 'New').length

  const handleCompleteTask = async (id: string) => {
    setCompletingTask(id)
    setTimeout(async () => {
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: 'Done' } : t))
      try { await db.tasks.update(id, { status: 'Done' }) } catch { /* revert if needed */ }
      setCompletingTask(null)
    }, 400)
  }

  const stageCount = (stage: string) =>
    content.filter((c) => c.status === stage).length

  const filteredContent = activeStage
    ? content.filter((c) => c.status === activeStage)
    : pipelineContent

  return (
    <div className="min-h-full p-6">
      {/* ── AI Briefing Banner ── */}
      <AnimatePresence>
        {showBriefingBanner && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-4"
          >
            <div className="flex items-center justify-between rounded-[8px] border-l-[3px] border-l-[var(--accent)] border border-[var(--accent)]/20 bg-[var(--accent-muted)] px-4 py-3">
              <div className="flex items-center gap-3">
                <Sun className="h-4 w-4 flex-shrink-0 text-[var(--accent)]" />
                <span className="text-[13px] text-[var(--text-primary)]">
                  {currentHour < 12 ? 'Good morning' : 'Good afternoon'}, Drew. Your AI briefing is ready.
                </span>
              </div>
              <Link
                href="/briefing"
                className="flex items-center gap-1 text-[13px] font-medium text-[var(--accent)] hover:underline whitespace-nowrap"
              >
                Start Briefing →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <PageHeader
        title="Dashboard"
        description={`Good morning — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
      />

      {/* ── Row 1: Stat Cards ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today's P0 Tasks"
          value={todayP0.length}
          icon={CheckSquare2}
          subtext={todayP0[0]?.name ?? 'All clear'}
        >
          {todayP0.length > 1 && (
            <div className="space-y-1">
              {todayP0.slice(0, 3).map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <PriorityDot priority={t.priority} />
                  <span className="truncate text-[12px] text-[var(--text-secondary)]">{t.name}</span>
                </div>
              ))}
            </div>
          )}
        </StatCard>

        <StatCard
          label="Live Projects"
          value={liveProjects.length}
          icon={FolderKanban}
          subtext={`${avgProgress}% avg progress`}
        >
          <ProgressBar value={avgProgress} showLabel />
        </StatCard>

        <StatCard
          label="Content in Pipeline"
          value={pipelineContent.length}
          icon={Film}
          subtext={`${content.filter((c) => c.status === 'Scheduled').length} scheduled`}
        >
          <div className="flex gap-1 flex-wrap">
            {CONTENT_STAGES.map((s) => {
              const count = stageCount(s)
              if (!count) return null
              return (
                <span key={s} className="rounded-[4px] bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]">
                  {s} {count}
                </span>
              )
            })}
          </div>
        </StatCard>

        <StatCard
          label="Next Shoot / Event"
          value={nextEvent ? nextEvent.name.split(' ').slice(0, 3).join(' ') + '...' : 'None scheduled'}
          icon={CalendarDays}
          subtext={nextEvent ? `In ${daysUntil(nextEvent.dateTime ?? '')} days · ${nextEvent.location ?? ''}` : 'No upcoming events'}
        />

        {/* Creative Studio summary */}
        <StatCard
          label="Creative Studio"
          value={(() => {
            const done = csMetrics.filter((m) => m.metricType === 'cs_task_completed').length
            return done > 0 ? `${done} done` : 'No activity'
          })()}
          icon={Sparkles}
          subtext={(() => {
            const focusMin = csMetrics
              .filter((m) => m.metricType === 'cs_focus_session')
              .reduce((s, m) => s + (m.metricValue ?? 0), 0)
            const sessions = csMetrics.filter((m) => m.metricType === 'cs_focus_session').length
            if (sessions === 0) return '7-day overview'
            return `${focusMin}m focus · ${sessions} session${sessions !== 1 ? 's' : ''}`
          })()}
        >
          <Link href="/creative-studio" className="mt-2 inline-block text-[12px] text-[var(--accent)] hover:underline">
            Open Studio →
          </Link>
        </StatCard>
      </div>

      {/* ── Row 2: Today's Tasks + Projects Board ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Today's Tasks */}
        <div className="lg:col-span-4 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Today&apos;s Tasks</h2>
            <Link href="/tasks" className="text-[12px] text-[var(--accent)] hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-1">
            <AnimatePresence mode="popLayout">
              {todayTasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-[6px] px-2 py-2 group',
                    'hover:bg-[var(--surface-2)] transition-colors duration-150',
                    completingTask === task.id && 'opacity-50'
                  )}
                >
                  <button
                    onClick={() => handleCompleteTask(task.id)}
                    className={cn(
                      'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border',
                      'transition-all duration-150',
                      'hover:border-[var(--accent)] hover:bg-[var(--accent-muted)]',
                      task.status === 'Done'
                        ? 'border-[var(--success)] bg-[var(--success)]'
                        : 'border-[var(--border-strong)]'
                    )}
                    aria-label={`Complete task: ${task.name}`}
                  >
                    {task.status === 'Done' && <Check className="h-2.5 w-2.5 text-white" />}
                  </button>
                  <PriorityDot priority={task.priority} className="flex-shrink-0" />
                  <span className={cn(
                    'flex-1 min-w-0 truncate text-[13px]',
                    task.status === 'Done'
                      ? 'text-[var(--text-tertiary)] line-through'
                      : 'text-[var(--text-primary)]'
                  )}>
                    {task.name}
                  </span>
                  {task.status === 'Blocked' && (
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-[var(--warning)]" />
                  )}
                  {task.dueDate && (
                    <span className={cn(
                      'flex-shrink-0 rounded-[4px] px-1.5 py-0.5 text-[11px]',
                      isOverdue(task.dueDate)
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-[var(--surface-2)] text-[var(--text-tertiary)]'
                    )}>
                      {formatDate(task.dueDate)}
                    </span>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {!loading && todayTasks.length === 0 && (
              <div className="py-8 text-center text-[13px] text-[var(--text-tertiary)]">
                No open tasks — you&apos;re operating clean.
              </div>
            )}
            {loading && (
              <div className="space-y-2 py-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-8 animate-pulse rounded-[6px] bg-[var(--surface-2)]" />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mini Kanban — draggable project board */}
        <div className="lg:col-span-8 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Projects</h2>
            <Link href="/projects" className="text-[12px] text-[var(--accent)] hover:underline">
              Full board
            </Link>
          </div>
          <KanbanBoard
            items={projects.filter((p) => PROJECT_COLUMNS.includes(p.status as ProjectStatus))}
            columns={PROJECT_COLUMNS}
            onStatusChange={handleProjectStatusChange}
            columnWidth="w-[180px]"
            columnMinHeight="0px"
            renderColumnHeader={(col, count) => (
              <div className="mb-2 flex items-center gap-2 px-2">
                <span className="text-[12px] font-medium text-[var(--text-secondary)]">{col}</span>
                <span className="rounded-full bg-[var(--surface-2)] px-1.5 text-[11px] text-[var(--text-tertiary)]">{count}</span>
              </div>
            )}
            renderCard={(project) => (
              <Link
                href={`/projects/${project.id}`}
                className={cn(
                  'block rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)]',
                  'hover:border-[var(--border-strong)] transition-all duration-150 overflow-hidden'
                )}
              >
                <div className="h-[6px] w-full bg-[var(--border)]">
                  <div className="h-full bg-[var(--accent)]" style={{ width: `${project.progress}%` }} />
                </div>
                <div className="p-2.5">
                  <p className="mb-1.5 text-[12px] font-medium leading-snug text-[var(--text-primary)] line-clamp-2">{project.name}</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-[4px] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] text-[var(--text-tertiary)]">{project.category}</span>
                    {project.deadline && (
                      <span className={cn('inline-flex items-center gap-1 text-[11px]', isOverdue(project.deadline) ? 'text-red-400' : isUpcomingSoon(project.deadline) ? 'text-amber-400' : 'text-[var(--text-tertiary)]')}>
                        {formatDate(project.deadline)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )}
          />
        </div>
      </div>

      {/* ── Row 3: Creative Queue + Content Pipeline ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Creative Queue */}
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Creative Queue</h2>
            <Link href="/briefs" className="text-[12px] text-[var(--accent)] hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {activeBriefs.map((project) => (
              <div key={project.id} className="flex items-center gap-3 rounded-[6px] px-2 py-2 hover:bg-[var(--surface-2)] transition-colors">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] bg-[var(--accent-muted)]">
                  <span className="text-[11px] font-bold text-[var(--accent)]">
                    {project.category ? project.category[0] : '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{project.name}</p>
                  <p className="text-[12px] text-[var(--text-tertiary)]">{project.category}</p>
                </div>
                <StatusBadge status={project.status} size="sm" />
              </div>
            ))}
            {activeBriefs.length === 0 && (
              <div className="py-6 text-center text-[13px] text-[var(--text-tertiary)]">No active briefs</div>
            )}
          </div>
        </div>

        {/* Content Pipeline */}
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Content Pipeline</h2>
            <Link href="/content" className="text-[12px] text-[var(--accent)] hover:underline">View all</Link>
          </div>
          {/* Stage pill row */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {CONTENT_STAGES.map((stage) => {
              const count = stageCount(stage)
              return (
                <button
                  key={stage}
                  onClick={() => setActiveStage(activeStage === stage ? null : stage)}
                  className={cn(
                    'flex items-center gap-1 rounded-[6px] border px-2.5 py-1 text-[12px] font-medium transition-all duration-150',
                    activeStage === stage
                      ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]'
                      : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                  )}
                >
                  {stage}
                  <span className={cn(
                    'rounded-full px-1 text-[11px]',
                    activeStage === stage ? 'bg-[var(--accent)] text-[var(--accent-fg)]' : 'bg-[var(--surface)] text-[var(--text-tertiary)]'
                  )}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {filteredContent.slice(0, 6).map((item) => (
              <div key={item.id} className="flex items-center gap-2.5 rounded-[6px] px-2 py-1.5 hover:bg-[var(--surface-2)] transition-colors">
                <StatusBadge status={item.status} size="sm" />
                <span className="flex-1 min-w-0 truncate text-[12px] text-[var(--text-primary)]">{item.title}</span>
                <span className="flex-shrink-0 text-[11px] text-[var(--text-tertiary)]">{item.format}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 4: Campaign Radar + Upcoming Events ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Campaign Radar */}
        <div className="lg:col-span-8 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Campaign Radar</h2>
            <Link href="/campaigns" className="text-[12px] text-[var(--accent)] hover:underline">View all</Link>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['Name', 'Goal', 'Status', 'Channels', 'Budget'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((camp) => (
                <tr key={camp.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                  <td className="px-4 py-3 text-[13px] font-medium text-[var(--text-primary)]">{camp.name}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-[4px] bg-[var(--surface-2)] px-1.5 py-0.5 text-[12px] text-[var(--text-secondary)]">
                      {camp.goal}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={camp.status} size="sm" /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {camp.channels.slice(0, 3).map((ch) => (
                        <span key={ch} className="rounded-[4px] bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--text-tertiary)]">
                          {ch}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[var(--text-secondary)]">
                    —
                  </td>
                </tr>
              ))}
              {!loading && campaigns.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[13px] text-[var(--text-tertiary)]">
                    No campaigns
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Upcoming Events */}
        <div className="lg:col-span-4 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Upcoming Events</h2>
            <Link href="/events" className="text-[12px] text-[var(--accent)] hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {upcomingEvents.slice(0, 4).map((event) => {
              const d = new Date(event.dateTime ?? '')
              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="flex items-start gap-3 rounded-[6px] p-2 hover:bg-[var(--surface-2)] transition-colors"
                >
                  <div className="flex-shrink-0 text-center w-10">
                    <div className="text-[16px] font-bold leading-none text-[var(--text-primary)]">
                      {d.getDate()}
                    </div>
                    <div className="text-[11px] text-[var(--text-tertiary)] uppercase">
                      {d.toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{event.name}</p>
                    <p className="truncate text-[12px] text-[var(--text-tertiary)]">{event.type}</p>
                    {event.location && (
                      <p className="truncate text-[11px] text-[var(--text-tertiary)]">{event.location}</p>
                    )}
                  </div>
                  <StatusBadge status={event.status} size="sm" />
                </Link>
              )
            })}
            {!loading && upcomingEvents.length === 0 && (
              <div className="py-6 text-center text-[13px] text-[var(--text-tertiary)]">No upcoming events</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Inbox Banner ── */}
      {unreadInbox > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'flex items-center justify-between rounded-[8px] border',
            'border-red-500/20 bg-red-500/5 px-4 py-3'
          )}
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-400" />
            <span className="text-[13px] text-[var(--text-primary)]">
              You have <strong>{unreadInbox}</strong> unprocessed item{unreadInbox !== 1 ? 's' : ''} in your Inbox
            </span>
          </div>
          <Link href="/inbox" className="text-[13px] font-medium text-[var(--accent)] hover:underline">
            Process now →
          </Link>
        </motion.div>
      )}
    </div>
  )
}
