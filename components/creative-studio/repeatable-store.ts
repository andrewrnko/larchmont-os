// Daily Repeatables — Zustand store with localStorage persistence.

'use client'

import { create } from 'zustand'
import type { RepeatableItem, RepeatableCheck, RepeatableDayLog, TimeSlot } from './repeatable-types'

const LS_ITEMS = 'cs:repeatables'
const LS_CHECKS = 'cs:repeatable_checks'
const LS_LOG = 'cs:repeatable_log'
const LS_LAST_RESET = 'cs:repeatable_last_reset'

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}
function saveJSON(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
const todayStr = () => new Date().toISOString().slice(0, 10)

interface RepeatableState {
  items: RepeatableItem[]
  checks: RepeatableCheck[] // today's checks only
  log: RepeatableDayLog[]
  lastResetDate: string
  hydrated: boolean

  hydrate: () => void
  addItem: (title: string, timeSlot: TimeSlot, category?: string) => void
  removeItem: (id: string) => void
  updateItem: (id: string, patch: Partial<RepeatableItem>) => void
  reorderItem: (id: string, timeSlot: TimeSlot, order: number) => void
  toggleCheck: (itemId: string) => void
  isChecked: (itemId: string) => boolean
  checkDailyReset: () => void
}

export const useRepeatableStore = create<RepeatableState>((set, get) => ({
  items: [],
  checks: [],
  log: [],
  lastResetDate: todayStr(),
  hydrated: false,

  hydrate: () => {
    const items = loadJSON<RepeatableItem[]>(LS_ITEMS, [])
    const checks = loadJSON<RepeatableCheck[]>(LS_CHECKS, [])
    const log = loadJSON<RepeatableDayLog[]>(LS_LOG, [])
    const lastResetDate = loadJSON<string>(LS_LAST_RESET, todayStr())
    set({ items, checks, log, lastResetDate, hydrated: true })
    // Check if day rolled over
    if (lastResetDate !== todayStr()) {
      get().checkDailyReset()
    }
  },

  addItem: (title, timeSlot, category) => {
    const s = get()
    const order = s.items.filter((i) => i.timeSlot === timeSlot).length
    const item: RepeatableItem = {
      id: uid(),
      title,
      category,
      timeSlot,
      order,
      streak: 0,
      createdAt: Date.now(),
    }
    const items = [...s.items, item]
    set({ items })
    saveJSON(LS_ITEMS, items)
  },

  removeItem: (id) => {
    const items = get().items.filter((i) => i.id !== id)
    const checks = get().checks.filter((c) => c.itemId !== id)
    set({ items, checks })
    saveJSON(LS_ITEMS, items)
    saveJSON(LS_CHECKS, checks)
  },

  updateItem: (id, patch) => {
    const items = get().items.map((i) => (i.id === id ? { ...i, ...patch } : i))
    set({ items })
    saveJSON(LS_ITEMS, items)
  },

  reorderItem: (id, timeSlot, order) => {
    const items = get().items.map((i) => (i.id === id ? { ...i, timeSlot, order } : i))
    set({ items })
    saveJSON(LS_ITEMS, items)
  },

  toggleCheck: (itemId) => {
    const s = get()
    const today = todayStr()
    const existing = s.checks.find((c) => c.itemId === itemId && c.date === today)
    let checks: RepeatableCheck[]
    if (existing) {
      checks = s.checks.map((c) =>
        c.itemId === itemId && c.date === today ? { ...c, checked: !c.checked } : c
      )
    } else {
      checks = [...s.checks, { itemId, date: today, checked: true }]
    }
    set({ checks })
    saveJSON(LS_CHECKS, checks)

    // Track to analytics
    const item = s.items.find((i) => i.id === itemId)
    const nowChecked = existing ? !existing.checked : true
    if (item && nowChecked) {
      import('./tracking').then((m) =>
        m.trackTaskCompleted({ rank: 0, title: `[Repeatable] ${item.title}`, estimateMin: undefined })
      )
    }
  },

  isChecked: (itemId) => {
    const s = get()
    const today = todayStr()
    return s.checks.some((c) => c.itemId === itemId && c.date === today && c.checked)
  },

  checkDailyReset: () => {
    const s = get()
    const today = todayStr()
    if (s.lastResetDate === today) return

    // Archive yesterday's state
    const completedIds = new Set(
      s.checks.filter((c) => c.date === s.lastResetDate && c.checked).map((c) => c.itemId)
    )
    const totalItems = s.items.length
    const completedItems = s.items.filter((i) => completedIds.has(i.id)).length

    // Update streaks
    const items = s.items.map((i) => {
      if (completedIds.has(i.id)) {
        return { ...i, streak: i.streak + 1 }
      }
      return { ...i, streak: 0 } // missed → reset
    })

    const logEntry: RepeatableDayLog = {
      date: s.lastResetDate,
      totalItems,
      completedItems,
      streaks: Object.fromEntries(items.map((i) => [i.id, i.streak])),
    }

    const log = [logEntry, ...s.log].slice(0, 90) // keep 90 days

    // Track daily summary
    import('./tracking').then((m) =>
      m.trackDailySummary({ totalTasks: totalItems, completedTasks: completedItems, totalFocusMin: 0 })
    )

    set({ items, checks: [], log, lastResetDate: today })
    saveJSON(LS_ITEMS, items)
    saveJSON(LS_CHECKS, [])
    saveJSON(LS_LOG, log)
    saveJSON(LS_LAST_RESET, today)
  },
}))
