import { create } from 'zustand'
import type {
  Project,
  Task,
  CreativeBrief,
  Campaign,
  Asset,
  ResourceItem,
  EventRecord,
  ContentItem,
  InboxItem,
} from './types'
// mock-data imports removed — all data comes from Supabase via db.*

// ────────────────────────────────────────────────────────────
// UI State
// ────────────────────────────────────────────────────────────
export type SidebarMode = 'full' | 'rail' | 'hidden'

interface UIState {
  /** Tri-state sidebar: full (260px) → rail (52px icons) → hidden (0). */
  sidebarMode: SidebarMode
  /** Legacy boolean kept for backwards compatibility with older callers. */
  sidebarCollapsed: boolean
  rightPanelOpen: boolean
  rightPanelContent: React.ReactNode | null
  commandPaletteOpen: boolean
  quickCaptureOpen: boolean
  setSidebarMode: (m: SidebarMode) => void
  cycleSidebarMode: () => void
  setSidebarCollapsed: (v: boolean) => void
  setRightPanelOpen: (v: boolean, content?: React.ReactNode) => void
  setCommandPaletteOpen: (v: boolean) => void
  setQuickCaptureOpen: (v: boolean) => void
}

// Persisted across reloads via localStorage so the layout never "flashes"
// between refreshes.
const SIDEBAR_MODE_KEY = 'larchmont:sidebar-mode'
const readInitialSidebarMode = (): SidebarMode => {
  if (typeof window === 'undefined') return 'full'
  const v = window.localStorage.getItem(SIDEBAR_MODE_KEY)
  return v === 'rail' || v === 'hidden' || v === 'full' ? v : 'full'
}

export const useUIStore = create<UIState>((set) => ({
  sidebarMode: readInitialSidebarMode(),
  sidebarCollapsed: readInitialSidebarMode() !== 'full',
  rightPanelOpen: false,
  rightPanelContent: null,
  commandPaletteOpen: false,
  quickCaptureOpen: false,
  setSidebarMode: (m) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(SIDEBAR_MODE_KEY, m)
    set({ sidebarMode: m, sidebarCollapsed: m !== 'full' })
  },
  cycleSidebarMode: () =>
    set((s) => {
      // Single-click toggles between full and fully hidden — no intermediate
      // rail state. The rail mode still exists as a direct-set target for
      // legacy callers but is never reachable via the toggle button.
      const next: SidebarMode = s.sidebarMode === 'full' ? 'hidden' : 'full'
      if (typeof window !== 'undefined') window.localStorage.setItem(SIDEBAR_MODE_KEY, next)
      return { sidebarMode: next, sidebarCollapsed: next !== 'full' }
    }),
  setSidebarCollapsed: (v) => {
    const mode: SidebarMode = v ? 'rail' : 'full'
    if (typeof window !== 'undefined') window.localStorage.setItem(SIDEBAR_MODE_KEY, mode)
    set({ sidebarMode: mode, sidebarCollapsed: v })
  },
  setRightPanelOpen: (v, content) =>
    set({ rightPanelOpen: v, rightPanelContent: content ?? null }),
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
  setQuickCaptureOpen: (v) => set({ quickCaptureOpen: v }),
}))

// ────────────────────────────────────────────────────────────
// Toast
// ────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = crypto.randomUUID()
    set((state) => ({
      toasts: [...state.toasts.slice(-2), { ...toast, id }],
    }))
    const duration = toast.duration ?? 3000
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }))
    }, duration)
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

// ────────────────────────────────────────────────────────────
// Projects
// ────────────────────────────────────────────────────────────
interface ProjectState {
  projects: Project[]
  addProject: (p: Project) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  removeProject: (id: string) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  addProject: (p) => set((s) => ({ projects: [...s.projects, p] })),
  updateProject: (id, updates) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  removeProject: (id) =>
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
}))

// ────────────────────────────────────────────────────────────
// Tasks
// ────────────────────────────────────────────────────────────
interface TaskState {
  tasks: Task[]
  addTask: (t: Task) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  removeTask: (id: string) => void
  completeTask: (id: string) => void
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  addTask: (t) => set((s) => ({ tasks: [...s.tasks, t] })),
  updateTask: (id, updates) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTask: (id) =>
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
  completeTask: (id) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? { ...t, status: 'Done', completedOn: new Date().toISOString() }
          : t
      ),
    })),
}))

// ────────────────────────────────────────────────────────────
// Briefs
// ────────────────────────────────────────────────────────────
interface BriefState {
  briefs: CreativeBrief[]
  addBrief: (b: CreativeBrief) => void
  updateBrief: (id: string, updates: Partial<CreativeBrief>) => void
  removeBrief: (id: string) => void
}

export const useBriefStore = create<BriefState>((set) => ({
  briefs: [],
  addBrief: (b) => set((s) => ({ briefs: [...s.briefs, b] })),
  updateBrief: (id, updates) =>
    set((s) => ({
      briefs: s.briefs.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    })),
  removeBrief: (id) =>
    set((s) => ({ briefs: s.briefs.filter((b) => b.id !== id) })),
}))

// ────────────────────────────────────────────────────────────
// Campaigns
// ────────────────────────────────────────────────────────────
interface CampaignState {
  campaigns: Campaign[]
  addCampaign: (c: Campaign) => void
  updateCampaign: (id: string, updates: Partial<Campaign>) => void
}

export const useCampaignStore = create<CampaignState>((set) => ({
  campaigns: [],
  addCampaign: (c) => set((s) => ({ campaigns: [...s.campaigns, c] })),
  updateCampaign: (id, updates) =>
    set((s) => ({
      campaigns: s.campaigns.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
}))

// ────────────────────────────────────────────────────────────
// Assets
// ────────────────────────────────────────────────────────────
interface AssetState {
  assets: Asset[]
  addAsset: (a: Asset) => void
  updateAsset: (id: string, updates: Partial<Asset>) => void
}

export const useAssetStore = create<AssetState>((set) => ({
  assets: [],
  addAsset: (a) => set((s) => ({ assets: [...s.assets, a] })),
  updateAsset: (id, updates) =>
    set((s) => ({
      assets: s.assets.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),
}))

// ────────────────────────────────────────────────────────────
// Resources
// ────────────────────────────────────────────────────────────
interface ResourceState {
  resources: ResourceItem[]
  addResource: (r: ResourceItem) => void
  updateResource: (id: string, updates: Partial<ResourceItem>) => void
}

export const useResourceStore = create<ResourceState>((set) => ({
  resources: [],
  addResource: (r) => set((s) => ({ resources: [...s.resources, r] })),
  updateResource: (id, updates) =>
    set((s) => ({
      resources: s.resources.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    })),
}))

// ────────────────────────────────────────────────────────────
// Events
// ────────────────────────────────────────────────────────────
interface EventState {
  events: EventRecord[]
  addEvent: (e: EventRecord) => void
  updateEvent: (id: string, updates: Partial<EventRecord>) => void
}

export const useEventStore = create<EventState>((set) => ({
  events: [],
  addEvent: (e) => set((s) => ({ events: [...s.events, e] })),
  updateEvent: (id, updates) =>
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),
}))

// ────────────────────────────────────────────────────────────
// Content
// ────────────────────────────────────────────────────────────
interface ContentState {
  content: ContentItem[]
  addContent: (c: ContentItem) => void
  updateContent: (id: string, updates: Partial<ContentItem>) => void
}

export const useContentStore = create<ContentState>((set) => ({
  content: [],
  addContent: (c) => set((s) => ({ content: [...s.content, c] })),
  updateContent: (id, updates) =>
    set((s) => ({
      content: s.content.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
}))

// ────────────────────────────────────────────────────────────
// Inbox
// ────────────────────────────────────────────────────────────
interface InboxState {
  items: InboxItem[]
  addItem: (item: InboxItem) => void
  processItem: (id: string) => void
  archiveItem: (id: string) => void
}

export const useInboxStore = create<InboxState>((set) => ({
  items: [],
  addItem: (item) => set((s) => ({ items: [item, ...s.items] })),
  processItem: (id) =>
    set((s) => ({
      items: s.items.map((i) =>
        i.id === id ? { ...i, status: 'Processed' } : i
      ),
    })),
  archiveItem: (id) =>
    set((s) => ({
      items: s.items.map((i) =>
        i.id === id ? { ...i, status: 'Archived' } : i
      ),
    })),
}))

// ────────────────────────────────────────────────────────────
// Briefing
// ────────────────────────────────────────────────────────────
export interface BriefingMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isStreaming?: boolean
}

export interface BriefingSession {
  id: string
  date: string // YYYY-MM-DD
  timeOfDay: 'morning' | 'afternoon' | 'evening'
  messages: BriefingMessage[]
  dayPlan?: string
  completedAt?: string
}

interface BriefingState {
  sessions: BriefingSession[]
  currentSession: BriefingSession | null
  startNewSession: () => BriefingSession
  addMessage: (message: BriefingMessage) => void
  updateLastAssistantMessage: (content: string, isStreaming: boolean) => void
  endSession: (dayPlan?: string) => void
  clearCurrentSession: () => void
  hasTodaysMorningBriefing: () => boolean
  hasTodaysAfternoonBriefing: () => boolean
}

const getTodayString = () => new Date().toISOString().split('T')[0]
const getTimeOfDay = (): 'morning' | 'afternoon' | 'evening' => {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

// Load sessions from localStorage if available
const loadSessions = (): BriefingSession[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem('larchmont-briefing-sessions')
    if (!stored) return []
    const sessions = JSON.parse(stored) as BriefingSession[]
    return sessions.slice(-7) // keep last 7
  } catch {
    return []
  }
}

const saveSessions = (sessions: BriefingSession[]) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('larchmont-briefing-sessions', JSON.stringify(sessions.slice(-7)))
  } catch {}
}

export const useBriefingStore = create<BriefingState>((set, get) => ({
  sessions: loadSessions(),
  currentSession: null,

  startNewSession: () => {
    const session: BriefingSession = {
      id: crypto.randomUUID(),
      date: getTodayString(),
      timeOfDay: getTimeOfDay(),
      messages: [],
    }
    set((s) => {
      const updated = [...s.sessions, session].slice(-7)
      saveSessions(updated)
      return { sessions: updated, currentSession: session }
    })
    return session
  },

  addMessage: (message) => {
    set((s) => {
      if (!s.currentSession) return s
      const updatedSession = {
        ...s.currentSession,
        messages: [...s.currentSession.messages, message],
      }
      const sessions = s.sessions.map((sess) =>
        sess.id === updatedSession.id ? updatedSession : sess
      )
      saveSessions(sessions)
      return { currentSession: updatedSession, sessions }
    })
  },

  updateLastAssistantMessage: (content, isStreaming) => {
    set((s) => {
      if (!s.currentSession) return s
      const messages = [...s.currentSession.messages]
      const lastIdx = messages.length - 1
      if (lastIdx >= 0 && messages[lastIdx].role === 'assistant') {
        messages[lastIdx] = { ...messages[lastIdx], content, isStreaming }
      }
      const updatedSession = { ...s.currentSession, messages }
      const sessions = s.sessions.map((sess) =>
        sess.id === updatedSession.id ? updatedSession : sess
      )
      saveSessions(sessions)
      return { currentSession: updatedSession, sessions }
    })
  },

  endSession: (dayPlan) => {
    set((s) => {
      if (!s.currentSession) return s
      const updatedSession = {
        ...s.currentSession,
        completedAt: new Date().toISOString(),
        dayPlan,
      }
      const sessions = s.sessions.map((sess) =>
        sess.id === updatedSession.id ? updatedSession : sess
      )
      saveSessions(sessions)
      return { currentSession: updatedSession, sessions }
    })
  },

  clearCurrentSession: () => {
    set({ currentSession: null })
  },

  hasTodaysMorningBriefing: () => {
    const today = getTodayString()
    return get().sessions.some(
      (s) => s.date === today && s.timeOfDay === 'morning' && s.messages.length > 0
    )
  },

  hasTodaysAfternoonBriefing: () => {
    const today = getTodayString()
    return get().sessions.some(
      (s) => s.date === today && s.timeOfDay === 'afternoon' && s.messages.length > 0
    )
  },
}))

// ────────────────────────────────────────────────────────────
// Timer — persists across page navigation via Zustand global state
// ────────────────────────────────────────────────────────────
interface TimerState {
  activeTaskId: string | null
  startedAt: string | null // ISO datetime string
  startTimer: (taskId: string) => void
  stopTimer: () => { taskId: string; startedAt: string } | null
  clearTimer: () => void
}

export const useTimerStore = create<TimerState>((set, get) => ({
  activeTaskId: null,
  startedAt: null,

  startTimer: (taskId) => {
    set({ activeTaskId: taskId, startedAt: new Date().toISOString() })
  },

  stopTimer: () => {
    const { activeTaskId, startedAt } = get()
    if (!activeTaskId || !startedAt) return null
    const result = { taskId: activeTaskId, startedAt }
    set({ activeTaskId: null, startedAt: null })
    return result
  },

  clearTimer: () => set({ activeTaskId: null, startedAt: null }),
}))
