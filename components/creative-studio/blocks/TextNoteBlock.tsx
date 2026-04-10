// Rich text note using Tiptap.
// Click to edit. Right-click to format (context menu with formatting options).
// No toolbar — formatting is all via right-click, clean and out of the way.

'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useCanvasStore } from '../store'
import type { TextBlock } from '../types'
import { BlockWrapper } from '../BlockWrapper'
import { Palette } from 'lucide-react'

const BG_PALETTE = [
  '#1c1c1a', '#2a1f14', '#1b2a1f', '#1a1f2a',
  '#2a1a1f', '#2a261a', '#241a2a', '#111110',
]

interface Props {
  block: TextBlock
  onContextMenu?: (e: React.MouseEvent) => void
}

export function TextNoteBlock({ block, onContextMenu }: Props) {
  const updateBlock = useCanvasStore((s) => s.updateBlock)
  const [showColors, setShowColors] = useState(false)
  const [editing, setEditing] = useState(false)
  const [formatMenu, setFormatMenu] = useState<{ x: number; y: number } | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: block.html,
    editable: editing,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => updateBlock(block.id, { html }), 300)
    },
  })

  useEffect(() => {
    editor?.setEditable(editing)
    if (editing) editor?.commands.focus('end')
  }, [editing, editor])

  useEffect(() => {
    if (editor && !editing && editor.getHTML() !== block.html) {
      editor.commands.setContent(block.html, { emitUpdate: false })
    }
  }, [block.html, editor, editing])

  // Close format menu on outside click
  useEffect(() => {
    if (!formatMenu) return
    const close = () => setFormatMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [formatMenu])

  const handleRightClick = (e: React.MouseEvent) => {
    if (!editing || !editor) {
      // Not editing — pass to block-level context menu
      onContextMenu?.(e)
      return
    }
    // In edit mode — show format menu instead of block context menu
    e.preventDefault()
    e.stopPropagation()
    setFormatMenu({ x: e.clientX, y: e.clientY })
  }

  const fmt = (label: string, action: () => void, active?: boolean) => (
    <button
      key={label}
      className={`w-full px-3 py-1.5 text-left text-[12px] ${
        active ? 'bg-amber-500/20 text-amber-300' : 'text-neutral-200 hover:bg-[#1e1e1e]'
      }`}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        action()
        setFormatMenu(null)
      }}
    >
      {label}
    </button>
  )

  return (
    <BlockWrapper block={block} kind="text" onContextMenu={onContextMenu}>
      <div
        className="relative flex h-full w-full flex-col overflow-hidden rounded-md border border-[#2a2a2a] shadow-lg"
        style={{ background: block.bg }}
        onClick={() => { if (!editing) setEditing(true) }}
        onContextMenu={handleRightClick}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setEditing(false)
            setFormatMenu(null)
          }
        }}
      >
        <div data-no-drag className="absolute right-1 top-1 z-10 flex gap-1 opacity-0 group-hover:opacity-100">
          <button
            className="rounded bg-black/50 p-1 text-white hover:bg-black/70"
            onClick={(e) => {
              e.stopPropagation()
              setShowColors((v) => !v)
            }}
          >
            <Palette size={12} />
          </button>
        </div>
        {showColors && (
          <div
            data-no-drag
            className="absolute right-1 top-8 z-20 flex flex-wrap gap-1 rounded bg-black/80 p-1"
            style={{ width: 96 }}
          >
            {BG_PALETTE.map((c) => (
              <button
                key={c}
                className="h-5 w-5 rounded border border-white/20"
                style={{ background: c }}
                onClick={(e) => {
                  e.stopPropagation()
                  updateBlock(block.id, { bg: c })
                  setShowColors(false)
                }}
              />
            ))}
          </div>
        )}

        <div data-no-drag data-scrollable className="flex-1 overflow-auto p-3 text-sm text-white">
          {editor && (
            <EditorContent
              editor={editor}
              className="max-w-none focus:outline-none [&_*]:outline-none [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-1.5 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-1 [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:my-1 [&_ol]:pl-5 [&_ol]:list-decimal [&_li]:my-0.5 [&_li]:pl-1 [&_hr]:my-3 [&_hr]:border-[#2a2a2a] [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-600 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-400"
            />
          )}
        </div>
      </div>

      {/* Right-click format menu — portaled to body */}
      {formatMenu && editor && typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed z-[9999] w-44 overflow-hidden rounded-md border border-[#2a2a2a] bg-[#141414] py-1 shadow-2xl"
            style={{
              left: Math.min(formatMenu.x, window.innerWidth - 190),
              top: Math.min(formatMenu.y, window.innerHeight - 340),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-neutral-600">Format</div>
            {fmt('Bold', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
            {fmt('Italic', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
            {fmt('Underline', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}
            <div className="my-1 h-px bg-[#2a2a2a]" />
            {fmt('Heading 1', () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }))}
            {fmt('Heading 2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
            {fmt('Heading 3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }))}
            {fmt('Normal text', () => editor.chain().focus().setParagraph().run())}
            <div className="my-1 h-px bg-[#2a2a2a]" />
            {fmt('• Bullet list', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
            {fmt('1. Numbered list', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
            {fmt('— Horizontal rule', () => editor.chain().focus().setHorizontalRule().run())}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </BlockWrapper>
  )
}
