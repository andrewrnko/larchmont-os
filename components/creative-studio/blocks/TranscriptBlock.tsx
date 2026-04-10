// Transcript block — paste transcripts from audio files.
// Title + source label + large text area.

'use client'

import { useRef } from 'react'
import { useCanvasStore } from '../store'
import type { TranscriptBlock } from '../types'
import { BlockWrapper } from '../BlockWrapper'
import { FileAudio } from 'lucide-react'
import { useSlashMenu } from '../SlashMenu'

interface Props {
  block: TranscriptBlock
  onContextMenu?: (e: React.MouseEvent) => void
}

export function TranscriptBlockView({ block, onContextMenu }: Props) {
  const updateBlock = useCanvasStore((s) => s.updateBlock)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const { handleKeyDown, menu } = useSlashMenu(taRef, (val) => updateBlock(block.id, { transcript: val }))

  return (
    <BlockWrapper block={block} kind="transcript" onContextMenu={onContextMenu}>
      <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#0e0e0d] shadow-lg">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-[#2a2a2a] bg-[#141412] px-4 py-3">
          <FileAudio size={15} className="text-amber-500" />
          <input
            className="flex-1 bg-transparent text-[13px] font-semibold text-white outline-none"
            defaultValue={block.title}
            placeholder="Transcript title…"
            onBlur={(e) => updateBlock(block.id, { title: e.target.value })}
          />
        </div>

        {/* Source */}
        <div className="border-b border-[#1a1a1a] px-4 py-1.5">
          <input
            className="w-full bg-transparent text-[13px] text-neutral-500 outline-none placeholder:text-neutral-600"
            defaultValue={block.source ?? ''}
            placeholder="Source: e.g. Client call, Podcast ep 12…"
            onBlur={(e) => updateBlock(block.id, { source: e.target.value })}
          />
        </div>

        {/* Transcript body */}
        <textarea
          ref={taRef}
          className="flex-1 resize-none bg-transparent p-4 text-[13px] leading-[1.5] text-neutral-300 outline-none placeholder:text-neutral-600"
          defaultValue={block.transcript}
          placeholder="Paste your transcript here… (type / for commands)"
          onBlur={(e) => updateBlock(block.id, { transcript: e.target.value })}
          onKeyDown={handleKeyDown}
        />
      </div>
      {menu}
    </BlockWrapper>
  )
}
