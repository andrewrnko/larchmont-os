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
      <div className="flex h-full w-full flex-col items-center justify-center rounded-md border border-dashed border-[#3a3a3a] bg-[#141414] text-center">
        <div className="font-mono text-[11px] uppercase tracking-wider text-amber-500">{label}</div>
        <div className="mt-1 text-[11px] text-neutral-500">Coming next session</div>
      </div>
    </BlockWrapper>
  )
}
