// Creative Studio — shared types
// All canvas blocks inherit from BaseBlock. Position is in canvas (world) space.

export type BlockKind =
  | 'text'
  | 'sticky'
  | 'image'
  | 'storyboard'
  | 'mindmap'
  | 'page'
  | 'timeline'
  | 'embed'
  | 'section'
  | 'transcript'
  | 'assistant'
  | 'tasks'

export interface BaseBlock {
  id: string
  kind: BlockKind
  x: number
  y: number
  w: number
  h: number
  z: number
  locked?: boolean
  rotation?: number
}

export interface TextBlock extends BaseBlock {
  kind: 'text'
  html: string
  bg: string // hex
  autoHeight: boolean
}

export interface StickyBlock extends BaseBlock {
  kind: 'sticky'
  text: string
  color: 'yellow' | 'pink' | 'blue' | 'green' | 'orange'
}

export interface ImageBlock extends BaseBlock {
  kind: 'image'
  src: string // data url or http
  caption?: string
  lockAspect: boolean
  naturalRatio?: number
}

export interface StoryboardFrame {
  id: string
  label: string
  image?: string
  notes: string
  detailedNotes?: string
  order: number
}

export interface StoryboardBlock extends BaseBlock {
  kind: 'storyboard'
  frames: StoryboardFrame[]
}

export interface MindMapNode {
  id: string
  parentId: string | null
  label: string
  // position relative to block origin
  dx: number
  dy: number
  shape: 'circle' | 'square' | 'pill'
  color: string
  collapsed?: boolean
  notes?: string
}

export interface MindMapBlock extends BaseBlock {
  kind: 'mindmap'
  nodes: MindMapNode[]
}

export type SubPageBlock =
  | { id: string; type: 'h1' | 'h2' | 'h3' | 'p' | 'bullet' | 'numbered' | 'todo' | 'divider'; text: string; checked?: boolean }
  | { id: string; type: 'image'; src: string }

export interface PageBlock extends BaseBlock {
  kind: 'page'
  title: string
  icon: string
  color?: string
  deadline?: string // ISO date
  content: SubPageBlock[]
}

export interface TranscriptBlock extends BaseBlock {
  kind: 'transcript'
  title: string
  transcript: string
  source?: string // e.g. "Client call 04/09", "Podcast ep 12"
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface AssistantBlock extends BaseBlock {
  kind: 'assistant'
  messages: ChatMessage[]
  label?: string
}

export interface TaskItem {
  id: string
  title: string
  done: boolean
  priority?: 1 | 2 | 3
  createdAt: number
  completedAt?: number
}

export interface TasksBlock extends BaseBlock {
  kind: 'tasks'
  label: string
  taskItems: TaskItem[]
}

// Stubs (placeholders this session)
export interface TimelineBlock extends BaseBlock {
  kind: 'timeline'
}
export interface EmbedBlock extends BaseBlock {
  kind: 'embed'
  url?: string
  title?: string
  description?: string
  favicon?: string
  image?: string
}
export interface SectionBlock extends BaseBlock {
  kind: 'section'
  label?: string
}

export type AnyBlock =
  | TextBlock
  | StickyBlock
  | ImageBlock
  | StoryboardBlock
  | MindMapBlock
  | PageBlock
  | TimelineBlock
  | EmbedBlock
  | SectionBlock
  | TranscriptBlock
  | AssistantBlock
  | TasksBlock

export interface Connector {
  id: string
  fromBlockId: string
  toBlockId: string
  style: 'straight' | 'curved' | 'elbow'
  arrow: 'none' | 'one' | 'both'
  label?: string
  color: string
  weight: number
}

export interface Board {
  id: string
  name: string
  icon: string // emoji
  parentId: string | null
  blocks: AnyBlock[]
  connectors: Connector[]
  viewport: { x: number; y: number; scale: number }
  createdAt: number
  updatedAt: number
}

// Day Hyperplanner types
export interface PriorityTask {
  id: string
  rank: 1 | 2 | 3
  title: string
  estimateMin?: number
  dueAt?: number
  done: boolean
  createdAt: number
  completedAt?: number
}

export interface LogEntry {
  date: string // YYYY-MM-DD
  tasks: PriorityTask[]
}

export interface FocusSession {
  taskId: string
  startedAt: number
  durationMin: number
  active: boolean
}
