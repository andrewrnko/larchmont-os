// Connector lines — click to select, Delete/Backspace or × button to remove.
//
// Two visual styles determined by the source/target block types:
//   Style A (node-to-node): neutral gray, no arrows — matches mind map edges
//   Style B (block-to-block): slightly brighter, small subtle arrowhead
//
// z-index 100: above group backgrounds (z=1), below standalone nodes and
// other blocks (z=Date.now clamped), below modals/menus.

'use client'

import { useEffect, useState } from 'react'
import type { AnyBlock, Connector, StandaloneNodeBlock } from './types'
import { useCanvasStore } from './store'

interface Props {
  blocks: AnyBlock[]
  connectors: Connector[]
  /** Optional filter: 'to-group' = only connectors touching a group,
   *  'not-group' = only connectors NOT touching a group,
   *  undefined = all connectors */
  filter?: 'to-group' | 'not-group'
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

/** Returns the set of block ids hidden by collapse. */
export function getCollapsedBlockIds(blocks: AnyBlock[], connectors: Connector[]): Set<string> {
  const hidden = new Set<string>()
  // Find all collapsed standalone-node blocks
  const collapsedRoots = blocks.filter(
    (b) => b.kind === 'standalone-node' && (b as StandaloneNodeBlock).collapsed
  )
  // BFS downstream from each collapsed root via outgoing connectors
  for (const root of collapsedRoots) {
    const queue = [root.id]
    const visited = new Set<string>([root.id])
    while (queue.length > 0) {
      const cur = queue.shift()!
      const children = connectors
        .filter((c) => c.fromBlockId === cur)
        .map((c) => c.toBlockId)
      for (const childId of children) {
        if (!visited.has(childId)) {
          visited.add(childId)
          hidden.add(childId)
          queue.push(childId)
        }
      }
    }
  }
  return hidden
}

export function ConnectorLines({ blocks, connectors, filter }: Props) {
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
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-connector]')) {
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('click', onClick)
    }
  }, [selectedId, removeConnector])

  const blockMap = new Map(blocks.map((b) => [b.id, b]))

  // Compute hidden blocks from collapse state
  const hiddenIds = getCollapsedBlockIds(blocks, connectors)

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      style={{ width: 10, height: 10, overflow: 'visible', zIndex: filter === 'to-group' ? 5 : 15 }}
    >
      <defs>
        {/* Red arrowhead for block-to-block connectors — original style */}
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

        // Hide connectors to/from collapsed (hidden) nodes
        if (hiddenIds.has(c.fromBlockId) || hiddenIds.has(c.toBlockId)) return null

        // Filter by group involvement
        const touchesGroup = a.kind === 'group' || b.kind === 'group'
        if (filter === 'to-group' && !touchesGroup) return null
        if (filter === 'not-group' && touchesGroup) return null

        // Center-to-center — same as mind map edges
        const ap = { x: a.x + a.w / 2, y: a.y + a.h / 2 }
        const bp = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
        const d = pathFor(c.style, ap, bp)
        const mid = { x: (ap.x + bp.x) / 2, y: (ap.y + bp.y) / 2 }
        const isSelected = selectedId === c.id

        // Any connector involving a standalone-node uses neutral gray.
        // Only connectors between two non-node blocks use the red accent style.
        const involvesNode = a.kind === 'standalone-node' || b.kind === 'standalone-node'
        const strokeColor = isSelected
          ? 'var(--cs-accent2)'
          : involvesNode
            ? 'rgba(255,255,255,0.12)'
            : c.color
        const strokeWidth = isSelected ? 2.5 : involvesNode ? 1.5 : c.weight
        const opacity = involvesNode && !isSelected ? 0.7 : 1
        const showArrow = !involvesNode && c.arrow !== 'none'

        return (
          <g key={c.id} data-connector={c.id} className="pointer-events-auto">
            {/* Selection glow */}
            {isSelected && (
              <path d={d} stroke="var(--cs-accent2)" strokeWidth={8} fill="none" opacity={0.2} />
            )}
            {/* Main visible line */}
            <path
              d={d}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              fill="none"
              opacity={opacity}
              markerEnd={showArrow ? (isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)') : undefined}
              style={{ cursor: 'pointer' }}
              onContextMenu={(e) => {
                e.preventDefault()
                const next: Connector['style'] =
                  c.style === 'straight' ? 'curved' : c.style === 'curved' ? 'elbow' : 'straight'
                updateConnector(c.id, { style: next })
              }}
            />
            {/* Fat invisible hitbox */}
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
            {/* Delete button when selected */}
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
