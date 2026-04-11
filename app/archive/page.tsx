'use client'

import { useState, useEffect, useCallback } from 'react'
import { Archive, FolderKanban, CheckSquare, Megaphone, Film, RotateCcw } from 'lucide-react'
import { db, type Project, type Task, type Campaign, type ContentItem } from '@/lib/db'
import { useToastStore } from '@/lib/store'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'

type Tab = 'projects' | 'tasks' | 'campaigns' | 'content'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Tab Button ────────────────────────────────────────────────────────────────

function TabButton({ active, icon: Icon, label, count, onClick }: {
  active: boolean
  icon: React.ElementType
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-all',
        active
          ? 'bg-[var(--accent-muted)] text-[var(--accent)] border border-[var(--accent)]/30'
          : 'text-[var(--text-secondary)] border border-transparent hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
      {count > 0 && (
        <span className={cn(
          'rounded-full px-1.5 py-0.5 text-[11px] font-medium',
          active ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'bg-[var(--surface-2)] text-[var(--text-tertiary)]'
        )}>
          {count}
        </span>
      )}
    </button>
  )
}

// ── Restore Button ────────────────────────────────────────────────────────────

function RestoreButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 transition-all"
    >
      <RotateCcw className="h-3 w-3" />
      Restore
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ArchivePage() {
  const [tab, setTab] = useState<Tab>('projects')
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [content, setContent] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<string | null>(null)
  const { addToast } = useToastStore()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, t, c, ct] = await Promise.all([
        db.projects.list(),
        db.tasks.list(),
        db.campaigns.list(),
        db.content.list(),
      ])
      setProjects(p.filter((x) => x.status === 'Archived'))
      setTasks(t.filter((x) => x.status === 'Cancelled'))
      setCampaigns(c.filter((x) => x.status === 'Complete'))
      setContent(ct.filter((x) => x.status === 'Archived'))
    } catch {
      addToast({ type: 'error', message: 'Failed to load archive' })
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { load() }, [load])

  const restoreProject = async (id: string) => {
    setRestoring(id)
    try {
      await db.projects.update(id, { status: 'Active' })
      setProjects((prev) => prev.filter((p) => p.id !== id))
      addToast({ type: 'success', message: 'Project restored' })
    } catch {
      addToast({ type: 'error', message: 'Failed to restore' })
    } finally {
      setRestoring(null)
    }
  }

  const restoreTask = async (id: string) => {
    setRestoring(id)
    try {
      await db.tasks.update(id, { status: 'Not Started' })
      setTasks((prev) => prev.filter((t) => t.id !== id))
      addToast({ type: 'success', message: 'Task restored' })
    } catch {
      addToast({ type: 'error', message: 'Failed to restore' })
    } finally {
      setRestoring(null)
    }
  }

  const restoreCampaign = async (id: string) => {
    setRestoring(id)
    try {
      await db.campaigns.update(id, { status: 'Planned' })
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
      addToast({ type: 'success', message: 'Campaign restored' })
    } catch {
      addToast({ type: 'error', message: 'Failed to restore' })
    } finally {
      setRestoring(null)
    }
  }

  const restoreContent = async (id: string) => {
    setRestoring(id)
    try {
      await db.content.update(id, { status: 'Draft' })
      setContent((prev) => prev.filter((c) => c.id !== id))
      addToast({ type: 'success', message: 'Content item restored' })
    } catch {
      addToast({ type: 'error', message: 'Failed to restore' })
    } finally {
      setRestoring(null)
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'projects', label: 'Projects', icon: FolderKanban, count: projects.length },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, count: tasks.length },
    { id: 'campaigns', label: 'Campaigns', icon: Megaphone, count: campaigns.length },
    { id: 'content', label: 'Content', icon: Film, count: content.length },
  ]

  const totalCount = projects.length + tasks.length + campaigns.length + content.length

  return (
    <div className="min-h-full p-6">
      <PageHeader
        title="Archive"
        description={`${totalCount} archived item${totalCount !== 1 ? 's' : ''}`}
      />

      {/* Tab bar */}
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <TabButton
            key={t.id}
            active={tab === t.id}
            icon={t.icon}
            label={t.label}
            count={t.count}
            onClick={() => setTab(t.id)}
          />
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-[8px] bg-[var(--surface-2)]" />
          ))}
        </div>
      ) : (
        <>
          {/* Projects tab */}
          {tab === 'projects' && (
            projects.length === 0 ? (
              <EmptyState icon={FolderKanban} heading="No archived projects" subtext="Projects you archive will appear here." />
            ) : (
              <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
                {projects.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <FolderKanban className="h-4 w-4 flex-shrink-0 text-[var(--text-tertiary)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{p.name}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">{p.category || 'Uncategorized'} · Archived {formatDate(p.createdAt)}</p>
                    </div>
                    <RestoreButton onClick={() => restoreProject(p.id)} loading={restoring === p.id} />
                  </div>
                ))}
              </div>
            )
          )}

          {/* Tasks tab */}
          {tab === 'tasks' && (
            tasks.length === 0 ? (
              <EmptyState icon={CheckSquare} heading="No cancelled tasks" subtext="Cancelled tasks will appear here." />
            ) : (
              <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
                {tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={cn(
                      'h-2 w-2 flex-shrink-0 rounded-full',
                      t.priority === 'P0' ? 'bg-red-500' : t.priority === 'P1' ? 'bg-orange-400' : t.priority === 'P2' ? 'bg-yellow-400' : 'bg-[var(--text-tertiary)]'
                    )} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{t.name}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">{t.priority} · Cancelled {t.dueDate ? formatDate(t.dueDate) : ''}</p>
                    </div>
                    <RestoreButton onClick={() => restoreTask(t.id)} loading={restoring === t.id} />
                  </div>
                ))}
              </div>
            )
          )}

          {/* Campaigns tab */}
          {tab === 'campaigns' && (
            campaigns.length === 0 ? (
              <EmptyState icon={Megaphone} heading="No complete campaigns" subtext="Campaigns marked Complete will appear here." />
            ) : (
              <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
                {campaigns.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <Megaphone className="h-4 w-4 flex-shrink-0 text-[var(--text-tertiary)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{c.name}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">{c.goal || 'No goal'} · {c.channels.join(', ') || 'No channels'}</p>
                    </div>
                    <RestoreButton onClick={() => restoreCampaign(c.id)} loading={restoring === c.id} />
                  </div>
                ))}
              </div>
            )
          )}

          {/* Content tab */}
          {tab === 'content' && (
            content.length === 0 ? (
              <EmptyState icon={Film} heading="No archived content" subtext="Content items you archive will appear here." />
            ) : (
              <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
                {content.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <Film className="h-4 w-4 flex-shrink-0 text-[var(--text-tertiary)]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{c.title}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">{c.format || 'Unknown format'} · Archived {formatDate(c.createdAt)}</p>
                    </div>
                    <RestoreButton onClick={() => restoreContent(c.id)} loading={restoring === c.id} />
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
