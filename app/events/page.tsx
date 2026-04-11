'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, List, CalendarDays, Calendar, ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react'
import { db } from '@/lib/db'
import type { AppEvent } from '@/lib/db'
import { PageHeader } from '@/components/shared/page-header'
import { ViewSwitcher } from '@/components/shared/view-switcher'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/shared/skeleton'
import { cn } from '@/lib/utils'

type ViewMode = 'list' | 'calendar'
type EventType =
  | 'Production Shoot'
  | 'Brand Event'
  | 'Community Activation'
  | 'Client Meeting'
  | 'Podcast'
  | 'Trade Show'

// ─── Color coding by event type ────────────────────────────────────────────
const EVENT_TYPE_COLORS: Record<string, string> = {
  'Production Shoot':     'border-blue-500 bg-blue-500',
  'Brand Event':          'border-purple-500 bg-purple-500',
  'Community Activation': 'border-green-500 bg-green-500',
  'Client Meeting':       'border-yellow-500 bg-yellow-500',
  'Podcast':              'border-orange-500 bg-orange-500',
  'Trade Show':           'border-pink-500 bg-pink-500',
}

const EVENT_TYPE_PILL: Record<string, string> = {
  'Production Shoot':     'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  'Brand Event':          'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  'Community Activation': 'bg-green-500/10 text-green-400 border border-green-500/20',
  'Client Meeting':       'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20',
  'Podcast':              'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  'Trade Show':           'bg-pink-500/10 text-pink-400 border border-pink-500/20',
}

const EVENT_TYPES: EventType[] = [
  'Production Shoot',
  'Brand Event',
  'Community Activation',
  'Client Meeting',
  'Podcast',
  'Trade Show',
]

const EVENT_STATUSES = ['Upcoming', 'Confirmed', 'Cancelled', 'Complete'] as const

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTH_ABBREV = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_ABBREV = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ─── Helpers ───────────────────────────────────────────────────────────────
function getCountdown(dateStr: string): string | null {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return null
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return `in ${diff} days`
}

function isPast(dateStr: string): boolean {
  return new Date(dateStr) < new Date()
}

function groupByMonth(evts: AppEvent[]): Map<string, AppEvent[]> {
  const map = new Map<string, AppEvent[]>()
  for (const evt of evts) {
    if (!evt.dateTime) continue
    const d = new Date(evt.dateTime)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(evt)
  }
  return map
}

function calendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

// ─── Modal ─────────────────────────────────────────────────────────────────
interface ModalFields {
  name: string
  type: string
  status: string
  date_time: string
  location: string
}

const EMPTY_FIELDS: ModalFields = {
  name: '',
  type: 'Production Shoot',
  status: 'Upcoming',
  date_time: '',
  location: '',
}

interface EventModalProps {
  initial?: ModalFields
  onClose: () => void
  onSave: (fields: ModalFields) => void
}

function EventModal({ initial = EMPTY_FIELDS, onClose, onSave }: EventModalProps) {
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
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
            {initial.name ? 'Edit Event' : 'Add Event'}
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
              placeholder="Event name"
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">Type</label>
            <select
              value={fields.type}
              onChange={(e) => set('type', e.target.value)}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">Status</label>
            <select
              value={fields.status}
              onChange={(e) => set('status', e.target.value)}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            >
              {EVENT_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">Date & Time</label>
            <input
              type="datetime-local"
              value={fields.date_time}
              onChange={(e) => set('date_time', e.target.value)}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">Location</label>
            <input
              type="text"
              value={fields.location}
              onChange={(e) => set('location', e.target.value)}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none"
              placeholder="Location (optional)"
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
              {initial.name ? 'Save Changes' : 'Add Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function EventsPage() {
  const [events, setEvents] = useState<AppEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('list')
  const [typeFilter, setTypeFilter] = useState<EventType | 'All'>('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AppEvent | null>(null)

  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())

  useEffect(() => {
    db.events.list()
      .then((data) => { setEvents(data); setLoading(false) })
      .catch((e) => { console.error(e); setLoading(false) })
  }, [])

  const viewOptions = [
    { value: 'list' as const, label: 'List', icon: List },
    { value: 'calendar' as const, label: 'Calendar', icon: CalendarDays },
  ]

  const filtered = (typeFilter === 'All' ? events : events.filter((e) => e.type === typeFilter))
    .slice()
    .sort((a, b) => {
      const ta = a.dateTime ? new Date(a.dateTime).getTime() : Infinity
      const tb = b.dateTime ? new Date(b.dateTime).getTime() : Infinity
      return ta - tb
    })

  // ─── List view: group chronologically by month ────────────────────────
  const grouped = groupByMonth(filtered)
  const sortedKeys = Array.from(grouped.keys()).sort()

  // ─── Calendar view: events for current displayed month ────────────────
  const calEvents = events.filter((e) => {
    if (!e.dateTime) return false
    const d = new Date(e.dateTime)
    return d.getFullYear() === calYear && d.getMonth() === calMonth
  })

  const eventsByDay = new Map<number, typeof calEvents>()
  for (const e of calEvents) {
    if (!e.dateTime) continue
    const day = new Date(e.dateTime).getDate()
    if (!eventsByDay.has(day)) eventsByDay.set(day, [])
    eventsByDay.get(day)!.push(e)
  }

  const cells = calendarDays(calYear, calMonth)
  const today = new Date()
  const isCurrentMonthYear = today.getFullYear() === calYear && today.getMonth() === calMonth

  function prevMonth() {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11) }
    else setCalMonth((m) => m - 1)
  }

  function nextMonth() {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0) }
    else setCalMonth((m) => m + 1)
  }

  function openAdd() {
    setEditTarget(null)
    setModalOpen(true)
  }

  function openEdit(evt: AppEvent) {
    setEditTarget(evt)
    setModalOpen(true)
  }

  async function handleSave(fields: ModalFields) {
    setModalOpen(false)

    const payload = {
      name: fields.name,
      type: fields.type,
      status: fields.status,
      date_time: fields.date_time || undefined,
      location: fields.location || undefined,
    }

    if (editTarget) {
      // Optimistic update
      const prev = events
      const optimistic: AppEvent = {
        ...editTarget,
        name: fields.name,
        type: fields.type,
        status: fields.status,
        dateTime: fields.date_time || undefined,
        location: fields.location || undefined,
      }
      setEvents((es) => es.map((e) => (e.id === editTarget.id ? optimistic : e)))
      try {
        const updated = await db.events.update(editTarget.id, payload)
        setEvents((es) => es.map((e) => (e.id === updated.id ? updated : e)))
      } catch (err) {
        console.error(err)
        setEvents(prev)
      }
    } else {
      // Optimistic insert with temp id
      const tempId = `temp-${Date.now()}`
      const optimistic: AppEvent = {
        id: tempId,
        name: fields.name,
        type: fields.type,
        status: fields.status,
        dateTime: fields.date_time || undefined,
        location: fields.location || undefined,
        createdAt: new Date().toISOString(),
      }
      const prev = events
      setEvents((es) => [...es, optimistic])
      try {
        const created = await db.events.insert(payload)
        setEvents((es) => es.map((e) => (e.id === tempId ? created : e)))
      } catch (err) {
        console.error(err)
        setEvents(prev)
      }
    }
  }

  const modalInitial: ModalFields | undefined = editTarget
    ? {
        name: editTarget.name,
        type: editTarget.type,
        status: editTarget.status,
        date_time: editTarget.dateTime
          ? new Date(editTarget.dateTime).toISOString().slice(0, 16)
          : '',
        location: editTarget.location ?? '',
      }
    : undefined

  return (
    <div className="min-h-full p-6">
      <PageHeader
        title="Events & Shoots"
        description={`${events.length} event${events.length !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as EventType | 'All')}
              className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--text-secondary)] focus:border-[var(--accent)] focus:outline-none"
              aria-label="Filter by type"
            >
              <option value="All">All Types</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <ViewSwitcher options={viewOptions} value={view} onChange={setView} />
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 rounded-[6px] bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Add Event
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
      {!loading && events.length === 0 && (
        <EmptyState
          icon={Calendar}
          heading="No events yet"
          subtext="Schedule your first shoot or event."
          cta={
            <button
              onClick={() => setModalOpen(true)}
              className="rounded-[6px] bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-fg)]"
            >
              Add Event
            </button>
          }
        />
      )}

      {/* ── List View ───────────────────────────────────────────────────── */}
      {!loading && view === 'list' && events.length > 0 && (
        <div className="space-y-8">
          {sortedKeys.length === 0 && (
            <EmptyState
              icon={Calendar}
              heading="No events found"
              subtext="Add your first event or adjust the type filter."
              cta={
                <button
                  onClick={openAdd}
                  className="rounded-[6px] bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-fg)]"
                >
                  Add Event
                </button>
              }
            />
          )}

          {sortedKeys.map((key) => {
            const [yr, mo] = key.split('-').map(Number)
            const monthLabel = `${MONTH_NAMES[mo - 1]} ${yr}`
            const monthEvents = grouped.get(key)!

            return (
              <div key={key}>
                {/* Month header */}
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-[13px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                    {monthLabel}
                  </h2>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <span className="text-[12px] text-[var(--text-tertiary)]">{monthEvents.length}</span>
                </div>

                {/* Event rows */}
                <div className="space-y-2">
                  {monthEvents.map((evt) => {
                    const dt = evt.dateTime ? new Date(evt.dateTime) : null
                    const day = dt ? dt.getDate() : null
                    const monthAbbr = dt ? MONTH_ABBREV[dt.getMonth()] : null
                    const past = evt.dateTime ? isPast(evt.dateTime) : false
                    const countdown = evt.dateTime ? getCountdown(evt.dateTime) : null
                    const borderColor =
                      EVENT_TYPE_COLORS[evt.type]?.split(' ')[0] ?? 'border-[var(--border-strong)]'

                    return (
                      <div
                        key={evt.id}
                        className={cn(
                          'flex items-start gap-4 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--border-strong)]',
                          'border-l-4',
                          borderColor,
                          past && 'opacity-60'
                        )}
                      >
                        {/* Date block */}
                        <div className="flex-shrink-0 w-10 text-center">
                          {day !== null ? (
                            <>
                              <div className="text-[16px] font-bold leading-none text-[var(--text-primary)]">
                                {day}
                              </div>
                              <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{monthAbbr}</div>
                            </>
                          ) : (
                            <div className="text-[12px] text-[var(--text-tertiary)] mt-1">TBD</div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                                {evt.name}
                              </span>
                              {evt.type && (
                                <span
                                  className={cn(
                                    'inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium flex-shrink-0',
                                    EVENT_TYPE_PILL[evt.type] ??
                                      'bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]'
                                  )}
                                >
                                  {evt.type}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={evt.status} size="sm" />
                              <button
                                onClick={() => openEdit(evt)}
                                className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
                                aria-label="Edit event"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                            {evt.location && (
                              <span className="text-[12px] text-[var(--text-secondary)]">
                                {evt.location}
                              </span>
                            )}
                            {countdown && !past && (
                              <span className="text-[11px] font-medium text-[var(--accent)]">
                                {countdown}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Calendar View ───────────────────────────────────────────────── */}
      {!loading && view === 'calendar' && events.length > 0 && (
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          {/* Calendar header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <button
              onClick={prevMonth}
              className="flex items-center justify-center rounded-[6px] p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
              {MONTH_NAMES[calMonth]} {calYear}
            </h2>
            <button
              onClick={nextMonth}
              className="flex items-center justify-center rounded-[6px] p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-[var(--border)]">
            {DAY_ABBREV.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              const dayEvents = day ? (eventsByDay.get(day) ?? []) : []
              const isToday = isCurrentMonthYear && day === today.getDate()

              return (
                <div
                  key={idx}
                  className={cn(
                    'min-h-[90px] p-1.5 border-b border-r border-[var(--border)]',
                    (idx + 1) % 7 === 0 && 'border-r-0',
                    idx >= cells.length - 7 && 'border-b-0',
                    !day && 'bg-[var(--surface-2)]'
                  )}
                >
                  {day && (
                    <>
                      <div
                        className={cn(
                          'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium',
                          isToday
                            ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                            : 'text-[var(--text-secondary)]'
                        )}
                      >
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((evt) => {
                          const bgColor =
                            EVENT_TYPE_COLORS[evt.type]?.split(' ')[1] ?? 'bg-[var(--accent-muted)]'
                          return (
                            <div
                              key={evt.id}
                              title={evt.name}
                              className={cn(
                                'truncate rounded-[3px] px-1 py-0.5 text-[11px] font-medium text-white leading-snug opacity-80',
                                bgColor
                              )}
                            >
                              {evt.name}
                            </div>
                          )
                        })}
                        {dayEvents.length > 3 && (
                          <div className="px-1 text-[11px] text-[var(--text-tertiary)]">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <EventModal
          initial={modalInitial}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
