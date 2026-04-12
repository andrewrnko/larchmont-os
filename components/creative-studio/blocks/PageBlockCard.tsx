// Page block card — icon picker, color palette, deadline, "Open →".

'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useCanvasStore } from '../store'
import type { PageBlock } from '../types'
import { BlockWrapper } from '../BlockWrapper'
import { ArrowRight, Calendar, Palette } from 'lucide-react'

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })

const COLORS = [
  '#1a1a1a', '#2a1f14', '#1b2a1f', '#1a1f2a',
  '#2a1a1f', '#2a261a', '#241a2a', '#3a1a0a',
]

interface Props {
  block: PageBlock
  onContextMenu?: (e: React.MouseEvent) => void
}

export function PageBlockCard({ block, onContextMenu }: Props) {
  const updateBlock = useCanvasStore((s) => s.updateBlock)
  const openPage = useCanvasStore((s) => s.openPage)
  const lastCreated = useCanvasStore((s) => s.lastCreatedBlockId)
  const clearLastCreated = useCanvasStore((s) => s.clearLastCreated)
  const titleRef = useRef<HTMLInputElement>(null)
  const [iconOpen, setIconOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)

  // Auto-focus title on fresh creation.
  useEffect(() => {
    if (lastCreated === block.id && titleRef.current) {
      clearLastCreated()
      setTimeout(() => {
        titleRef.current?.focus()
        titleRef.current?.select()
      }, 60)
    }
  }, [lastCreated, block.id, clearLastCreated])

  return (
    <BlockWrapper block={block} kind="page" onContextMenu={onContextMenu}>
      <div
        className="relative flex h-full w-full flex-col justify-between rounded-lg border p-4 shadow-lg"
        style={{
          background: block.color ?? 'var(--bg2)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-start gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIconOpen((v) => !v)
            }}
            className="text-2xl hover:scale-110 transition-transform"
            title="Change icon"
          >
            {block.icon}
          </button>
          <input
            ref={titleRef}
            className="flex-1 bg-transparent text-[15px] font-semibold outline-none"
            style={{ color: '#f0ede8' }}
            defaultValue={block.title}
            onBlur={(e) => updateBlock(block.id, { title: e.target.value })}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </div>

        {block.deadline && (
          <div className="mt-1 flex items-center gap-1 text-[13px] text-[color:var(--cs-accent2)]">
            <Calendar size={10} /> Due {block.deadline}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-1 opacity-0 group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setColorOpen((v) => !v)
              }}
              className="rounded bg-black/40 p-1 text-[#c8c4bc] hover:text-white"
              title="Change color"
            >
              <Palette size={10} />
            </button>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              openPage(block.id)
            }}
            className="flex items-center gap-1 rounded bg-[color:var(--cs-accent)]/20 px-2 py-1 text-[14px] text-[color:var(--cs-accent2)] hover:bg-[color:var(--cs-accent)]/40"
          >
            Open <ArrowRight size={10} />
          </button>
        </div>

        {iconOpen && (
          <div
            className="absolute left-0 top-full z-50 mt-1"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <EmojiPicker
              onEmojiClick={(d) => {
                updateBlock(block.id, { icon: d.emoji })
                setIconOpen(false)
              }}
              width={260}
              height={320}
            />
          </div>
        )}

        {colorOpen && (
          <div
            className="absolute left-0 top-full z-50 mt-1 flex flex-wrap gap-1 rounded bg-black/90 p-2"
            style={{ width: 120 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {COLORS.map((c) => (
              <button
                key={c}
                className="h-5 w-5 rounded border border-white/10"
                style={{ background: c }}
                onClick={() => {
                  updateBlock(block.id, { color: c })
                  setColorOpen(false)
                }}
              />
            ))}
          </div>
        )}
      </div>
    </BlockWrapper>
  )
}
