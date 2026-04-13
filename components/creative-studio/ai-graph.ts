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
  actionId?: string        // optional id for forward references: {{actionId}}
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
// Layout engine — column-based placement to the
// RIGHT of all existing canvas content
// ────────────────────────────────────────────────

const GROUP_PAD = 40
const COL_GAP = 120     // horizontal gap between columns
const ROW_GAP = 60      // vertical gap between blocks in a column

// Default block sizes per type (used for layout calculation)
const BLOCK_DIMS: Record<string, { w: number; h: number }> = {
  page:              { w: 280, h: 160 },
  text:              { w: 280, h: 180 },
  sticky:            { w: 240, h: 200 },
  tasks:             { w: 300, h: 220 },
  mindmap:           { w: 520, h: 400 },
  group:             { w: 500, h: 360 },
  'standalone-node': { w: 180, h: 60 },
  embed:             { w: 320, h: 200 },
  transcript:        { w: 280, h: 180 },
  storyboard:        { w: 400, h: 300 },
  assistant:         { w: 320, h: 280 },
}

class LayoutEngine {
  // Column definition: content → data → visual.
  // Each column tracks an x origin and a running y cursor.
  private cols: {
    content: { x: number; y: number; items: number }  // pages, text, sticky, transcript
    data:    { x: number; y: number; items: number }  // tasks
    visual:  { x: number; y: number; items: number }  // mindmap, group
    other:   { x: number; y: number; items: number }  // standalone nodes, misc
  }
  private startX: number
  private startY: number

  constructor(assistantBlock: AnyBlock, existingBlocks: AnyBlock[]) {
    // Find the RIGHT edge of all existing blocks (excluding assistant)
    let rightEdge = 0
    for (const b of existingBlocks) {
      if (b.id === assistantBlock.id) continue
      rightEdge = Math.max(rightEdge, b.x + b.w)
    }

    // New content starts 200px right of the rightmost existing block,
    // or 200px from the left if the canvas is empty.
    this.startX = existingBlocks.length <= 1 ? 200 : rightEdge + 200
    this.startY = assistantBlock.y   // align with assistant vertically

    // Column x origins — left to right: content, data, visual
    const contentW = BLOCK_DIMS.page.w
    const dataW = BLOCK_DIMS.tasks.w
    const visualW = BLOCK_DIMS.mindmap.w

    this.cols = {
      content: { x: this.startX,                                   y: this.startY, items: 0 },
      data:    { x: this.startX + contentW + COL_GAP,              y: this.startY, items: 0 },
      visual:  { x: this.startX + contentW + COL_GAP + dataW + COL_GAP, y: this.startY, items: 0 },
      other:   { x: this.startX + contentW + COL_GAP + dataW + COL_GAP, y: this.startY, items: 0 },
    }
  }

  /** Place a block in a column, returning { x, y } and advancing the cursor. */
  private place(col: keyof typeof this.cols, h: number): { x: number; y: number } {
    const c = this.cols[col]
    const pos = { x: c.x, y: c.y }
    c.y += h + ROW_GAP
    c.items++
    return pos
  }

  pagePosition(): { x: number; y: number } {
    return this.place('content', BLOCK_DIMS.page.h)
  }

  taskPosition(): { x: number; y: number } {
    return this.place('data', BLOCK_DIMS.tasks.h)
  }

  mindmapPosition(): { x: number; y: number } {
    return this.place('visual', BLOCK_DIMS.mindmap.h)
  }

  groupPosition(_w: number, h: number): { x: number; y: number } {
    return this.place('visual', Math.max(h, BLOCK_DIMS.group.h))
  }

  blockPosition(): { x: number; y: number } {
    return this.place('other', 180)
  }
}

// ────────────────────────────────────────────────
// Mind map tree layout algorithm
// ────────────────────────────────────────────────

interface NetworkNodeInput {
  id: string
  label: string
  body: string
  parentId: string | null
  color?: string
}

/** Ensure body text has proper newlines for ModalNotesEditor rendering. */
function formatBodyText(text: string): string {
  if (!text) return ''
  // Already has newlines — use as-is
  if (text.includes('\n')) return text
  // Single-line text: split on sentence-ending punctuation followed by space
  // so each sentence or bullet renders on its own line
  return text
    .replace(/\.\s+(?=[A-Z])/g, '.\n')   // "Sentence one. Sentence two" → two lines
    .replace(/:\s+(?=[A-Z])/g, ':\n')     // "Focus: Deep work" → two lines
    .replace(/\.\s+(?=[a-z])/g, '.\n')    // "priorities include. research areas" → two lines
    .replace(/;\s+/g, ';\n')              // "item one; item two" → two lines
    .replace(/\s*[-•]\s+/g, '\n• ')       // inline bullet markers → separate lines
    .trim()
}

function layoutMindMapTree(nodes: NetworkNodeInput[]): MindMapNode[] {
  // Build adjacency: parent → children
  const childrenOf = new Map<string | null, NetworkNodeInput[]>()
  for (const n of nodes) {
    const list = childrenOf.get(n.parentId) ?? []
    list.push(n)
    childrenOf.set(n.parentId, list)
  }

  // Find root (parentId: null)
  const roots = childrenOf.get(null) ?? []
  if (roots.length === 0) return []

  const root = roots[0]
  const result: MindMapNode[] = []

  const X_STEP = 280
  const Y_STEP = 130

  // Calculate subtree leaf-count for proportional spacing
  function subtreeSize(nodeId: string): number {
    const children = childrenOf.get(nodeId) ?? []
    if (children.length === 0) return 1
    return children.reduce((sum, c) => sum + subtreeSize(c.id), 0)
  }

  // BFS layout: root on left, children branch right
  function layoutNode(node: NetworkNodeInput, level: number, yCenter: number) {
    const x = 100 + level * X_STEP
    result.push({
      id: node.id,
      parentId: node.parentId,
      label: node.label,
      dx: x,
      dy: yCenter,
      shape: 'pill',
      color: node.color ?? '',
      notes: formatBodyText(node.body),
    })

    const children = childrenOf.get(node.id) ?? []
    if (children.length === 0) return

    // Total leaf-nodes across all children determines spread
    const totalLeaves = children.reduce((s, c) => s + subtreeSize(c.id), 0)
    const totalHeight = (totalLeaves - 1) * Y_STEP
    let currentY = yCenter - totalHeight / 2

    for (const child of children) {
      const childLeaves = subtreeSize(child.id)
      const childCenter = currentY + ((childLeaves - 1) * Y_STEP) / 2
      layoutNode(child, level + 1, childCenter)
      currentY += childLeaves * Y_STEP
    }
  }

  // Start root at a generous y so the tree centers in the block
  const rootLeaves = subtreeSize(root.id)
  const estimatedHeight = (rootLeaves - 1) * Y_STEP
  const rootY = Math.max(200, estimatedHeight / 2 + 80)
  layoutNode(root, 0, rootY)

  // Normalize: ensure all nodes have positive y with padding
  const minY = Math.min(...result.map((n) => n.dy))
  if (minY < 60) {
    const shift = 60 - minY
    for (const n of result) n.dy += shift
  }

  return result
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

/** Normalize blockType aliases the AI might use ("mind-map" → "mindmap" etc.) */
const BLOCK_TYPE_ALIASES: Record<string, BlockKind> = {
  'mind-map': 'mindmap',
  'mindmap': 'mindmap',
  'task-list': 'tasks',
  'tasklist': 'tasks',
  'tasks': 'tasks',
  'page': 'page',
  'sticky': 'sticky',
  'text': 'text',
  'group': 'group',
  'standalone-node': 'standalone-node',
  'node': 'standalone-node',
}

function normalizeBlockType(raw: string): BlockKind {
  return BLOCK_TYPE_ALIASES[raw.toLowerCase()] ?? raw as BlockKind
}

function fail(results: ActionResult[], action: AIAction, reason: string): void {
  console.error(`✗ Action ${action.type} FAILED: ${reason}`, action)
  results.push({ action, success: false, description: reason })
}

function succeed(results: ActionResult[], action: AIAction, desc: string): void {
  console.log(`✓ Action ${action.type} applied: ${desc}`)
  results.push({ action, success: true, description: desc })
}

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
  // Track actionId → created block id for forward references
  const actionIdMap = new Map<string, string>()

  // Resolve forward references: {{actionId}} → actual block id
  // Also resolve "auto" for mind map targets
  function resolveTargetBlockId(raw: string | undefined, preferKind?: string): string {
    if (!raw) return ''
    // Forward reference: {{someActionId}}
    const refMatch = raw.match(/^\{\{(.+)\}\}$/)
    if (refMatch) {
      const resolved = actionIdMap.get(refMatch[1])
      if (resolved) {
        console.log(`Resolved forward reference {{${refMatch[1]}}} → ${resolved}`)
        return resolved
      }
      console.warn(`Forward reference {{${refMatch[1]}}} not found in actionIdMap`)
      return ''
    }
    // Auto: find most relevant block or create one
    if (raw === 'auto') {
      console.warn('targetBlockId "auto" used — resolving...')
      if (preferKind === 'mindmap') {
        // Find most recent mind map on canvas
        const mm = board.blocks.filter((b) => b.kind === 'mindmap')
        if (mm.length > 0) {
          const resolved = mm[mm.length - 1].id
          console.warn(`targetBlockId "auto" resolved to existing mindmap: ${resolved}`)
          return resolved
        }
      }
      if (preferKind === 'tasks') {
        const tl = board.blocks.filter((b) => b.kind === 'tasks')
        if (tl.length > 0) return tl[tl.length - 1].id
      }
      return '' // will trigger auto-creation in the action handler
    }
    return raw
  }

  for (const action of actions) {
    try {
      // Resolve forward references and "auto" for ALL actions universally
      if (action.targetBlockId) {
        const preferKind = action.type.includes('mind') || action.type.includes('node') ? 'mindmap'
          : action.type.includes('task') ? 'tasks' : undefined
        action.targetBlockId = resolveTargetBlockId(action.targetBlockId, preferKind)
      }
      if (action.targetGroupId) {
        action.targetGroupId = resolveTargetBlockId(action.targetGroupId, 'group')
      }

      switch (action.type) {
        // ── MIND MAP — NETWORK CREATION (preferred) ──
        case 'create-mind-map-network': {
          const tid = action.targetBlockId ?? ''
          let target = blockMap.get(tid)

          // Fallback: if targetBlockId not found, try to find ANY mind map block
          if (!target || target.kind !== 'mindmap') {
            // Try recently created mind maps
            for (const [, id] of createdIds) {
              const b = blockMap.get(id)
              if (b && b.kind === 'mindmap') { target = b; break }
            }
          }
          if (!target || target.kind !== 'mindmap') {
            // Try fresh store
            const fresh = getStoreState()
            if (fresh) {
              const fb = fresh.blocks.find((x: AnyBlock) => x.id === tid && x.kind === 'mindmap')
                ?? fresh.blocks.find((x: AnyBlock) => x.kind === 'mindmap')
              if (fb) { target = fb; blockMap.set(fb.id, fb) }
            }
          }
          if (!target || target.kind !== 'mindmap') {
            // Last resort: create a new mind map block
            const pos = layout.mindmapPosition()
            const newId = addBlockAt('mindmap', pos.x, pos.y)
            if (newId) {
              addConnector({ id: uid(), fromBlockId: assistantBlock.id, toBlockId: newId, style: 'curved', arrow: 'one', color: 'var(--cs-accent)', weight: 2 })
              const freshStore = getStoreState()
              target = freshStore?.blocks.find((x: AnyBlock) => x.id === newId)
              if (target) blockMap.set(newId, target)
            }
          }
          if (!target || target.kind !== 'mindmap') {
            fail(results, action, 'Could not find or create mind map block')
            break
          }

          const d = action.data as { nodes: NetworkNodeInput[] }
          if (!Array.isArray(d.nodes) || d.nodes.length === 0) {
            fail(results, action, 'No nodes provided in network data')
            break
          }

          // Validate: exactly one root, all parentIds valid
          const nodeIds = new Set(d.nodes.map((n) => n.id))
          const roots = d.nodes.filter((n) => !n.parentId)
          if (roots.length === 0) {
            // Auto-fix: make the first node the root
            d.nodes[0].parentId = null
          }

          // Auto-fix: remap invalid parentIds to root
          const rootId = d.nodes.find((n) => !n.parentId)?.id ?? d.nodes[0].id
          for (const n of d.nodes) {
            if (n.parentId && !nodeIds.has(n.parentId)) {
              console.warn(`Auto-fixing node "${n.label}": invalid parentId "${n.parentId}" → root`)
              n.parentId = rootId
            }
          }

          // Layout into positioned MindMapNode objects
          const layoutNodes = layoutMindMapTree(d.nodes)

          // Calculate required block size
          const maxX = Math.max(...layoutNodes.map((n) => n.dx)) + 160
          const maxY = Math.max(...layoutNodes.map((n) => n.dy)) + 80
          const minY = Math.min(...layoutNodes.map((n) => n.dy))
          const blockW = Math.max(520, maxX + 40)
          const blockH = Math.max(360, maxY - Math.min(0, minY - 40) + 80)

          updateBlock(target.id, {
            nodes: layoutNodes,
            w: blockW,
            h: blockH,
          } as Partial<AnyBlock>)

          succeed(results, action, `Created mind map network with ${layoutNodes.length} nodes`)
          break
        }

        // ── MIND MAP — SINGLE NODE ──
        case 'add-node': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target || target.kind !== 'mindmap') {
            fail(results, action, `Mind map not found (targetBlockId: "${action.targetBlockId ?? 'none'}")`)
            break
          }
          const m = target as MindMapBlock
          const d = action.data as { label: string; parentId?: string; parentLabel?: string; content?: string }
          let parentId: string | null = d.parentId ?? null
          if (!parentId && d.parentLabel) parentId = m.nodes.find((n) => n.label.toLowerCase() === d.parentLabel!.toLowerCase())?.id ?? null
          if (!parentId) parentId = m.nodes.find((n) => !n.parentId)?.id ?? null
          const parent = m.nodes.find((n) => n.id === parentId)
          const siblings = m.nodes.filter((n) => n.parentId === parentId)
          updateBlock(target.id, { nodes: [...m.nodes, {
            id: uid(), parentId, label: d.label, dx: (parent?.dx ?? 180) + 250, dy: (parent?.dy ?? 140) + siblings.length * 120,
            shape: 'pill', color: '', notes: formatBodyText(d.content ?? ''),
          }] } as Partial<AnyBlock>)
          succeed(results, action, `Added node "${d.label}"`)
          break
        }
        case 'bulk-add-nodes': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target || target.kind !== 'mindmap') {
            fail(results, action, `Mind map not found (targetBlockId: "${action.targetBlockId ?? 'none'}")`)
            break
          }
          const m = target as MindMapBlock
          const d = action.data as { nodes: Array<{ label: string; parentLabel: string; content?: string }> }
          if (!Array.isArray(d.nodes)) {
            fail(results, action, 'bulk-add-nodes data.nodes is not an array')
            break
          }
          let allNodes = [...m.nodes]
          for (const nd of d.nodes) {
            const parent = allNodes.find((n) => n.label.toLowerCase() === nd.parentLabel.toLowerCase())
            const pid = parent?.id ?? allNodes.find((n) => !n.parentId)?.id ?? null
            const sibs = allNodes.filter((n) => n.parentId === pid)
            const p = allNodes.find((n) => n.id === pid)
            allNodes.push({ id: uid(), parentId: pid, label: nd.label, dx: (p?.dx ?? 180) + 250, dy: (p?.dy ?? 140) + sibs.length * 120, shape: 'pill', color: '', notes: formatBodyText(nd.content ?? '') })
          }
          updateBlock(target.id, { nodes: allNodes } as Partial<AnyBlock>)
          succeed(results, action, `Added ${d.nodes.length} nodes`)
          break
        }
        case 'edit-node': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target || target.kind !== 'mindmap') {
            fail(results, action, `Mind map not found for edit-node (targetBlockId: "${action.targetBlockId ?? 'none'}")`)
            break
          }
          const m = target as MindMapBlock
          const d = action.data as { nodeId?: string; nodeLabel?: string; newLabel?: string; content?: string }
          updateBlock(target.id, { nodes: m.nodes.map((n) => {
            if ((d.nodeId && n.id === d.nodeId) || (d.nodeLabel && n.label.toLowerCase() === d.nodeLabel.toLowerCase()))
              return { ...n, ...(d.newLabel ? { label: d.newLabel } : {}), ...(d.content !== undefined ? { notes: d.content } : {}) }
            return n
          }) } as Partial<AnyBlock>)
          succeed(results, action, `Updated node "${d.nodeLabel ?? d.nodeId}"`)
          break
        }
        case 'delete-node': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target || target.kind !== 'mindmap') {
            fail(results, action, `Mind map not found for delete-node (targetBlockId: "${action.targetBlockId ?? 'none'}")`)
            break
          }
          const m = target as MindMapBlock
          const d = action.data as { nodeId?: string; nodeLabel?: string }
          const toDelete = new Set<string>()
          const fn = m.nodes.find((n) => (d.nodeId && n.id === d.nodeId) || (d.nodeLabel && n.label.toLowerCase() === d.nodeLabel!.toLowerCase()))
          if (fn) { const r = (id: string) => { toDelete.add(id); m.nodes.filter((n) => n.parentId === id).forEach((n) => r(n.id)) }; r(fn.id) }
          updateBlock(target.id, { nodes: m.nodes.filter((n) => !toDelete.has(n.id)) } as Partial<AnyBlock>)
          succeed(results, action, `Deleted ${toDelete.size} nodes`)
          break
        }
        case 'rename-mindmap': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target || target.kind !== 'mindmap') {
            fail(results, action, `Mind map not found for rename (targetBlockId: "${action.targetBlockId ?? 'none'}")`)
            break
          }
          const m = target as MindMapBlock
          const root = m.nodes.find((n) => !n.parentId)
          if (root) updateBlock(target.id, { nodes: m.nodes.map((n) => n.id === root.id ? { ...n, label: (action.data as { newTitle: string }).newTitle } : n) } as Partial<AnyBlock>)
          succeed(results, action, `Renamed mind map`)
          break
        }
        case 'update-node-body': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target) {
            fail(results, action, `Block not found for update-node-body (targetBlockId: "${action.targetBlockId ?? 'none'}")`)
            break
          }
          const d = action.data as { nodeId?: string; nodeLabel?: string; body: string }
          const formattedBody = formatBodyText(d.body)
          if (target.kind === 'mindmap') {
            const m = target as MindMapBlock
            updateBlock(target.id, { nodes: m.nodes.map((n) => ((d.nodeId && n.id === d.nodeId) || (d.nodeLabel && n.label.toLowerCase() === d.nodeLabel!.toLowerCase())) ? { ...n, notes: formattedBody } : n) } as Partial<AnyBlock>)
          } else if (target.kind === 'standalone-node') {
            updateBlock(target.id, { notes: formattedBody } as Partial<AnyBlock>)
          } else {
            fail(results, action, `Block "${target.kind}" doesn't support update-node-body`)
            break
          }
          succeed(results, action, 'Updated node body')
          break
        }

        // ── TASKS ──
        case 'add-task': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target || target.kind !== 'tasks') {
            fail(results, action, `Task list not found (targetBlockId: "${action.targetBlockId ?? 'none'}")`)
            break
          }
          const t = target as TasksBlock
          const d = action.data as { text: string; priority?: string | number }
          const pri = typeof d.priority === 'string' ? parseInt(d.priority.replace('P', '')) : (d.priority ?? 2)
          updateBlock(target.id, { taskItems: [...t.taskItems, { id: uid(), title: d.text, done: false, priority: pri as 1 | 2 | 3, createdAt: Date.now() }] } as Partial<AnyBlock>)
          succeed(results, action, `Added task "${d.text}"`)
          break
        }
        case 'complete-task': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target || target.kind !== 'tasks') {
            fail(results, action, `Task list not found for complete-task (targetBlockId: "${action.targetBlockId ?? 'none'}")`)
            break
          }
          const t = target as TasksBlock
          const d = action.data as { taskText: string }
          updateBlock(target.id, { taskItems: t.taskItems.map((i) => i.title.toLowerCase().includes(d.taskText.toLowerCase()) ? { ...i, done: true, completedAt: Date.now() } : i) } as Partial<AnyBlock>)
          succeed(results, action, `Completed task`)
          break
        }

        // ── BLOCK CREATION ──
        case 'create-block': {
          const d = action.data as { blockType: string; label?: string; content?: unknown; position?: { x: number; y: number } | 'auto' }
          const kind = normalizeBlockType(d.blockType)
          let pos: { x: number; y: number }
          if (d.position && d.position !== 'auto') {
            pos = d.position as { x: number; y: number }
          } else if (kind === 'mindmap') {
            pos = layout.mindmapPosition()
          } else if (kind === 'page' || kind === 'text' || kind === 'sticky') {
            pos = layout.pagePosition()
          } else if (kind === 'group') {
            pos = layout.groupPosition(600, 400)
          } else if (kind === 'tasks') {
            pos = layout.taskPosition()
          } else {
            pos = layout.blockPosition()
          }

          const newId = addBlockAt(kind, pos.x, pos.y)
          if (newId) {
            const patch: Record<string, unknown> = {}
            if (d.label) {
              if (kind === 'sticky') patch.text = d.label
              else if (kind === 'tasks') patch.label = d.label
              else if (kind === 'page') patch.title = d.label
              else if (kind === 'standalone-node') patch.label = d.label
              else if (kind === 'group') { patch.label = d.label; patch.w = 600; patch.h = 400 }
            }
            if (d.content && kind === 'page' && Array.isArray(d.content)) {
              patch.content = (d.content as Array<{ type: string; text: string }>).map((c) => ({ id: uid(), type: c.type, text: c.text }))
            }
            if (d.content && kind === 'sticky') patch.text = d.content as string
            if (d.content && kind === 'text') patch.html = `<p>${d.content}</p>`
            if (d.content && kind === 'tasks' && Array.isArray(d.content)) {
              patch.taskItems = (d.content as Array<{ title: string; priority?: number }>).map((t) => ({
                id: uid(), title: t.title, done: false, priority: (t.priority ?? 2) as 1 | 2 | 3, createdAt: Date.now(),
              }))
            }
            if (Object.keys(patch).length > 0) updateBlock(newId, patch as Partial<AnyBlock>)
            addConnector({ id: uid(), fromBlockId: assistantBlock.id, toBlockId: newId, style: 'curved', arrow: 'one', color: 'var(--cs-accent)', weight: 2 })
            if (d.label) createdIds.set(d.label, newId)
            // Add to blockMap so subsequent actions (like add-nodes-to-group or create-mind-map-network) can find it
            const freshStore = getStoreState()
            const freshBlock = freshStore?.blocks.find((x: AnyBlock) => x.id === newId)
            if (freshBlock) blockMap.set(newId, freshBlock)
            createdIds.set(`__id_${newId}`, newId)
            // Store actionId mapping for forward references
            if (action.actionId) actionIdMap.set(action.actionId, newId)
            succeed(results, action, `Created ${kind}${d.label ? ` "${d.label}"` : ''}`)
          } else {
            fail(results, action, `addBlockAt returned null for blockType "${kind}"`)
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
            fail(results, action, `Group not found (targetBlockId: "${action.targetBlockId ?? 'none'}", targetGroupId: "${action.targetGroupId ?? 'none'}")`)
            break
          }
          const d = action.data as { nodes: Array<{ label: string; body?: string; connectTo?: string[] }> }
          if (!Array.isArray(d.nodes)) {
            fail(results, action, 'add-nodes-to-group data.nodes is not an array')
            break
          }

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
              updateBlock(newId, { label: nd.label, notes: formatBodyText(nd.body ?? ''), groupId: group!.id } as Partial<AnyBlock>)
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
          succeed(results, action, `Added ${nodeIds.length} nodes to group`)
          break
        }

        // ── BLOCK EDITING ──
        case 'rename-block': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target) {
            fail(results, action, `Block not found for rename (targetBlockId: "${action.targetBlockId ?? 'none'}")`)
            break
          }
          const d = action.data as { newTitle: string }
          if (target.kind === 'page') updateBlock(target.id, { title: d.newTitle } as Partial<AnyBlock>)
          else if (target.kind === 'tasks') updateBlock(target.id, { label: d.newTitle } as Partial<AnyBlock>)
          else if (target.kind === 'standalone-node') updateBlock(target.id, { label: d.newTitle } as Partial<AnyBlock>)
          else if (target.kind === 'group') updateBlock(target.id, { label: d.newTitle } as Partial<AnyBlock>)
          succeed(results, action, `Renamed to "${d.newTitle}"`)
          break
        }
        case 'update-page-content':
        case 'append-text': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target) {
            fail(results, action, `Block not found for content update (targetBlockId: "${action.targetBlockId ?? 'none'}")`)
            break
          }
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
          } else {
            fail(results, action, `Block "${target.kind}" doesn't support content update`)
            break
          }
          succeed(results, action, 'Updated content')
          break
        }
        case 'replace-text':
        case 'update-sticky':
        case 'update-text': {
          const target = blockMap.get(action.targetBlockId ?? '')
          if (!target) {
            fail(results, action, `Block not found for text replace (targetBlockId: "${action.targetBlockId ?? 'none'}")`)
            break
          }
          const d = action.data as { text?: string; content?: string }
          const val = d.text ?? d.content ?? ''
          if (target.kind === 'sticky') updateBlock(target.id, { text: val } as Partial<AnyBlock>)
          else if (target.kind === 'text') updateBlock(target.id, { html: `<p>${val}</p>` } as Partial<AnyBlock>)
          else {
            fail(results, action, `Block "${target.kind}" doesn't support text replace`)
            break
          }
          succeed(results, action, 'Replaced content')
          break
        }

        // ── GROUP ──
        case 'rename-group': {
          const gid = action.targetGroupId ?? action.targetBlockId ?? ''
          const target = blockMap.get(gid)
          if (!target || target.kind !== 'group') {
            fail(results, action, `Group not found for rename (id: "${gid}")`)
            break
          }
          updateBlock(gid, { label: (action.data as { newLabel: string }).newLabel } as Partial<AnyBlock>)
          succeed(results, action, `Renamed group`)
          break
        }
        case 'add-node-to-group':
        case 'add-block-to-group': {
          const gid = action.targetGroupId ?? action.targetBlockId ?? ''
          const group = blockMap.get(gid)
          if (!group || group.kind !== 'group') {
            fail(results, action, `Group not found for add-node (id: "${gid}")`)
            break
          }
          const d = action.data as { label?: string; content?: string; body?: string }
          const px = group.x + GROUP_PAD + Math.random() * (group.w - 2 * GROUP_PAD - 160)
          const py = group.y + 50 + Math.random() * (group.h - 120)
          const newId = addBlockAt('standalone-node', px, py)
          if (newId) {
            updateBlock(newId, { label: d.label, notes: d.body ?? d.content, groupId: gid } as Partial<AnyBlock>)
            succeed(results, action, `Added "${d.label}" to group`)
          } else {
            fail(results, action, `addBlockAt returned null for standalone-node`)
          }
          break
        }

        // ── PROJECT ──
        case 'create-project': {
          const d = action.data as { projectName: string; structure?: { mindmap?: { root: string; branches: Array<{ label: string; children?: string[] }> }; tasks?: Array<{ title: string; priority?: number }>; brief?: string } }
          if (d.structure?.mindmap) {
            const pos = layout.mindmapPosition()
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
            const pos = layout.taskPosition()
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
          succeed(results, action, `Created project "${d.projectName}"`)
          break
        }

        default:
          fail(results, action, `Unknown action type: "${action.type}"`)
      }
    } catch (err) {
      fail(results, action, `Error: ${err instanceof Error ? err.message : String(err)}`)
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
  // Pattern 1: Entire response is pure JSON
  try {
    const parsed = JSON.parse(responseText)
    if (typeof parsed.message === 'string' && Array.isArray(parsed.actions)) {
      return { message: parsed.message, actions: parsed.actions }
    }
  } catch { /* not pure JSON */ }

  // Pattern 2: JSON inside markdown code fence (```json ... ``` or ``` ... ```)
  const fenceMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1])
      if (typeof parsed.message === 'string' && Array.isArray(parsed.actions)) {
        // Strip the code fence from the display text — show only human text
        const cleanText = responseText.replace(/```(?:json)?\s*\n?[\s\S]*?```/g, '').trim()
        return { message: parsed.message || cleanText, actions: parsed.actions }
      }
    } catch (err) {
      console.warn('parseAIResponse: code fence contained invalid JSON', err)
    }
  }

  // Pattern 3: JSON object embedded inline in text (no fences)
  const inlineMatch = responseText.match(/(\{[\s\S]*"message"\s*:\s*"[\s\S]*?"actions"\s*:\s*\[[\s\S]*\]\s*\})/)
  if (inlineMatch) {
    try {
      const parsed = JSON.parse(inlineMatch[1])
      if (typeof parsed.message === 'string' && Array.isArray(parsed.actions)) {
        return { message: parsed.message, actions: parsed.actions }
      }
    } catch (err) {
      console.warn('parseAIResponse: inline JSON extraction failed', err)
    }
  }

  // Fallback: strip any leftover code fences from display
  const cleanMessage = responseText.replace(/```(?:json)?\s*\n?[\s\S]*?```/g, '').trim()
  return { message: cleanMessage || responseText, actions: [] }
}
