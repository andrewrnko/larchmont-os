// Creative Studio — Zustand stores
// Three stores: boards/canvas, history (undo/redo), day planner.
// Persistence: localStorage now, but each store is wrapped so you can swap to API later.

'use client'

import { create } from 'zustand'
import type {
  Board,
  AnyBlock,
  Connector,
  BlockKind,
  PriorityTask,
  LogEntry,
  FocusSession,
  MindMapNode,
  StoryboardFrame,
} from './types'

// ──────────────────────────────────────────────────────────────
// Persistence adapter (swap this for an API later)
// ──────────────────────────────────────────────────────────────
const LS_BOARDS = 'cs:boards'
const LS_ACTIVE = 'cs:active'
const LS_PLANNER = 'cs:planner'
const LS_LOG = 'cs:planner_log'
const LS_PREFS = 'cs:prefs'

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function saveJSON(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
const todayStr = () => new Date().toISOString().slice(0, 10)

// ──────────────────────────────────────────────────────────────
// Default content
// ──────────────────────────────────────────────────────────────
function makeDefaultBoard(): Board {
  return {
    id: uid(),
    name: 'Untitled Board',
    icon: '✨',
    parentId: null,
    blocks: [],
    connectors: [],
    viewport: { x: 0, y: 0, scale: 1 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

// ──────────────────────────────────────────────────────────────
// Canvas / Board store
// ──────────────────────────────────────────────────────────────
interface CanvasState {
  boards: Board[]
  activeBoardId: string | null
  selection: string[] // block ids
  hydrated: boolean

  // Preferences
  showGrid: boolean
  snapToGrid: boolean
  gridSize: number

  // Subpage nav
  openPageBlockId: string | null

  // Connector drag state (shared between BlockWrapper + Canvas)
  connectDrag: { fromId: string; startX: number; startY: number; cursorX: number; cursorY: number } | null

  // Hydration
  hydrate: () => void

  // Board ops
  createBoard: (name?: string, icon?: string, parentId?: string | null) => string
  deleteBoard: (id: string) => void
  renameBoard: (id: string, name: string, icon?: string) => void
  setActiveBoard: (id: string) => void

  // Block ops
  addBlock: (block: AnyBlock) => void
  addBlockAt: (kind: BlockKind, x: number, y: number) => string | null
  updateBlock: (id: string, patch: Partial<AnyBlock>) => void
  removeBlocks: (ids: string[]) => void
  duplicateBlock: (id: string) => void
  bringToFront: (id: string) => void
  sendToBack: (id: string) => void
  toggleLock: (id: string) => void

  // Selection
  setSelection: (ids: string[]) => void
  clearSelection: () => void

  // Connectors
  addConnector: (c: Connector) => void
  updateConnector: (id: string, patch: Partial<Connector>) => void
  removeConnector: (id: string) => void

  // Viewport
  setViewport: (v: { x: number; y: number; scale: number }) => void
  centerOnBlock: (blockId: string) => void

  // Prefs
  setShowGrid: (v: boolean) => void
  setSnapToGrid: (v: boolean) => void

  // Subpage
  openPage: (blockId: string | null) => void

  // Connector drag
  startConnectDrag: (fromId: string, startX: number, startY: number) => void
  updateConnectCursor: (x: number, y: number) => void
  endConnectDrag: () => { fromId: string; cursorX: number; cursorY: number } | null

  // Internal mutator used by undo/redo
  _replaceActiveBoard: (b: Board) => void
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  boards: [],
  activeBoardId: null,
  selection: [],
  hydrated: false,
  showGrid: true,
  snapToGrid: false,
  gridSize: 16,
  openPageBlockId: null,
  connectDrag: null,

  hydrate: () => {
    const boards = loadJSON<Board[]>(LS_BOARDS, [])
    const activeId = loadJSON<string | null>(LS_ACTIVE, null)
    const prefs = loadJSON<{ showGrid: boolean; snapToGrid: boolean }>(LS_PREFS, {
      showGrid: true,
      snapToGrid: false,
    })
    if (boards.length === 0) {
      const b = makeDefaultBoard()
      b.name = 'Welcome'
      b.icon = '🎬'
      set({
        boards: [b],
        activeBoardId: b.id,
        hydrated: true,
        showGrid: prefs.showGrid,
        snapToGrid: prefs.snapToGrid,
      })
      persist()
    } else {
      set({
        boards,
        activeBoardId: activeId && boards.find((b) => b.id === activeId) ? activeId : boards[0].id,
        hydrated: true,
        showGrid: prefs.showGrid,
        snapToGrid: prefs.snapToGrid,
      })
    }
  },

  createBoard: (name = 'Untitled', icon = '📄', parentId = null) => {
    const b = makeDefaultBoard()
    b.name = name
    b.icon = icon
    b.parentId = parentId
    set((s) => ({ boards: [...s.boards, b], activeBoardId: b.id }))
    persist()
    return b.id
  },

  deleteBoard: (id) => {
    set((s) => {
      const boards = s.boards.filter((b) => b.id !== id && b.parentId !== id)
      const active = s.activeBoardId === id ? boards[0]?.id ?? null : s.activeBoardId
      return { boards, activeBoardId: active }
    })
    persist()
  },

  renameBoard: (id, name, icon) => {
    set((s) => ({
      boards: s.boards.map((b) => (b.id === id ? { ...b, name, icon: icon ?? b.icon, updatedAt: Date.now() } : b)),
    }))
    persist()
  },

  setActiveBoard: (id) => {
    set({ activeBoardId: id, selection: [], openPageBlockId: null })
    persist()
  },

  addBlock: (block) => {
    mutateActive((board) => {
      board.blocks.push(block)
    })
  },

  addBlockAt: (kind, x, y) => {
    const block = createDefaultBlock(kind, x, y)
    if (!block) return null
    pushHistorySnapshot()
    mutateActive((b) => {
      b.blocks.push(block)
    })
    return block.id
  },

  updateBlock: (id, patch) => {
    mutateActive((b) => {
      const idx = b.blocks.findIndex((x) => x.id === id)
      if (idx >= 0) b.blocks[idx] = { ...b.blocks[idx], ...patch } as AnyBlock
    })
  },

  removeBlocks: (ids) => {
    pushHistorySnapshot()
    mutateActive((b) => {
      b.blocks = b.blocks.filter((x) => !ids.includes(x.id))
      b.connectors = b.connectors.filter((c) => !ids.includes(c.fromBlockId) && !ids.includes(c.toBlockId))
    })
    set({ selection: [] })
  },

  duplicateBlock: (id) => {
    pushHistorySnapshot()
    mutateActive((b) => {
      const src = b.blocks.find((x) => x.id === id)
      if (!src) return
      const clone = JSON.parse(JSON.stringify(src)) as AnyBlock
      clone.id = uid()
      clone.x += 24
      clone.y += 24
      clone.z = Math.max(...b.blocks.map((x) => x.z), 0) + 1
      b.blocks.push(clone)
    })
  },

  bringToFront: (id) => {
    mutateActive((b) => {
      const max = Math.max(...b.blocks.map((x) => x.z), 0)
      const bl = b.blocks.find((x) => x.id === id)
      if (bl) bl.z = max + 1
    })
  },

  sendToBack: (id) => {
    mutateActive((b) => {
      const min = Math.min(...b.blocks.map((x) => x.z), 0)
      const bl = b.blocks.find((x) => x.id === id)
      if (bl) bl.z = min - 1
    })
  },

  toggleLock: (id) => {
    mutateActive((b) => {
      const bl = b.blocks.find((x) => x.id === id)
      if (bl) bl.locked = !bl.locked
    })
  },

  setSelection: (ids) => set({ selection: ids }),
  clearSelection: () => set({ selection: [] }),

  addConnector: (c) => {
    pushHistorySnapshot()
    mutateActive((b) => {
      b.connectors.push(c)
    })
  },
  updateConnector: (id, patch) => {
    mutateActive((b) => {
      const idx = b.connectors.findIndex((c) => c.id === id)
      if (idx >= 0) b.connectors[idx] = { ...b.connectors[idx], ...patch }
    })
  },
  removeConnector: (id) => {
    pushHistorySnapshot()
    mutateActive((b) => {
      b.connectors = b.connectors.filter((c) => c.id !== id)
    })
  },

  setViewport: (v) => {
    mutateActive((b) => {
      b.viewport = v
    }, /* skipHistory */ true)
  },

  centerOnBlock: (blockId) => {
    const s = get()
    const b = s.boards.find((x) => x.id === s.activeBoardId)
    if (!b) return
    const block = b.blocks.find((x) => x.id === blockId)
    if (!block) return
    const scale = b.viewport.scale
    // Center of viewport in screen coords ≈ half of window, adjusted for panels.
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    const vx = cx - (block.x + block.w / 2) * scale
    const vy = cy - (block.y + block.h / 2) * scale
    mutateActive((bb) => { bb.viewport = { x: vx, y: vy, scale } }, true)
    set({ selection: [blockId], openPageBlockId: null })
  },

  setShowGrid: (v) => {
    set({ showGrid: v })
    saveJSON(LS_PREFS, { showGrid: v, snapToGrid: get().snapToGrid })
  },
  setSnapToGrid: (v) => {
    set({ snapToGrid: v })
    saveJSON(LS_PREFS, { showGrid: get().showGrid, snapToGrid: v })
  },

  openPage: (blockId) => set({ openPageBlockId: blockId }),

  startConnectDrag: (fromId, startX, startY) =>
    set({ connectDrag: { fromId, startX, startY, cursorX: startX, cursorY: startY } }),

  updateConnectCursor: (x, y) =>
    set((s) => s.connectDrag ? { connectDrag: { ...s.connectDrag, cursorX: x, cursorY: y } } : {}),

  endConnectDrag: () => {
    const d = get().connectDrag
    set({ connectDrag: null })
    return d
  },

  _replaceActiveBoard: (b) => {
    set((s) => ({
      boards: s.boards.map((x) => (x.id === b.id ? b : x)),
    }))
    persist()
  },
}))

// ──────────────────────────────────────────────────────────────
// Active board mutation helper (immutable swap)
// ──────────────────────────────────────────────────────────────
function mutateActive(fn: (b: Board) => void, skipHistory = false) {
  const s = useCanvasStore.getState()
  const idx = s.boards.findIndex((b) => b.id === s.activeBoardId)
  if (idx < 0) return
  const clone: Board = JSON.parse(JSON.stringify(s.boards[idx]))
  fn(clone)
  clone.updatedAt = Date.now()
  const next = [...s.boards]
  next[idx] = clone
  useCanvasStore.setState({ boards: next })
  if (!skipHistory) persist()
  else persistDebounced()
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
function persist() {
  const s = useCanvasStore.getState()
  saveJSON(LS_BOARDS, s.boards)
  saveJSON(LS_ACTIVE, s.activeBoardId)
}
function persistDebounced() {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(persist, 300)
}

// ──────────────────────────────────────────────────────────────
// Default block factories
// ──────────────────────────────────────────────────────────────
function createDefaultBlock(kind: BlockKind, x: number, y: number): AnyBlock | null {
  const base = { id: uid(), x, y, z: Date.now(), locked: false }
  switch (kind) {
    case 'text':
      return { ...base, kind: 'text', w: 320, h: 160, html: '<p>Start writing…</p>', bg: '#1c1c1a', autoHeight: true }
    case 'sticky':
      return { ...base, kind: 'sticky', w: 180, h: 180, text: '', color: 'yellow' }
    case 'image':
      return { ...base, kind: 'image', w: 320, h: 220, src: '', lockAspect: true }
    case 'storyboard': {
      const frames: StoryboardFrame[] = [1, 2, 3].map((n, i) => ({
        id: uid(),
        label: `Frame 0${n}`,
        notes: '',
        order: i,
      }))
      return { ...base, kind: 'storyboard', w: 720, h: 260, frames }
    }
    case 'mindmap': {
      const root: MindMapNode = {
        id: uid(),
        parentId: null,
        label: 'Central Idea',
        dx: 180,
        dy: 140,
        shape: 'pill',
        color: '#e8a045',
      }
      return { ...base, kind: 'mindmap', w: 520, h: 360, nodes: [root] }
    }
    case 'page':
      return {
        ...base,
        kind: 'page',
        w: 240,
        h: 120,
        title: 'Untitled Page',
        icon: '📄',
        color: '#1a1a1a',
        content: [{ id: uid(), type: 'p', text: '' }],
      }
    case 'tasks':
      return { ...base, kind: 'tasks', w: 320, h: 300, label: 'Task List', taskItems: [] }
    case 'transcript':
      return { ...base, kind: 'transcript', w: 400, h: 300, title: 'Transcript', transcript: '', source: '' }
    case 'assistant':
      return { ...base, kind: 'assistant', w: 380, h: 420, messages: [], label: 'AI Assistant' }
    case 'timeline':
      return { ...base, kind: 'timeline', w: 560, h: 140 }
    case 'embed':
      return { ...base, kind: 'embed', w: 300, h: 160, url: '', title: '', description: '', favicon: '', image: '' }
    case 'section':
      return { ...base, kind: 'section', w: 480, h: 320, label: 'Section' }
    default:
      return null
  }
}

// ──────────────────────────────────────────────────────────────
// History store (undo/redo) — snapshots the active board
// ──────────────────────────────────────────────────────────────
interface HistoryState {
  past: Board[]
  future: Board[]
  push: (b: Board) => void
  undo: () => void
  redo: () => void
  clear: () => void
}
export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  push: (b) => set((s) => ({ past: [...s.past.slice(-49), JSON.parse(JSON.stringify(b))], future: [] })),
  undo: () => {
    const s = get()
    if (s.past.length === 0) return
    const cs = useCanvasStore.getState()
    const active = cs.boards.find((x) => x.id === cs.activeBoardId)
    if (!active) return
    const prev = s.past[s.past.length - 1]
    set({ past: s.past.slice(0, -1), future: [JSON.parse(JSON.stringify(active)), ...s.future] })
    cs._replaceActiveBoard(prev)
  },
  redo: () => {
    const s = get()
    if (s.future.length === 0) return
    const cs = useCanvasStore.getState()
    const active = cs.boards.find((x) => x.id === cs.activeBoardId)
    if (!active) return
    const next = s.future[0]
    set({ future: s.future.slice(1), past: [...s.past, JSON.parse(JSON.stringify(active))] })
    cs._replaceActiveBoard(next)
  },
  clear: () => set({ past: [], future: [] }),
}))

export function pushHistorySnapshot() {
  const cs = useCanvasStore.getState()
  const active = cs.boards.find((x) => x.id === cs.activeBoardId)
  if (active) useHistoryStore.getState().push(active)
}

// ──────────────────────────────────────────────────────────────
// Day Hyperplanner store
// ──────────────────────────────────────────────────────────────
interface PlannerState {
  tasks: PriorityTask[]
  drifting: string
  focus: FocusSession | null
  driftingSince: number | null
  log: LogEntry[]
  lastResetDate: string
  hydrated: boolean

  hydrate: () => void
  addTask: (title: string, rank: 1 | 2 | 3, estimateMin?: number, dueAt?: number) => void
  updateTask: (id: string, patch: Partial<PriorityTask>) => void
  removeTask: (id: string) => void
  toggleDone: (id: string) => void
  setDrifting: (text: string) => void
  startFocus: (taskId: string, durationMin: number) => void
  stopFocus: (completed?: boolean) => void
  resetDay: () => void
  checkDailyReset: () => void
}

export const usePlannerStore = create<PlannerState>((set, get) => ({
  tasks: [],
  drifting: '',
  focus: null,
  driftingSince: null,
  log: [],
  lastResetDate: todayStr(),
  hydrated: false,

  hydrate: () => {
    const saved = loadJSON<Partial<PlannerState>>(LS_PLANNER, {})
    const log = loadJSON<LogEntry[]>(LS_LOG, [])
    set({
      tasks: saved.tasks ?? [],
      drifting: saved.drifting ?? '',
      focus: saved.focus ?? null,
      driftingSince: saved.driftingSince ?? null,
      lastResetDate: saved.lastResetDate ?? todayStr(),
      log,
      hydrated: true,
    })
    get().checkDailyReset()
  },

  addTask: (title, rank, estimateMin, dueAt) => {
    const s = get()
    const count = s.tasks.filter((t) => t.rank === rank).length
    if (count >= 5) return // cap at 5 per rank
    const task: PriorityTask = {
      id: uid(),
      rank,
      title,
      estimateMin,
      dueAt,
      done: false,
      createdAt: Date.now(),
    }
    set({ tasks: [...s.tasks, task] })
    persistPlanner()
  },

  updateTask: (id, patch) => {
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
    persistPlanner()
  },

  removeTask: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
    persistPlanner()
  },

  toggleDone: (id) => {
    const s = get()
    const task = s.tasks.find((t) => t.id === id)
    const nowDone = task ? !task.done : false
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done, completedAt: !t.done ? Date.now() : undefined } : t)),
    }))
    persistPlanner()
    // Track to analytics
    if (task && nowDone) {
      import('./tracking').then((m) => m.trackTaskCompleted({ rank: task.rank, title: task.title, estimateMin: task.estimateMin }))
    }
  },

  setDrifting: (text) => {
    set({ drifting: text, driftingSince: text ? Date.now() : null })
    persistPlanner()
  },

  startFocus: (taskId, durationMin) => {
    set({ focus: { taskId, startedAt: Date.now(), durationMin, active: true } })
    persistPlanner()
  },
  stopFocus: (completed) => {
    const s = get()
    if (s.focus) {
      const tid = s.focus.taskId
      const task = s.tasks.find((t) => t.id === tid)
      const durationMs = Date.now() - s.focus.startedAt
      if (completed) {
        set({ tasks: s.tasks.map((t) => (t.id === tid ? { ...t, done: true, completedAt: Date.now() } : t)) })
      }
      // Track focus session to analytics
      if (task) {
        import('./tracking').then((m) =>
          m.trackFocusSession({ taskTitle: task.title, rank: task.rank, durationMs, completed: !!completed })
        )
      }
    }
    set({ focus: null })
    persistPlanner()
  },

  resetDay: () => {
    const s = get()
    const today = todayStr()
    if (s.tasks.length) {
      const existing = s.log.find((e) => e.date === s.lastResetDate)
      const log = existing
        ? s.log.map((e) => (e.date === s.lastResetDate ? { ...e, tasks: [...e.tasks, ...s.tasks] } : e))
        : [{ date: s.lastResetDate, tasks: s.tasks }, ...s.log]
      saveJSON(LS_LOG, log)
      set({ log })
    }
    // Track daily summary to analytics
    const completed = s.tasks.filter((t) => t.done).length
    import('./tracking').then((m) =>
      m.trackDailySummary({ totalTasks: s.tasks.length, completedTasks: completed, totalFocusMin: 0 })
    )
    set({ tasks: [], drifting: '', driftingSince: null, focus: null, lastResetDate: today })
    persistPlanner()
  },

  checkDailyReset: () => {
    const s = get()
    if (s.lastResetDate !== todayStr()) s.resetDay()
  },
}))

function persistPlanner() {
  const s = usePlannerStore.getState()
  saveJSON(LS_PLANNER, {
    tasks: s.tasks,
    drifting: s.drifting,
    focus: s.focus,
    driftingSince: s.driftingSince,
    lastResetDate: s.lastResetDate,
  })
}

// Derived selector
export function useActiveBoard(): Board | null {
  return useCanvasStore((s) => s.boards.find((b) => b.id === s.activeBoardId) ?? null)
}
