'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Table2, LayoutGrid, Megaphone, Pencil, Trash2, X, Kanban } from 'lucide-react'
import { db } from '@/lib/db'
import type { Campaign } from '@/lib/db'
import { PageHeader } from '@/components/shared/page-header'
import { ViewSwitcher } from '@/components/shared/view-switcher'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/shared/skeleton'
import { KanbanBoard } from '@/components/shared/kanban-board'
import { cn } from '@/lib/utils'

type ViewMode = 'table' | 'cards' | 'board'
type CampaignStatus = 'Planned' | 'Active' | 'Paused' | 'Complete'

// ─── Goal pill ─────────────────────────────────────────────────────────────
const GOAL_COLORS: Record<string, string> = {
  'Awareness':    'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  'Lead Gen':     'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  'Conversion':   'bg-green-500/10 text-green-400 border border-green-500/20',
  'Retention':    'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  'Brand Equity': 'bg-pink-500/10 text-pink-400 border border-pink-500/20',
}

const GOAL_FALLBACK = 'bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]'

function GoalPill({ goal }: { goal: string }) {
  if (!goal) return <span className="text-[12px] text-[var(--text-tertiary)]">—</span>
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11px] font-medium',
        GOAL_COLORS[goal] ?? GOAL_FALLBACK
      )}
    >
      {goal}
    </span>
  )
}

function ChannelChips({ channels }: { channels: string[] }) {
  if (!channels || channels.length === 0) {
    return <span className="text-[12px] text-[var(--text-tertiary)]">—</span>
  }
  const visible = channels.slice(0, 3)
  const overflow = channels.length - 3
  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((ch) => (
        <span
          key={ch}
          className="inline-flex items-center rounded-[4px] bg-[var(--surface-2)] border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]"
        >
          {ch}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-[11px] text-[var(--text-tertiary)]">+{overflow} more</span>
      )}
    </div>
  )
}

const CAMPAIGN_STATUSES: CampaignStatus[] = ['Planned', 'Active', 'Paused', 'Complete']

// ─── Modal ─────────────────────────────────────────────────────────────────
interface ModalFields {
  name: string
  goal: string
  status: string
  channels: string
}

const EMPTY_FIELDS: ModalFields = {
  name: '',
  goal: 'Awareness',
  status: 'Planned',
  channels: '',
}

interface CampaignModalProps {
  initial?: ModalFields
  onClose: () => void
  onSave: (fields: ModalFields) => void
}

function CampaignModal({ initial = EMPTY_FIELDS, onClose, onSave }: CampaignModalProps) {
  const [fields, setFields] = useState<ModalFields>(initial)
  const overlayRef = useRef<HTMLDivElement>(null)

  function set(key: keyof ModalFields, val: string) {
    setFields((prev) => ({ ...prev, [key]: val }))
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fields.name.trim()) return
    onSave(fields)
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
            {initial.name ? 'Edit Campaign' : 'New Campaign'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-[6px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={fields.name}
              onChange={(e) => set('name', e.target.value)}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none"
              placeholder="Campaign name"
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">Goal</label>
            <input
              type="text"
              list="goal-suggestions"
              value={fields.goal}
              onChange={(e) => set('goal', e.target.value)}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none"
              placeholder="e.g. Awareness, Lead Gen, Conversion"
            />
            <datalist id="goal-suggestions">
              {Object.keys(GOAL_COLORS).map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">Status</label>
            <select
              value={fields.status}
              onChange={(e) => set('status', e.target.value)}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            >
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">
              Channels
              <span className="ml-1 text-[var(--text-tertiary)] font-normal">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={fields.channels}
              onChange={(e) => set('channels', e.target.value)}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none"
              placeholder="e.g. Instagram, Email, TikTok"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[6px] border border-[var(--border)] px-4 py-1.5 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-[6px] bg-[var(--accent)] px-4 py-1.5 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-90 transition-opacity"
            >
              {initial.name ? 'Save Changes' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Board Card ────────────────────────────────────────────────────────────

const BOARD_COLUMN_COLORS: Record<string, string> = {
  'Planned':  'border-blue-500/30',
  'Active':   'border-green-500/30',
  'Paused':   'border-orange-500/30',
  'Complete': 'border-[var(--border)]',
}

function CampaignBoardCard({ campaign, onEdit, onDelete }: {
  campaign: Campaign
  onEdit: (c: Campaign) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="group rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3 hover:border-[var(--border-strong)] transition-all">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="flex-1 text-[13px] font-medium leading-snug text-[var(--text-primary)]">
          {campaign.name}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onEdit(campaign) }}
            className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(campaign.id) }}
            className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      {campaign.goal && <GoalPill goal={campaign.goal} />}
      {campaign.channels.length > 0 && (
        <div className="mt-2">
          <ChannelChips channels={campaign.channels} />
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('table')
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'All'>('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Campaign | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    db.campaigns.list()
      .then((data) => { setCampaigns(data); setLoading(false) })
      .catch((e) => { console.error(e); setLoading(false) })
  }, [])

  const viewOptions = [
    { value: 'table' as const, label: 'Table', icon: Table2 },
    { value: 'cards' as const, label: 'Cards', icon: LayoutGrid },
    { value: 'board' as const, label: 'Board', icon: Kanban },
  ]

  const handleStatusChange = async (campaignId: string, newStatus: string) => {
    const campaign = campaigns.find((c) => c.id === campaignId)
    if (!campaign) return
    const oldStatus = campaign.status
    setCampaigns((cs) => cs.map((c) => c.id === campaignId ? { ...c, status: newStatus } : c))
    try {
      await db.campaigns.update(campaignId, { status: newStatus })
    } catch {
      setCampaigns((cs) => cs.map((c) => c.id === campaignId ? { ...c, status: oldStatus } : c))
    }
  }

  const filtered = statusFilter === 'All'
    ? campaigns
    : campaigns.filter((c) => c.status === statusFilter)

  function openAdd() {
    setEditTarget(null)
    setModalOpen(true)
  }

  function openEdit(c: Campaign) {
    setEditTarget(c)
    setModalOpen(true)
  }

  function parseChannels(raw: string): string[] {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  async function handleSave(fields: ModalFields) {
    setModalOpen(false)
    const channels = parseChannels(fields.channels)

    const payload = {
      name: fields.name,
      goal: fields.goal || undefined,
      status: fields.status,
      channels,
    }

    if (editTarget) {
      const prev = campaigns
      const optimistic: Campaign = {
        ...editTarget,
        name: fields.name,
        goal: fields.goal,
        status: fields.status,
        channels,
      }
      setCampaigns((cs) => cs.map((c) => (c.id === editTarget.id ? optimistic : c)))
      try {
        const updated = await db.campaigns.update(editTarget.id, payload)
        setCampaigns((cs) => cs.map((c) => (c.id === updated.id ? updated : c)))
      } catch (err) {
        console.error(err)
        setCampaigns(prev)
      }
    } else {
      const tempId = `temp-${Date.now()}`
      const optimistic: Campaign = {
        id: tempId,
        name: fields.name,
        goal: fields.goal,
        status: fields.status,
        channels,
        createdAt: new Date().toISOString(),
      }
      const prev = campaigns
      setCampaigns((cs) => [...cs, optimistic])
      try {
        const created = await db.campaigns.insert(payload)
        setCampaigns((cs) => cs.map((c) => (c.id === tempId ? created : c)))
      } catch (err) {
        console.error(err)
        setCampaigns(prev)
      }
    }
  }

  async function handleDelete(id: string) {
    setDeleteConfirmId(null)
    const prev = campaigns
    setCampaigns((cs) => cs.filter((c) => c.id !== id))
    try {
      await db.campaigns.delete(id)
    } catch (err) {
      console.error(err)
      setCampaigns(prev)
    }
  }

  const modalInitial: ModalFields | undefined = editTarget
    ? {
        name: editTarget.name,
        goal: editTarget.goal,
        status: editTarget.status,
        channels: editTarget.channels.join(', '),
      }
    : undefined

  return (
    <div className="min-h-full p-6">
      <PageHeader
        title="Campaigns"
        description={`${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | 'All')}
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
              aria-label="Filter by status"
            >
              <option value="All">All Statuses</option>
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ViewSwitcher options={viewOptions} value={view} onChange={setView} />
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 rounded-[6px] bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              New Campaign
            </button>
          </div>
        }
      />

      {/* ── Loading skeletons ──────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} shape="row" />
          ))}
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!loading && campaigns.length === 0 && (
        <EmptyState
          icon={Megaphone}
          heading="No campaigns yet"
          subtext="Create your first campaign to start tracking goals, channels, and results."
          cta={
            <button
              onClick={openAdd}
              className="rounded-[6px] bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-fg)]"
            >
              New Campaign
            </button>
          }
        />
      )}

      {/* ── Table View ──────────────────────────────────────────────────── */}
      {!loading && campaigns.length > 0 && view === 'table' && (
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['Name', 'Goal', 'Status', 'Channels', ''].map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-[13px] font-medium text-[var(--text-primary)]">{c.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <GoalPill goal={c.goal} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <ChannelChips channels={c.channels} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
                        aria-label="Edit campaign"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {deleteConfirmId === c.id ? (
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="rounded-[4px] px-2 py-0.5 text-[11px] bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="rounded-[4px] px-2 py-0.5 text-[11px] text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(c.id)}
                          className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-400 transition-colors"
                          aria-label="Delete campaign"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-[13px] text-[var(--text-tertiary)]">
              No campaigns match this filter.
            </div>
          )}
        </div>
      )}

      {/* ── Cards View ──────────────────────────────────────────────────── */}
      {!loading && campaigns.length > 0 && view === 'cards' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] transition-all duration-150 p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">{c.name}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <GoalPill goal={c.goal} />
                    <StatusBadge status={c.status} />
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEdit(c)}
                    className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
                    aria-label="Edit campaign"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {deleteConfirmId === c.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="rounded-[4px] px-2 py-0.5 text-[11px] bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="rounded-[4px] px-2 py-0.5 text-[11px] text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(c.id)}
                      className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      aria-label="Delete campaign"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {c.channels.length > 0 && (
                <div className="mt-3">
                  <ChannelChips channels={c.channels} />
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-2 py-12 text-center text-[13px] text-[var(--text-tertiary)]">
              No campaigns match this filter.
            </div>
          )}
        </div>
      )}

      {/* ── Board View ──────────────────────────────────────────────────── */}
      {!loading && campaigns.length > 0 && view === 'board' && (
        <KanbanBoard
          items={campaigns}
          columns={CAMPAIGN_STATUSES}
          onStatusChange={handleStatusChange}
          renderCard={(campaign) => (
            <CampaignBoardCard
              campaign={campaign}
              onEdit={openEdit}
              onDelete={(id) => setDeleteConfirmId(id)}
            />
          )}
          getColumnBorderClass={(col) => BOARD_COLUMN_COLORS[col] ?? 'border-[var(--border)]'}
        />
      )}

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <CampaignModal
          initial={modalInitial}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
