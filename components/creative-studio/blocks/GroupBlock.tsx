// Group block — a transparent container that holds standalone nodes.
// Uses BlockWrapper for drag/resize but caps z-index at 10 so it never
// paints above connectors (z=25) or nodes (z=50).

'use client'

import type { GroupBlock } from '../types'
import { BlockWrapper } from '../BlockWrapper'

interface Props {
  block: GroupBlock
  onContextMenu?: (e: React.MouseEvent) => void
}

export function GroupBlockView({ block, onContextMenu }: Props) {
  // Cap z-index so groups always stay behind connectors and nodes
  const cappedBlock = { ...block, z: Math.min(block.z, 10) }

  return (
    <BlockWrapper block={cappedBlock} kind="group" passThrough onContextMenu={onContextMenu}>
      <div
        className="relative h-full w-full rounded-lg border shadow-lg"
        style={{
          overflow: 'visible',
          background: 'var(--bg1)',
          borderColor: 'var(--border)',
          pointerEvents: 'none',
        }}
      >
        <div
          className="absolute left-3 top-2 z-10 font-mono text-[10px] font-medium uppercase tracking-[0.1em]"
          style={{ color: 'var(--cs-accent)', pointerEvents: 'auto' }}
        >
          {block.label}
        </div>
      </div>
    </BlockWrapper>
  )
}
