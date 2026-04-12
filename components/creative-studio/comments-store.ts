// Comment pin store — spatial annotations on the canvas.
// Persisted to localStorage, scoped per board.

'use client'

import { create } from 'zustand'

const LS_KEY = 'cs:comment-pins'

export interface Comment {
  id: string
  text: string
  createdAt: number
}

export interface Pin {
  id: string
  x: number
  y: number
  boardId: string
  comments: Comment[]
  resolved: boolean
}

interface CommentsState {
  pins: Pin[]
  activePinId: string | null
  showResolved: boolean
  hydrated: boolean

  hydrate: () => void
  addPin: (boardId: string, x: number, y: number) => string
  deletePin: (id: string) => void
  updatePin: (id: string, patch: Partial<Pick<Pin, 'x' | 'y'>>) => void
  addComment: (pinId: string, text: string) => void
  resolvePin: (id: string) => void
  setActivePin: (id: string | null) => void
  setShowResolved: (v: boolean) => void
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

function loadPins(): Pin[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Pin[]) : []
  } catch {
    return []
  }
}

function savePins(pins: Pin[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(pins))
  } catch {}
}

export const useCommentsStore = create<CommentsState>((set, get) => ({
  pins: [],
  activePinId: null,
  showResolved: false,
  hydrated: false,

  hydrate: () => {
    set({ pins: loadPins(), hydrated: true })
  },

  addPin: (boardId, x, y) => {
    const id = uid()
    const pin: Pin = { id, x, y, boardId, comments: [], resolved: false }
    set((s) => {
      const pins = [...s.pins, pin]
      savePins(pins)
      return { pins, activePinId: id }
    })
    return id
  },

  deletePin: (id) => {
    set((s) => {
      const pins = s.pins.filter((p) => p.id !== id)
      savePins(pins)
      return { pins, activePinId: s.activePinId === id ? null : s.activePinId }
    })
  },

  updatePin: (id, patch) => {
    set((s) => {
      const pins = s.pins.map((p) => (p.id === id ? { ...p, ...patch } : p))
      savePins(pins)
      return { pins }
    })
  },

  addComment: (pinId, text) => {
    const comment: Comment = { id: uid(), text, createdAt: Date.now() }
    set((s) => {
      const pins = s.pins.map((p) =>
        p.id === pinId ? { ...p, comments: [...p.comments, comment] } : p
      )
      savePins(pins)
      return { pins }
    })
  },

  resolvePin: (id) => {
    set((s) => {
      const pins = s.pins.map((p) =>
        p.id === id ? { ...p, resolved: true } : p
      )
      savePins(pins)
      return { pins, activePinId: null }
    })
  },

  setActivePin: (id) => set({ activePinId: id }),

  setShowResolved: (v) => set({ showResolved: v }),
}))
