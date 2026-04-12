// Floating left toolbar with rich hover tooltips showing what each tool does.

'use client'

import { useEffect, useState } from 'react'
import {
  MousePointer2, Hand, Type, StickyNote, ImageIcon, Film, GitBranch,
  FileText, Link2, FileAudio, Bot, CheckSquare,
} from 'lucide-react'
import type { BlockKind } from './types'

export type ToolId = 'select' | 'pan' | BlockKind | 'connector'

interface Props {
  active: ToolId
  setActive: (t: ToolId) => void
}

const TOOLS: { id: ToolId; label: string; shortcut: string; desc: string; icon: typeof Type; stub?: boolean }[] = [
  { id: 'select',     label: 'Select',        shortcut: 'V', desc: 'Click blocks to select, drag to move',           icon: MousePointer2 },
  { id: 'pan',        label: 'Pan',            shortcut: 'H', desc: 'Drag to pan around the canvas',                  icon: Hand },
  { id: 'text',       label: 'Text Note',      shortcut: 'T', desc: 'Rich text block with formatting toolbar',        icon: Type },
  { id: 'sticky',     label: 'Sticky Note',    shortcut: 'S', desc: 'Quick note with color coding',                   icon: StickyNote },
  { id: 'image',      label: 'Image',          shortcut: 'I', desc: 'Drop, paste, or upload an image',                icon: ImageIcon },
  { id: 'storyboard', label: 'Storyboard',     shortcut: 'F', desc: 'Frame-by-frame layout for video/ad planning',    icon: Film },
  { id: 'mindmap',    label: 'Mind Map',        shortcut: 'M', desc: 'Visual brainstorm — click nodes to write notes', icon: GitBranch },
  { id: 'page',       label: 'Page',            shortcut: 'P', desc: 'Full document with headings, lists, media',      icon: FileText },
  { id: 'tasks',      label: 'Tasks',             shortcut: 'K', desc: 'Task list with checkboxes and focus timer',      icon: CheckSquare },
  { id: 'connector',  label: 'Connector',       shortcut: 'C', desc: 'Draw lines between blocks (also hover edges)',   icon: Link2 },
  { id: 'transcript', label: 'Transcript',      shortcut: 'R', desc: 'Paste audio transcripts for reference',          icon: FileAudio },
  { id: 'assistant',  label: 'AI Assistant',    shortcut: 'A', desc: 'Chat with AI about connected blocks',            icon: Bot },
]

export function Toolbar({ active, setActive }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const map: Record<string, ToolId> = {
        v: 'select', h: 'pan', t: 'text', s: 'sticky', i: 'image',
        f: 'storyboard', m: 'mindmap', p: 'page', c: 'connector',
        r: 'transcript', a: 'assistant', k: 'tasks',
      }
      const id = map[e.key.toLowerCase()]
      if (id) setActive(id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setActive])

  return (
    <div
      className="absolute left-3 top-1/2 z-30 -translate-y-1/2 flex flex-col gap-1.5 rounded-xl border p-1.5 shadow-2xl backdrop-blur"
      style={{
        background: 'color-mix(in srgb, var(--bg2) 95%, transparent)',
        borderColor: 'var(--border)',
      }}
    >
      {TOOLS.map((t) => {
        const Icon = t.icon
        const isActive = active === t.id && !t.stub
        const isHovered = hoverId === t.id
        return (
          <div key={t.id} className="relative">
            <button
              disabled={t.stub}
              onClick={() => !t.stub && setActive(t.id)}
              onMouseEnter={() => setHoverId(t.id)}
              onMouseLeave={() => setHoverId(null)}
              className={`flex h-11 w-11 items-center justify-center rounded-lg transition-all duration-150 ease-out ${
                isActive ? 'scale-[1.02]' : 'hover:scale-[1.04]'
              } ${t.stub ? 'opacity-30' : ''}`}
              style={{
                background: isActive ? 'var(--cs-accent)' : 'transparent',
                color: isActive ? '#0a0a09' : 'var(--text1)',
              }}
              onMouseOver={(e) => {
                if (!isActive && !t.stub) {
                  e.currentTarget.style.background = 'var(--bg3)'
                  e.currentTarget.style.color = 'var(--text0)'
                }
              }}
              onMouseOut={(e) => {
                if (!isActive && !t.stub) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text1)'
                }
              }}
            >
              <Icon size={20} strokeWidth={2} />
            </button>
            {/* Rich tooltip */}
            {isHovered && !t.stub && (
              <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap">
                <div
                  className="rounded-md border px-3 py-2 shadow-xl"
                  style={{
                    background: 'var(--bg2)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-medium" style={{ color: 'var(--text0)' }}>
                      {t.label}
                    </span>
                    {t.shortcut && (
                      <span
                        className="rounded px-1.5 py-0.5 font-mono text-[13px]"
                        style={{ background: 'var(--bg4)', color: 'var(--text1)' }}
                      >
                        {t.shortcut}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[13px]" style={{ color: 'var(--text2)' }}>
                    {t.desc}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
