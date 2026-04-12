// Connector lines — click to select, Delete/Backspace or × button to remove.

'use client'

import { useEffect, useState } from 'react'
import type { AnyBlock, Connector } from './types'
import { useCanvasStore } from './store'

interface Props {
  blocks: AnyBlock[]
  connectors: Connector[]
}

function pathFor(style: Connector['style'], a: { x: number; y: number }, c: { x: number; y: number }) {
  if (style === 'straight') return `M ${a.x} ${a.y} L ${c.x} ${c.y}`
  if (style === 'elbow') {
    const mx = (a.x + c.x) / 2
    return `M ${a.x} ${a.y} L ${mx} ${a.y} L ${mx} ${c.y} L ${c.x} ${c.y}`
  }
  const mx = (a.x + c.x) / 2
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${c.y}, ${c.x} ${c.y}`
}

export function ConnectorLines({ blocks, connectors }: Props) {
  const updateConnector = useCanvasStore((s) => s.updateConnector)
  const removeConnector = useCanvasStore((s) => s.removeConnector)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  // Delete selected connector on Delete/Backspace
  useEffect(() => {
    if (!selectedId) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        e.stopPropagation()
        removeConnector(selectedId)
        setSelectedId(null)
      }
      if (e.key === 'Escape') setSelectedId(null)
    }
    // Click anywhere else to deselect
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-connector]')) {
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey, true) // capture phase so it fires before Canvas's handler
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('click', onClick)
    }
  }, [selectedId, removeConnector])

  const blockMap = new Map(blocks.map((b) => [b.id, b]))

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      style={{ width: 100000, height: 100000, overflow: 'visible' }}
    >
      <defs>
        <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill="var(--cs-accent)" />
        </marker>
        <marker id="arrowhead-selected" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill="var(--cs-accent2)" />
        </marker>
      </defs>
      {connectors.map((c) => {
        const a = blockMap.get(c.fromBlockId)
        const b = blockMap.get(c.toBlockId)
        if (!a || !b) return null
        const ap = { x: a.x + a.w / 2, y: a.y + a.h / 2 }
        const bp = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
        const d = pathFor(c.style, ap, bp)
        const mid = { x: (ap.x + bp.x) / 2, y: (ap.y + bp.y) / 2 }
        const isSelected = selectedId === c.id
        return (
          <g key={c.id} data-connector={c.id} className="pointer-events-auto">
            {/* Selection glow (behind the main line) */}
            {isSelected && (
              <path d={d} stroke="var(--cs-accent2)" strokeWidth={8} fill="none" opacity={0.3} />
            )}
            {/* Main visible line */}
            <path
              d={d}
              stroke={isSelected ? 'var(--cs-accent2)' : c.color}
              strokeWidth={isSelected ? 3 : c.weight}
              fill="none"
              markerEnd={c.arrow !== 'none' ? (isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)') : undefined}
              markerStart={c.arrow === 'both' ? (isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)') : undefined}
              style={{ cursor: 'pointer' }}
              onContextMenu={(e) => {
                e.preventDefault()
                const next: Connector['style'] =
                  c.style === 'straight' ? 'curved' : c.style === 'curved' ? 'elbow' : 'straight'
                updateConnector(c.id, { style: next })
              }}
            />
            {/* Fat invisible hitbox for easy clicking */}
            <path
              d={d}
              stroke="transparent"
              strokeWidth={16}
              fill="none"
              className="pointer-events-auto"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedId(isSelected ? null : c.id)
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                setEditing(c.id)
              }}
            />
            {/* Label */}
            {c.label && (
              <text x={mid.x} y={mid.y - 6} fill="#eee" fontSize={10} textAnchor="middle">
                {c.label}
              </text>
            )}
            {/* Delete button at midpoint when selected */}
            {isSelected && (
              <foreignObject x={mid.x - 12} y={mid.y - 12} width={24} height={24}>
                <button
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-red-600 bg-red-900 text-[15px] text-red-300 shadow-lg hover:bg-red-800"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeConnector(c.id)
                    setSelectedId(null)
                  }}
                  title="Delete connector"
                >
                  ×
                </button>
              </foreignObject>
            )}
            {/* Inline label editor */}
            {editing === c.id && (
              <foreignObject x={mid.x - 60} y={mid.y - 10} width={120} height={22}>
                <input
                  autoFocus
                  defaultValue={c.label ?? ''}
                  className="w-full rounded bg-black/90 px-1 text-[15px] text-white outline-none"
                  onBlur={(e) => {
                    updateConnector(c.id, { label: e.target.value })
                    setEditing(null)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
              </foreignObject>
            )}
          </g>
        )
      })}
    </svg>
  )
}
