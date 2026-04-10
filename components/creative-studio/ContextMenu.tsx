// Right-click context menu — empty canvas or block target.

'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCanvasStore } from './store'
import type { BlockKind } from './types'

export interface ContextMenuState {
  x: number
  y: number
  worldX: number
  worldY: number
  blockId: string | null
}

interface Props {
  state: ContextMenuState | null
  onClose: () => void
  onZoomToFit: () => void
}

export function ContextMenu({ state, onClose, onZoomToFit }: Props) {
  const addBlockAt = useCanvasStore((s) => s.addBlockAt)
  const duplicateBlock = useCanvasStore((s) => s.duplicateBlock)
  const removeBlocks = useCanvasStore((s) => s.removeBlocks)
  const toggleLock = useCanvasStore((s) => s.toggleLock)
  const bringToFront = useCanvasStore((s) => s.bringToFront)
  const sendToBack = useCanvasStore((s) => s.sendToBack)
  const setSelection = useCanvasStore((s) => s.setSelection)
  const board = useCanvasStore((s) => s.boards.find((b) => b.id === s.activeBoardId))

  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onClick = () => onClose()
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('click', onClick)
    }
  }, [state, onClose])

  const addAt = (kind: BlockKind) => {
    if (!state) return
    addBlockAt(kind, state.worldX, state.worldY)
    onClose()
  }

  const item = (label: string, fn: () => void, danger?: boolean) => (
    <button
      className={`w-full px-3 py-1 text-left text-[12px] hover:bg-amber-500/20 ${danger ? 'text-red-400' : 'text-neutral-200'}`}
      onClick={(e) => {
        e.stopPropagation()
        fn()
      }}
    >
      {label}
    </button>
  )

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.1 }}
          className="fixed z-[100] w-52 overflow-hidden rounded-md border border-[#2a2a2a] bg-[#141414] py-1 shadow-2xl"
          style={{ left: state.x, top: state.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {state.blockId ? (
            <>
              {item('Duplicate', () => {
                duplicateBlock(state.blockId!)
                onClose()
              })}
              {item('Lock / Unlock', () => {
                toggleLock(state.blockId!)
                onClose()
              })}
              {item('Bring to front', () => {
                bringToFront(state.blockId!)
                onClose()
              })}
              {item('Send to back', () => {
                sendToBack(state.blockId!)
                onClose()
              })}
              <div className="my-1 h-px bg-[#2a2a2a]" />
              {item('Delete', () => {
                removeBlocks([state.blockId!])
                onClose()
              }, true)}
            </>
          ) : (
            <>
              {item('Add Text Note', () => addAt('text'))}
              {item('Add Sticky Note', () => addAt('sticky'))}
              {item('Add Image Block', () => addAt('image'))}
              {item('Add Storyboard Frame', () => addAt('storyboard'))}
              {item('Add Mind Map', () => addAt('mindmap'))}
              {item('Add Page Block', () => addAt('page'))}
              {item('Add Transcript', () => addAt('transcript'))}
              {item('Add AI Assistant', () => addAt('assistant'))}
              <div className="my-1 h-px bg-[#2a2a2a]" />
              {item('Select All', () => {
                setSelection(board?.blocks.map((b) => b.id) ?? [])
                onClose()
              })}
              {item('Zoom to Fit', () => {
                onZoomToFit()
                onClose()
              })}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
