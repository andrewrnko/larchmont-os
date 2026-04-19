// Floating left toolbar — single scrollable column of icons with thin
// dividers between logical groups. Tooltips render into a document.body
// portal so they aren't clipped by the toolbar's own overflow context.

'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  MousePointer2, Hand, Type, StickyNote, ImageIcon, Film, GitBranch,
  FileText, Link2, FileAudio, Bot, CheckSquare, MessageSquare,
  Circle, Square, CalendarRange,
} from 'lucide-react'
import type { BlockKind } from './types'

export type ToolId = 'select' | 'pan' | BlockKind | 'connector' | 'comment'

interface ToolDef {
  kind: 'tool'
  id: ToolId
  label: string
  shortcut?: string
  desc: string
  icon: typeof Type
  stub?: boolean
}

interface DividerDef {
  kind: 'divider'
}

type ToolbarItem = ToolDef | DividerDef

// Flat list. Dividers land exactly where the spec asks for them:
// after pan (navigation), after rectangle/group (basic shapes),
// after page block (content nodes), after task board (productivity).
const ITEMS: ToolbarItem[] = [
  { kind: 'tool', id: 'select', label: 'Select',     shortcut: 'V', desc: 'Click blocks to select, drag to move',           icon: MousePointer2 },
  { kind: 'tool', id: 'pan',    label: 'Pan',        shortcut: 'H', desc: 'Drag to pan around the canvas',                  icon: Hand },
  { kind: 'divider' },
  { kind: 'tool', id: 'text',   label: 'Text Note',  shortcut: 'T', desc: 'Rich text block with formatting toolbar',        icon: Type },
  { kind: 'tool', id: 'sticky', label: 'Sticky Note',shortcut: 'S', desc: 'Quick note with color coding',                   icon: StickyNote },
  { kind: 'tool', id: 'image',  label: 'Image',      shortcut: 'I', desc: 'Drop, paste, or upload an image',                icon: ImageIcon },
  { kind: 'tool', id: 'group',  label: 'Rectangle',                 desc: 'Container to group nodes together',              icon: Square },
  { kind: 'divider' },
  { kind: 'tool', id: 'mindmap',         label: 'Mind Map',  shortcut: 'M', desc: 'Visual brainstorm — click nodes to write notes', icon: GitBranch },
  { kind: 'tool', id: 'connector',       label: 'Connector', shortcut: 'L', desc: 'Draw lines between blocks (also hover edges)',   icon: Link2 },
  { kind: 'tool', id: 'transcript',      label: 'Transcript',shortcut: 'R', desc: 'Paste audio transcripts for reference',          icon: FileAudio },
  { kind: 'tool', id: 'standalone-node', label: 'Node',      shortcut: 'N', desc: 'Standalone mind map node on the canvas',         icon: Circle },
  { kind: 'tool', id: 'comment',         label: 'Comment',   shortcut: 'C', desc: 'Drop annotation pins on the canvas',             icon: MessageSquare },
  { kind: 'tool', id: 'page',            label: 'Page',      shortcut: 'G', desc: 'Full document with headings, lists, media',      icon: FileText },
  { kind: 'divider' },
  { kind: 'tool', id: 'planner-block',   label: 'Planner',   shortcut: 'P', desc: 'Week + day planner inline on the canvas',        icon: CalendarRange },
  { kind: 'tool', id: 'tasks',           label: 'Tasks',     shortcut: 'K', desc: 'Task list with checkboxes and focus timer',      icon: CheckSquare },
  { kind: 'divider' },
  { kind: 'tool', id: 'assistant',       label: 'AI Assistant', shortcut: 'A', desc: 'Chat with AI about connected blocks',         icon: Bot },
  { kind: 'tool', id: 'storyboard',      label: 'Storyboard',   shortcut: 'F', desc: 'Frame-by-frame layout for video/ad planning', icon: Film },
]

// Build keymap once at module scope — shortcuts fire regardless of scroll
// position or which icons are currently visible in the viewport.
const KEY_TO_TOOL: Record<string, ToolId> = (() => {
  const map: Record<string, ToolId> = {}
  for (const it of ITEMS) {
    if (it.kind === 'tool' && it.shortcut) map[it.shortcut.toLowerCase()] = it.id
  }
  return map
})()

interface Props {
  active: ToolId
  setActive: (t: ToolId) => void
  hidden?: boolean
}

export function Toolbar({ active, setActive, hidden }: Props) {
  const [hover, setHover] = useState<{ tool: ToolDef; rect: DOMRect } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const id = KEY_TO_TOOL[e.key.toLowerCase()]
      if (id) setActive(id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setActive])

  return (
    <>
      <div
        className="absolute left-3 top-1/2 z-30 flex w-[52px] flex-col gap-1 overflow-y-auto rounded-xl border p-1.5 shadow-2xl backdrop-blur [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
        style={{
          background: 'color-mix(in srgb, var(--bg2) 95%, transparent)',
          borderColor: 'var(--border)',
          maxHeight: 'calc(100vh - 120px)',
          transform: hidden
            ? 'translateY(-50%) translateX(calc(-100% - 16px))'
            : 'translateY(-50%) translateX(0)',
          transition: 'transform 200ms ease-in-out',
        }}
      >
        {ITEMS.map((item, i) => {
          if (item.kind === 'divider') {
            return (
              <div
                key={`div-${i}`}
                className="my-0.5 h-px w-full shrink-0"
                style={{ background: 'var(--border)' }}
              />
            )
          }
          return (
            <ToolButton
              key={item.id}
              tool={item}
              active={active === item.id && !item.stub}
              onActivate={() => !item.stub && setActive(item.id)}
              onHoverChange={(rect) =>
                rect ? setHover({ tool: item, rect }) : setHover((h) => (h?.tool.id === item.id ? null : h))
              }
            />
          )
        })}
      </div>

      {hover && <TooltipPortal tool={hover.tool} rect={hover.rect} />}
    </>
  )
}

function ToolButton({
  tool,
  active,
  onActivate,
  onHoverChange,
}: {
  tool: ToolDef
  active: boolean
  onActivate: () => void
  onHoverChange: (rect: DOMRect | null) => void
}) {
  const Icon = tool.icon
  const btnRef = useRef<HTMLButtonElement | null>(null)

  return (
    <button
      ref={btnRef}
      disabled={tool.stub}
      onClick={onActivate}
      onMouseEnter={() => {
        if (btnRef.current) onHoverChange(btnRef.current.getBoundingClientRect())
      }}
      onMouseLeave={() => onHoverChange(null)}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-all duration-150 ease-out ${
        active ? '' : 'hover:scale-[1.04]'
      } ${tool.stub ? 'opacity-30' : ''}`}
      style={{
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? 'var(--accent-fg)' : 'var(--text1)',
      }}
      onMouseOver={(e) => {
        if (!active && !tool.stub) {
          e.currentTarget.style.background = 'var(--bg3)'
          e.currentTarget.style.color = 'var(--text0)'
        }
      }}
      onMouseOut={(e) => {
        if (!active && !tool.stub) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text1)'
        }
      }}
    >
      <Icon size={18} strokeWidth={2} />
    </button>
  )
}

function TooltipPortal({ tool, rect }: { tool: ToolDef; rect: DOMRect }) {
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState({ x: rect.right + 8, y: rect.top + rect.height / 2 })
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const vh = window.innerHeight
    const { offsetHeight: h } = el
    let y = rect.top + rect.height / 2
    if (y + h / 2 > vh - 8) y = vh - h / 2 - 8
    if (y - h / 2 < 8) y = h / 2 + 8
    setPos({ x: rect.right + 8, y })
  }, [rect])

  if (!mounted || typeof document === 'undefined') return null

  const title = tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label

  return createPortal(
    <div
      ref={ref}
      className="pointer-events-none fixed z-[500] whitespace-nowrap"
      style={{ left: pos.x, top: pos.y, transform: 'translateY(-50%)' }}
    >
      <div
        className="rounded-md border px-3 py-2 shadow-xl"
        style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
      >
        <div className="text-[13px] font-medium" style={{ color: 'var(--text0)' }}>
          {title}
        </div>
        <div className="mt-0.5 text-[12px]" style={{ color: 'var(--text2)' }}>
          {tool.desc}
        </div>
      </div>
    </div>,
    document.body,
  )
}
