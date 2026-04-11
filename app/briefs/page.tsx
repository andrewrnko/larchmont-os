'use client'

import { useState } from 'react'
import { Plus, FileText, Image, Camera } from 'lucide-react'
import { useBriefStore, useProjectStore } from '@/lib/store'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'
import type { BriefType, BriefStatus } from '@/lib/types'

const BRIEF_TYPES: Array<BriefType | 'All'> = [
  'All', 'Video', 'Brand', 'Web', 'Ad Campaign', 'Event', 'Print', 'Copy',
]

const BRIEF_STATUSES: Array<BriefStatus | 'All'> = [
  'All', 'Draft', 'Approved', 'In Production', 'Locked',
]

const BRIEF_TYPE_COLORS: Record<BriefType, string> = {
  'Video':      'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  'Brand':      'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  'Web':        'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
  'Ad Campaign':'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  'Event':      'bg-green-500/10 text-green-400 border border-green-500/20',
  'Print':      'bg-pink-500/10 text-pink-400 border border-pink-500/20',
  'Copy':       'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20',
}

function formatDate(d?: string) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function BriefsPage() {
  const { briefs } = useBriefStore()
  const { projects } = useProjectStore()

  const [typeFilter, setTypeFilter] = useState<BriefType | 'All'>('All')
  const [statusFilter, setStatusFilter] = useState<BriefStatus | 'All'>('All')

  const filtered = briefs.filter((b) => {
    if (typeFilter !== 'All' && b.type !== typeFilter) return false
    if (statusFilter !== 'All' && b.status !== statusFilter) return false
    return true
  })

  const getProjectName = (projectId: string) => {
    return projects.find((p) => p.id === projectId)?.name ?? null
  }

  return (
    <div className="min-h-full p-6">
      <PageHeader
        title="Creative Briefs"
        description={`${briefs.length} brief${briefs.length !== 1 ? 's' : ''} total`}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
              aria-label="Filter by type"
            >
              {BRIEF_TYPES.map((t) => (
                <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>
              ))}
            </select>
            <button className="flex items-center gap-1.5 rounded-[6px] bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-90 transition-opacity">
              <Plus className="h-4 w-4" />
              New Brief
            </button>
          </div>
        }
      />

      {/* Filter Pills — Type */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {BRIEF_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={cn(
              'rounded-[6px] border px-3 py-1 text-[12px] font-medium transition-all duration-150',
              typeFilter === t
                ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filter Pills — Status */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {BRIEF_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-[6px] border px-3 py-1 text-[12px] font-medium transition-all duration-150',
              statusFilter === s
                ? 'border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-tertiary)] hover:border-[var(--border-strong)]'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((brief) => {
            const projectName = getProjectName(brief.projectId)
            return (
              <div
                key={brief.id}
                className={cn(
                  'group rounded-[10px] border border-[var(--border)] bg-[var(--surface)]',
                  'hover:border-[var(--border-strong)] transition-all duration-150',
                  'flex flex-col p-4'
                )}
              >
                {/* Header row: type badge + status badge */}
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium',
                      BRIEF_TYPE_COLORS[brief.type]
                    )}
                  >
                    {brief.type}
                  </span>
                  <StatusBadge status={brief.status} size="sm" />
                </div>

                {/* Brief name */}
                <h3 className="mb-1.5 text-[14px] font-semibold leading-snug text-[var(--text-primary)]">
                  {brief.name}
                </h3>

                {/* Objective */}
                {brief.objective && (
                  <p className="mb-3 line-clamp-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                    {brief.objective}
                  </p>
                )}

                {/* Tone tags */}
                {brief.tone.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {brief.tone.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-[4px] bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--text-tertiary)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Metadata row */}
                <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3">
                  {brief.shots.length > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
                      <Camera className="h-3 w-3" />
                      {brief.shots.length} shot{brief.shots.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {brief.moodBoardImages.length > 0 && (
                    <span className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
                      <Image className="h-3 w-3" />
                      {brief.moodBoardImages.length} image{brief.moodBoardImages.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {projectName && (
                    <span className="ml-auto max-w-[140px] truncate rounded-[4px] bg-[var(--accent-muted)] px-1.5 py-0.5 text-[11px] text-[var(--accent)]">
                      {projectName}
                    </span>
                  )}
                </div>

                {/* Approval date */}
                {brief.approvalDate && (
                  <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                    Approved {formatDate(brief.approvalDate)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          heading="No briefs found"
          subtext={
            typeFilter !== 'All' || statusFilter !== 'All'
              ? 'Try adjusting your filters to see more briefs.'
              : 'Create your first creative brief to get started.'
          }
          cta={
            typeFilter === 'All' && statusFilter === 'All' ? (
              <button className="flex items-center gap-1.5 rounded-[6px] bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-fg)]">
                <Plus className="h-4 w-4" />
                New Brief
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  )
}
