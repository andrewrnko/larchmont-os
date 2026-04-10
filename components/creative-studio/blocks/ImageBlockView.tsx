// Image block: drag-drop, paste, URL fallback, optional caption, aspect lock.

'use client'

import { useRef, useState } from 'react'
import { Lock, Unlock, Link as LinkIcon } from 'lucide-react'
import { useCanvasStore } from '../store'
import type { ImageBlock } from '../types'
import { BlockWrapper } from '../BlockWrapper'

interface Props {
  block: ImageBlock
  onContextMenu?: (e: React.MouseEvent) => void
}

export function ImageBlockView({ block, onContextMenu }: Props) {
  const updateBlock = useCanvasStore((s) => s.updateBlock)
  const fileRef = useRef<HTMLInputElement>(null)
  const [showUrl, setShowUrl] = useState(false)
  const [editCaption, setEditCaption] = useState(false)

  const loadFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const src = reader.result as string
      const img = new Image()
      img.onload = () => {
        updateBlock(block.id, { src, naturalRatio: img.width / img.height })
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  }

  return (
    <BlockWrapper
      block={block}
      kind="image"
      onContextMenu={onContextMenu}
      lockAspect={block.lockAspect}
      ratio={block.naturalRatio}
    >
      <div
        className="relative flex h-full w-full flex-col overflow-hidden rounded-md border border-[#2a2a2a] bg-[#1a1a1a] shadow-lg"
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (file && file.type.startsWith('image/')) loadFile(file)
        }}
        onDragOver={(e) => e.preventDefault()}
      >
        <div data-no-drag className="absolute right-1 top-1 z-10 flex gap-1 opacity-0 group-hover:opacity-100">
          <button
            className="rounded bg-black/60 p-1 text-white hover:bg-black/80"
            title={block.lockAspect ? 'Unlock aspect' : 'Lock aspect'}
            onClick={(e) => {
              e.stopPropagation()
              updateBlock(block.id, { lockAspect: !block.lockAspect })
            }}
          >
            {block.lockAspect ? <Lock size={12} /> : <Unlock size={12} />}
          </button>
          <button
            className="rounded bg-black/60 p-1 text-white hover:bg-black/80"
            title="Set URL"
            onClick={(e) => {
              e.stopPropagation()
              setShowUrl((v) => !v)
            }}
          >
            <LinkIcon size={12} />
          </button>
        </div>

        {showUrl && (
          <div data-no-drag className="absolute right-1 top-8 z-20 rounded bg-black/90 p-1">
            <input
              autoFocus
              className="w-48 bg-black text-xs text-white outline-none"
              placeholder="https://..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateBlock(block.id, { src: (e.currentTarget as HTMLInputElement).value })
                  setShowUrl(false)
                }
              }}
            />
          </div>
        )}

        <div className="relative flex-1 overflow-hidden bg-black/40">
          {block.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={block.src} alt="" className="h-full w-full object-contain" draggable={false} />
          ) : (
            <button
              data-no-drag
              className="flex h-full w-full items-center justify-center text-xs text-neutral-500 hover:text-neutral-300"
              onClick={(e) => {
                e.stopPropagation()
                fileRef.current?.click()
              }}
            >
              Drop, paste or click to add image
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) loadFile(f)
            }}
          />
        </div>

        <div
          data-no-drag
          className="border-t border-[#2a2a2a] bg-[#111] px-2 py-1 text-[11px] text-neutral-400"
          onDoubleClick={() => setEditCaption(true)}
        >
          {editCaption ? (
            <input
              autoFocus
              className="w-full bg-transparent outline-none"
              defaultValue={block.caption ?? ''}
              onBlur={(e) => {
                updateBlock(block.id, { caption: e.target.value })
                setEditCaption(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
            />
          ) : (
            block.caption || <span className="text-neutral-600">Double-click to add caption</span>
          )}
        </div>
      </div>
    </BlockWrapper>
  )
}
