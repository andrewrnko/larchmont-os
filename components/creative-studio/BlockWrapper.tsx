// Generic block frame.
// Top edge strip: full-width drag handle (cursor: move).
// 3 anchor dots (right / bottom / left): drag-to-connect.
// Bottom-right corner: resize handle.

'use client'

import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { useCanvasStore } from './store'
import { useDraggable, useResizable } from './hooks'
import type { AnyBlock, BlockKind } from './types'
import { cn } from '@/lib/utils'

interface Props {
  block: AnyBlock
  kind: BlockKind
  children: ReactNode
  className?: string
  lockAspect?: boolean
  ratio?: number
  onContextMenu?: (e: React.MouseEvent) => void
}

const ANCHORS: { side: string; style: React.CSSProperties }[] = [
  { side: 'right',  style: { right: 0, top: '50%', transform: 'translate(50%, -50%)' } },
  { side: 'bottom', style: { left: '50%', bottom: 0, transform: 'translate(-50%, 50%)' } },
  { side: 'left',   style: { left: 0, top: '50%', transform: 'translate(-50%, -50%)' } },
]

function anchorWorldPos(block: AnyBlock, side: string) {
  switch (side) {
    case 'right':  return { x: block.x + block.w,     y: block.y + block.h / 2 }
    case 'bottom': return { x: block.x + block.w / 2, y: block.y + block.h }
    case 'left':   return { x: block.x,               y: block.y + block.h / 2 }
    default:       return { x: block.x, y: block.y }
  }
}

export function BlockWrapper({ block, kind, children, className, lockAspect, ratio, onContextMenu }: Props) {
  const selection = useCanvasStore((s) => s.selection)
  const setSelection = useCanvasStore((s) => s.setSelection)
  const bringToFront = useCanvasStore((s) => s.bringToFront)
  const startConnectDrag = useCanvasStore((s) => s.startConnectDrag)
  const selected = selection.includes(block.id)

  const { onPointerDown: onDragStart } = useDraggable(block.id, { disabled: block.locked })
  const { onPointerDown: onResizeStart } = useResizable(block.id, kind, { lockAspect, ratio })

  const handleSelectOnly = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-drag-handle], [data-resize-handle], [data-anchor]')) return
    bringToFront(block.id)
    if (e.shiftKey) {
      setSelection(selection.includes(block.id) ? selection.filter((x) => x !== block.id) : [...selection, block.id])
    } else if (!selection.includes(block.id)) {
      setSelection([block.id])
    }
  }

  const handleAnchorDown = (side: string, e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    e.nativeEvent.stopImmediatePropagation()
    const wp = anchorWorldPos(block, side)
    startConnectDrag(block.id, wp.x, wp.y)
  }

  return (
    <div
      data-block={block.id}
      onPointerDown={handleSelectOnly}
      onContextMenu={onContextMenu}
      className={cn(
        'absolute group',
        selected && 'ring-2 ring-[color:var(--cs-accent)]',
        block.locked && 'cursor-not-allowed',
        className
      )}
      style={{
        left: block.x,
        top: block.y,
        width: block.w,
        height: block.h,
        zIndex: block.z,
      }}
    >
      {children}

      {/* Drag handle — full-width top edge strip */}
      {!block.locked && (
        <div
          data-drag-handle
          onPointerDown={onDragStart}
          className="absolute left-0 top-0 z-[9999] h-4 w-full cursor-move rounded-t-md opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--cs-accent) 35%, transparent) 0%, transparent 100%)' }}
          title="Drag to move"
        />
      )}

      {/* Connector anchors — right / bottom / left */}
      {!block.locked &&
        ANCHORS.map(({ side, style }) => (
          <div
            key={side}
            data-anchor
            onPointerDown={(e) => handleAnchorDown(side, e)}
            className="absolute z-[99999] h-3.5 w-3.5 cursor-crosshair rounded-full border-2 border-white bg-[color:var(--cs-accent)] opacity-0 shadow-md transition-all duration-150 ease-out group-hover:opacity-100 hover:scale-150"
            style={style}
          />
        ))}

      {block.locked && (
        <div className="pointer-events-none absolute left-1 top-1 rounded bg-black/60 p-1 text-[color:var(--cs-accent2)]">
          <Lock size={12} />
        </div>
      )}

      {!block.locked && (
        <div
          data-resize-handle
          onPointerDown={onResizeStart}
          className="absolute bottom-0 right-0 z-[9999] h-4 w-4 cursor-se-resize opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          style={{
            background:
              'linear-gradient(135deg, transparent 0 50%, color-mix(in srgb, var(--cs-accent) 90%, transparent) 50% 100%)',
          }}
        />
      )}
    </div>
  )
}
