// Custom user-owned pages — created via the sidebar's "+ New object" action.
// Each page is a lightweight Anytype-style document with a title, icon, and
// an ordered list of blocks. Persisted to localStorage so it survives reloads
// without touching Supabase. When you're ready to sync to Supabase later,
// swap the persistence layer — the store contract stays the same.

'use client'

import { create } from 'zustand'

// ─── Types ────────────────────────────────────────────────────────────────

export type BlockType = 'heading' | 'text' | 'todo' | 'divider' | 'quote'

export interface PageBlock {
  id: string
  type: BlockType
  /** Textual content for heading/text/todo/quote; ignored for divider. */
  content: string
  /** Done state for todo blocks. */
  done?: boolean
  /** h1/h2/h3 for heading blocks. */
  level?: 1 | 2 | 3
}

export interface CustomPage {
  id: string
  title: string
  icon: string
  /** Color tint for the sidebar square. Hex string. */
  tint: string
  blocks: PageBlock[]
  createdAt: number
  updatedAt: number
}

interface PagesState {
  pages: CustomPage[]
  hydrated: boolean
  hydrate: () => void
  createPage: (title?: string, icon?: string) => string
  deletePage: (id: string) => void
  renamePage: (id: string, title: string) => void
  setPageIcon: (id: string, icon: string) => void
  addBlock: (pageId: string, block: Omit<PageBlock, 'id'>, atIndex?: number) => string
  updateBlock: (pageId: string, blockId: string, patch: Partial<PageBlock>) => void
  removeBlock: (pageId: string, blockId: string) => void
  reorderBlocks: (pageId: string, fromIndex: number, toIndex: number) => void
}

// ─── Persistence ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'larchmont:custom-pages'

const loadPages = (): CustomPage[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const savePages = (pages: CustomPage[]) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pages))
  } catch {
    // Quota exceeded or private mode — silently skip.
  }
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

const randomTint = () => {
  const tints = [
    '#4a9cf5',
    '#52a96a',
    '#d4a234',
    '#b47cf5',
    '#ef6850',
    '#52a996',
    '#fa6c94',
    '#818cf8',
  ]
  return tints[Math.floor(Math.random() * tints.length)]
}

// ─── Store ────────────────────────────────────────────────────────────────

export const usePagesStore = create<PagesState>((set, get) => ({
  pages: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return
    set({ pages: loadPages(), hydrated: true })
  },

  createPage: (title = 'Untitled', icon = '📄') => {
    const id = uid()
    const now = Date.now()
    const page: CustomPage = {
      id,
      title,
      icon,
      tint: randomTint(),
      blocks: [
        { id: uid(), type: 'heading', level: 1, content: title },
        { id: uid(), type: 'text', content: '' },
      ],
      createdAt: now,
      updatedAt: now,
    }
    const next = [...get().pages, page]
    savePages(next)
    set({ pages: next })
    return id
  },

  deletePage: (id) => {
    const next = get().pages.filter((p) => p.id !== id)
    savePages(next)
    set({ pages: next })
  },

  renamePage: (id, title) => {
    const next = get().pages.map((p) =>
      p.id === id
        ? {
            ...p,
            title,
            // Keep the first heading in sync with the title.
            blocks: p.blocks.map((b, i) =>
              i === 0 && b.type === 'heading' ? { ...b, content: title } : b
            ),
            updatedAt: Date.now(),
          }
        : p
    )
    savePages(next)
    set({ pages: next })
  },

  setPageIcon: (id, icon) => {
    const next = get().pages.map((p) =>
      p.id === id ? { ...p, icon, updatedAt: Date.now() } : p
    )
    savePages(next)
    set({ pages: next })
  },

  addBlock: (pageId, block, atIndex) => {
    const blockId = uid()
    const newBlock: PageBlock = { id: blockId, ...block }
    const next = get().pages.map((p) => {
      if (p.id !== pageId) return p
      const blocks = [...p.blocks]
      if (atIndex === undefined || atIndex < 0 || atIndex > blocks.length) {
        blocks.push(newBlock)
      } else {
        blocks.splice(atIndex, 0, newBlock)
      }
      return { ...p, blocks, updatedAt: Date.now() }
    })
    savePages(next)
    set({ pages: next })
    return blockId
  },

  updateBlock: (pageId, blockId, patch) => {
    const next = get().pages.map((p) =>
      p.id !== pageId
        ? p
        : {
            ...p,
            blocks: p.blocks.map((b) =>
              b.id === blockId ? { ...b, ...patch } : b
            ),
            updatedAt: Date.now(),
          }
    )
    savePages(next)
    set({ pages: next })
  },

  removeBlock: (pageId, blockId) => {
    const next = get().pages.map((p) =>
      p.id !== pageId
        ? p
        : {
            ...p,
            blocks: p.blocks.filter((b) => b.id !== blockId),
            updatedAt: Date.now(),
          }
    )
    savePages(next)
    set({ pages: next })
  },

  reorderBlocks: (pageId, fromIndex, toIndex) => {
    const next = get().pages.map((p) => {
      if (p.id !== pageId) return p
      const blocks = [...p.blocks]
      const [moved] = blocks.splice(fromIndex, 1)
      blocks.splice(toIndex, 0, moved)
      return { ...p, blocks, updatedAt: Date.now() }
    })
    savePages(next)
    set({ pages: next })
  },
}))
