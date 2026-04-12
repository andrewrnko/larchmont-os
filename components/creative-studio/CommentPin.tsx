// Comment pin + thread panel — rendered in world (canvas) space.
// Thread panel uses a React Portal so it always floats above blocks.

'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Check, X, MoreHorizontal, Trash2, Send } from 'lucide-react'
import { useCommentsStore, type Pin } from './comments-store'

// ── Relative time formatter ──
function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  return `${days}d ago`
}

// ── Viewport info passed from Canvas ──
export interface PinViewport {
  panX: number
  panY: number
  zoom: number
  canvasRect: DOMRect | null
}

// ── Single Pin on canvas ──
export function CommentPinMarker({
  pin,
  index,
  vp,
  onPinContextMenu,
}: {
  pin: Pin
  index: number
  vp: PinViewport
  onPinContextMenu?: (e: React.MouseEvent) => void
}) {
  const activePinId = useCommentsStore((s) => s.activePinId)
  const setActivePin = useCommentsStore((s) => s.setActivePin)
  const updatePin = useCommentsStore((s) => s.updatePin)
  const isActive = activePinId === pin.id
  const [hovered, setHovered] = useState(false)
  const isDragging = useRef(false)

  // ── Drag: document-level listeners, deferred pointer capture ──
  const DRAG_THRESHOLD = 4

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
    e.preventDefault()

    const startX = e.clientX
    const startY = e.clientY
    const pointerId = e.pointerId
    const target = e.currentTarget as Element
    let dragging = false

    const handleMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (!dragging && distance > DRAG_THRESHOLD) {
        dragging = true
        isDragging.current = true
        try { target.setPointerCapture(pointerId) } catch {}
      }

      if (dragging && vp.canvasRect) {
        moveEvent.stopPropagation()
        moveEvent.preventDefault()
        const wx = (moveEvent.clientX - vp.canvasRect.left - vp.panX) / vp.zoom
        const wy = (moveEvent.clientY - vp.canvasRect.top - vp.panY) / vp.zoom
        updatePin(pin.id, { x: wx, y: wy })
      }
    }

    const handleUp = () => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', handleUp)

      if (!dragging) {
        // It was a click — toggle the thread panel
        setActivePin(isActive ? null : pin.id)
      }
      try { target.releasePointerCapture(pointerId) } catch {}
      isDragging.current = false
    }

    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleUp)
  }

  // Compute screen position for the portal panel
  const screenX = vp.canvasRect
    ? pin.x * vp.zoom + vp.panX + vp.canvasRect.left
    : 0
  const screenY = vp.canvasRect
    ? pin.y * vp.zoom + vp.panY + vp.canvasRect.top
    : 0

  return (
    <div
      data-comment-pin="true"
      className="absolute"
      style={{
        left: pin.x,
        top: pin.y,
        zIndex: 500,
        transform: 'translate(-18px, -18px)',
        pointerEvents: 'auto',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
      } as React.CSSProperties}
    >
      {/* Pin shape: circle */}
      <div
        onPointerDown={handlePointerDown}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onPinContextMenu?.(e)
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          opacity: pin.resolved ? 0.4 : 1,
          transition: isDragging.current ? 'none' : 'transform 150ms ease, opacity 150ms ease',
          transform: hovered && !pin.resolved ? 'scale(1.08)' : 'scale(1)',
          cursor: isDragging.current ? 'grabbing' : 'pointer',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          outline: 'none',
        } as React.CSSProperties}
      >
        {/* Circle — 36px, accent red */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 700,
            background: 'var(--cs-accent)',
            color: '#fff',
            boxShadow: isActive
              ? '0 0 0 3px rgba(232,93,58,0.25), 0 4px 12px rgba(0,0,0,0.4)'
              : '0 4px 12px rgba(0,0,0,0.4)',
            outline: 'none',
          }}
        >
          {pin.resolved ? (
            <Check size={15} strokeWidth={2.5} />
          ) : pin.comments.length > 0 ? (
            pin.comments.length
          ) : (
            <MessageSquare size={15} strokeWidth={2} />
          )}
        </div>
      </div>

      {/* Thread panel — rendered via portal at screen coords */}
      {isActive && !pin.resolved && (
        <CommentThreadPortal
          pin={pin}
          index={index}
          screenX={screenX}
          screenY={screenY}
        />
      )}
    </div>
  )
}

// ── Thread panel rendered via portal to document.body ──
function CommentThreadPortal({
  pin,
  index,
  screenX,
  screenY,
}: {
  pin: Pin
  index: number
  screenX: number
  screenY: number
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      <CommentThreadPanel
        pin={pin}
        index={index}
        screenX={screenX}
        screenY={screenY}
      />
    </AnimatePresence>,
    document.body
  )
}

// ── Thread panel floating near pin ──
function CommentThreadPanel({
  pin,
  index,
  screenX,
  screenY,
}: {
  pin: Pin
  index: number
  screenX: number
  screenY: number
}) {
  const addComment = useCommentsStore((s) => s.addComment)
  const deletePin = useCommentsStore((s) => s.deletePin)
  const resolvePin = useCommentsStore((s) => s.resolvePin)
  const setActivePin = useCommentsStore((s) => s.setActivePin)

  const [text, setText] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)

  // Auto-focus input when panel opens
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

  // Scroll to bottom when new comment added (smooth)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [pin.comments.length])

  // Dismiss three-dots menu on outside click or Escape
  useEffect(() => {
    if (!showMenu) return
    const onMouseDown = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        menuBtnRef.current &&
        !menuBtnRef.current.contains(e.target as Node)
      ) {
        setShowMenu(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMenu(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [showMenu])

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    addComment(pin.id, trimmed)
    setText('')
  }

  // Viewport collision: flip panel if it would go off-screen
  const panelW = 300
  const panelH = 360
  const pinOffset = 20
  const flipX = screenX + pinOffset + panelW > window.innerWidth
  const flipY = screenY + panelH > window.innerHeight

  const panelLeft = flipX ? screenX - panelW - pinOffset : screenX + pinOffset
  const panelTop = flipY ? screenY - panelH : screenY - 46

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="fixed"
      style={{
        left: Math.max(8, panelLeft),
        top: Math.max(8, panelTop),
        width: panelW,
        zIndex: 2000,
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        style={{
          overflow: 'hidden',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.08)',
          background: '#161616',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3.5 py-2.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#d4d4d4',
              letterSpacing: '-0.01em',
            }}
          >
            Note #{index + 1}
          </span>
          <div className="flex items-center gap-0.5">
            {/* Resolve */}
            <button
              onClick={() => resolvePin(pin.id)}
              title="Resolve"
              className="flex items-center justify-center rounded transition-colors duration-[120ms]"
              style={{ width: 28, height: 28, color: '#737373' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#e5e5e5' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#737373' }}
            >
              <Check size={15} />
            </button>
            {/* More menu */}
            <div className="relative">
              <button
                ref={menuBtnRef}
                onClick={() => setShowMenu((v) => !v)}
                className="flex items-center justify-center rounded transition-colors duration-[120ms]"
                style={{ width: 28, height: 28, color: '#737373' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#e5e5e5' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#737373' }}
              >
                <MoreHorizontal size={15} />
              </button>
              {showMenu && (
                <div
                  ref={menuRef}
                  className="absolute right-0 top-full mt-1 w-40 overflow-hidden rounded-lg py-1"
                  style={{
                    zIndex: 2010,
                    background: '#1c1c1c',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}
                >
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors duration-[100ms]"
                    style={{ color: '#d4d4d4' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    onClick={() => {
                      setShowMenu(false)
                      resolvePin(pin.id)
                    }}
                  >
                    <Check size={13} /> Resolve
                  </button>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors duration-[100ms]"
                    style={{ color: '#f87171' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    onClick={() => {
                      setShowMenu(false)
                      deletePin(pin.id)
                    }}
                  >
                    <Trash2 size={13} /> Delete pin
                  </button>
                </div>
              )}
            </div>
            {/* Close */}
            <button
              onClick={() => setActivePin(null)}
              className="flex items-center justify-center rounded transition-colors duration-[120ms]"
              style={{ width: 28, height: 28, color: '#737373' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#e5e5e5' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#737373' }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Comment thread */}
        {pin.comments.length > 0 && (
          <div
            ref={scrollRef}
            style={{
              maxHeight: 280,
              overflowY: 'auto',
              scrollbarWidth: 'thin' as const,
            }}
          >
            {pin.comments.map((c, ci) => (
              <div
                key={c.id}
                style={{
                  padding: '14px 16px',
                  borderBottom: ci < pin.comments.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  display: 'flex',
                  flexDirection: 'row' as const,
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                {/* Avatar — 32px */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                    background: 'rgba(232,93,58,0.25)',
                    color: '#e85d3a',
                  }}
                >
                  A
                </div>
                <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f0f0f0' }}>
                      Andrew
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 400, color: '#737373' }}>
                      {timeAgo(c.createdAt)}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: '#d4d4d4',
                      wordBreak: 'break-word',
                    }}
                  >
                    {c.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Input area */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row' as const,
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
              e.stopPropagation()
            }}
            placeholder="Add a note..."
            style={{
              flex: 1,
              height: 40,
              fontSize: 14,
              padding: '0 14px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: '#e5e5e5',
              outline: 'none',
            }}
            className="placeholder:text-neutral-500"
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            onMouseEnter={(e) => { if (text.trim()) e.currentTarget.style.filter = 'brightness(1.1)' }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = 'none' }}
            style={{
              width: 48,
              height: 40,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: 'none',
              background: text.trim() ? '#e85d3a' : '#262626',
              color: text.trim() ? '#fff' : '#525252',
              boxShadow: text.trim() ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
              transition: 'background 120ms, color 120ms, filter 120ms',
              cursor: text.trim() ? 'pointer' : 'default',
            }}
          >
            <Send size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Pin context menu (right-click) — rendered via portal ──
export function PinContextMenu({
  pin,
  x,
  y,
  onClose,
}: {
  pin: Pin
  x: number
  y: number
  onClose: () => void
}) {
  const deletePin = useCommentsStore((s) => s.deletePin)
  const resolvePin = useCommentsStore((s) => s.resolvePin)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const dismiss = () => onClose()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('click', dismiss)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', dismiss)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Viewport collision
  const menuW = 180
  const menuH = pin.resolved ? 48 : 92
  const left = x + menuW > window.innerWidth ? x - menuW : x
  const top = y + menuH > window.innerHeight ? y - menuH : y

  const menu = (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.1 }}
      className="fixed overflow-hidden py-1"
      style={{
        zIndex: 2000,
        left: Math.max(8, left),
        top: Math.max(8, top),
        width: menuW,
        background: '#1a1a1a',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {!pin.resolved && (
        <button
          className="flex w-full items-center gap-2 text-left text-[13px] transition-colors duration-[100ms]"
          style={{ padding: '10px 16px', color: '#d4d4d4' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          onClick={(e) => {
            e.stopPropagation()
            resolvePin(pin.id)
            onClose()
          }}
        >
          <Check size={13} /> Resolve
        </button>
      )}
      <button
        className="flex w-full items-center gap-2 text-left text-[13px] transition-colors duration-[100ms]"
        style={{ padding: '10px 16px', color: '#e85d3a' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        onClick={(e) => {
          e.stopPropagation()
          deletePin(pin.id)
          onClose()
        }}
      >
        <Trash2 size={13} /> Delete pin
      </button>
    </motion.div>
  )

  if (!mounted) return null
  return createPortal(menu, document.body)
}
