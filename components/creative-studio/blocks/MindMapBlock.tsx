// Mind map block.
//
// Click a node → opens the full-page notes modal
// Double-click a node → edit its label inline
// Press+drag a node → reposition it
// Press+drag the "+" → ghost line to cursor; drop on another node = re-parent,
//   drop on empty = create new child at drop position
// Right-click → shape / color / delete menu
//
// The container uses overflow:visible so the action buttons (-top-3) aren't clipped.

'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useCanvasStore, uid } from '../store'
import { ModalNotesEditor } from '../ModalNotesEditor'
import type { MindMapBlock, MindMapNode } from '../types'
import { BlockWrapper } from '../BlockWrapper'
import { Plus, X } from 'lucide-react'

// ── Color system ────────────────────────────────────────────────
// Default node bg = neutral dark card surface, matching every other
// block on the canvas. User-picked colors from the swatch picker
// are stored as explicit hex and rendered as-is.
const CARD_BG = '#141413'       // matches --bg2 / --card in dark theme
const CARD_BORDER = 'rgba(255,255,255,0.06)'
const LIGHT_TEXT = '#f0ede8'    // matches --text0
const DARK_TEXT = '#0a0a09'

// Picker swatches — note: #e85d3a is NOT in this list because it
// collides with the legacy default sentinel. Use #f97316 for orange.
const COLORS = ['#f97316', '#ef4444', '#3b82f6', '#10b981', '#a855f7', '#f5d97a']

// Values that were stored as "default" by previous versions of the code.
// ALL of them resolve to the neutral card background at render time.
const LEGACY_DEFAULTS = new Set([
  '', '#e85d3a', '#e85d3b', '#141413',
  'var(--cs-accent)', 'var(--accent)', 'var(--bg2)',
])

/** Resolve stored color → rendered background. */
function resolveColor(c: string | undefined | null): string {
  if (!c) return CARD_BG
  if (LEGACY_DEFAULTS.has(c.trim().toLowerCase())) return CARD_BG
  return c
}

/** Pick readable text color for a given hex background. */
function textForBg(hex: string): string {
  if (hex === CARD_BG) return LIGHT_TEXT
  try {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? DARK_TEXT : LIGHT_TEXT
  } catch { return LIGHT_TEXT }
}

/** Whether the resolved bg is the neutral card (not a user-picked color). */
function isNeutral(c: string | undefined | null): boolean {
  if (!c) return true
  return LEGACY_DEFAULTS.has(c.trim().toLowerCase())
}

interface Props {
  block: MindMapBlock
  onContextMenu?: (e: React.MouseEvent) => void
}

export function MindMapBlockView({ block, onContextMenu }: Props) {
  const updateBlock = useCanvasStore((s) => s.updateBlock)
  const [editingId, setEditingId] = useState<string | null>(null)
  // Right-click context menu state — includes screen position so we can
  // portal the menu to document.body at a fixed position, escaping the
  // node's stacking context (which has zIndex: 10 and traps child z-index).
  const [nodeMenu, setNodeMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [modalId, setModalId] = useState<string | null>(null)
  const [connectDrag, setConnectDrag] = useState<{
    fromId: string
    cursor: { x: number; y: number }
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const setNodes = (fn: (n: MindMapNode[]) => MindMapNode[]) => {
    updateBlock(block.id, { nodes: fn(block.nodes) })
  }

  // Close the right-click context menu on outside click or Escape.
  useEffect(() => {
    if (!nodeMenu) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-node-menu]')) return
      setNodeMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNodeMenu(null)
    }
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 60)
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [nodeMenu])

  const isHiddenByCollapse = (node: MindMapNode): boolean => {
    let cur = node
    while (cur.parentId) {
      const parent = block.nodes.find((n) => n.id === cur.parentId)
      if (!parent) break
      if (parent.collapsed) return true
      cur = parent
    }
    return false
  }

  const visibleNodes = block.nodes.filter((n) => !isHiddenByCollapse(n))

  // Convert clientX/Y to block-local coords (accounting for canvas transform).
  const toLocal = (clientX: number, clientY: number) => {
    const el = containerRef.current
    if (!el) return { x: clientX, y: clientY }
    const rect = el.getBoundingClientRect()
    const cs = useCanvasStore.getState()
    const b = cs.boards.find((x) => x.id === cs.activeBoardId)
    const scale = b?.viewport.scale ?? 1
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    }
  }

  // Press+drag = move node. Click (no drag) = open modal. Double-click = edit label.
  // ONLY fires on left-click (button 0) — right-click is handled by onContextMenu.
  const startNodeInteraction = (e: React.PointerEvent, nodeId: string) => {
    if (e.button !== 0) return // ignore right-click and middle-click
    e.stopPropagation()
    if (editingId === nodeId) return // already editing, don't start drag
    const node = block.nodes.find((n) => n.id === nodeId)
    if (!node) return
    const startX = e.clientX
    const startY = e.clientY
    const origDx = node.dx
    const origDy = node.dy
    const cs = useCanvasStore.getState()
    const b = cs.boards.find((x) => x.id === cs.activeBoardId)
    const scale = b?.viewport.scale ?? 1
    let moved = false

    const onMove = (ev: PointerEvent) => {
      const dxp = ev.clientX - startX
      const dyp = ev.clientY - startY
      if (!moved && Math.hypot(dxp, dyp) > 3) moved = true
      if (moved) {
        setNodes((ns) =>
          ns.map((n) => (n.id === nodeId ? { ...n, dx: origDx + dxp / scale, dy: origDy + dyp / scale } : n))
        )
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (!moved) {
        // Single click → open modal
        setModalId(nodeId)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Double-click = edit label inline
  const handleDoubleClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    setModalId(null) // close modal if open
    setEditingId(nodeId)
  }

  // Drag from "+" — ghost line to cursor, drop creates child or re-parents.
  const startConnectDrag = (e: React.PointerEvent, parentId: string) => {
    e.stopPropagation()
    e.preventDefault()
    const local = toLocal(e.clientX, e.clientY)
    setConnectDrag({ fromId: parentId, cursor: local })

    const onMove = (ev: PointerEvent) => {
      const l = toLocal(ev.clientX, ev.clientY)
      setConnectDrag((d) => (d ? { ...d, cursor: l } : d))
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const drop = toLocal(ev.clientX, ev.clientY)
      // Re-read nodes from store
      const cur = useCanvasStore.getState()
      const currentBoard = cur.boards.find((x) => x.id === cur.activeBoardId)
      const currentBlock = currentBoard?.blocks.find((x) => x.id === block.id) as MindMapBlock | undefined
      const nodes = currentBlock?.nodes ?? block.nodes
      const hit = nodes.find((n) => n.id !== parentId && Math.hypot(n.dx - drop.x, n.dy - drop.y) < 60)

      if (hit) {
        setNodes((ns) => ns.map((n) => (n.id === hit.id ? { ...n, parentId } : n)))
      } else {
        const parent = nodes.find((n) => n.id === parentId)
        const child: MindMapNode = {
          id: uid(),
          parentId,
          label: 'New node',
          dx: drop.x,
          dy: drop.y,
          shape: 'pill',
          color: parent?.color ?? '',
          notes: '',
        }
        setNodes((ns) => [...ns, child])
        // Open modal immediately for the new node so user can write
        setModalId(child.id)
      }
      setConnectDrag(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Portal target for modal — must escape the CSS transform containing block.
  // Standard SSR-safe "set on mount" pattern.
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPortalTarget(document.body)
  }, [])

  // Read the latest node data for the modal
  const modalNode = modalId
    ? (() => {
        const s = useCanvasStore.getState()
        const b = s.boards.find((x) => x.id === s.activeBoardId)
        const bl = b?.blocks.find((x) => x.id === block.id) as MindMapBlock | undefined
        return bl?.nodes.find((n) => n.id === modalId) ?? block.nodes.find((n) => n.id === modalId)
      })()
    : null

  return (
    <>
    <BlockWrapper block={block} kind="mindmap" onContextMenu={onContextMenu}>
      <div
        ref={containerRef}
        className="relative h-full w-full rounded-md border shadow-lg"
        style={{
          overflow: 'visible',
          background: 'var(--bg1)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="absolute left-3 top-2 z-10 font-mono text-[13px] font-medium uppercase tracking-[0.06em] text-[color:var(--cs-accent)]">Mind Map</div>

        {/* Edges (SVG) — neutral tokenized stroke for default nodes so
            edges don't disappear against the neutral node background.
            Custom-colored nodes keep their custom stroke. */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: 'visible' }}>
          {visibleNodes.map((n) => {
            if (!n.parentId) return null
            const p = block.nodes.find((x) => x.id === n.parentId)
            if (!p) return null
            const x1 = p.dx, y1 = p.dy, x2 = n.dx, y2 = n.dy
            const mx = (x1 + x2) / 2
            const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
            const edgeColor = isNeutral(n.color) ? 'rgba(255,255,255,0.12)' : resolveColor(n.color)
            return <path key={n.id} d={d} stroke={edgeColor} strokeWidth={1.5} fill="none" opacity={0.7} />
          })}
          {connectDrag && (() => {
            const from = block.nodes.find((n) => n.id === connectDrag.fromId)
            if (!from) return null
            const x1 = from.dx, y1 = from.dy
            const x2 = connectDrag.cursor.x, y2 = connectDrag.cursor.y
            const mx = (x1 + x2) / 2
            const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
            return <path d={d} stroke="#e85d3a" strokeWidth={2} strokeDasharray="6 4" fill="none" />
          })()}
        </svg>

        {/* Nodes */}
        {visibleNodes.map((n) => {
          const hasChildren = block.nodes.some((x) => x.parentId === n.id)
          const isEditing = editingId === n.id
          const isSelected = modalId === n.id || editingId === n.id
          const bg = resolveColor(n.color)
          const fg = textForBg(bg)
          const neutral = isNeutral(n.color)
          const shapeCls =
            n.shape === 'circle'
              ? 'rounded-full h-24 w-24 flex items-center justify-center text-center'
              : n.shape === 'square'
              ? 'rounded-lg px-8 py-5'
              : 'rounded-full px-9 py-5'
          return (
            <div
              key={n.id}
              onPointerDown={(e) => !isEditing && startNodeInteraction(e, n.id)}
              onDoubleClick={(e) => handleDoubleClick(e, n.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setNodeMenu({
                  id: n.id,
                  x: Math.min(e.clientX, window.innerWidth - 200),
                  y: Math.min(e.clientY, window.innerHeight - 280),
                })
              }}
              className={`group/node absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer text-[15px] font-semibold shadow-lg select-none transition-shadow duration-150 ${shapeCls}`}
              style={{
                left: n.dx,
                top: n.dy,
                background: bg,
                // Selected nodes get the accent ring; unselected get a subtle border.
                border: isSelected ? '2px solid #e85d3a' : `1px solid ${neutral ? CARD_BORDER : 'rgba(0,0,0,0.25)'}`,
                boxShadow: isSelected ? '0 0 0 2px rgba(232,93,58,0.3), 0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.3)',
                color: fg,
                minWidth: 90,
                zIndex: isSelected ? 20 : 10,
              }}
            >
              {isEditing ? (
                <input
                  autoFocus
                  defaultValue={n.label}
                  className="w-full min-w-[80px] rounded-[4px] bg-transparent text-center outline-none focus:outline-none"
                  style={{
                    boxShadow: neutral ? `0 0 0 1px ${CARD_BORDER}` : '0 0 0 1px rgba(0,0,0,0.25)',
                    color: fg,
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.25)'
                  }}
                  onBlur={(e) => {
                    setNodes((ns) => ns.map((x) => (x.id === n.id ? { ...x, label: e.target.value } : x)))
                    setEditingId(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                />
              ) : (
                <span className="whitespace-nowrap">{n.label}</span>
              )}

              {/* Drag-to-connect "+" — border matches canvas bg for a "knock-out" ring */}
              <div
                className="absolute -right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-full border-2 bg-[color:var(--cs-accent)] text-black shadow-lg opacity-0 transition-opacity group-hover/node:opacity-100"
                style={{ borderColor: 'var(--bg0)' }}
                onPointerDown={(e) => startConnectDrag(e, n.id)}
                title="Drag to connect or add child"
              >
                <Plus size={14} />
              </div>

              {/* Collapse/expand */}
              {hasChildren && (
                <button
                  className="absolute -bottom-4 left-1/2 flex h-7 w-7 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border text-[14px] shadow transition-colors duration-100"
                  style={{
                    background: 'var(--bg0)',
                    color: 'var(--text0)',
                    borderColor: 'var(--border2)',
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    setNodes((ns) => ns.map((x) => (x.id === n.id ? { ...x, collapsed: !x.collapsed } : x)))
                  }}
                >
                  {n.collapsed ? '+' : '−'}
                </button>
              )}

              {/* Context menu is portaled — see below BlockWrapper */}
            </div>
          )
        })}
      </div>

    </BlockWrapper>

      {/* Right-click node context menu — portaled to document.body so it
          escapes the node's stacking context (zIndex: 10) and always
          renders above every other node on the canvas. */}
      {portalTarget && nodeMenu &&
        createPortal(
          <div
            data-node-menu
            className="fixed z-[10000] flex flex-col gap-1 rounded-md border p-2 shadow-2xl"
            style={{
              left: nodeMenu.x,
              top: nodeMenu.y,
              background: '#141413',
              borderColor: 'rgba(255,255,255,0.06)',
              color: '#f0ede8',
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="mb-1 text-[14px] font-mono uppercase tracking-[0.06em]" style={{ color: '#888780' }}>Shape</div>
            <div className="flex gap-1">
              {(['circle', 'square', 'pill'] as const).map((s) => (
                <button
                  key={s}
                  className="cursor-pointer rounded px-2 py-1 text-[14px] transition-colors duration-100"
                  style={{ background: '#1a1a18', color: '#f0ede8' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#232320')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#1a1a18')}
                  onClick={() => {
                    setNodes((ns) => ns.map((x) => (x.id === nodeMenu.id ? { ...x, shape: s } : x)))
                    setNodeMenu(null)
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="mb-1 mt-1 text-[14px] font-mono uppercase tracking-[0.06em]" style={{ color: '#888780' }}>Color</div>
            <div className="flex flex-wrap gap-1">
              {/* Reset swatch — returns node to neutral dark default */}
              <button
                className="flex h-5 w-5 cursor-pointer items-center justify-center rounded border text-[10px] transition-transform duration-100 hover:scale-110"
                style={{
                  background: CARD_BG,
                  borderColor: 'rgba(255,255,255,0.10)',
                  color: '#888780',
                }}
                title="Reset to default"
                onClick={() => {
                  setNodes((ns) => ns.map((x) => (x.id === nodeMenu.id ? { ...x, color: '' } : x)))
                  setNodeMenu(null)
                }}
              >
                ↺
              </button>
              {COLORS.map((c) => (
                <button
                  key={c}
                  className="h-5 w-5 cursor-pointer rounded border transition-transform duration-100 hover:scale-110"
                  style={{ background: c, borderColor: 'rgba(255,255,255,0.10)' }}
                  onClick={() => {
                    setNodes((ns) => ns.map((x) => (x.id === nodeMenu.id ? { ...x, color: c } : x)))
                    setNodeMenu(null)
                  }}
                />
              ))}
            </div>
            <button
              className="mt-1 cursor-pointer rounded bg-red-900/80 px-2 py-1 text-[14px] text-red-300 transition-colors duration-100 hover:bg-red-800"
              onClick={() => {
                const toDelete = new Set<string>()
                const recurse = (id: string) => {
                  toDelete.add(id)
                  block.nodes.filter((x) => x.parentId === id).forEach((x) => recurse(x.id))
                }
                recurse(nodeMenu.id)
                setNodes((ns) => ns.filter((x) => !toDelete.has(x.id)))
                setNodeMenu(null)
              }}
            >
              Delete node
            </button>
          </div>,
          portalTarget
        )
      }

      {/* Full-page node editor modal — portaled to body to escape CSS transform */}
      {portalTarget &&
        createPortal(
          <AnimatePresence>
            {modalNode && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setModalId(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setModalId(null)
                }}
                tabIndex={-1}
              >
                <motion.div
                  initial={{ scale: 0.95, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 20 }}
                  className="flex h-[80vh] w-[min(800px,92vw)] flex-col overflow-hidden rounded-lg border"
                  style={{
                    // Literal values — this modal is portaled to document.body,
                    // which is OUTSIDE the .cs-anytype scope. CSS vars like
                    // --cs-accent and --bg0 don't resolve there.
                    background: '#0a0a09',
                    borderColor: 'rgba(232, 93, 58, 0.35)',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(232, 93, 58, 0.10)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header — all literal values since this modal is portaled
                       to document.body, outside .cs-anytype scope */}
                  <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="flex-1">
                      <div className="font-mono text-[13px] font-medium uppercase tracking-[0.06em]" style={{ color: '#e85d3a' }}>Mind Map Node</div>
                      <input
                        autoFocus
                        className="mt-1 w-full bg-transparent text-[24px] font-bold leading-[1.2] outline-none"
                        style={{ color: '#f0ede8' }}
                        defaultValue={modalNode.label}
                        placeholder="Node title…"
                        onBlur={(e) =>
                          setNodes((ns) => ns.map((x) => (x.id === modalNode.id ? { ...x, label: e.target.value } : x)))
                        }
                      />
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          className="h-5 w-5 rounded-full border"
                          style={{ background: c, borderColor: 'rgba(255,255,255,0.10)' }}
                          onClick={() => setNodes((ns) => ns.map((x) => (x.id === modalNode.id ? { ...x, color: c } : x)))}
                        />
                      ))}
                      <button
                        onClick={() => setModalId(null)}
                        className="ml-3 transition-colors duration-150"
                        style={{ color: '#888780' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#f0ede8')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#888780')}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <ModalNotesEditor
                    key={modalNode.id}
                    defaultValue={modalNode.notes ?? ''}
                    onChange={(val) =>
                      setNodes((ns) => ns.map((x) => (x.id === modalNode.id ? { ...x, notes: val } : x)))
                    }
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          portalTarget
        )}
    </>
  )
}
