// Portal-based context menu used by week + day views. Rendering through
// document.body avoids clipping from parent overflow/transform contexts that
// plague inline fixed-position menus.

'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface PlannerMenuItem {
  label: string
  onSelect: () => void | Promise<void>
  danger?: boolean
}

interface Props {
  x: number
  y: number
  items: PlannerMenuItem[]
  onClose: () => void
}

export function PlannerContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState({ x, y })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Clamp to viewport after the menu measures itself.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { offsetWidth: w, offsetHeight: h } = el
    const vw = window.innerWidth
    const vh = window.innerHeight
    const nx = Math.min(x, Math.max(4, vw - w - 4))
    const ny = Math.min(y, Math.max(4, vh - h - 4))
    setPos({ x: nx, y: ny })
  }, [x, y])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onScroll = () => onClose()
    window.addEventListener('keydown', onKey)
    // mousedown — dismiss before clicks fire elsewhere.
    window.addEventListener('mousedown', onDown)
    // capture=true so inner scroll containers also dismiss.
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    window.addEventListener('contextmenu', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('contextmenu', onDown)
    }
  }, [onClose])

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={ref}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[1000] min-w-[160px] overflow-hidden rounded-md border shadow-xl"
      style={{
        top: pos.y,
        left: pos.x,
        background: 'var(--bg1)',
        borderColor: 'var(--border)',
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={async (e) => {
            e.stopPropagation()
            // Close first so any state update in onSelect doesn't race with cleanup.
            onClose()
            await item.onSelect()
          }}
          className={`flex w-full items-center px-3 py-1.5 text-left text-[12px] transition hover:bg-[color:var(--bg2)] ${
            item.danger ? '' : ''
          } ${i > 0 && item.danger ? 'border-t' : ''}`}
          style={{
            color: item.danger ? '#ef6850' : 'var(--text0)',
            borderColor: 'var(--border)',
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}
