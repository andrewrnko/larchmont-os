// Daily Repeatables — collapsible panel with Morning / Midday / Evening columns.
// Checkboxes reset daily. Streak counter per item. Category tags.

'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown, ChevronUp, Plus, Trash2, Flame, Sunrise, Sun, Moon, X, Archive,
} from 'lucide-react'
import { useRepeatableStore } from './repeatable-store'
import type { TimeSlot } from './repeatable-types'

const SLOTS: { key: TimeSlot; label: string; icon: typeof Sunrise }[] = [
  { key: 'morning', label: 'Morning', icon: Sunrise },
  { key: 'midday', label: 'Midday', icon: Sun },
  { key: 'evening', label: 'Evening', icon: Moon },
]

const CATEGORIES = ['Ops', 'Finance', 'Content', 'Client', 'Health', 'Admin']

export function DailyRepeatables() {
  const items = useRepeatableStore((s) => s.items)
  const checks = useRepeatableStore((s) => s.checks)
  const log = useRepeatableStore((s) => s.log)
  const hydrated = useRepeatableStore((s) => s.hydrated)
  const hydrate = useRepeatableStore((s) => s.hydrate)
  const addItem = useRepeatableStore((s) => s.addItem)
  const removeItem = useRepeatableStore((s) => s.removeItem)
  const toggleCheck = useRepeatableStore((s) => s.toggleCheck)
  const isChecked = useRepeatableStore((s) => s.isChecked)

  // Default to collapsed — the expanded panel takes a lot of vertical space.
  const [collapsed, setCollapsed] = useState(true)
  const [logOpen, setLogOpen] = useState(false)
  const [addingSlot, setAddingSlot] = useState<TimeSlot | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newCat, setNewCat] = useState('')

  useEffect(() => { if (!hydrated) hydrate() }, [hydrated, hydrate])

  if (!hydrated) return null

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayChecked = checks.filter((c) => c.date === todayStr && c.checked).length
  const total = items.length
  const pct = total > 0 ? Math.round((todayChecked / total) * 100) : 0

  if (collapsed) {
    return (
      <div className="flex items-center justify-between border-b border-[color:var(--border)] bg-[color:var(--bg1)] px-4 py-1">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[13px] font-medium uppercase tracking-[0.06em] text-[color:var(--cs-accent)]">Daily Repeatables</span>
          {total > 0 && (
            <span className="font-mono text-[13px] text-[#888780]">
              {todayChecked}/{total} · {pct}%
            </span>
          )}
        </div>
        <button onClick={() => setCollapsed(false)} className="text-[#888780] hover:text-white">
          <ChevronDown size={14} />
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="border-b border-[color:var(--border)] bg-[color:var(--bg1)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[13px] font-medium uppercase tracking-[0.06em] text-[color:var(--cs-accent)]">Daily Repeatables</span>
            {total > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-20 rounded-full bg-[rgba(255,255,255,0.07)]">
                  <div
                    className="h-full rounded-full bg-[color:var(--cs-accent)] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-mono text-[13px] text-[#888780]">{pct}%</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-[15px] text-[#888780]">
            <button onClick={() => setLogOpen(true)} className="flex items-center gap-1 hover:text-white">
              <Archive size={10} /> History
            </button>
            <button onClick={() => setCollapsed(true)} className="hover:text-white">
              <ChevronUp size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {SLOTS.map(({ key, label, icon: Icon }) => {
            const slotItems = items
              .filter((i) => i.timeSlot === key)
              .sort((a, b) => a.order - b.order)
            return (
              <div key={key} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg2)]">
                <div className="flex items-center gap-2 border-b border-[color:rgba(255,255,255,0.07)] px-3 py-1.5">
                  <Icon size={12} className="text-[color:var(--cs-accent)]" />
                  <span className="font-mono text-[13px] font-medium uppercase tracking-[0.06em] text-[#c8c4bc]">{label}</span>
                  <span className="ml-auto font-mono text-[13px] text-[#555450]">{slotItems.filter((i) => isChecked(i.id)).length}/{slotItems.length}</span>
                </div>
                <div className="space-y-0.5 p-2">
                  {slotItems.map((item) => {
                    const checked = isChecked(item.id)
                    return (
                      <div
                        key={item.id}
                        className={`group flex items-center gap-2 rounded px-2 py-1.5 ${
                          checked ? 'opacity-50' : 'hover:bg-[#242422]'
                        }`}
                      >
                        <button
                          onClick={() => toggleCheck(item.id)}
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                            checked
                              ? 'border-[color:var(--cs-accent)] bg-[color:var(--cs-accent)] text-black'
                              : 'border-[#555450]'
                          }`}
                        >
                          {checked && <span className="text-[13px] leading-none">✓</span>}
                        </button>
                        <span className={`flex-1 text-[15px] leading-[1.5] ${checked ? 'text-[#888780] line-through' : 'text-white'}`}>
                          {item.title}
                        </span>
                        {item.category && (
                          <span className="rounded bg-[#242422] px-1.5 py-0.5 text-[14px] text-[#888780]">
                            {item.category}
                          </span>
                        )}
                        {item.streak > 0 && (
                          <span className="flex items-center gap-0.5 text-[13px] text-orange-400" title={`${item.streak} day streak`}>
                            <Flame size={10} /> {item.streak}
                          </span>
                        )}
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-[#555450] opacity-0 group-hover:opacity-100 hover:text-red-400"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    )
                  })}
                  {addingSlot === key ? (
                    <div className="flex flex-col gap-1 pt-1">
                      <input
                        autoFocus
                        className="w-full rounded bg-[#242422] px-2 py-1 text-[15px] text-white outline-none"
                        placeholder="Task name…"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTitle.trim()) {
                            addItem(newTitle.trim(), key, newCat || undefined)
                            setNewTitle('')
                            setNewCat('')
                            setAddingSlot(null)
                          }
                          if (e.key === 'Escape') { setAddingSlot(null); setNewTitle(''); setNewCat('') }
                        }}
                      />
                      <div className="flex flex-wrap gap-1">
                        {CATEGORIES.map((c) => (
                          <button
                            key={c}
                            className={`rounded px-1.5 py-0.5 text-[14px] ${
                              newCat === c ? 'bg-[color:var(--cs-accent)]/20 text-[color:var(--cs-accent2)]' : 'bg-[#242422] text-[#888780] hover:text-white'
                            }`}
                            onClick={() => setNewCat(newCat === c ? '' : c)}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingSlot(key); setNewTitle(''); setNewCat('') }}
                      className="flex w-full items-center gap-1 rounded px-2 py-1 text-[15px] text-[#555450] hover:text-neutral-300"
                    >
                      <Plus size={10} /> Add
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* History drawer */}
      <AnimatePresence>
        {logOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.2 }}
            className="fixed right-0 top-0 z-[60] h-full w-80 border-l border-[color:var(--border)] bg-[color:var(--bg0)] p-4 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[13px] font-medium uppercase tracking-[0.06em] text-[color:var(--cs-accent)]">History</span>
              <button onClick={() => setLogOpen(false)} className="text-[#888780] hover:text-white">
                <X size={14} />
              </button>
            </div>
            {log.length === 0 && <div className="text-[15px] text-[#555450]">No history yet. Complete a full day to see data.</div>}
            {log.slice(0, 30).map((entry) => (
              <div key={entry.date} className="mb-3 rounded border border-[color:var(--border)] bg-[color:var(--bg2)] p-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[13px] text-[#888780]">{entry.date}</span>
                  <span className={`font-mono text-[13px] ${
                    entry.completedItems === entry.totalItems ? 'text-green-400' : 'text-[#888780]'
                  }`}>
                    {entry.completedItems}/{entry.totalItems}
                    {entry.totalItems > 0 && ` · ${Math.round((entry.completedItems / entry.totalItems) * 100)}%`}
                  </span>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
