// Sticky note: plain text with slash commands, 6 colors, compact.

'use client'

import { useRef, useState } from 'react'
import { useCanvasStore } from '../store'
import type { StickyBlock } from '../types'
import { BlockWrapper } from '../BlockWrapper'
import { useSlashMenu } from '../SlashMenu'

const COLORS: Record<string, string> = {
  yellow: '#f5d97a',
  pink: '#f59ec4',
  blue: '#8ec4f5',
  green: '#9ed8a0',
  orange: '#f5b07a',
  purple: '#c79ef5',
}

interface Props {
  block: StickyBlock
  onContextMenu?: (e: React.MouseEvent) => void
}

export function StickyNoteBlock({ block, onContextMenu }: Props) {
  const updateBlock = useCanvasStore((s) => s.updateBlock)
  const bg = COLORS[block.color] || COLORS.yellow
  const taRef = useRef<HTMLTextAreaElement>(null)
  const { handleKeyDown, menu } = useSlashMenu(taRef, (val) => updateBlock(block.id, { text: val }))

  return (
    <BlockWrapper block={block} kind="sticky" onContextMenu={onContextMenu}>
      <div
        className="relative h-full w-full rounded-sm shadow-lg"
        style={{ background: bg, boxShadow: '0 6px 14px rgba(0,0,0,0.35)' }}
      >
        <div className="absolute right-1 top-1 z-10 flex gap-0.5 opacity-0 group-hover:opacity-100">
          {(Object.keys(COLORS) as (keyof typeof COLORS)[]).map((c) => (
            <button
              key={c}
              className="h-3 w-3 rounded-full border border-black/20"
              style={{ background: COLORS[c] }}
              onClick={(e) => {
                e.stopPropagation()
                updateBlock(block.id, { color: c as StickyBlock['color'] })
              }}
            />
          ))}
        </div>
        <textarea
          ref={taRef}
          className="h-full w-full resize-none whitespace-pre-wrap break-words bg-transparent p-4 pt-6 text-[15px] leading-[1.5] text-black/80 outline-none placeholder:text-black/30"
          defaultValue={block.text}
          placeholder="Type / for commands…"
          onBlur={(e) => updateBlock(block.id, { text: e.target.value })}
          onKeyDown={handleKeyDown}
        />
      </div>
      {menu}
    </BlockWrapper>
  )
}
