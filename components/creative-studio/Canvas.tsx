// Infinite canvas: dot-grid background, blocks in world space, connector drag handling.

'use client'

import { useEffect, useRef, useState } from 'react'
import { useCanvasStore, useActiveBoard, uid } from './store'
import { useCanvasViewport, useLassoSelect, useUndoRedo } from './hooks'
import type { AnyBlock, BlockKind } from './types'
import { TextNoteBlock } from './blocks/TextNoteBlock'
import { StickyNoteBlock } from './blocks/StickyNoteBlock'
import { ImageBlockView } from './blocks/ImageBlockView'
import { StoryboardFrameBlock } from './blocks/StoryboardFrameBlock'
import { MindMapBlockView } from './blocks/MindMapBlock'
import { PageBlockCard } from './blocks/PageBlockCard'
import { PlaceholderBlock } from './blocks/PlaceholderBlock'
import { ConnectorLines } from './Connectors'
import { ContextMenu, type ContextMenuState } from './ContextMenu'
import type { ToolId } from './Toolbar'
import { Grid3x3, Minus, Plus as PlusIcon } from 'lucide-react'

interface Props {
  tool: ToolId
  setTool: (t: ToolId) => void
}

// Convert client coords to world coords using canvas container rect + viewport.
function screenToWorld(
  clientX: number,
  clientY: number,
  canvasEl: HTMLElement | null,
  vx: number,
  vy: number,
  scale: number
) {
  const rect = canvasEl?.getBoundingClientRect()
  return {
    x: (clientX - (rect?.left ?? 0) - vx) / scale,
    y: (clientY - (rect?.top ?? 0) - vy) / scale,
  }
}

// 30px-padded hit test
function blockAtWorldPoint(blocks: AnyBlock[], wx: number, wy: number, excludeId?: string): AnyBlock | null {
  const PAD = 30
  let hit: AnyBlock | null = null
  for (const b of blocks) {
    if (b.id === excludeId) continue
    if (wx >= b.x - PAD && wx <= b.x + b.w + PAD && wy >= b.y - PAD && wy <= b.y + b.h + PAD) {
      if (!hit || b.z > hit.z) hit = b
    }
  }
  return hit
}

export function Canvas({ tool, setTool }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const board = useActiveBoard()
  const { viewport, zoomToFit, setViewport } = useCanvasViewport(containerRef)
  const showGrid = useCanvasStore((s) => s.showGrid)
  const setShowGrid = useCanvasStore((s) => s.setShowGrid)
  const snapToGrid = useCanvasStore((s) => s.snapToGrid)
  const setSnapToGrid = useCanvasStore((s) => s.setSnapToGrid)
  const addBlockAt = useCanvasStore((s) => s.addBlockAt)
  const removeBlocks = useCanvasStore((s) => s.removeBlocks)
  const selection = useCanvasStore((s) => s.selection)
  const addConnector = useCanvasStore((s) => s.addConnector)
  const connectDrag = useCanvasStore((s) => s.connectDrag)
  const updateConnectCursor = useCanvasStore((s) => s.updateConnectCursor)
  const endConnectDrag = useCanvasStore((s) => s.endConnectDrag)

  const lasso = useLassoSelect(containerRef)
  useUndoRedo()

  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)

  // ── Connector drag: pointermove + pointerup ──
  useEffect(() => {
    if (!connectDrag) return

    const onMove = (e: PointerEvent) => {
      const s = useCanvasStore.getState()
      const b = s.boards.find((x) => x.id === s.activeBoardId)
      if (!b) return
      const w = screenToWorld(e.clientX, e.clientY, containerRef.current, b.viewport.x, b.viewport.y, b.viewport.scale)
      updateConnectCursor(w.x, w.y)
    }

    const onUp = (e: PointerEvent) => {
      const d = endConnectDrag()
      if (!d) return
      const s = useCanvasStore.getState()
      const b = s.boards.find((x) => x.id === s.activeBoardId)
      if (!b) return
      const w = screenToWorld(e.clientX, e.clientY, containerRef.current, b.viewport.x, b.viewport.y, b.viewport.scale)
      const hit = blockAtWorldPoint(b.blocks, w.x, w.y, d.fromId)
      if (hit) {
        addConnector({
          id: uid(),
          fromBlockId: d.fromId,
          toBlockId: hit.id,
          style: 'curved',
          arrow: 'one',
          color: '#e8a045',
          weight: 2,
        })
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!connectDrag])

  // Delete selected blocks
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.length) {
        e.preventDefault()
        removeBlocks(selection)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selection, removeBlocks])

  // Paste image from clipboard
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'))
      if (!item) return
      const file = item.getAsFile()
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const cs = useCanvasStore.getState()
        const b = cs.boards.find((x) => x.id === cs.activeBoardId)
        if (!b) return
        const wx = (-b.viewport.x + window.innerWidth / 2) / b.viewport.scale
        const wy = (-b.viewport.y + window.innerHeight / 2) / b.viewport.scale
        const id = addBlockAt('image', wx, wy)
        if (id) {
          const img = new Image()
          img.onload = () => {
            useCanvasStore
              .getState()
              .updateBlock(id, { src: reader.result as string, naturalRatio: img.width / img.height })
          }
          img.src = reader.result as string
        }
      }
      reader.readAsDataURL(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [addBlockAt])

  // Click to place block
  const handleCanvasClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-block]')) return
    if (tool === 'select' || tool === 'pan' || tool === 'connector') return
    const placementKinds: BlockKind[] = ['text', 'sticky', 'image', 'storyboard', 'mindmap', 'page']
    if (!placementKinds.includes(tool as BlockKind)) return
    const rect = containerRef.current!.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const wx = (sx - viewport.x) / viewport.scale
    const wy = (sy - viewport.y) / viewport.scale
    addBlockAt(tool as BlockKind, wx, wy)
    setTool('select')
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const rect = containerRef.current!.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const wx = (sx - viewport.x) / viewport.scale
    const wy = (sy - viewport.y) / viewport.scale
    const blockEl = (e.target as HTMLElement).closest('[data-block]') as HTMLElement | null
    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      worldX: wx,
      worldY: wy,
      blockId: blockEl?.getAttribute('data-block') ?? null,
    })
  }

  if (!board) return null

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a0a0a]">
      <div
        ref={containerRef}
        className="absolute inset-0"
        onClick={handleCanvasClick}
        onContextMenu={handleContextMenu}
        style={{
          cursor: connectDrag ? 'crosshair' : tool === 'pan' ? 'grab' : tool === 'connector' ? 'crosshair' : 'default',
          backgroundImage: showGrid
            ? 'radial-gradient(circle, #222 1px, transparent 1px)'
            : undefined,
          backgroundSize: showGrid ? `${24 * viewport.scale}px ${24 * viewport.scale}px` : undefined,
          backgroundPosition: showGrid ? `${viewport.x}px ${viewport.y}px` : undefined,
        }}
      >
        {/* World container */}
        <div
          className="absolute left-0 top-0"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
            transformOrigin: '0 0',
          }}
        >
          {board.blocks.map((block) => renderBlock(block, handleContextMenu))}
          <ConnectorLines blocks={board.blocks} connectors={board.connectors} />

          {/* Connector drag preview line (in world space) */}
          {connectDrag && (
            <svg
              className="pointer-events-none absolute left-0 top-0"
              style={{ width: 100000, height: 100000, overflow: 'visible' }}
            >
              <path
                d={`M ${connectDrag.startX} ${connectDrag.startY} C ${(connectDrag.startX + connectDrag.cursorX) / 2} ${connectDrag.startY}, ${(connectDrag.startX + connectDrag.cursorX) / 2} ${connectDrag.cursorY}, ${connectDrag.cursorX} ${connectDrag.cursorY}`}
                stroke="#e8a045"
                strokeWidth={2.5}
                strokeDasharray="8 5"
                fill="none"
              />
              {/* Cursor dot */}
              <circle cx={connectDrag.cursorX} cy={connectDrag.cursorY} r={6} fill="#e8a045" opacity={0.8} />
            </svg>
          )}
        </div>

        {/* Lasso overlay (screen space) */}
        {lasso && (
          <div
            className="pointer-events-none absolute border border-amber-500/70 bg-amber-500/10"
            style={{ left: lasso.x, top: lasso.y, width: lasso.w, height: lasso.h }}
          />
        )}
      </div>

      {/* Zoom + grid controls */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 rounded-md border border-[#2a2a2a] bg-[#141414]/95 px-2 py-1 text-[11px] text-neutral-400 backdrop-blur">
        <button
          className={`rounded px-1 ${showGrid ? 'text-amber-400' : ''}`}
          onClick={() => setShowGrid(!showGrid)}
          title="Toggle grid"
        >
          <Grid3x3 size={12} />
        </button>
        <button
          className={`rounded px-1 text-[10px] ${snapToGrid ? 'text-amber-400' : ''}`}
          onClick={() => setSnapToGrid(!snapToGrid)}
          title="Snap to grid"
        >
          SNAP
        </button>
        <div className="h-3 w-px bg-[#2a2a2a]" />
        <button onClick={() => setViewport({ ...viewport, scale: Math.max(0.1, viewport.scale - 0.1) })}>
          <Minus size={12} />
        </button>
        <span className="font-mono tabular-nums">{Math.round(viewport.scale * 100)}%</span>
        <button onClick={() => setViewport({ ...viewport, scale: Math.min(4, viewport.scale + 0.1) })}>
          <PlusIcon size={12} />
        </button>
        <button className="text-[10px] hover:text-white" onClick={zoomToFit}>FIT</button>
      </div>

      <ContextMenu state={ctxMenu} onClose={() => setCtxMenu(null)} onZoomToFit={zoomToFit} />
    </div>
  )
}

function renderBlock(block: AnyBlock, onContextMenu: (e: React.MouseEvent) => void) {
  switch (block.kind) {
    case 'text':      return <TextNoteBlock      key={block.id} block={block} onContextMenu={onContextMenu} />
    case 'sticky':    return <StickyNoteBlock    key={block.id} block={block} onContextMenu={onContextMenu} />
    case 'image':     return <ImageBlockView     key={block.id} block={block} onContextMenu={onContextMenu} />
    case 'storyboard':return <StoryboardFrameBlock key={block.id} block={block} onContextMenu={onContextMenu} />
    case 'mindmap':   return <MindMapBlockView   key={block.id} block={block} onContextMenu={onContextMenu} />
    case 'page':      return <PageBlockCard      key={block.id} block={block} onContextMenu={onContextMenu} />
    case 'timeline':  return <PlaceholderBlock   key={block.id} block={block} label="Timeline" onContextMenu={onContextMenu} />
    case 'embed':     return <PlaceholderBlock   key={block.id} block={block} label="Embed" onContextMenu={onContextMenu} />
    case 'section':   return <PlaceholderBlock   key={block.id} block={block} label="Section" onContextMenu={onContextMenu} />
  }
}
