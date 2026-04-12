// Sticky note: Tiptap-backed rich text with slash commands + color swatches.
// Same editing model as TextNoteBlock (click to edit, blur to exit) but with
// the compact sticky visual style — small colored paper with shadow.
// Supports cmd+B / cmd+I / cmd+U, right-click format menu, and "/" slash
// commands for headings, lists, quotes, and dividers.

'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useCanvasStore } from '../store'
import type { StickyBlock } from '../types'
import { BlockWrapper } from '../BlockWrapper'
import { useTiptapSlashMenu } from '../TiptapSlashMenu'

const COLORS: Record<string, string> = {
  yellow: '#f5d97a',
  pink: '#f59ec4',
  blue: '#8ec4f5',
  green: '#9ed8a0',
  orange: '#f5b07a',
  purple: '#c79ef5',
}

interface Props {
  block: StickyBlock
  onContextMenu?: (e: React.MouseEvent) => void
}

export function StickyNoteBlock({ block, onContextMenu }: Props) {
  const updateBlock = useCanvasStore((s) => s.updateBlock)
  const bg = COLORS[block.color] || COLORS.yellow
  const [editing, setEditing] = useState(false)
  const [formatMenu, setFormatMenu] = useState<{ x: number; y: number } | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: block.text,
    editable: editing,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => updateBlock(block.id, { text: html }), 300)
    },
  })

  // Slash commands: user types "/" at line start → Tiptap-aware menu
  const { menu: slashMenuElement } = useTiptapSlashMenu(editor)

  useEffect(() => {
    editor?.setEditable(editing)
    if (editing) editor?.commands.focus('end')
  }, [editing, editor])

  useEffect(() => {
    if (editor && !editing && editor.getHTML() !== block.text) {
      editor.commands.setContent(block.text, { emitUpdate: false })
    }
  }, [block.text, editor, editing])

  // Close format menu on outside click
  useEffect(() => {
    if (!formatMenu) return
    const close = () => setFormatMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [formatMenu])

  const handleRightClick = (e: React.MouseEvent) => {
    if (!editing || !editor) {
      onContextMenu?.(e)
      return
    }
    e.preventDefault()
    e.stopPropagation()
    setFormatMenu({ x: e.clientX, y: e.clientY })
  }

  const fmt = (label: string, action: () => void, active?: boolean) => (
    <button
      key={label}
      className={`w-full px-3 py-1.5 text-left text-[13.5px] transition-colors duration-100 ${
        active
          ? 'bg-[color:var(--cs-accent)]/20 text-[color:var(--cs-accent2)]'
          : 'text-[color:var(--text1)] hover:bg-[color:var(--bg3)]'
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
    <BlockWrapper block={block} kind="sticky" onContextMenu={onContextMenu}>
      <div
        className="relative h-full w-full rounded-sm shadow-lg"
        style={{ background: bg, boxShadow: '0 6px 14px rgba(0,0,0,0.35)' }}
        onClick={() => {
          if (!editing) setEditing(true)
        }}
        onContextMenu={handleRightClick}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setEditing(false)
            setFormatMenu(null)
          }
        }}
      >
        {/* Color picker — appears on hover */}
        <div
          data-no-drag
          className="absolute right-1 top-1 z-10 flex gap-0.5 opacity-0 group-hover:opacity-100"
        >
          {(Object.keys(COLORS) as (keyof typeof COLORS)[]).map((c) => (
            <button
              key={c}
              className="h-3 w-3 rounded-full border border-black/20 transition-transform duration-150 hover:scale-125"
              style={{ background: COLORS[c] }}
              onClick={(e) => {
                e.stopPropagation()
                updateBlock(block.id, { color: c as StickyBlock['color'] })
              }}
            />
          ))}
        </div>

        {/* Editor content */}
        <div
          data-no-drag
          data-scrollable
          className="h-full w-full overflow-auto p-4 pt-6 text-[15px] leading-[1.5]"
          style={{ color: 'rgba(0,0,0,0.85)' }}
        >
          {editor && (
            <EditorContent
              editor={editor}
              className="max-w-none focus:outline-none [&_*]:outline-none [&_h1]:text-[20px] [&_h1]:font-semibold [&_h1]:leading-[1.2] [&_h1]:mb-1 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:leading-[1.2] [&_h2]:mb-1 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:leading-[1.2] [&_p]:my-1 [&_p]:leading-[1.4] [&_ul]:my-1 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:my-1 [&_ol]:pl-5 [&_ol]:list-decimal [&_li]:my-0.5 [&_hr]:my-2 [&_hr]:border-black/20 [&_blockquote]:border-l-2 [&_blockquote]:border-black/30 [&_blockquote]:pl-3 [&_blockquote]:italic"
              placeholder="Sticky note…"
            />
          )}
        </div>
      </div>

      {/* Slash command menu — Tiptap-aware, portaled */}
      {slashMenuElement}

      {/* Right-click format menu */}
      {formatMenu && editor && typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed z-[9999] w-44 overflow-hidden rounded-md border py-1 shadow-2xl"
            style={{
              left: Math.min(formatMenu.x, window.innerWidth - 190),
              top: Math.min(formatMenu.y, window.innerHeight - 340),
              background: 'var(--bg2)',
              borderColor: 'var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-3 py-1 text-[11.5px] font-medium uppercase tracking-[0.08em]"
              style={{ color: 'var(--text3)' }}
            >
              Format
            </div>
            {fmt('Bold', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
            {fmt('Italic', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
            {fmt('Underline', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}
            <div className="my-1 h-px" style={{ background: 'var(--border)' }} />
            {fmt('Heading 1', () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }))}
            {fmt('Heading 2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
            {fmt('Normal text', () => editor.chain().focus().setParagraph().run())}
            <div className="my-1 h-px" style={{ background: 'var(--border)' }} />
            {fmt('Bullet list', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
            {fmt('Numbered list', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </BlockWrapper>
  )
}
