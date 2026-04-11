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
import { useSlashMenu } from '../SlashMenu'
import type { MindMapBlock, MindMapNode } from '../types'
import { BlockWrapper } from '../BlockWrapper'
import { Plus, X } from 'lucide-react'

const COLORS = ['#e8a045', '#ef4444', '#3b82f6', '#10b981', '#a855f7', '#f5d97a']

interface Props {
  block: MindMapBlock
  onContextMenu?: (e: React.MouseEvent) => void
}

export function MindMapBlockView({ block, onContextMenu }: Props) {
  const updateBlock = useCanvasStore((s) => s.updateBlock)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [modalId, setModalId] = useState<string | null>(null)
  const [connectDrag, setConnectDrag] = useState<{
    fromId: string
    cursor: { x: number; y: number }
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const modalTextareaRef = useRef<HTMLTextAreaElement>(null)
  const { handleKeyDown: slashKeyDown, menu: slashMenu } = useSlashMenu(
    modalTextareaRef,
    (val) => { if (modalId) setNodes((ns) => ns.map((x) => (x.id === modalId ? { ...x, notes: val } : x))) }
  )

  const setNodes = (fn: (n: MindMapNode[]) => MindMapNode[]) => {
    updateBlock(block.id, { nodes: fn(block.nodes) })
  }

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
  const startNodeInteraction = (e: React.PointerEvent, nodeId: string) => {
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
          color: parent?.color ?? '#e8a045',
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

  // Portal target for modal — must escape the CSS transform containing block
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
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
        className="relative h-full w-full rounded-md border border-[#2a2a2a] bg-[#101010] shadow-lg"
        style={{ overflow: 'visible' }}
      >
        <div className="absolute left-3 top-2 z-10 font-mono text-[13px] font-medium uppercase tracking-[0.06em] text-amber-500">Mind Map</div>

        {/* Edges (SVG) */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: 'visible' }}>
          {visibleNodes.map((n) => {
            if (!n.parentId) return null
            const p = block.nodes.find((x) => x.id === n.parentId)
            if (!p) return null
            const x1 = p.dx, y1 = p.dy, x2 = n.dx, y2 = n.dy
            const mx = (x1 + x2) / 2
            const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
            return <path key={n.id} d={d} stroke={n.color} strokeWidth={2} fill="none" />
          })}
          {connectDrag && (() => {
            const from = block.nodes.find((n) => n.id === connectDrag.fromId)
            if (!from) return null
            const x1 = from.dx, y1 = from.dy
            const x2 = connectDrag.cursor.x, y2 = connectDrag.cursor.y
            const mx = (x1 + x2) / 2
            const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
            return <path d={d} stroke="#e8a045" strokeWidth={2} strokeDasharray="6 4" fill="none" />
          })()}
        </svg>

        {/* Nodes */}
        {visibleNodes.map((n) => {
          const hasChildren = block.nodes.some((x) => x.parentId === n.id)
          const isEditing = editingId === n.id
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
                setMenuId(n.id)
              }}
              className={`group/node absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer border-2 text-[15px] font-semibold text-black shadow-lg select-none ${shapeCls}`}
              style={{
                left: n.dx,
                top: n.dy,
                background: n.color,
                borderColor: 'rgba(0,0,0,0.35)',
                minWidth: 90,
                zIndex: 10,
              }}
            >
              {isEditing ? (
                <input
                  autoFocus
                  defaultValue={n.label}
                  className="w-full min-w-[80px] bg-transparent text-center outline-none"
                  onPointerDown={(e) => e.stopPropagation()}
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

              {/* Drag-to-connect "+" — always visible, larger */}
              <div
                className="absolute -right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-full border-2 border-white bg-amber-500 text-black shadow-lg opacity-0 transition-opacity group-hover/node:opacity-100"
                onPointerDown={(e) => startConnectDrag(e, n.id)}
                title="Drag to connect or add child"
              >
                <Plus size={14} />
              </div>

              {/* Collapse/expand */}
              {hasChildren && (
                <button
                  className="absolute -bottom-4 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full bg-black/80 text-[14px] text-white shadow border border-neutral-600"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    setNodes((ns) => ns.map((x) => (x.id === n.id ? { ...x, collapsed: !x.collapsed } : x)))
                  }}
                >
                  {n.collapsed ? '+' : '−'}
                </button>
              )}

              {/* Right-click context menu */}
              {menuId === n.id && (
                <div
                  className="absolute left-full top-0 z-30 ml-2 flex flex-col gap-1 rounded-md bg-[#141414] p-2 text-white shadow-2xl border border-[#2a2a2a]"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className="mb-1 text-[14px] font-mono uppercase tracking-[0.06em] text-neutral-500">Shape</div>
                  <div className="flex gap-1">
                    {(['circle', 'square', 'pill'] as const).map((s) => (
                      <button
                        key={s}
                        className="rounded bg-[#1a1a1a] px-2 py-1 text-[14px] hover:bg-[#222]"
                        onClick={() => {
                          setNodes((ns) => ns.map((x) => (x.id === n.id ? { ...x, shape: s } : x)))
                          setMenuId(null)
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 mb-1 text-[14px] font-mono uppercase tracking-[0.06em] text-neutral-500">Color</div>
                  <div className="flex gap-1">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        className="h-5 w-5 rounded border border-white/20"
                        style={{ background: c }}
                        onClick={() => {
                          setNodes((ns) => ns.map((x) => (x.id === n.id ? { ...x, color: c } : x)))
                          setMenuId(null)
                        }}
                      />
                    ))}
                  </div>
                  <button
                    className="mt-1 rounded bg-red-900/80 px-2 py-1 text-[14px] text-red-300 hover:bg-red-800"
                    onClick={() => {
                      // Recursively delete node and all descendants
                      const toDelete = new Set<string>()
                      const recurse = (id: string) => {
                        toDelete.add(id)
                        block.nodes.filter((x) => x.parentId === id).forEach((x) => recurse(x.id))
                      }
                      recurse(n.id)
                      setNodes((ns) => ns.filter((x) => !toDelete.has(x.id)))
                      setMenuId(null)
                    }}
                  >
                    Delete node
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

    </BlockWrapper>

      {/* Full-page node editor modal — portaled to body to escape CSS transform */}
      {portalTarget &&
        createPortal(
          <AnimatePresence>
            {modalNode && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setModalId(null)
                }}
              >
                <motion.div
                  initial={{ scale: 0.95, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 20 }}
                  className="flex h-[80vh] w-[min(800px,92vw)] flex-col overflow-hidden rounded-lg border border-amber-700/60 bg-[#0a0a0a] shadow-[0_0_80px_rgba(245,158,11,0.2)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-[#2a2a2a] px-6 py-4">
                    <div className="flex-1">
                      <div className="font-mono text-[13px] font-medium uppercase tracking-[0.06em] text-amber-500">Mind Map Node</div>
                      <input
                        autoFocus
                        className="mt-1 w-full bg-transparent text-[24px] font-bold leading-[1.2] text-white outline-none"
                        defaultValue={modalNode.label}
                        placeholder="Node title…"
                        onBlur={(e) =>
                          setNodes((ns) => ns.map((x) => (x.id === modalNode.id ? { ...x, label: e.target.value } : x)))
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          className="h-5 w-5 rounded-full border border-white/10"
                          style={{ background: c }}
                          onClick={() => setNodes((ns) => ns.map((x) => (x.id === modalNode.id ? { ...x, color: c } : x)))}
                        />
                      ))}
                      <button onClick={() => setModalId(null)} className="ml-3 text-neutral-500 hover:text-white">
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <textarea
                    ref={modalTextareaRef}
                    key={modalNode.id}
                    defaultValue={modalNode.notes ?? ''}
                    placeholder="Type / for commands… Write ideas, sub-notes, action items…"
                    className="flex-1 resize-none bg-transparent p-6 text-[15px] leading-[1.5] text-white outline-none placeholder:text-neutral-600"
                    onBlur={(e) =>
                      setNodes((ns) => ns.map((x) => (x.id === modalNode.id ? { ...x, notes: e.target.value } : x)))
                    }
                    onKeyDown={slashKeyDown}
                  />
                  {slashMenu}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          portalTarget
        )}
    </>
  )
}
