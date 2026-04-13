// Right-click context menu — empty canvas or block target.

'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare } from 'lucide-react'
import { useCanvasStore } from './store'
import { useCommentsStore } from './comments-store'
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
  const selection = useCanvasStore((s) => s.selection)
  const setSelection = useCanvasStore((s) => s.setSelection)
  const board = useCanvasStore((s) => s.boards.find((b) => b.id === s.activeBoardId))
  const addPin = useCommentsStore((s) => s.addPin)

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
      className={`w-full px-3 py-1.5 text-left text-[15px] hover:bg-[color:var(--cs-accent)]/20 ${danger ? 'text-red-400' : 'text-neutral-200'}`}
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
          className="fixed z-[100] w-52 overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--bg2)] py-1 shadow-2xl"
          style={{
            left: Math.min(state.x, window.innerWidth - 220),
            top: Math.min(state.y, window.innerHeight - 320),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {state.blockId ? (
            <>
              {/* If right-clicked on a group block, offer to add a node inside */}
              {board?.blocks.find((b) => b.id === state.blockId)?.kind === 'group' &&
                item('Add Node here', () => {
                  addBlockAt('standalone-node', state.worldX, state.worldY)
                  onClose()
                })}
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
              <div className="my-1 h-px bg-[color:var(--bg4)]" />
              {item(selection.length > 1 && selection.includes(state.blockId!) ? `Delete ${selection.length} selected` : 'Delete', () => {
                // If the right-clicked block is in the selection, delete all selected
                const ids = selection.includes(state.blockId!)
                  ? selection
                  : [state.blockId!]
                removeBlocks(ids)
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
              {item('Add Task List', () => addAt('tasks'))}
              {item('Add Transcript', () => addAt('transcript'))}
              {item('Add AI Assistant', () => addAt('assistant'))}
              {item('Add Node', () => addAt('standalone-node'))}
              {item('Add Group', () => addAt('group'))}
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[15px] text-neutral-200 hover:bg-[color:var(--cs-accent)]/20"
                onClick={(e) => {
                  e.stopPropagation()
                  if (state && board) {
                    addPin(board.id, state.worldX, state.worldY)
                  }
                  onClose()
                }}
              >
                <MessageSquare size={14} /> Add Comment Pin
              </button>
              <div className="my-1 h-px bg-[color:var(--bg4)]" />
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
