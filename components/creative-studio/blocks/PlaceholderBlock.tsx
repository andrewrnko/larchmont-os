// Stubs for Timeline / Embed / Section — ship with functional shell,
// full implementation in next session.

'use client'

import type { AnyBlock } from '../types'
import { BlockWrapper } from '../BlockWrapper'

interface Props {
  block: AnyBlock
  label: string
  onContextMenu?: (e: React.MouseEvent) => void
}

export function PlaceholderBlock({ block, label, onContextMenu }: Props) {
  return (
    <BlockWrapper block={block} kind={block.kind} onContextMenu={onContextMenu}>
      <div className="flex h-full w-full flex-col items-center justify-center rounded-md border border-dashed border-[color:rgba(255,255,255,0.12)] bg-[#1c1c1a] text-center">
        <div className="font-mono text-[13px] font-medium uppercase tracking-[0.06em] text-[color:var(--cs-accent)]">{label}</div>
        <div className="mt-1 text-[15px] text-[#888780]">Coming next session</div>
      </div>
    </BlockWrapper>
  )
}
