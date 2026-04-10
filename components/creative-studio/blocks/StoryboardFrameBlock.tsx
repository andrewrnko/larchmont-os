// Storyboard block — frames with image + notes.
// - Images use object-contain so they don't get cropped
// - Notes auto-format bullets: pressing Enter after "- " continues the bullet
// - Each frame has an "Open" button → full-page modal for detailed notes
// - Bigger text, scales better when block is resized

'use client'

import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useCanvasStore, uid } from '../store'
import type { StoryboardBlock, StoryboardFrame } from '../types'
import { BlockWrapper } from '../BlockWrapper'
import { Plus, Film, ArrowRight, X } from 'lucide-react'
import { useSlashMenu } from '../SlashMenu'

interface Props {
  block: StoryboardBlock
  onContextMenu?: (e: React.MouseEvent) => void
}

export function StoryboardFrameBlock({ block, onContextMenu }: Props) {
  const updateBlock = useCanvasStore((s) => s.updateBlock)
  const seqRef = useRef(false)
  const [openFrameId, setOpenFrameId] = useState<string | null>(null)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const activeNotesRef = useRef<HTMLTextAreaElement>(null)
  const { handleKeyDown: slashKeyDown, menu: slashMenu } = useSlashMenu(activeNotesRef, (val) => {
    // The active frame's notes updated — we persist on blur, this just keeps the ref in sync
  })

  useEffect(() => { setPortalTarget(document.body) }, [])

  const setFrames = (fn: (frames: StoryboardFrame[]) => StoryboardFrame[]) => {
    updateBlock(block.id, { frames: fn(block.frames) })
  }

  const addFrame = () => {
    setFrames((f) => [
      ...f,
      { id: uid(), label: `Frame ${String(f.length + 1).padStart(2, '0')}`, notes: '', order: f.length },
    ])
  }

  const sequence = () => {
    if (!seqRef.current) {
      updateBlock(block.id, { w: Math.max(block.w, block.frames.length * 280 + 32), y: 50 })
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

  // Auto-bullet: when user presses Enter and the current line starts with "- ", continue with "- "
  const handleNotesKey = (e: React.KeyboardEvent<HTMLTextAreaElement>, frameId: string) => {
    if (e.key === 'Enter') {
      const ta = e.currentTarget
      const val = ta.value
      const pos = ta.selectionStart
      const lineStart = val.lastIndexOf('\n', pos - 1) + 1
      const line = val.slice(lineStart, pos)
      if (line.startsWith('- ') && line.trim() !== '-') {
        e.preventDefault()
        const before = val.slice(0, pos)
        const after = val.slice(pos)
        const newVal = before + '\n- ' + after
        ta.value = newVal
        ta.selectionStart = ta.selectionEnd = pos + 3
        setFrames((f) => f.map((fr) => (fr.id === frameId ? { ...fr, notes: newVal } : fr)))
      }
    }
  }

  const openFrame = openFrameId ? block.frames.find((f) => f.id === openFrameId) : null

  return (
    <>
      <BlockWrapper block={block} kind="storyboard" onContextMenu={onContextMenu}>
        <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-[#2a2a2a] bg-[#141412] shadow-lg">
          {/* Header */}
          <div data-no-drag className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#1a1a18] px-4 py-2">
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-amber-500">Storyboard</span>
            <div className="flex gap-1">
              <button
                className="flex items-center gap-1 rounded bg-[#2a2a2a] px-2 py-1 text-[13px] text-white hover:bg-[#3a3a3a]"
                onClick={(e) => { e.stopPropagation(); sequence() }}
              >
                <Film size={11} /> Sequence
              </button>
              <button
                className="flex items-center gap-1 rounded bg-amber-600 px-2 py-1 text-[13px] text-black hover:bg-amber-500"
                onClick={(e) => { e.stopPropagation(); addFrame() }}
              >
                <Plus size={11} /> Frame
              </button>
            </div>
          </div>

          {/* Frames */}
          <div data-no-drag data-scrollable className="flex flex-1 gap-3 overflow-auto p-3">
            {block.frames.map((frame, idx) => (
              <div key={frame.id} className="flex w-[240px] shrink-0 flex-col rounded-lg border border-[#2a2a2a] bg-[#0e0e0d]">
                {/* Frame header */}
                <div className="flex items-center justify-between border-b border-[#2a2a2a] px-3 py-2">
                  <span className="font-mono text-[13px] font-medium text-amber-500">
                    FRAME {String(idx + 1).padStart(2, '0')}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenFrameId(frame.id) }}
                    className="flex items-center gap-1 rounded bg-amber-600/20 px-2 py-1 text-[13px] text-amber-400 hover:bg-amber-600/40"
                    title="Open detailed notes"
                  >
                    Open <ArrowRight size={9} />
                  </button>
                </div>

                {/* Image + notes side by side */}
                <div className="flex flex-1 gap-2 p-2" style={{ minHeight: 120 }}>
                  {/* Image area */}
                  <label
                    className="relative flex w-1/2 cursor-pointer items-center justify-center overflow-hidden rounded bg-black/40 text-[12px] text-neutral-500"
                    onDrop={(e) => {
                      e.preventDefault()
                      const f = e.dataTransfer.files[0]
                      if (f) loadImage(frame.id, f)
                    }}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    {frame.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={frame.image} alt="" className="h-full w-full object-contain" draggable={false} />
                    ) : (
                      <span className="p-2 text-center">Drop or click to add image</span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => e.target.files?.[0] && loadImage(frame.id, e.target.files[0])}
                    />
                  </label>

                  {/* Notes area with auto-bullet */}
                  <textarea
                    ref={(el) => { if (el && document.activeElement === el) (activeNotesRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el }}
                    className="w-1/2 resize-none rounded bg-black/40 p-2 text-[13px] leading-[1.5] text-white outline-none placeholder:text-neutral-600"
                    placeholder="Type / for commands…"
                    defaultValue={frame.notes}
                    onFocus={(e) => { (activeNotesRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = e.currentTarget }}
                    onBlur={(e) =>
                      setFrames((f) => f.map((fr) => (fr.id === frame.id ? { ...fr, notes: e.target.value } : fr)))
                    }
                    onKeyDown={(e) => { slashKeyDown(e); if (!e.defaultPrevented) handleNotesKey(e, frame.id) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </BlockWrapper>

      {slashMenu}

      {/* Frame detail modal — portaled to body */}
      {portalTarget && createPortal(
        <AnimatePresence>
          {openFrame && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
              onClick={(e) => { if (e.target === e.currentTarget) setOpenFrameId(null) }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="flex h-[80vh] w-[min(800px,92vw)] flex-col overflow-hidden rounded-lg border border-amber-700/60 bg-[#0a0a0a] shadow-[0_0_80px_rgba(245,158,11,0.2)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-[#2a2a2a] px-6 py-4">
                  <div>
                    <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-amber-500">Storyboard Frame</div>
                    <input
                      className="mt-1 w-full bg-transparent text-[13px] font-semibold text-white outline-none"
                      defaultValue={openFrame.label}
                      onBlur={(e) =>
                        setFrames((f) => f.map((fr) => (fr.id === openFrame.id ? { ...fr, label: e.target.value } : fr)))
                      }
                    />
                  </div>
                  <button onClick={() => setOpenFrameId(null)} className="text-neutral-500 hover:text-white">
                    <X size={18} />
                  </button>
                </div>

                {/* Image preview */}
                {openFrame.image && (
                  <div className="border-b border-[#2a2a2a] bg-black/40 p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={openFrame.image} alt="" className="mx-auto max-h-48 rounded object-contain" />
                  </div>
                )}

                {/* Quick notes (from card) */}
                <div className="border-b border-[#2a2a2a] px-6 py-3">
                  <div className="mb-1 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-500">Quick Notes</div>
                  <textarea
                    defaultValue={openFrame.notes}
                    placeholder="- Bullet notes…"
                    className="w-full resize-none bg-transparent text-[13px] leading-[1.5] text-white outline-none placeholder:text-neutral-600"
                    rows={3}
                    onBlur={(e) =>
                      setFrames((f) => f.map((fr) => (fr.id === openFrame.id ? { ...fr, notes: e.target.value } : fr)))
                    }
                    onKeyDown={(e) => handleNotesKey(e, openFrame.id)}
                  />
                </div>

                {/* Detailed notes */}
                <div className="flex-1 overflow-auto px-6 py-4">
                  <div className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-500">Detailed Notes</div>
                  <textarea
                    autoFocus
                    key={openFrame.id}
                    defaultValue={openFrame.detailedNotes ?? ''}
                    placeholder="Write in-depth scene breakdown, direction notes, dialogue, action beats…"
                    className="h-full min-h-[200px] w-full resize-none bg-transparent text-[13px] leading-[1.5] text-white outline-none placeholder:text-neutral-600"
                    onBlur={(e) =>
                      setFrames((f) =>
                        f.map((fr) => (fr.id === openFrame.id ? { ...fr, detailedNotes: e.target.value } : fr))
                      )
                    }
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        portalTarget
      )}
    </>
  )
}
