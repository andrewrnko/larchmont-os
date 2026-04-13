// Infinite canvas: dot-grid background, blocks in world space, connector drag handling.

'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
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
import { TranscriptBlockView } from './blocks/TranscriptBlock'
import { AssistantBlockView } from './blocks/AssistantBlock'
import { EmbedBlockView } from './blocks/EmbedBlock'
import { TasksBlockView } from './blocks/TasksBlock'
import { StandaloneNodeBlockView } from './blocks/StandaloneNodeBlock'
import { GroupBlockView } from './blocks/GroupBlock'
import { ConnectorLines, getCollapsedBlockIds } from './Connectors'
import { ContextMenu, type ContextMenuState } from './ContextMenu'
import { ConnectorDropMenu, type DropMenuState } from './ConnectorDropMenu'
import { CommentPinMarker, PinContextMenu, type PinViewport } from './CommentPin'
import { useCommentsStore } from './comments-store'
import type { Pin } from './comments-store'
import type { ToolId } from './Toolbar'
import { Grid3x3, Minus, Plus as PlusIcon, Eye, EyeOff } from 'lucide-react'
import { TimerWidget } from './Timer'

// Compact, AI-ready summary of a block for context injection.
function summarizeBlock(block: AnyBlock | undefined): string {
  if (!block) return ''
  const stripHtml = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  switch (block.kind) {
    case 'text':
      return `[Text note] ${stripHtml(block.html).slice(0, 400)}`
    case 'sticky':
      return `[Sticky · ${block.color}] ${block.text.slice(0, 300)}`
    case 'page': {
      const body = block.content
        .map((c) => ('text' in c ? c.text : ''))
        .filter(Boolean)
        .slice(0, 12)
        .join(' • ')
      return `[Page · ${block.title || 'Untitled'}] ${body.slice(0, 500)}`
    }
    case 'tasks': {
      const items = block.taskItems
        .slice(0, 10)
        .map((t) => `${t.done ? '✓' : '○'} ${t.title}`)
        .join(' · ')
      return `[Tasks · ${block.label}] ${items}`
    }
    case 'transcript':
      return `[Transcript · ${block.title || 'Untitled'}] ${block.transcript.slice(0, 500)}`
    case 'storyboard': {
      const frames = block.frames
        .slice(0, 6)
        .map((f) => `Frame ${f.order}: ${f.notes || f.label}`)
        .join(' · ')
      return `[Storyboard] ${frames}`
    }
    case 'mindmap': {
      const root = block.nodes.find((n) => n.parentId === null)?.label ?? 'Untitled'
      const branches = block.nodes
        .filter((n) => n.parentId !== null)
        .slice(0, 8)
        .map((n) => n.label)
        .join(', ')
      return `[Mind map · ${root}] branches: ${branches}`
    }
    case 'image':
      return `[Image${block.caption ? ` · ${block.caption}` : ''}]`
    case 'embed':
      return `[Embed${block.url ? ` · ${block.url}` : ''}${block.title ? ` · ${block.title}` : ''}]`
    case 'assistant': {
      const recent = block.messages
        .slice(-3)
        .map((m) => `${m.role}: ${m.content.slice(0, 120)}`)
        .join(' | ')
      return `[AI chat] ${recent}`
    }
    case 'standalone-node':
      return `[Node] ${block.label}`
    case 'group':
      return `[Group] ${block.label}`
    default:
      return `[${block.kind}]`
  }
}

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

// Padded hit test for connector drop targets.
// When the source is a standalone-node, SKIP group blocks — nodes should
// connect to other nodes or non-group blocks, never to the group container.
// Standalone nodes get a larger center-based snap area (40px radius).
function blockAtWorldPoint(
  blocks: AnyBlock[],
  wx: number,
  wy: number,
  excludeId?: string,
  sourceKind?: string
): AnyBlock | null {
  const PAD = 30
  const NODE_SNAP = 40
  let hit: AnyBlock | null = null
  for (const b of blocks) {
    if (b.id === excludeId) continue
    // When dragging from a standalone-node, skip group blocks as targets
    if (sourceKind === 'standalone-node' && b.kind === 'group') continue
    // Standalone nodes: check distance from center (40px radius)
    if (b.kind === 'standalone-node') {
      const cx = b.x + b.w / 2
      const cy = b.y + b.h / 2
      if (Math.hypot(wx - cx, wy - cy) <= NODE_SNAP + Math.max(b.w, b.h) / 2) {
        if (!hit || b.z > hit.z) hit = b
      }
    } else if (wx >= b.x - PAD && wx <= b.x + b.w + PAD && wy >= b.y - PAD && wy <= b.y + b.h + PAD) {
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

  // Comment pins
  const commentPins = useCommentsStore((s) => s.pins)
  const addPin = useCommentsStore((s) => s.addPin)
  const commentsHydrated = useCommentsStore((s) => s.hydrated)
  const hydrateComments = useCommentsStore((s) => s.hydrate)
  const showResolved = useCommentsStore((s) => s.showResolved)
  const setShowResolved = useCommentsStore((s) => s.setShowResolved)
  const setActivePin = useCommentsStore((s) => s.setActivePin)
  const activePinId = useCommentsStore((s) => s.activePinId)

  // Hydrate comments store on mount
  useEffect(() => {
    if (!commentsHydrated) hydrateComments()
  }, [commentsHydrated, hydrateComments])

  const lasso = useLassoSelect(containerRef)
  useUndoRedo()

  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)
  const [dropMenu, setDropMenu] = useState<DropMenuState | null>(null)
  const [pinCtxMenu, setPinCtxMenu] = useState<{ pin: Pin; x: number; y: number } | null>(null)

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
      const sourceBlock = b.blocks.find((x) => x.id === d.fromId)
      const hit = blockAtWorldPoint(b.blocks, w.x, w.y, d.fromId, sourceBlock?.kind)
      if (hit) {
        // Any connector involving a standalone-node uses neutral gray style
        const involvesNode = sourceBlock?.kind === 'standalone-node' || hit.kind === 'standalone-node'
        addConnector({
          id: uid(),
          fromBlockId: d.fromId,
          toBlockId: hit.id,
          style: 'curved',
          arrow: involvesNode ? 'none' : 'one',
          color: involvesNode ? 'rgba(255,255,255,0.12)' : 'var(--cs-accent)',
          weight: involvesNode ? 1.5 : 2,
        })
      } else if (sourceBlock?.kind === 'standalone-node') {
        // Standalone node "+" dropped on empty canvas → auto-create child node
        // Center the new node at cursor (subtract half default w/h: 160/2=80, 64/2=32)
        const childId = addBlockAt('standalone-node', w.x - 80, w.y - 32)
        if (childId) {
          addConnector({
            id: uid(),
            fromBlockId: d.fromId,
            toBlockId: childId,
            style: 'curved',
            arrow: 'none',
            color: 'rgba(255,255,255,0.12)',
            weight: 1.5,
          })
        }
      } else {
        // Non-node block dropped on empty canvas → show the dropdown
        setDropMenu({
          clientX: e.clientX,
          clientY: e.clientY,
          worldX: w.x,
          worldY: w.y,
          fromBlockId: d.fromId,
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

  // Paste from clipboard — handles images, URLs, and plain text
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return

      const cs = useCanvasStore.getState()
      const b = cs.boards.find((x) => x.id === cs.activeBoardId)
      if (!b) return
      const wx = (-b.viewport.x + window.innerWidth / 2) / b.viewport.scale
      const wy = (-b.viewport.y + window.innerHeight / 2) / b.viewport.scale

      // 1. Image file
      const imageItem = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'))
      if (imageItem) {
        e.preventDefault()
        const file = imageItem.getAsFile()
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
          const id = addBlockAt('image', wx, wy)
          if (id) {
            const img = new Image()
            img.onload = () => {
              useCanvasStore.getState().updateBlock(id, { src: reader.result as string, naturalRatio: img.width / img.height })
            }
            img.src = reader.result as string
          }
        }
        reader.readAsDataURL(file)
        return
      }

      // 2. Text content
      const text = e.clipboardData?.getData('text/plain')?.trim()
      if (!text) return
      e.preventDefault()

      // Check if it's a URL
      const urlRegex = /^https?:\/\/\S+$/i
      if (urlRegex.test(text)) {
        // Create an embed block with the URL
        const id = addBlockAt('embed', wx, wy)
        if (id) {
          useCanvasStore.getState().updateBlock(id, { url: text })
        }
        return
      }

      // Otherwise create a sticky note with the pasted text
      const id = addBlockAt('sticky', wx, wy)
      if (id) {
        useCanvasStore.getState().updateBlock(id, { text })
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [addBlockAt])

  // Click to place block or comment pin
  const handleCanvasClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-block], [data-comment-pin]')) return

    // Close active pin if clicking empty canvas (unless dropping a new pin)
    if (tool !== 'comment' && activePinId) {
      // Check if click is on a pin element — don't close if so
      if (!(e.target as HTMLElement).closest('[data-comment-pin]')) {
        setActivePin(null)
      }
    }

    if (tool === 'select' || tool === 'pan' || tool === 'connector') return

    const rect = containerRef.current!.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const wx = (sx - viewport.x) / viewport.scale
    const wy = (sy - viewport.y) / viewport.scale

    // Comment tool — drop a pin then switch back to select (single-shot)
    if (tool === 'comment') {
      if (board) {
        addPin(board.id, wx, wy)
        setTool('select')
      }
      return
    }

    const placementKinds: BlockKind[] = ['text', 'sticky', 'image', 'storyboard', 'mindmap', 'page', 'transcript', 'assistant', 'tasks', 'standalone-node', 'group']
    if (!placementKinds.includes(tool as BlockKind)) return
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

  // ── Drop-menu handlers ──
  // Creates a block of the picked kind at the drop point and connects it.
  const handleCreateBlockFromDrop = (kind: BlockKind, wx: number, wy: number, fromBlockId: string) => {
    const id = addBlockAt(kind, wx, wy)
    if (!id) return
    addConnector({
      id: uid(),
      fromBlockId,
      toBlockId: id,
      style: 'curved',
      arrow: 'one',
      color: 'var(--cs-accent)',
      weight: 2,
    })
    // Select the new block so the user can immediately edit it
    useCanvasStore.setState({ selection: [id] })
  }

  // Calls the server AI endpoint to populate a page block at the drop point,
  // then connects it to the source block. Context injected: the source
  // block's summary + up to 8 other blocks on the board for reference.
  const handleCreatePageFromAI = async (
    prompt: string,
    wx: number,
    wy: number,
    fromBlockId: string
  ) => {
    const state = useCanvasStore.getState()
    const activeBoard = state.boards.find((b) => b.id === state.activeBoardId)
    if (!activeBoard) throw new Error('No active board')

    const sourceBlock = activeBoard.blocks.find((b) => b.id === fromBlockId)
    const sourceContext = summarizeBlock(sourceBlock)

    // Same-board neighbors (up to 8)
    const otherContext = activeBoard.blocks
      .filter((b) => b.id !== fromBlockId)
      .slice(0, 8)
      .map(summarizeBlock)
      .filter(Boolean)
      .join('\n')

    // Cross-board context: summarize up to 2 highest-signal blocks from each
    // OTHER board (title, icon, top ~2 summaries). Capped at 6 boards so the
    // prompt stays bounded.
    const otherBoards = state.boards.filter((b) => b.id !== activeBoard.id).slice(0, 6)
    const workspaceContext = otherBoards
      .map((b) => {
        const summaries = b.blocks
          .slice(0, 3)
          .map(summarizeBlock)
          .filter(Boolean)
          .join(' | ')
        return `— Board "${b.icon} ${b.name}" (${b.blocks.length} blocks): ${summaries}`
      })
      .filter(Boolean)
      .join('\n')

    const res = await fetch('/api/creative-studio/generate-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        sourceContext,
        boardContext: otherContext,
        workspaceContext,
        boardName: activeBoard.name,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(err.error || `Request failed (${res.status})`)
    }
    const data = (await res.json()) as {
      title: string
      icon: string
      blocks: Array<{ type: string; text: string; checked?: boolean }>
    }

    // Create the page block in place
    const newId = addBlockAt('page', wx, wy)
    if (!newId) throw new Error('Failed to create page block')

    // Convert AI blocks into SubPageBlock shape with fresh ids
    const content = data.blocks.map((b) => ({
      id: uid(),
      type: b.type as 'h1' | 'h2' | 'h3' | 'p' | 'bullet' | 'numbered' | 'todo' | 'divider',
      text: b.text,
      ...(b.type === 'todo' ? { checked: b.checked ?? false } : {}),
    }))

    useCanvasStore.getState().updateBlock(newId, {
      title: data.title || 'Untitled',
      // Always use the document icon for AI-generated pages (user preference).
      icon: '📄',
      content,
    } as Partial<AnyBlock>)

    // Connect source → new page
    addConnector({
      id: uid(),
      fromBlockId,
      toBlockId: newId,
      style: 'curved',
      arrow: 'one',
      color: 'var(--cs-accent)',
      weight: 2,
    })

    useCanvasStore.setState({ selection: [newId] })
  }

  if (!board) return null

  return (
    <div
      className="relative h-full w-full overflow-hidden select-none"
      style={{ background: 'var(--bg0)' }}
    >
      <div
        ref={containerRef}
        className="absolute inset-0 outline-none select-none"
        tabIndex={0}
        onPointerDown={(e) => {
          // Prevent text selection on canvas drag — but allow it in editable fields
          const el = e.target as HTMLElement
          const tag = el.tagName
          const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || el.contentEditable === 'true' || !!el.closest('[contenteditable="true"]')
          if (!isEditable) e.preventDefault()
        }}
        onClick={(e) => {
          const tag = (e.target as HTMLElement)?.tagName
          const isInteractive = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable
          if (!isInteractive && !(e.target as HTMLElement).closest('[data-block]')) {
            containerRef.current?.focus()
          }
          handleCanvasClick(e)
        }}
        onContextMenu={handleContextMenu}
        style={{
          cursor: connectDrag ? 'crosshair' : tool === 'pan' ? 'grab' : tool === 'connector' ? 'crosshair' : tool === 'comment' ? 'crosshair' : 'default',
          backgroundImage: showGrid
            ? 'radial-gradient(circle, color-mix(in srgb, var(--text3) 45%, transparent) 1px, transparent 1px)'
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
          {/* Render order:
              1. Connectors touching groups (behind groups — hidden by group bg)
              2. Group blocks
              3. Connectors NOT touching groups (above groups, visible inside)
              4. Non-group blocks (nodes, etc — above everything) */}
          {(() => {
            const hiddenIds = getCollapsedBlockIds(board.blocks, board.connectors)
            const visible = board.blocks.filter((b) => !hiddenIds.has(b.id))
            const groups = visible.filter((b) => b.kind === 'group')
            const rest = visible.filter((b) => b.kind !== 'group')
            return (
              <>
                <ConnectorLines blocks={board.blocks} connectors={board.connectors} filter="to-group" />
                {groups.map((block) => renderBlock(block, handleContextMenu))}
                <ConnectorLines blocks={board.blocks} connectors={board.connectors} filter="not-group" />
                {rest.map((block) => renderBlock(block, handleContextMenu))}
              </>
            )
          })()}

          {/* Comment pins (world space) */}
          {(() => {
            const pinVp: PinViewport = {
              panX: viewport.x,
              panY: viewport.y,
              zoom: viewport.scale,
              canvasRect: containerRef.current?.getBoundingClientRect() ?? null,
            }
            return commentPins
              .filter((p) => p.boardId === board.id && (showResolved || !p.resolved))
              .map((pin, i) => (
                <div key={pin.id} data-comment-pin>
                  <CommentPinMarker
                    pin={pin}
                    index={i}
                    vp={pinVp}
                    onPinContextMenu={(e) => {
                      setPinCtxMenu({ pin, x: e.clientX, y: e.clientY })
                    }}
                  />
                </div>
              ))
          })()}

          {/* Connector drag preview line (in world space) */}
          {connectDrag && (
            <svg
              className="pointer-events-none absolute left-0 top-0"
              style={{ width: 10, height: 10, overflow: 'visible', zIndex: 100 }}
            >
              <path
                d={`M ${connectDrag.startX} ${connectDrag.startY} C ${(connectDrag.startX + connectDrag.cursorX) / 2} ${connectDrag.startY}, ${(connectDrag.startX + connectDrag.cursorX) / 2} ${connectDrag.cursorY}, ${connectDrag.cursorX} ${connectDrag.cursorY}`}
                stroke="#e85d3a"
                strokeWidth={2}
                strokeDasharray="6 4"
                fill="none"
              />
              {/* Cursor dot */}
              <circle cx={connectDrag.cursorX} cy={connectDrag.cursorY} r={6} fill="#e85d3a" opacity={0.8} />
            </svg>
          )}

        </div>

        {/* Lasso overlay (screen space) — only render when actually dragged */}
        {lasso && lasso.w > 1 && lasso.h > 1 && (
          <div
            className="pointer-events-none absolute border border-[color:var(--cs-accent)]/70 bg-[color:var(--cs-accent)]/10"
            style={{ left: lasso.x, top: lasso.y, width: lasso.w, height: lasso.h }}
          />
        )}
      </div>

      {/* Zoom + grid controls */}
      <div
        className="absolute bottom-3 right-3 z-20 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[13px] backdrop-blur"
        style={{
          background: 'color-mix(in srgb, var(--bg2) 95%, transparent)',
          borderColor: 'var(--border)',
          color: 'var(--text1)',
        }}
      >
        <button
          className={`rounded px-1 ${showGrid ? 'text-[color:var(--cs-accent2)]' : ''}`}
          onClick={() => setShowGrid(!showGrid)}
          title="Toggle grid"
        >
          <Grid3x3 size={12} />
        </button>
        <button
          className={`rounded px-1 text-[13px] ${snapToGrid ? 'text-[color:var(--cs-accent2)]' : ''}`}
          onClick={() => setSnapToGrid(!snapToGrid)}
          title="Snap to grid"
        >
          SNAP
        </button>
        <div className="h-3 w-px bg-[rgba(255,255,255,0.07)]" />
        <button onClick={() => setViewport({ ...viewport, scale: Math.max(0.1, viewport.scale - 0.1) })}>
          <Minus size={12} />
        </button>
        <span className="font-mono tabular-nums">{Math.round(viewport.scale * 100)}%</span>
        <button onClick={() => setViewport({ ...viewport, scale: Math.min(4, viewport.scale + 0.1) })}>
          <PlusIcon size={12} />
        </button>
        <button className="text-[13px] hover:text-white" onClick={zoomToFit}>FIT</button>
        {/* Show/hide resolved pins toggle */}
        {commentPins.some((p) => p.boardId === board.id && p.resolved) && (
          <>
            <div className="h-3 w-px bg-[rgba(255,255,255,0.07)]" />
            <button
              className="flex items-center gap-1 text-[13px]"
              style={{ color: showResolved ? 'var(--cs-accent2)' : 'var(--text2)' }}
              onClick={() => setShowResolved(!showResolved)}
              title={showResolved ? 'Hide resolved' : 'Show resolved'}
            >
              {showResolved ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
          </>
        )}
      </div>

      <TimerWidget />
      <ContextMenu state={ctxMenu} onClose={() => setCtxMenu(null)} onZoomToFit={zoomToFit} />
      {/* Pin right-click context menu */}
      <AnimatePresence>
        {pinCtxMenu && (
          <PinContextMenu
            pin={pinCtxMenu.pin}
            x={pinCtxMenu.x}
            y={pinCtxMenu.y}
            onClose={() => setPinCtxMenu(null)}
          />
        )}
      </AnimatePresence>
      {(() => {
        // Recompute the drop menu's screen position on every render so it
        // tracks canvas pan/zoom — popup stays attached to the drop point
        // on the canvas instead of "locking" to the viewport.
        if (!dropMenu) return null
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return null
        const clientX = rect.left + viewport.x + dropMenu.worldX * viewport.scale
        const clientY = rect.top + viewport.y + dropMenu.worldY * viewport.scale
        return (
          <ConnectorDropMenu
            state={{ ...dropMenu, clientX, clientY }}
            onClose={() => setDropMenu(null)}
            onCreateBlock={handleCreateBlockFromDrop}
            onCreatePageFromAI={handleCreatePageFromAI}
          />
        )
      })()}
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
    case 'tasks':     return <TasksBlockView      key={block.id} block={block} onContextMenu={onContextMenu} />
    case 'transcript':return <TranscriptBlockView key={block.id} block={block} onContextMenu={onContextMenu} />
    case 'assistant': return <AssistantBlockView  key={block.id} block={block} onContextMenu={onContextMenu} />
    case 'timeline':  return <PlaceholderBlock   key={block.id} block={block} label="Timeline" onContextMenu={onContextMenu} />
    case 'embed':     return <EmbedBlockView     key={block.id} block={block} onContextMenu={onContextMenu} />
    case 'section':         return <PlaceholderBlock          key={block.id} block={block} label="Section" onContextMenu={onContextMenu} />
    case 'standalone-node': return <StandaloneNodeBlockView   key={block.id} block={block as import('./types').StandaloneNodeBlock} onContextMenu={onContextMenu} />
    case 'group':           return <GroupBlockView            key={block.id} block={block as import('./types').GroupBlock} onContextMenu={onContextMenu} />
  }
}
