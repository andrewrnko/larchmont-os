// Standalone Node block — identical to mind map nodes.
//
// Click → open full-page notes modal
// Double-click → edit label inline
// Drag → move (3px threshold)
// "+" → drag to connect / create child
// Collapse "−" → hide downstream nodes
// Right-click → shape / color / delete menu (same as mind map)
// Red border ONLY while modal or editing is active

'use client'

import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useCanvasStore, useActiveBoard, pushHistorySnapshot } from '../store'
import { ModalNotesEditor } from '../ModalNotesEditor'
import type { StandaloneNodeBlock, AnyBlock } from '../types'
import { getCollapsedBlockIds } from '../Connectors'
import { Plus, X } from 'lucide-react'

// ── Color system — copied from MindMapBlock ──
const CARD_BG = '#141413'
const CARD_BORDER = 'rgba(255,255,255,0.06)'
const LIGHT_TEXT = '#f0ede8'
const DARK_TEXT = '#0a0a09'
const COLORS = ['#f97316', '#ef4444', '#3b82f6', '#10b981', '#a855f7', '#f5d97a']
const LEGACY_DEFAULTS = new Set(['', '#e85d3a', '#e85d3b', '#141413', 'var(--cs-accent)', 'var(--accent)', 'var(--bg2)'])

function resolveColor(c: string | undefined | null): string {
  if (!c) return CARD_BG
  if (LEGACY_DEFAULTS.has(c.trim().toLowerCase())) return CARD_BG
  return c
}
function textForBg(hex: string): string {
  if (hex === CARD_BG) return LIGHT_TEXT
  try {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? DARK_TEXT : LIGHT_TEXT
  } catch { return LIGHT_TEXT }
}
function isNeutral(c: string | undefined | null): boolean {
  if (!c) return true
  return LEGACY_DEFAULTS.has(c.trim().toLowerCase())
}

interface Props {
  block: StandaloneNodeBlock
  onContextMenu?: (e: React.MouseEvent) => void
}

export function StandaloneNodeBlockView({ block, onContextMenu }: Props) {
  const updateBlock = useCanvasStore((s) => s.updateBlock)
  const removeBlocks = useCanvasStore((s) => s.removeBlocks)
  const startConnectDrag = useCanvasStore((s) => s.startConnectDrag)
  const selection = useCanvasStore((s) => s.selection)
  const setSelection = useCanvasStore((s) => s.setSelection)
  const bringToFront = useCanvasStore((s) => s.bringToFront)
  const snapToGrid = useCanvasStore((s) => s.snapToGrid)
  const gridSize = useCanvasStore((s) => s.gridSize)
  const lastCreatedBlockId = useCanvasStore((s) => s.lastCreatedBlockId)
  const clearLastCreated = useCanvasStore((s) => s.clearLastCreated)
  const board = useActiveBoard()

  const [editingId, setEditingId] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [nodeMenu, setNodeMenu] = useState<{ x: number; y: number } | null>(null)

  // Only one node modal can be open at a time — close when another opens
  useEffect(() => {
    const handler = (e: Event) => {
      const openId = (e as CustomEvent).detail
      if (openId !== block.id && modalOpen) setModalOpen(false)
    }
    window.addEventListener('close-node-modals', handler)
    return () => window.removeEventListener('close-node-modals', handler)
  }, [block.id, modalOpen])
  const isActive = modalOpen || editingId
  const isInSelection = selection.includes(block.id)
  const bg = resolveColor(block.color)
  const fg = textForBg(bg)
  const neutral = isNeutral(block.color)

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  useEffect(() => { setPortalTarget(document.body) }, [])

  useEffect(() => {
    if (lastCreatedBlockId === block.id) {
      setEditingId(true)
      clearLastCreated()
    }
  }, [lastCreatedBlockId, block.id, clearLastCreated])

  // Close node menu on outside click/escape
  useEffect(() => {
    if (!nodeMenu) return
    const onDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-node-menu]')) return
      setNodeMenu(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNodeMenu(null) }
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 60)
    document.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [nodeMenu])

  // Collapse
  const outgoing = board?.connectors.filter((c) => c.fromBlockId === block.id) ?? []
  const hasChildren = outgoing.length > 0
  let hiddenCount = 0
  if (block.collapsed && board) {
    hiddenCount = getCollapsedBlockIds(board.blocks, board.connectors).size
  }

  // Drag / click
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    if (editingId) return
    if ((e.target as HTMLElement).closest('[data-node-action]')) return
    e.stopPropagation()

    bringToFront(block.id)
    const isIn = selection.includes(block.id)
    if (e.shiftKey) {
      setSelection(isIn ? selection.filter((x) => x !== block.id) : [...selection, block.id])
    } else if (!isIn) {
      setSelection([block.id])
    }
    if (block.locked) return

    const cs = useCanvasStore.getState()
    const bd = cs.boards.find((b) => b.id === cs.activeBoardId)
    if (!bd) return
    const scale = bd.viewport.scale
    const sel = isIn ? cs.selection : [block.id]
    const containedIds = new Set<string>()
    for (const id of sel) {
      const blk = bd.blocks.find((x) => x.id === id)
      if (blk && blk.kind === 'group') {
        for (const other of bd.blocks) {
          if (other.kind === 'standalone-node' && !sel.includes(other.id) &&
              other.x >= blk.x && other.x + other.w <= blk.x + blk.w &&
              other.y >= blk.y && other.y + other.h <= blk.y + blk.h) {
            containedIds.add(other.id)
          }
        }
      }
    }
    const allIds = [...sel, ...containedIds]
    const origins = allIds.map((id) => {
      const b = bd.blocks.find((x) => x.id === id)
      return { id, x: b?.x ?? 0, y: b?.y ?? 0 }
    })
    const startX = e.clientX, startY = e.clientY
    let moved = false
    document.body.style.userSelect = 'none'

    const onMove = (ev: PointerEvent) => {
      const dxp = ev.clientX - startX, dyp = ev.clientY - startY
      if (!moved && Math.hypot(dxp, dyp) > 3) { moved = true; setDragging(true); pushHistorySnapshot() }
      if (moved) {
        for (const orig of origins) {
          let nx = orig.x + dxp / scale, ny = orig.y + dyp / scale
          if (snapToGrid) { nx = Math.round(nx / gridSize) * gridSize; ny = Math.round(ny / gridSize) * gridSize }
          updateBlock(orig.id, { x: nx, y: ny })
        }
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.userSelect = ''
      setDragging(false)
      if (!moved) {
        window.dispatchEvent(new CustomEvent('close-node-modals', { detail: block.id }))
        setModalOpen(true)
      }
      else {
        const ps = useCanvasStore.getState()
        const pb = ps.boards.find((b) => b.id === ps.activeBoardId)
        if (pb) {
          const groups = pb.blocks.filter((b) => b.kind === 'group')
          for (const id of allIds) {
            const blk = pb.blocks.find((b) => b.id === id)
            if (blk && blk.kind === 'standalone-node') {
              const inside = groups.find((g) => blk.x >= g.x && blk.x + blk.w <= g.x + g.w && blk.y >= g.y && blk.y + blk.h <= g.y + g.h)
              updateBlock(blk.id, { groupId: inside?.id ?? undefined } as Partial<AnyBlock>)
            }
          }
        }
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleDoubleClick = (e: React.MouseEvent) => { e.stopPropagation(); setModalOpen(false); setEditingId(true) }
  const handlePlusDrag = (e: React.PointerEvent) => { e.stopPropagation(); e.preventDefault(); startConnectDrag(block.id, block.x + block.w / 2, block.y + block.h / 2) }
  const toggleCollapse = (e: React.MouseEvent) => { e.stopPropagation(); updateBlock(block.id, { collapsed: !block.collapsed } as Partial<AnyBlock>) }

  // Right-click → node menu (same as mind map)
  const handleNodeContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setNodeMenu({
      x: Math.min(e.clientX, window.innerWidth - 200),
      y: Math.min(e.clientY, window.innerHeight - 280),
    })
  }

  const nodeZ = Math.max(block.z, 50)

  // Shape class — same as mind map
  const shapeCls = block.shape === 'circle'
    ? 'rounded-full h-24 w-24 flex items-center justify-center text-center'
    : block.shape === 'square'
    ? 'rounded-lg px-8 py-5'
    : 'rounded-full px-9 py-5'

  return (
    <>
      <div
        data-block={block.id}
        className="absolute group/node select-none"
        style={{
          left: block.x, top: block.y, zIndex: nodeZ,
          cursor: block.locked ? 'not-allowed' : dragging ? 'grabbing' : editingId ? 'text' : 'pointer',
        }}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleNodeContextMenu}
      >
        <div
          className={`flex items-center justify-center text-[15px] font-semibold shadow-lg select-none transition-shadow duration-150 ${shapeCls}`}
          style={{
            background: bg,
            border: isActive ? '2px solid #e85d3a' : `1px solid ${neutral ? CARD_BORDER : 'rgba(0,0,0,0.25)'}`,
            boxShadow: isActive
              ? '0 0 0 2px rgba(232,93,58,0.3), 0 4px 12px rgba(0,0,0,0.3)'
              : isInSelection
                ? '0 0 0 2px rgba(232,93,58,0.5), 0 4px 12px rgba(0,0,0,0.3)'
                : '0 4px 12px rgba(0,0,0,0.3)',
            color: fg, minWidth: 90, maxWidth: 400,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {editingId ? (
            <input
              autoFocus defaultValue={block.label}
              className="w-full min-w-[80px] rounded-[4px] bg-transparent text-center outline-none focus:outline-none"
              style={{ boxShadow: `0 0 0 1px ${CARD_BORDER}`, color: fg }}
              onPointerDown={(e) => e.stopPropagation()}
              onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.25)' }}
              onBlur={(e) => { updateBlock(block.id, { label: e.target.value || 'New node' }); setEditingId(false) }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingId(false) }}
            />
          ) : (
            <span className="whitespace-nowrap">{block.label}</span>
          )}
          {block.collapsed && hiddenCount > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-medium"
              style={{ background: 'rgba(255,255,255,0.10)', color: '#888780' }}>{hiddenCount}</span>
          )}
        </div>

        {/* "+" drag-to-connect */}
        <div data-node-action
          className="absolute -right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-full border-2 bg-[color:var(--cs-accent)] text-black shadow-lg opacity-0 transition-opacity group-hover/node:opacity-100"
          style={{ borderColor: 'var(--bg0)' }} onPointerDown={handlePlusDrag} title="Drag to connect or add child">
          <Plus size={14} />
        </div>

        {/* Collapse/expand */}
        {hasChildren && (
          <button data-node-action
            className="absolute -bottom-4 left-1/2 flex h-7 w-7 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border text-[14px] shadow transition-colors duration-100"
            style={{ background: 'var(--bg0)', color: 'var(--text0)', borderColor: 'var(--border2)' }}
            onPointerDown={(e) => e.stopPropagation()} onClick={toggleCollapse}>
            {block.collapsed ? '+' : '−'}
          </button>
        )}
      </div>

      {/* Right-click context menu — portaled, same as mind map */}
      {portalTarget && nodeMenu && createPortal(
        <div data-node-menu
          className="fixed z-[10000] flex flex-col gap-1 rounded-md border p-2 shadow-2xl"
          style={{ left: nodeMenu.x, top: nodeMenu.y, background: '#141413', borderColor: 'rgba(255,255,255,0.06)', color: '#f0ede8' }}
          onPointerDown={(e) => e.stopPropagation()}>
          <div className="mb-1 text-[14px] font-mono uppercase tracking-[0.06em]" style={{ color: '#888780' }}>Shape</div>
          <div className="flex gap-1">
            {(['circle', 'square', 'pill'] as const).map((s) => (
              <button key={s} className="cursor-pointer rounded px-2 py-1 text-[14px] transition-colors duration-100"
                style={{ background: '#1a1a18', color: '#f0ede8' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#232320')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#1a1a18')}
                onClick={() => { updateBlock(block.id, { shape: s } as Partial<AnyBlock>); setNodeMenu(null) }}>{s}</button>
            ))}
          </div>
          <div className="mb-1 mt-1 text-[14px] font-mono uppercase tracking-[0.06em]" style={{ color: '#888780' }}>Color</div>
          <div className="flex flex-wrap gap-1">
            <button className="flex h-5 w-5 cursor-pointer items-center justify-center rounded border text-[10px] transition-transform duration-100 hover:scale-110"
              style={{ background: CARD_BG, borderColor: 'rgba(255,255,255,0.10)', color: '#888780' }} title="Reset to default"
              onClick={() => { updateBlock(block.id, { color: '' } as Partial<AnyBlock>); setNodeMenu(null) }}>↺</button>
            {COLORS.map((c) => (
              <button key={c} className="h-5 w-5 cursor-pointer rounded border transition-transform duration-100 hover:scale-110"
                style={{ background: c, borderColor: 'rgba(255,255,255,0.10)' }}
                onClick={() => { updateBlock(block.id, { color: c } as Partial<AnyBlock>); setNodeMenu(null) }} />
            ))}
          </div>
          <button className="mt-1 cursor-pointer rounded bg-red-900/80 px-2 py-1 text-[14px] text-red-300 transition-colors duration-100 hover:bg-red-800"
            onClick={() => {
              const ids = isInSelection && selection.length > 1 ? selection : [block.id]
              removeBlocks(ids); setNodeMenu(null)
            }}>{isInSelection && selection.length > 1 ? `Delete ${selection.length} selected` : 'Delete node'}</button>
        </div>,
        portalTarget
      )}

      {/* Full-page editor modal */}
      {portalTarget && createPortal(
        <AnimatePresence>
          {modalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
              onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}
              onKeyDown={(e) => { if (e.key === 'Escape') setModalOpen(false) }} tabIndex={-1}>
              <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                className="flex h-[80vh] w-[min(800px,92vw)] flex-col overflow-hidden rounded-lg border"
                style={{ background: '#0a0a09', borderColor: 'rgba(232, 93, 58, 0.35)', boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(232, 93, 58, 0.10)' }}
                onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="flex-1">
                    <div className="font-mono text-[13px] font-medium uppercase tracking-[0.06em]" style={{ color: '#e85d3a' }}>Node</div>
                    <input autoFocus className="mt-1 w-full bg-transparent text-[24px] font-bold leading-[1.2] outline-none"
                      style={{ color: '#f0ede8' }} defaultValue={block.label} placeholder="Node title..."
                      onBlur={(e) => updateBlock(block.id, { label: e.target.value || 'New node' })} />
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    {COLORS.map((c) => (
                      <button key={c} className="h-5 w-5 rounded-full border"
                        style={{ background: c, borderColor: 'rgba(255,255,255,0.10)' }}
                        onClick={() => updateBlock(block.id, { color: c } as Partial<AnyBlock>)} />
                    ))}
                    <button onClick={() => setModalOpen(false)} className="ml-3 transition-colors duration-150"
                      style={{ color: '#888780' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#f0ede8')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#888780')}><X size={18} /></button>
                  </div>
                </div>
                <ModalNotesEditor
                  key={block.id}
                  defaultValue={block.notes ?? ''}
                  onChange={(val) => updateBlock(block.id, { notes: val } as Partial<AnyBlock>)}
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
