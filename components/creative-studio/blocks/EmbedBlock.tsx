// Embed / Link preview block — shows OG title, description, image, favicon.

'use client'

import { useEffect, useState } from 'react'
import { useCanvasStore } from '../store'
import type { EmbedBlock } from '../types'
import { BlockWrapper } from '../BlockWrapper'
import { ExternalLink, Loader2 } from 'lucide-react'

interface Props {
  block: EmbedBlock
  onContextMenu?: (e: React.MouseEvent) => void
}

export function EmbedBlockView({ block, onContextMenu }: Props) {
  const updateBlock = useCanvasStore((s) => s.updateBlock)
  const [loading, setLoading] = useState(false)

  // Fetch preview when URL is set but title is missing
  useEffect(() => {
    if (block.url && !block.title) {
      setLoading(true)
      fetch('/api/creative-studio/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: block.url }),
      })
        .then((r) => r.json())
        .then((data) => {
          updateBlock(block.id, {
            title: data.title || new URL(block.url!).hostname,
            description: data.description || '',
            image: data.image || '',
            favicon: data.favicon || '',
          })
        })
        .catch(() => {
          updateBlock(block.id, { title: block.url })
        })
        .finally(() => setLoading(false))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.url])

  const hostname = block.url ? (() => { try { return new URL(block.url).hostname } catch { return '' } })() : ''

  return (
    <BlockWrapper block={block} kind="embed" onContextMenu={onContextMenu}>
      <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-[#2a2a2a] bg-[#111] shadow-lg">
        {block.url ? (
          <>
            {/* Content */}
            <div className="flex flex-1 flex-col justify-between p-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {block.favicon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={block.favicon} alt="" className="h-4 w-4 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  )}
                  <span className="text-[11px] text-neutral-500 truncate">{hostname}</span>
                </div>
                {loading ? (
                  <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                    <Loader2 size={12} className="animate-spin" /> Loading preview…
                  </div>
                ) : (
                  <>
                    <div className="text-[14px] font-medium text-white leading-snug line-clamp-2">
                      {block.title || hostname}
                    </div>
                    {block.description && (
                      <div className="mt-1 text-[11px] text-neutral-500 line-clamp-3 leading-relaxed">
                        {block.description}
                      </div>
                    )}
                  </>
                )}
              </div>
              <a
                href={block.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-1 self-start rounded bg-amber-600/20 px-2 py-1 text-[11px] text-amber-400 hover:bg-amber-600/40"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <ExternalLink size={9} /> Open link
              </a>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-[14px] text-neutral-500">
            Paste a URL to see a preview
          </div>
        )}
      </div>
    </BlockWrapper>
  )
}
