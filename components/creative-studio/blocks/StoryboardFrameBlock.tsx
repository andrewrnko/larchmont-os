// Storyboard frame: image | notes split. Number badge. Frames stored inside one block.

'use client'

import { useRef } from 'react'
import { useCanvasStore } from '../store'
import type { StoryboardBlock } from '../types'
import { BlockWrapper } from '../BlockWrapper'
import { uid } from '../store'
import { Plus, Film } from 'lucide-react'

interface Props {
  block: StoryboardBlock
  onContextMenu?: (e: React.MouseEvent) => void
}

export function StoryboardFrameBlock({ block, onContextMenu }: Props) {
  const updateBlock = useCanvasStore((s) => s.updateBlock)
  const seqRef = useRef(false)

  const setFrames = (fn: (frames: typeof block.frames) => typeof block.frames) => {
    updateBlock(block.id, { frames: fn(block.frames) })
  }

  const addFrame = () => {
    setFrames((f) => [
      ...f,
      { id: uid(), label: `Frame ${String(f.length + 1).padStart(2, '0')}`, notes: '', order: f.length },
    ])
  }

  const sequence = () => {
    // Simple flag: widen block horizontally based on frame count
    if (!seqRef.current) {
      updateBlock(block.id, { w: Math.max(block.w, block.frames.length * 240 + 24), y: 50 })
      seqRef.current = true
    } else {
      seqRef.current = false
    }
  }

  const loadImage = (frameId: string, file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      setFrames((f) => f.map((fr) => (fr.id === frameId ? { ...fr, image: reader.result as string } : fr)))
    }
    reader.readAsDataURL(file)
  }

  return (
    <BlockWrapper block={block} kind="storyboard" onContextMenu={onContextMenu}>
      <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-[#2a2a2a] bg-[#141412] shadow-lg">
        <div data-no-drag className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#1a1a18] px-2 py-1">
          <span className="font-mono text-[11px] text-amber-400">STORYBOARD</span>
          <div className="flex gap-1">
            <button
              className="flex items-center gap-1 rounded bg-[#2a2a2a] px-2 py-0.5 text-[10px] text-white hover:bg-[#3a3a3a]"
              onClick={(e) => {
                e.stopPropagation()
                sequence()
              }}
            >
              <Film size={10} /> Sequence
            </button>
            <button
              className="flex items-center gap-1 rounded bg-amber-600 px-2 py-0.5 text-[10px] text-black hover:bg-amber-500"
              onClick={(e) => {
                e.stopPropagation()
                addFrame()
              }}
            >
              <Plus size={10} /> Frame
            </button>
          </div>
        </div>
        <div data-no-drag className="flex flex-1 gap-2 overflow-auto p-2">
          {block.frames.map((frame, idx) => (
            <div key={frame.id} className="flex w-56 shrink-0 flex-col rounded border border-[#2a2a2a] bg-[#0e0e0d]">
              <div className="flex items-center justify-between border-b border-[#2a2a2a] px-2 py-1">
                <span className="font-mono text-[10px] text-amber-500">FRAME {String(idx + 1).padStart(2, '0')}</span>
              </div>
              <div className="flex flex-1 gap-1 p-1">
                <label
                  className="relative flex h-full w-1/2 cursor-pointer items-center justify-center overflow-hidden rounded bg-black/40 text-[10px] text-neutral-600"
                  onDrop={(e) => {
                    e.preventDefault()
                    const f = e.dataTransfer.files[0]
                    if (f) loadImage(frame.id, f)
                  }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  {frame.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={frame.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    'drop image'
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => e.target.files?.[0] && loadImage(frame.id, e.target.files[0])}
                  />
                </label>
                <textarea
                  className="h-full w-1/2 resize-none rounded bg-black/40 p-1 text-[11px] text-white outline-none"
                  placeholder="notes…"
                  defaultValue={frame.notes}
                  onBlur={(e) =>
                    setFrames((f) => f.map((fr) => (fr.id === frame.id ? { ...fr, notes: e.target.value } : fr)))
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </BlockWrapper>
  )
}
