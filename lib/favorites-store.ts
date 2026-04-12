// Persistent favorites / pinned items store.
// Used by TopChrome's star button to pin the current route/page to the
// sidebar's "Pinned" section. Persisted to localStorage so pins survive
// reloads.

import { create } from 'zustand'

const STORAGE_KEY = 'larchmont:favorites'

export interface FavoriteEntry {
  /** Unique key — usually the pathname. */
  key: string
  /** Human label shown in the sidebar. */
  label: string
  /** Where clicking the favorite navigates to. */
  href: string
  /** Optional tint hex for the row's icon tile. */
  tint?: string
  /** Optional tint foreground for the icon. */
  tintFg?: string
  /** Optional emoji (used for custom pages). Icons from ROUTE_META are resolved at render time. */
  emoji?: string
}

interface FavoritesState {
  favorites: FavoriteEntry[]
  hydrated: boolean
  hydrate: () => void
  toggleFavorite: (entry: FavoriteEntry) => void
  isFavorite: (key: string) => boolean
  removeFavorite: (key: string) => void
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],
  hydrated: false,

  hydrate: () => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const parsed: FavoriteEntry[] = raw ? JSON.parse(raw) : []
      // Defensive: drop malformed entries
      const clean = Array.isArray(parsed)
        ? parsed.filter((f) => f && typeof f.key === 'string' && typeof f.href === 'string')
        : []
      set({ favorites: clean, hydrated: true })
    } catch {
      set({ favorites: [], hydrated: true })
    }
  },

  toggleFavorite: (entry) =>
    set((s) => {
      const exists = s.favorites.some((f) => f.key === entry.key)
      const next = exists
        ? s.favorites.filter((f) => f.key !== entry.key)
        : [...s.favorites, entry]
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      }
      return { favorites: next }
    }),

  isFavorite: (key) => get().favorites.some((f) => f.key === key),

  removeFavorite: (key) =>
    set((s) => {
      const next = s.favorites.filter((f) => f.key !== key)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      }
      return { favorites: next }
    }),
}))
