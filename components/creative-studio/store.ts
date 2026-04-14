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
// useThemeStore intentionally NOT imported here — mind map node colors
// are resolved at render time by MindMapBlock, not at creation time.

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

  /** ID of the most recently created block — used by block components to
   *  auto-focus their primary editable element on mount. Cleared after
   *  first read so blocks loaded from localStorage don't auto-focus. */
  lastCreatedBlockId: string | null
  clearLastCreated: () => void

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
  lastCreatedBlockId: null,
  clearLastCreated: () => set({ lastCreatedBlockId: null }),

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
    set({ lastCreatedBlockId: block.id })
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
      // When deleting group blocks, also delete standalone-nodes inside them
      const allIds = new Set(ids)
      for (const id of ids) {
        const blk = b.blocks.find((x) => x.id === id)
        if (blk && blk.kind === 'group') {
          for (const other of b.blocks) {
            if (other.kind === 'standalone-node') {
              const node = other as import('./types').StandaloneNodeBlock
              // Match by groupId or by bounds containment
              if (node.groupId === id ||
                  (other.x >= blk.x && other.x + other.w <= blk.x + blk.w &&
                   other.y >= blk.y && other.y + other.h <= blk.y + blk.h)) {
                allIds.add(other.id)
              }
            }
          }
        }
      }
      b.blocks = b.blocks.filter((x) => !allIds.has(x.id))
      b.connectors = b.connectors.filter((c) => !allIds.has(c.fromBlockId) && !allIds.has(c.toBlockId))
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
      // Empty paragraph — no "Start writing…" placeholder text. Tiptap
      // renders this as an empty editable region; the cursor simply
      // blinks and the user starts typing.
      return { ...base, kind: 'text', w: 340, h: 180, html: '<p></p>', bg: 'var(--bg2)', autoHeight: true }
    case 'sticky':
      return { ...base, kind: 'sticky', w: 220, h: 220, text: '', color: 'yellow' }
    case 'image':
      return { ...base, kind: 'image', w: 340, h: 240, src: '', lockAspect: true }
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
      // Empty string = "use neutral dark default". resolveColor() in
      // MindMapBlock maps '' → #141413 at render time.
      const root: MindMapNode = {
        id: uid(),
        parentId: null,
        label: 'Central Idea',
        dx: 180,
        dy: 140,
        shape: 'pill',
        color: '',
      }
      return { ...base, kind: 'mindmap', w: 520, h: 360, nodes: [root] }
    }
    case 'page':
      return {
        ...base,
        kind: 'page',
        w: 280,
        h: 140,
        title: 'Untitled Page',
        icon: '📄',
        // Leave color undefined so the PageBlockCard picks the theme
        // default (var(--bg2)) at render time — keeps every Untitled Page
        // visually aligned with the rest of the system.
        color: undefined,
        content: [{ id: uid(), type: 'p', text: '' }],
      }
    case 'tasks':
      return { ...base, kind: 'tasks', w: 340, h: 320, label: 'Task List', taskItems: [] }
    case 'transcript':
      return { ...base, kind: 'transcript', w: 420, h: 320, title: 'Transcript', transcript: '', source: '' }
    case 'assistant':
      return { ...base, kind: 'assistant', w: 400, h: 440, messages: [], label: 'AI Assistant' }
    case 'timeline':
      return { ...base, kind: 'timeline', w: 560, h: 140 }
    case 'embed':
      return { ...base, kind: 'embed', w: 320, h: 180, url: '', title: '', description: '', favicon: '', image: '' }
    case 'section':
      return { ...base, kind: 'section', w: 480, h: 320, label: 'Section' }
    case 'standalone-node':
      // Height 64 matches mind map pill (py-5 top 20 + text ~24 + py-5 bottom 20)
      return { ...base, kind: 'standalone-node', w: 160, h: 64, label: 'New node' }
    case 'group':
      // Groups render behind other blocks — use a low z so nodes inside sit on top.
      return { ...base, kind: 'group', w: 400, h: 300, label: 'GROUP', z: 1 }
    case 'week-planner':
      return { ...base, kind: 'week-planner', w: 640, h: 240, weekStart: null }
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

// ──────────────────────────────────────────────────────────────
// Export / Import
// ──────────────────────────────────────────────────────────────
export function exportAllData(): string {
  const canvas = useCanvasStore.getState()
  const planner = usePlannerStore.getState()
  const payload = {
    _format: 'larchmont-cs-export',
    _version: 1,
    _exportedAt: new Date().toISOString(),
    boards: canvas.boards,
    activeBoardId: canvas.activeBoardId,
    prefs: {
      snapToGrid: canvas.snapToGrid,
      gridSize: canvas.gridSize,
      showGrid: canvas.showGrid,
    },
    planner: {
      tasks: planner.tasks,
      drifting: planner.drifting,
      focus: planner.focus,
      driftingSince: planner.driftingSince,
      lastResetDate: planner.lastResetDate,
    },
    plannerLog: loadJSON<unknown[]>(LS_LOG, []),
  }
  return JSON.stringify(payload, null, 2)
}

export function importAllData(json: string): { ok: boolean; error?: string; boardCount?: number } {
  try {
    const data = JSON.parse(json)
    if (data._format !== 'larchmont-cs-export') {
      return { ok: false, error: 'Not a valid Larchmont OS export file.' }
    }

    // Restore canvas
    if (Array.isArray(data.boards)) {
      useCanvasStore.setState({ boards: data.boards, activeBoardId: data.activeBoardId ?? data.boards[0]?.id })
      saveJSON(LS_BOARDS, data.boards)
      saveJSON(LS_ACTIVE, data.activeBoardId ?? data.boards[0]?.id)
    }

    // Restore prefs
    if (data.prefs) {
      useCanvasStore.setState(data.prefs)
      saveJSON(LS_PREFS, data.prefs)
    }

    // Restore planner
    if (data.planner) {
      usePlannerStore.setState(data.planner)
      saveJSON(LS_PLANNER, data.planner)
    }

    // Restore planner log
    if (data.plannerLog) {
      saveJSON(LS_LOG, data.plannerLog)
    }

    return { ok: true, boardCount: data.boards?.length ?? 0 }
  } catch (e) {
    return { ok: false, error: 'Failed to parse JSON: ' + (e instanceof Error ? e.message : String(e)) }
  }
}
