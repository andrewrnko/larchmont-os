// AI Graph utilities — full canvas context builder, layout engine, action executor.

import { uid } from './store'
import type {
  AnyBlock, Board, Connector, TasksBlock, PageBlock, MindMapBlock,
  MindMapNode, StandaloneNodeBlock, GroupBlock, TextBlock, StickyBlock,
  TranscriptBlock, StoryboardBlock, SubPageBlock, EmbedBlock, AssistantBlock,
  BlockKind,
} from './types'

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

export interface AIAction {
  type: string
  targetBlockId?: string
  targetGroupId?: string
  targetPinId?: string
  data: Record<string, unknown>
}

export interface ActionResult {
  action: AIAction
  success: boolean
  description: string
}

// ────────────────────────────────────────────────
// Layout engine — grid-based, no-overlap placement
// ────────────────────────────────────────────────

const GRID_W = 320
const GRID_H = 160
const PAGE_W = 280
const PAGE_H = 140
const GROUP_PAD = 40

class LayoutEngine {
  private occupied = new Set<string>()
  private baseX: number
  private baseY: number
  private pageCol = 0
  private groupCol = 0
  private nodeCol = 0

  constructor(assistantBlock: AnyBlock, existingBlocks: AnyBlock[]) {
    // Place new content well to the right of the assistant, with vertical centering
    this.baseX = assistantBlock.x + assistantBlock.w + 120
    this.baseY = assistantBlock.y - 300

    // Mark ALL existing blocks as occupied (with 1-cell padding)
    for (const b of existingBlocks) {
      const gx = Math.floor(b.x / GRID_W) - 1
      const gy = Math.floor(b.y / GRID_H) - 1
      const gw = Math.ceil(b.w / GRID_W) + 2
      const gh = Math.ceil(b.h / GRID_H) + 2
      for (let x = gx; x < gx + gw; x++) {
        for (let y = gy; y < gy + gh; y++) {
          this.occupied.add(`${x},${y}`)
        }
      }
    }
  }

  private findFreeCell(startGx: number, startGy: number, cellsW: number, cellsH: number): { x: number; y: number } {
    for (let dy = 0; dy < 20; dy++) {
      for (let dx = 0; dx < 10; dx++) {
        const gx = startGx + dx
        const gy = startGy + dy
        let free = true
        for (let cx = gx; cx < gx + cellsW && free; cx++) {
          for (let cy = gy; cy < gy + cellsH && free; cy++) {
            if (this.occupied.has(`${cx},${cy}`)) free = false
          }
        }
        if (free) {
          for (let cx = gx; cx < gx + cellsW; cx++) {
            for (let cy = gy; cy < gy + cellsH; cy++) {
              this.occupied.add(`${cx},${cy}`)
            }
          }
          return { x: gx * GRID_W, y: gy * GRID_H }
        }
      }
    }
    // Fallback
    return { x: this.baseX + this.pageCol * GRID_W, y: this.baseY + 20 * GRID_H }
  }

  pagePosition(): { x: number; y: number } {
    const startGx = Math.floor(this.baseX / GRID_W)
    const startGy = Math.floor(this.baseY / GRID_H) + this.pageCol
    this.pageCol++
    return this.findFreeCell(startGx, startGy, 1, 1)
  }

  groupPosition(w: number, h: number): { x: number; y: number } {
    const cellsW = Math.ceil(w / GRID_W)
    const cellsH = Math.ceil(h / GRID_H)
    const startGx = Math.floor(this.baseX / GRID_W) + 2
    const startGy = Math.floor(this.baseY / GRID_H) + this.groupCol
    this.groupCol += cellsH
    return this.findFreeCell(startGx, startGy, cellsW, cellsH)
  }

  blockPosition(): { x: number; y: number } {
    const startGx = Math.floor(this.baseX / GRID_W) + 4 + this.nodeCol % 2
    const startGy = Math.floor(this.baseY / GRID_H) + Math.floor(this.nodeCol / 2)
    this.nodeCol++
    return this.findFreeCell(startGx, startGy, 1, 1)
  }
}

// ────────────────────────────────────────────────
// Full canvas context builder
// ────────────────────────────────────────────────

export function buildCanvasContext(assistantBlockId: string, board: Board): string {
  const blocks: Record<string, unknown>[] = []

  for (const b of board.blocks) {
    if (b.id === assistantBlockId) continue
    const connections = board.connectors
      .filter((c) => c.fromBlockId === b.id || c.toBlockId === b.id)
      .map((c) => c.fromBlockId === b.id ? c.toBlockId : c.fromBlockId)

    const base = { id: b.id, type: b.kind, position: { x: Math.round(b.x), y: Math.round(b.y) }, size: { width: b.w, height: b.h }, connections }

    switch (b.kind) {
      case 'tasks': { const t = b as TasksBlock; blocks.push({ ...base, label: t.label, tasks: t.taskItems.map((ti) => ({ id: ti.id, title: ti.title, done: ti.done, priority: ti.priority ? `P${ti.priority}` : undefined })) }); break }
      case 'page': { const p = b as PageBlock; blocks.push({ ...base, label: p.title, content: p.content.slice(0, 20).map((c) => c.type === 'image' ? { type: 'image' } : { type: c.type, text: c.text }) }); break }
      case 'mindmap': { const m = b as MindMapBlock; blocks.push({ ...base, label: m.nodes.find((n) => !n.parentId)?.label ?? 'Mind Map', nodes: m.nodes.map((n) => ({ id: n.id, label: n.label, parentId: n.parentId, notes: n.notes?.slice(0, 200) })) }); break }
      case 'standalone-node': { const sn = b as StandaloneNodeBlock; blocks.push({ ...base, label: sn.label, notes: sn.notes?.slice(0, 200), groupId: sn.groupId }); break }
      case 'group': {
        const g = b as GroupBlock
        const contained = board.blocks.filter((o) => o.kind === 'standalone-node' && ((o as StandaloneNodeBlock).groupId === g.id || (o.x >= g.x && o.x + o.w <= g.x + g.w && o.y >= g.y && o.y + o.h <= g.y + g.h)))
        blocks.push({ ...base, label: g.label, childBlocks: contained.map((c) => ({ id: c.id, label: (c as StandaloneNodeBlock).label, notes: (c as StandaloneNodeBlock).notes?.slice(0, 100) })) })
        break
      }
      case 'sticky': { blocks.push({ ...base, label: `Sticky (${(b as StickyBlock).color})`, text: (b as StickyBlock).text }); break }
      case 'text': { blocks.push({ ...base, label: 'Text Note', text: (b as TextBlock).html.replace(/<[^>]+>/g, ' ').trim().slice(0, 300) }); break }
      case 'transcript': { const tr = b as TranscriptBlock; blocks.push({ ...base, label: tr.title, text: tr.transcript.slice(0, 300) }); break }
      case 'storyboard': { blocks.push({ ...base, label: 'Storyboard' }); break }
      case 'embed': { const e = b as EmbedBlock; blocks.push({ ...base, label: e.title || 'Embed', url: e.url }); break }
      case 'assistant': { blocks.push({ ...base, label: (b as AssistantBlock).label || 'AI Assistant' }); break }
      default: blocks.push({ ...base, label: b.kind })
    }
  }

  const gc = board.blocks.filter((b) => b.kind === 'group').length
  const mc = board.blocks.filter((b) => b.kind === 'mindmap').length
  const nc = board.blocks.filter((b) => b.kind === 'standalone-node').length
  return JSON.stringify({ summary: `Canvas: ${board.blocks.length} blocks, ${gc} groups, ${mc} mind maps, ${nc} nodes`, blocks, connections: board.connectors.map((c) => ({ from: c.fromBlockId, to: c.toBlockId })) }, null, 2)
}

// ────────────────────────────────────────────────
// Comprehensive action executor
// ────────────────────────────────────────────────

export function executeActions(
  actions: AIAction[],
  board: Board,
  updateBlock: (id: string, patch: Partial<AnyBlock>) => void,
  addBlockAt: (kind: BlockKind, x: number, y: number) => string | null,
  assistantBlock: AnyBlock,
  addConnector: (c: Connector) => void,
): ActionResult[] {
  const results: ActionResult[] = []
  const blockMap = new Map(board.blocks.map((b) => [b.id, b]))
  const layout = new LayoutEngine(assistantBlock, board.blocks)
  // Track newly created block IDs so we can reference them across actions
  const createdIds = new Map<string, string>() // label → blockId

  for (const action of actions) {
    try {
      switch (action.type) {
        // ── MIND MAP ──
        case 'add-node': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target || target.kind !== 'mindmap') { results.push({ action, success: false, description: 'Mind map not found' }); break }
          const m = target as MindMapBlock
          const d = action.data as { label: string; parentId?: string; parentLabel?: string; content?: string }
          let parentId: string | null = d.parentId ?? null
          if (!parentId && d.parentLabel) parentId = m.nodes.find((n) => n.label.toLowerCase() === d.parentLabel!.toLowerCase())?.id ?? null
          if (!parentId) parentId = m.nodes.find((n) => !n.parentId)?.id ?? null
          const parent = m.nodes.find((n) => n.id === parentId)
          const siblings = m.nodes.filter((n) => n.parentId === parentId)
          updateBlock(target.id, { nodes: [...m.nodes, {
            id: uid(), parentId, label: d.label, dx: (parent?.dx ?? 180) + 250, dy: (parent?.dy ?? 140) + siblings.length * 120,
            shape: 'pill', color: '', notes: d.content,
          }] } as Partial<AnyBlock>)
          results.push({ action, success: true, description: `Added node "${d.label}"` })
          break
        }
        case 'bulk-add-nodes': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target || target.kind !== 'mindmap') { results.push({ action, success: false, description: 'Mind map not found' }); break }
          const m = target as MindMapBlock
          const d = action.data as { nodes: Array<{ label: string; parentLabel: string; content?: string }> }
          let allNodes = [...m.nodes]
          for (const nd of d.nodes) {
            const parent = allNodes.find((n) => n.label.toLowerCase() === nd.parentLabel.toLowerCase())
            const pid = parent?.id ?? allNodes.find((n) => !n.parentId)?.id ?? null
            const sibs = allNodes.filter((n) => n.parentId === pid)
            const p = allNodes.find((n) => n.id === pid)
            allNodes.push({ id: uid(), parentId: pid, label: nd.label, dx: (p?.dx ?? 180) + 250, dy: (p?.dy ?? 140) + sibs.length * 120, shape: 'pill', color: '', notes: nd.content })
          }
          updateBlock(target.id, { nodes: allNodes } as Partial<AnyBlock>)
          results.push({ action, success: true, description: `Added ${d.nodes.length} nodes` })
          break
        }
        case 'edit-node': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target || target.kind !== 'mindmap') break
          const m = target as MindMapBlock
          const d = action.data as { nodeId?: string; nodeLabel?: string; newLabel?: string; content?: string }
          updateBlock(target.id, { nodes: m.nodes.map((n) => {
            if ((d.nodeId && n.id === d.nodeId) || (d.nodeLabel && n.label.toLowerCase() === d.nodeLabel.toLowerCase()))
              return { ...n, ...(d.newLabel ? { label: d.newLabel } : {}), ...(d.content !== undefined ? { notes: d.content } : {}) }
            return n
          }) } as Partial<AnyBlock>)
          results.push({ action, success: true, description: 'Updated node' })
          break
        }
        case 'delete-node': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target || target.kind !== 'mindmap') break
          const m = target as MindMapBlock
          const d = action.data as { nodeId?: string; nodeLabel?: string }
          const toDelete = new Set<string>()
          const fn = m.nodes.find((n) => (d.nodeId && n.id === d.nodeId) || (d.nodeLabel && n.label.toLowerCase() === d.nodeLabel!.toLowerCase()))
          if (fn) { const r = (id: string) => { toDelete.add(id); m.nodes.filter((n) => n.parentId === id).forEach((n) => r(n.id)) }; r(fn.id) }
          updateBlock(target.id, { nodes: m.nodes.filter((n) => !toDelete.has(n.id)) } as Partial<AnyBlock>)
          results.push({ action, success: true, description: `Deleted ${toDelete.size} nodes` })
          break
        }
        case 'rename-mindmap': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target || target.kind !== 'mindmap') break
          const m = target as MindMapBlock
          const root = m.nodes.find((n) => !n.parentId)
          if (root) updateBlock(target.id, { nodes: m.nodes.map((n) => n.id === root.id ? { ...n, label: (action.data as { newTitle: string }).newTitle } : n) } as Partial<AnyBlock>)
          results.push({ action, success: true, description: `Renamed mind map` })
          break
        }
        case 'update-node-body': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target) break
          const d = action.data as { nodeId?: string; nodeLabel?: string; body: string }
          if (target.kind === 'mindmap') {
            const m = target as MindMapBlock
            updateBlock(target.id, { nodes: m.nodes.map((n) => ((d.nodeId && n.id === d.nodeId) || (d.nodeLabel && n.label.toLowerCase() === d.nodeLabel!.toLowerCase())) ? { ...n, notes: d.body } : n) } as Partial<AnyBlock>)
          } else if (target.kind === 'standalone-node') {
            updateBlock(target.id, { notes: d.body } as Partial<AnyBlock>)
          }
          results.push({ action, success: true, description: 'Updated node body' })
          break
        }

        // ── TASKS ──
        case 'add-task': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target || target.kind !== 'tasks') { results.push({ action, success: false, description: 'Task list not found' }); break }
          const t = target as TasksBlock
          const d = action.data as { text: string; priority?: string | number }
          const pri = typeof d.priority === 'string' ? parseInt(d.priority.replace('P', '')) : (d.priority ?? 2)
          updateBlock(target.id, { taskItems: [...t.taskItems, { id: uid(), title: d.text, done: false, priority: pri as 1 | 2 | 3, createdAt: Date.now() }] } as Partial<AnyBlock>)
          results.push({ action, success: true, description: `Added task "${d.text}"` })
          break
        }
        case 'complete-task': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target || target.kind !== 'tasks') break
          const t = target as TasksBlock
          const d = action.data as { taskText: string }
          updateBlock(target.id, { taskItems: t.taskItems.map((i) => i.title.toLowerCase().includes(d.taskText.toLowerCase()) ? { ...i, done: true, completedAt: Date.now() } : i) } as Partial<AnyBlock>)
          results.push({ action, success: true, description: `Completed task` })
          break
        }

        // ── BLOCK CREATION ──
        case 'create-block': {
          const d = action.data as { blockType: string; label?: string; content?: unknown; position?: { x: number; y: number } | 'auto' }
          let pos: { x: number; y: number }
          if (d.position && d.position !== 'auto') pos = d.position as { x: number; y: number }
          else if (d.blockType === 'page') pos = layout.pagePosition()
          else if (d.blockType === 'group') pos = layout.groupPosition(600, 400)
          else pos = layout.blockPosition()

          const newId = addBlockAt(d.blockType as BlockKind, pos.x, pos.y)
          if (newId) {
            const patch: Record<string, unknown> = {}
            if (d.label) {
              if (d.blockType === 'sticky') patch.text = d.label
              else if (d.blockType === 'tasks') patch.label = d.label
              else if (d.blockType === 'page') patch.title = d.label
              else if (d.blockType === 'standalone-node') patch.label = d.label
              else if (d.blockType === 'group') { patch.label = d.label; patch.w = 600; patch.h = 400 }
            }
            if (d.content && d.blockType === 'page' && Array.isArray(d.content)) {
              patch.content = (d.content as Array<{ type: string; text: string }>).map((c) => ({ id: uid(), type: c.type, text: c.text }))
            }
            if (d.content && d.blockType === 'sticky') patch.text = d.content as string
            if (d.content && d.blockType === 'text') patch.html = `<p>${d.content}</p>`
            if (d.content && d.blockType === 'tasks' && Array.isArray(d.content)) {
              patch.taskItems = (d.content as Array<{ title: string; priority?: number }>).map((t) => ({
                id: uid(), title: t.title, done: false, priority: (t.priority ?? 2) as 1 | 2 | 3, createdAt: Date.now(),
              }))
            }
            if (Object.keys(patch).length > 0) updateBlock(newId, patch as Partial<AnyBlock>)
            addConnector({ id: uid(), fromBlockId: assistantBlock.id, toBlockId: newId, style: 'curved', arrow: 'one', color: 'var(--cs-accent)', weight: 2 })
            if (d.label) createdIds.set(d.label, newId)
            // Add to blockMap so subsequent actions (like add-nodes-to-group) can find it
            const freshStore = getStoreState()
            const freshBlock = freshStore?.blocks.find((x: AnyBlock) => x.id === newId)
            if (freshBlock) blockMap.set(newId, freshBlock)
            results.push({ action, success: true, description: `Created ${d.blockType}${d.label ? ` "${d.label}"` : ''}` })
          }
          break
        }

        // ── ADD NODES TO GROUP ──
        case 'add-nodes-to-group': {
          let gid = action.targetBlockId ?? action.targetGroupId ?? ''
          let group = blockMap.get(gid)
          // If not found by ID, search recently created blocks by label
          if (!group || group.kind !== 'group') {
            for (const [, id] of createdIds) {
              const b = blockMap.get(id)
              if (b && b.kind === 'group') { group = b; gid = id; break }
            }
          }
          // Last resort: read fresh from the store
          if (!group || group.kind !== 'group') {
            const fresh = getStoreState()
            if (fresh) {
              // Try the original ID
              const fb = fresh.blocks.find((x: AnyBlock) => x.id === gid && x.kind === 'group')
              if (fb) { group = fb; blockMap.set(gid, fb) }
              // Try any recently created group
              if (!fb) {
                for (const [, id] of createdIds) {
                  const g = fresh.blocks.find((x: AnyBlock) => x.id === id && x.kind === 'group')
                  if (g) { group = g; gid = id; blockMap.set(id, g); break }
                }
              }
            }
          }
          if (!group || group.kind !== 'group') {
            results.push({ action, success: false, description: 'Group not found' })
            break
          }
          const d = action.data as { nodes: Array<{ label: string; body?: string; connectTo?: string[] }> }
          if (!Array.isArray(d.nodes)) break

          // Layout nodes in a chain: rows of 3, left-to-right, top-to-bottom
          const nodeIds: string[] = []
          const colW = 220
          const rowH = 120
          const cols = 3
          const startX = group.x + GROUP_PAD
          const startY = group.y + 50

          d.nodes.forEach((nd, i) => {
            const col = i % cols
            const row = Math.floor(i / cols)
            const nx = startX + col * colW
            const ny = startY + row * rowH
            const newId = addBlockAt('standalone-node', nx, ny)
            if (newId) {
              updateBlock(newId, { label: nd.label, notes: nd.body, groupId: group!.id } as Partial<AnyBlock>)
              nodeIds.push(newId)
            }
          })

          // Auto-resize group to fit all nodes
          const totalRows = Math.ceil(d.nodes.length / cols)
          const neededW = Math.max(600, GROUP_PAD * 2 + cols * colW)
          const neededH = Math.max(300, 50 + totalRows * rowH + GROUP_PAD)
          updateBlock(group.id, { w: neededW, h: neededH } as Partial<AnyBlock>)

          // Connect nodes in a linear chain: node[0]→node[1]→node[2]→...
          for (let i = 0; i < nodeIds.length - 1; i++) {
            addConnector({ id: uid(), fromBlockId: nodeIds[i], toBlockId: nodeIds[i + 1], style: 'curved', arrow: 'none', color: 'rgba(255,255,255,0.12)', weight: 1.5 })
          }
          results.push({ action, success: true, description: `Added ${nodeIds.length} nodes to group` })
          break
        }

        // ── BLOCK EDITING ──
        case 'rename-block': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target) break
          const d = action.data as { newTitle: string }
          if (target.kind === 'page') updateBlock(target.id, { title: d.newTitle } as Partial<AnyBlock>)
          else if (target.kind === 'tasks') updateBlock(target.id, { label: d.newTitle } as Partial<AnyBlock>)
          else if (target.kind === 'standalone-node') updateBlock(target.id, { label: d.newTitle } as Partial<AnyBlock>)
          else if (target.kind === 'group') updateBlock(target.id, { label: d.newTitle } as Partial<AnyBlock>)
          results.push({ action, success: true, description: `Renamed to "${d.newTitle}"` })
          break
        }
        case 'update-page-content':
        case 'append-text': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target) break
          if (target.kind === 'page') {
            const p = target as PageBlock
            const d = action.data as { content?: Array<{ type: string; text: string }>; text?: string; operation?: string }
            const items = d.content ?? [{ type: 'p', text: d.text ?? '' }]
            const newBlocks = items.map((c) => ({ id: uid(), type: c.type as SubPageBlock['type'], text: c.text })) as SubPageBlock[]
            const op = d.operation ?? 'append'
            updateBlock(target.id, { content: op === 'prepend' ? [...newBlocks, ...p.content] : op === 'replace' ? newBlocks : [...p.content, ...newBlocks] } as Partial<AnyBlock>)
          } else if (target.kind === 'sticky') {
            const d = action.data as { text?: string; content?: string }
            updateBlock(target.id, { text: d.text ?? d.content ?? '' } as Partial<AnyBlock>)
          }
          results.push({ action, success: true, description: 'Updated content' })
          break
        }
        case 'replace-text':
        case 'update-sticky':
        case 'update-text': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target) break
          const d = action.data as { text?: string; content?: string }
          const val = d.text ?? d.content ?? ''
          if (target.kind === 'sticky') updateBlock(target.id, { text: val } as Partial<AnyBlock>)
          else if (target.kind === 'text') updateBlock(target.id, { html: `<p>${val}</p>` } as Partial<AnyBlock>)
          results.push({ action, success: true, description: 'Replaced content' })
          break
        }

        // ── GROUP ──
        case 'rename-group': {
          const gid = action.targetGroupId ?? action.targetBlockId ?? ''
          const target = blockMap.get(gid)
          if (!target || target.kind !== 'group') break
          updateBlock(gid, { label: (action.data as { newLabel: string }).newLabel } as Partial<AnyBlock>)
          results.push({ action, success: true, description: `Renamed group` })
          break
        }
        case 'add-node-to-group':
        case 'add-block-to-group': {
          const gid = action.targetGroupId ?? action.targetBlockId ?? ''
          const group = blockMap.get(gid)
          if (!group || group.kind !== 'group') break
          const d = action.data as { label?: string; content?: string; body?: string }
          const px = group.x + GROUP_PAD + Math.random() * (group.w - 2 * GROUP_PAD - 160)
          const py = group.y + 50 + Math.random() * (group.h - 120)
          const newId = addBlockAt('standalone-node', px, py)
          if (newId) {
            updateBlock(newId, { label: d.label, notes: d.body ?? d.content, groupId: gid } as Partial<AnyBlock>)
            results.push({ action, success: true, description: `Added "${d.label}" to group` })
          }
          break
        }

        // ── PROJECT ──
        case 'create-project': {
          const d = action.data as { projectName: string; structure?: { mindmap?: { root: string; branches: Array<{ label: string; children?: string[] }> }; tasks?: Array<{ title: string; priority?: number }>; brief?: string } }
          if (d.structure?.mindmap) {
            const pos = layout.blockPosition()
            const mmId = addBlockAt('mindmap', pos.x, pos.y)
            if (mmId) {
              const rootNode: MindMapNode = { id: uid(), parentId: null, label: d.structure.mindmap.root, dx: 180, dy: 180, shape: 'pill', color: '' }
              const allNodes: MindMapNode[] = [rootNode]
              d.structure.mindmap.branches.forEach((b, i) => {
                const bn: MindMapNode = { id: uid(), parentId: rootNode.id, label: b.label, dx: 430, dy: 80 + i * 100, shape: 'pill', color: '' }
                allNodes.push(bn)
                b.children?.forEach((c, j) => { allNodes.push({ id: uid(), parentId: bn.id, label: c, dx: 680, dy: 60 + i * 100 + j * 60, shape: 'pill', color: '' }) })
              })
              updateBlock(mmId, { nodes: allNodes, w: 800, h: Math.max(400, 100 + d.structure.mindmap.branches.length * 100) } as Partial<AnyBlock>)
              addConnector({ id: uid(), fromBlockId: assistantBlock.id, toBlockId: mmId, style: 'curved', arrow: 'one', color: 'var(--cs-accent)', weight: 2 })
            }
          }
          if (d.structure?.tasks) {
            const pos = layout.pagePosition()
            const tId = addBlockAt('tasks', pos.x, pos.y)
            if (tId) {
              updateBlock(tId, { label: `${d.projectName} Tasks`, taskItems: d.structure.tasks.map((t) => ({ id: uid(), title: t.title, done: false, priority: (t.priority ?? 2) as 1 | 2 | 3, createdAt: Date.now() })) } as Partial<AnyBlock>)
              addConnector({ id: uid(), fromBlockId: assistantBlock.id, toBlockId: tId, style: 'curved', arrow: 'one', color: 'var(--cs-accent)', weight: 2 })
            }
          }
          if (d.structure?.brief) {
            const pos = layout.pagePosition()
            const bId = addBlockAt('page', pos.x, pos.y)
            if (bId) {
              updateBlock(bId, { title: `${d.projectName} Brief`, content: [{ id: uid(), type: 'h1', text: d.projectName }, { id: uid(), type: 'p', text: d.structure.brief }] } as Partial<AnyBlock>)
              addConnector({ id: uid(), fromBlockId: assistantBlock.id, toBlockId: bId, style: 'curved', arrow: 'one', color: 'var(--cs-accent)', weight: 2 })
            }
          }
          results.push({ action, success: true, description: `Created project "${d.projectName}"` })
          break
        }

        default:
          results.push({ action, success: false, description: `Unknown action: ${action.type}` })
      }
    } catch (err) {
      results.push({ action, success: false, description: `Error: ${err instanceof Error ? err.message : String(err)}` })
    }
  }

  return results
}

// Helper to get fresh board state during action execution.
// Imported at top level — useCanvasStore is a Zustand store, getState() works outside React.
function getStoreState(): Board | null {
  try {
    // Dynamic require to avoid circular dependency issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useCanvasStore } = require('./store')
    const s = useCanvasStore.getState()
    return s.boards.find((b: Board) => b.id === s.activeBoardId) ?? null
  } catch { return null }
}

// ────────────────────────────────────────────────
// Response parser
// ────────────────────────────────────────────────

export function parseAIResponse(responseText: string): { message: string; actions: AIAction[] } {
  try {
    const parsed = JSON.parse(responseText)
    if (typeof parsed.message === 'string' && Array.isArray(parsed.actions)) return { message: parsed.message, actions: parsed.actions }
  } catch { /* not JSON */ }

  const jsonMatch = responseText.match(/```(?:json)?\s*\n([\s\S]*?)```/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1])
      if (typeof parsed.message === 'string' && Array.isArray(parsed.actions)) return { message: parsed.message, actions: parsed.actions }
    } catch { /* bad JSON */ }
  }

  return { message: responseText, actions: [] }
}
