// Theme store — lets the user pick a custom accent color for the whole app.
// The color is persisted to localStorage and injected at runtime by
// <ThemeProvider /> which sets `--accent` and `--accent2` on the document.
// This is purely presentational: no data or routing logic is touched.

'use client'

import { create } from 'zustand'

interface ThemeState {
  /** Hex color string, e.g. `#e85d3a`. */
  accent: string
  hydrated: boolean
  hydrate: () => void
  setAccent: (hex: string) => void
  resetAccent: () => void
}

export const DEFAULT_ACCENT = '#e85d3a'

const STORAGE_KEY = 'larchmont:accent'

export const PRESET_ACCENTS: { name: string; value: string }[] = [
  { name: 'Orange',    value: '#e85d3a' },
  { name: 'Red',       value: '#e0443a' },
  { name: 'Pink',      value: '#ec4899' },
  { name: 'Purple',    value: '#a855f7' },
  { name: 'Indigo',    value: '#818cf8' },
  { name: 'Blue',      value: '#3d7be8' },
  { name: 'Cyan',      value: '#22d3ee' },
  { name: 'Teal',      value: '#14b8a6' },
  { name: 'Green',     value: '#52a96a' },
  { name: 'Lime',      value: '#a3c044' },
  { name: 'Gold',      value: '#d4a234' },
  { name: 'Slate',     value: '#64748b' },
]

/** Validate a 3- or 6-digit hex string. Returns the normalized 6-digit form or null. */
export function normalizeHex(input: string): string | null {
  let s = input.trim()
  if (!s.startsWith('#')) s = '#' + s
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    // Expand shorthand like #e5a → #ee55aa
    s = '#' + s.slice(1).split('').map((c) => c + c).join('')
  }
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : null
}

/** Lighten a hex color by a 0–1 ratio for use as `--accent2`. */
export function lightenHex(hex: string, amount = 0.15): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const mix = (v: number) => Math.round(v + (255 - v) * amount)
  return (
    '#' +
    [mix(r), mix(g), mix(b)]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
      .join('')
  )
}

/** Convert a hex color to a CSS rgba() string with the given alpha. */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Apply an accent to the :root element — overrides --accent and --accent2. */
export function applyAccentToRoot(hex: string) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--accent', hex)
  root.style.setProperty('--accent2', lightenHex(hex, 0.18))
  root.style.setProperty('--accent-muted', hexToRgba(hex, 0.15))
  root.style.setProperty('--ring', hex)
  root.style.setProperty('--primary', hex)
}

const readInitial = (): string => {
  if (typeof window === 'undefined') return DEFAULT_ACCENT
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v && normalizeHex(v) ? normalizeHex(v)! : DEFAULT_ACCENT
}

export const useThemeStore = create<ThemeState>((set) => ({
  accent: readInitial(),
  hydrated: false,
  hydrate: () => {
    const accent = readInitial()
    applyAccentToRoot(accent)
    set({ accent, hydrated: true })
  },
  setAccent: (hex) => {
    const normalized = normalizeHex(hex) ?? DEFAULT_ACCENT
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, normalized)
    }
    applyAccentToRoot(normalized)
    set({ accent: normalized })
  },
  resetAccent: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY)
    }
    applyAccentToRoot(DEFAULT_ACCENT)
    set({ accent: DEFAULT_ACCENT })
  },
}))
