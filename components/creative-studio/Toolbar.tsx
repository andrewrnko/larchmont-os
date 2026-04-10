// Floating left toolbar: tools + keyboard shortcuts.

'use client'

import { useEffect } from 'react'
import {
  MousePointer2, Hand, Type, StickyNote, ImageIcon, Film, GitBranch,
  FileText, Link2, Clock, Globe, SquareDashed,
} from 'lucide-react'
import type { BlockKind } from './types'

export type ToolId = 'select' | 'pan' | BlockKind | 'connector'

interface Props {
  active: ToolId
  setActive: (t: ToolId) => void
}

const TOOLS: { id: ToolId; label: string; shortcut: string; icon: typeof Type; stub?: boolean }[] = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2 },
  { id: 'pan', label: 'Pan', shortcut: 'H', icon: Hand },
  { id: 'text', label: 'Text Note', shortcut: 'T', icon: Type },
  { id: 'sticky', label: 'Sticky', shortcut: 'S', icon: StickyNote },
  { id: 'image', label: 'Image', shortcut: 'I', icon: ImageIcon },
  { id: 'storyboard', label: 'Storyboard', shortcut: 'F', icon: Film },
  { id: 'mindmap', label: 'Mind Map', shortcut: 'M', icon: GitBranch },
  { id: 'page', label: 'Page', shortcut: 'P', icon: FileText },
  { id: 'connector', label: 'Connector', shortcut: 'C', icon: Link2 },
  { id: 'timeline', label: 'Timeline (soon)', shortcut: '', icon: Clock, stub: true },
  { id: 'embed', label: 'Embed (soon)', shortcut: '', icon: Globe, stub: true },
  { id: 'section', label: 'Section (soon)', shortcut: '', icon: SquareDashed, stub: true },
]

export function Toolbar({ active, setActive }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const map: Record<string, ToolId> = {
        v: 'select', h: 'pan', t: 'text', s: 'sticky', i: 'image',
        f: 'storyboard', m: 'mindmap', p: 'page', c: 'connector',
      }
      const id = map[e.key.toLowerCase()]
      if (id) setActive(id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setActive])

  return (
    <div className="absolute left-3 top-1/2 z-30 -translate-y-1/2 flex flex-col gap-1 rounded-lg border border-[#2a2a2a] bg-[#141414]/95 p-1 shadow-2xl backdrop-blur">
      {TOOLS.map((t) => {
        const Icon = t.icon
        const isActive = active === t.id && !t.stub
        return (
          <button
            key={t.id}
            title={`${t.label}${t.shortcut ? ` (${t.shortcut})` : ''}`}
            disabled={t.stub}
            onClick={() => !t.stub && setActive(t.id)}
            className={`flex h-9 w-9 items-center justify-center rounded transition-colors ${
              isActive ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:bg-[#222] hover:text-white'
            } ${t.stub ? 'opacity-30' : ''}`}
          >
            <Icon size={16} />
          </button>
        )
      })}
    </div>
  )
}
