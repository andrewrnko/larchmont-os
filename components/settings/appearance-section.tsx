// Settings → Appearance: pick a custom accent color for the whole app.
// Live preview shows exactly how buttons, badges, active states, checkboxes,
// and focus rings will look with the selected color. The choice is persisted
// to localStorage and applied to `:root` at runtime via `useThemeStore`.

'use client'

import { useState } from 'react'
import { Check, RotateCcw, Palette } from 'lucide-react'
import {
  useThemeStore,
  PRESET_ACCENTS,
  DEFAULT_ACCENT,
  normalizeHex,
  lightenHex,
  hexToRgba,
} from '@/lib/theme-store'

function Swatch({
  value,
  label,
  selected,
  onClick,
}: {
  value: string
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="group relative flex h-9 w-9 items-center justify-center rounded-[6px] transition-transform duration-100 hover:scale-110"
      style={{
        background: value,
        boxShadow: selected ? `0 0 0 2px var(--bg1), 0 0 0 4px ${value}` : 'none',
      }}
    >
      {selected && <Check size={14} color="#111110" strokeWidth={3} />}
    </button>
  )
}

export function AppearanceSection() {
  const accent = useThemeStore((s) => s.accent)
  const setAccent = useThemeStore((s) => s.setAccent)
  const resetAccent = useThemeStore((s) => s.resetAccent)
  const [hexInput, setHexInput] = useState(accent)
  const [hexError, setHexError] = useState<string | null>(null)

  const tryApplyHex = (value: string) => {
    setHexInput(value)
    const normalized = normalizeHex(value)
    if (normalized) {
      setAccent(normalized)
      setHexError(null)
    } else if (value.trim() !== '') {
      setHexError('Enter a valid hex (e.g. #ef6850)')
    } else {
      setHexError(null)
    }
  }

  const isDefault = accent.toLowerCase() === DEFAULT_ACCENT.toLowerCase()
  const accent2 = lightenHex(accent, 0.18)

  return (
    <div
      className="overflow-hidden rounded-[10px] border"
      style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <div
        className="border-b px-5 py-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text0)' }}>
            Appearance
          </h2>
        </div>
        <p className="mt-0.5 text-[12px]" style={{ color: 'var(--text2)' }}>
          Pick an accent color — it updates buttons, badges, active states, and focus rings across the whole app instantly.
        </p>
      </div>

      {/* Preset swatches */}
      <div className="px-5 py-4">
        <label className="mb-2 block text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--text3)' }}>
          Presets
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_ACCENTS.map((p) => (
            <Swatch
              key={p.value}
              value={p.value}
              label={p.name}
              selected={accent.toLowerCase() === p.value.toLowerCase()}
              onClick={() => {
                setAccent(p.value)
                setHexInput(p.value)
                setHexError(null)
              }}
            />
          ))}
        </div>
      </div>

      {/* Custom hex input */}
      <div
        className="border-t px-5 py-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <label className="mb-2 block text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--text3)' }}>
          Custom color
        </label>
        <div className="flex items-center gap-2">
          <div
            className="h-9 w-9 shrink-0 rounded-[6px] border"
            style={{ background: accent, borderColor: 'var(--border2)' }}
          />
          <input
            value={hexInput}
            onChange={(e) => tryApplyHex(e.target.value)}
            placeholder="#e85d3a"
            spellCheck={false}
            className="flex-1 rounded-[6px] border px-3 py-1.5 font-mono text-[13px] outline-none transition-colors focus:border-[color:var(--accent)]"
            style={{
              background: 'var(--bg3)',
              borderColor: hexError ? '#e05050' : 'var(--border)',
              color: 'var(--text0)',
            }}
          />
          <input
            type="color"
            value={accent}
            onChange={(e) => {
              setAccent(e.target.value)
              setHexInput(e.target.value)
              setHexError(null)
            }}
            className="h-9 w-9 cursor-pointer rounded-[6px] border-0 bg-transparent p-0"
            title="Open native color picker"
          />
          {!isDefault && (
            <button
              onClick={() => {
                resetAccent()
                setHexInput(DEFAULT_ACCENT)
                setHexError(null)
              }}
              className="flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1.5 text-[12px] transition-colors duration-100 hover:bg-[color:var(--bg3)]"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text2)',
              }}
              title="Reset to default"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          )}
        </div>
        {hexError && (
          <p className="mt-1.5 text-[11px]" style={{ color: '#e05050' }}>
            {hexError}
          </p>
        )}
      </div>

      {/* Live preview */}
      <div
        className="border-t px-5 py-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <label className="mb-3 block text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--text3)' }}>
          Live preview
        </label>

        <div
          className="rounded-[8px] border p-4"
          style={{ background: 'var(--bg1)', borderColor: 'var(--border)' }}
        >
          {/* Buttons */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              className="rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-opacity hover:opacity-90"
              style={{ background: accent, color: '#111110' }}
            >
              Primary action
            </button>
            <button
              className="rounded-[6px] border px-3 py-1.5 text-[13px] font-medium transition-colors duration-100"
              style={{
                borderColor: accent,
                color: accent,
                background: 'transparent',
              }}
            >
              Outlined
            </button>
            <button
              className="rounded-[6px] px-3 py-1.5 text-[13px] transition-colors duration-100"
              style={{
                background: hexToRgba(accent, 0.15),
                color: accent,
              }}
            >
              Ghost
            </button>
            <div
              className="flex items-center gap-1.5 rounded-[6px] border px-2 py-1 text-[11px] font-semibold"
              style={{
                background: hexToRgba(accent, 0.18),
                borderColor: hexToRgba(accent, 0.3),
                color: accent,
              }}
            >
              P1 badge
            </div>
          </div>

          {/* Active nav row */}
          <div
            className="mb-3 flex h-7 items-center gap-2 rounded-[3px] pl-3 pr-2 text-[12.5px]"
            style={{
              background: 'var(--bg3)',
              borderLeft: `2px solid ${accent}`,
              color: 'var(--text0)',
            }}
          >
            <span
              className="flex h-[14px] w-[14px] items-center justify-center rounded-[3px]"
              style={{ background: hexToRgba(accent, 0.18), color: accent }}
            >
              <Check size={9} strokeWidth={2.5} />
            </span>
            <span className="flex-1">Active sidebar row</span>
          </div>

          {/* Checkbox + text */}
          <div className="mb-3 flex items-center gap-2">
            <div
              className="flex h-[14px] w-[14px] items-center justify-center rounded-[3px]"
              style={{ background: accent, borderColor: accent }}
            >
              <Check size={10} color="#111110" strokeWidth={3} />
            </div>
            <span className="text-[13px]" style={{ color: 'var(--text0)' }}>
              Task completed with the new accent
            </span>
          </div>

          {/* Input with focus ring */}
          <input
            placeholder="Focus ring preview (click me)"
            className="w-full rounded-[6px] border px-3 py-2 text-[13px] outline-none transition-all"
            style={{
              background: 'var(--bg2)',
              borderColor: 'var(--border)',
              color: 'var(--text0)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = accent
              e.currentTarget.style.boxShadow = `0 0 0 3px ${hexToRgba(accent, 0.15)}`
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />

          {/* Gradient avatar swatch — mirrors the sidebar workspace L */}
          <div className="mt-4 flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-[8px] text-[14px] font-semibold"
              style={{
                background: `linear-gradient(135deg, ${accent} 0%, ${accent2} 100%)`,
                color: '#111110',
              }}
            >
              L
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-medium" style={{ color: 'var(--text0)' }}>
                Larchmont OS
              </span>
              <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
                Personal Space
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
