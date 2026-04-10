// Creative Studio — custom hooks
// useCanvasViewport: pan/zoom via pointer + wheel
// useDraggable: drag blocks in world space (accounts for viewport scale)
// useResizable: bottom-right resize handle with min-size constraints
// useUndoRedo: wires Ctrl+Z / Ctrl+Y to the history store

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useCanvasStore, useHistoryStore, pushHistorySnapshot, useActiveBoard } from './store'
import type { BlockKind } from './types'

// ────────────────────────────────────────────────
// Viewport
// ────────────────────────────────────────────────
export function useCanvasViewport(containerRef: React.RefObject<HTMLDivElement | null>) {
  const board = useActiveBoard()
  const setViewport = useCanvasStore((s) => s.setViewport)
  const v = board?.viewport ?? { x: 0, y: 0, scale: 1 }

  const panning = useRef(false)
  const last = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      // If the cursor is over a scrollable element inside a block, let it scroll naturally
      const target = e.target as HTMLElement
      const blockEl = target.closest('[data-block]')
      if (blockEl) {
        // Check if any scrollable ancestor exists within the block
        const scrollable = target.closest('[data-scrollable]') ?? blockEl.querySelector('[data-scrollable]')
        if (scrollable) {
          const el2 = scrollable as HTMLElement
          const canScrollV = el2.scrollHeight > el2.clientHeight
          const canScrollH = el2.scrollWidth > el2.clientWidth
          if (canScrollV || canScrollH) {
            // Let the block's scrollable area handle it — don't pan the canvas
            return
          }
        }
      }
      e.preventDefault()
      // Ctrl/meta + wheel OR trackpad pinch → zoom. Plain wheel → pan.
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        const delta = -e.deltaY * 0.002
        const nextScale = Math.max(0.1, Math.min(4, v.scale * (1 + delta)))
        // Zoom around cursor
        const wx = (mx - v.x) / v.scale
        const wy = (my - v.y) / v.scale
        const nx = mx - wx * nextScale
        const ny = my - wy * nextScale
        setViewport({ x: nx, y: ny, scale: nextScale })
      } else {
        setViewport({ x: v.x - e.deltaX, y: v.y - e.deltaY, scale: v.scale })
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      // Middle mouse OR space-pan OR pan tool handled elsewhere
      if (e.button === 1) {
        panning.current = true
        last.current = { x: e.clientX, y: e.clientY }
        el.setPointerCapture(e.pointerId)
        e.preventDefault()
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!panning.current) return
      const dx = e.clientX - last.current.x
      const dy = e.clientY - last.current.y
      last.current = { x: e.clientX, y: e.clientY }
      setViewport({ x: v.x + dx, y: v.y + dy, scale: v.scale })
    }
    const onPointerUp = (e: PointerEvent) => {
      if (panning.current) {
        panning.current = false
        try { el.releasePointerCapture(e.pointerId) } catch {}
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [containerRef, v.x, v.y, v.scale, setViewport])

  const zoomToFit = useCallback(() => {
    const el = containerRef.current
    if (!el || !board || board.blocks.length === 0) {
      setViewport({ x: 0, y: 0, scale: 1 })
      return
    }
    const xs = board.blocks.map((b) => b.x)
    const ys = board.blocks.map((b) => b.y)
    const xe = board.blocks.map((b) => b.x + b.w)
    const ye = board.blocks.map((b) => b.y + b.h)
    const minX = Math.min(...xs) - 80
    const minY = Math.min(...ys) - 80
    const maxX = Math.max(...xe) + 80
    const maxY = Math.max(...ye) + 80
    const rect = el.getBoundingClientRect()
    const scale = Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY), 1.5)
    setViewport({ x: -minX * scale, y: -minY * scale, scale })
  }, [containerRef, board, setViewport])

  return { viewport: v, setViewport, zoomToFit }
}

// ────────────────────────────────────────────────
// Draggable blocks
// ────────────────────────────────────────────────
export function useDraggable(blockId: string, opts?: { disabled?: boolean }) {
  const updateBlock = useCanvasStore((s) => s.updateBlock)
  const snapToGrid = useCanvasStore((s) => s.snapToGrid)
  const gridSize = useCanvasStore((s) => s.gridSize)
  const bringToFront = useCanvasStore((s) => s.bringToFront)
  const setSelection = useCanvasStore((s) => s.setSelection)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (opts?.disabled) return
      if ((e.target as HTMLElement).closest('[data-no-drag]')) return
      if (e.button !== 0) return

      const cs = useCanvasStore.getState()
      const board = cs.boards.find((b) => b.id === cs.activeBoardId)
      if (!board) return
      const block = board.blocks.find((b) => b.id === blockId)
      if (!block || block.locked) return

      e.stopPropagation()
      e.preventDefault()
      bringToFront(blockId)
      // If this block is already in a multi-selection, keep it. Otherwise select just this one.
      const isInSelection = cs.selection.includes(blockId)
      if (!e.shiftKey && !isInSelection) setSelection([blockId])
      pushHistorySnapshot()

      document.body.style.userSelect = 'none'

      const scale = board.viewport.scale
      const startX = e.clientX
      const startY = e.clientY

      // Capture original positions of ALL selected blocks for group move
      const sel = isInSelection ? cs.selection : [blockId]
      const origins = sel.map((id) => {
        const b = board.blocks.find((x) => x.id === id)
        return { id, x: b?.x ?? 0, y: b?.y ?? 0 }
      })

      const onMove = (ev: PointerEvent) => {
        ev.preventDefault()
        const dx = (ev.clientX - startX) / scale
        const dy = (ev.clientY - startY) / scale
        for (const orig of origins) {
          let nx = orig.x + dx
          let ny = orig.y + dy
          if (snapToGrid) {
            nx = Math.round(nx / gridSize) * gridSize
            ny = Math.round(ny / gridSize) * gridSize
          }
          updateBlock(orig.id, { x: nx, y: ny })
        }
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        document.body.style.userSelect = ''
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [blockId, bringToFront, updateBlock, snapToGrid, gridSize, setSelection, opts?.disabled]
  )

  return { onPointerDown }
}

// ────────────────────────────────────────────────
// Resizable
// ────────────────────────────────────────────────
const MIN_SIZES: Record<string, { w: number; h: number }> = {
  text: { w: 160, h: 80 },
  sticky: { w: 120, h: 120 },
  image: { w: 120, h: 80 },
  storyboard: { w: 360, h: 200 },
  mindmap: { w: 280, h: 200 },
  page: { w: 180, h: 80 },
  timeline: { w: 320, h: 100 },
  embed: { w: 240, h: 160 },
  section: { w: 240, h: 160 },
}

export function useResizable(blockId: string, kind: BlockKind, opts?: { lockAspect?: boolean; ratio?: number }) {
  const updateBlock = useCanvasStore((s) => s.updateBlock)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      const cs = useCanvasStore.getState()
      const board = cs.boards.find((b) => b.id === cs.activeBoardId)
      if (!board) return
      const block = board.blocks.find((b) => b.id === blockId)
      if (!block || block.locked) return

      pushHistorySnapshot()
      const scale = board.viewport.scale
      const startX = e.clientX
      const startY = e.clientY
      const origW = block.w
      const origH = block.h
      const min = MIN_SIZES[kind] ?? { w: 80, h: 80 }

      const onMove = (ev: PointerEvent) => {
        let nw = Math.max(min.w, origW + (ev.clientX - startX) / scale)
        let nh = Math.max(min.h, origH + (ev.clientY - startY) / scale)
        if (opts?.lockAspect && opts.ratio) nh = nw / opts.ratio
        updateBlock(blockId, { w: nw, h: nh })
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [blockId, kind, updateBlock, opts?.lockAspect, opts?.ratio]
  )

  return { onPointerDown }
}

// ────────────────────────────────────────────────
// Undo / Redo keyboard
// ────────────────────────────────────────────────
export function useUndoRedo() {
  const undo = useHistoryStore((s) => s.undo)
  const redo = useHistoryStore((s) => s.redo)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable
      if (isEditing) return
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])
}

// ────────────────────────────────────────────────
// Lasso selection
// ────────────────────────────────────────────────
export function useLassoSelect(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const setSelection = useCanvasStore((s) => s.setSelection)
  const board = useActiveBoard()

  useEffect(() => {
    const el = containerRef.current
    if (!el || !board) return
    let startX = 0, startY = 0, active = false

    const onDown = (e: PointerEvent) => {
      // Only when clicking empty canvas (not a block or connector anchor)
      if ((e.target as HTMLElement).closest('[data-block], [data-anchor]')) return
      if (e.button !== 0) return
      const rect = el.getBoundingClientRect()
      startX = e.clientX - rect.left
      startY = e.clientY - rect.top
      active = true
      setBox({ x: startX, y: startY, w: 0, h: 0 })
      if (!e.shiftKey) setSelection([])
    }
    const onMove = (e: PointerEvent) => {
      if (!active) return
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      setBox({ x: Math.min(x, startX), y: Math.min(y, startY), w: Math.abs(x - startX), h: Math.abs(y - startY) })
    }
    const onUp = () => {
      if (!active) return
      active = false
      const cs = useCanvasStore.getState()
      const b = cs.boards.find((x) => x.id === cs.activeBoardId)
      setBox((cur) => {
        if (cur && b && (cur.w > 4 || cur.h > 4)) {
          // Convert screen box to world space
          const { x: vx, y: vy, scale } = b.viewport
          const wx1 = (cur.x - vx) / scale
          const wy1 = (cur.y - vy) / scale
          const wx2 = (cur.x + cur.w - vx) / scale
          const wy2 = (cur.y + cur.h - vy) / scale
          const hit = b.blocks
            .filter((bl) => bl.x < wx2 && bl.x + bl.w > wx1 && bl.y < wy2 && bl.y + bl.h > wy1)
            .map((bl) => bl.id)
          setSelection(hit)
        }
        return null
      })
    }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [containerRef, board, setSelection])

  return box
}
