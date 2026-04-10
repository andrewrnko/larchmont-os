// Rich text note using Tiptap. Supports bold/italic/underline/headings/bullets.
// Floating mini-toolbar appears on selection. Debounced save.

'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useCanvasStore } from '../store'
import type { TextBlock } from '../types'
import { BlockWrapper } from '../BlockWrapper'
import { Bold, Italic, UnderlineIcon, Heading1, Heading2, List, Palette } from 'lucide-react'

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
  }, [editing, editor])

  // Keep editor content in sync if block.html changes externally (undo/redo)
  useEffect(() => {
    if (editor && !editing && editor.getHTML() !== block.html) {
      editor.commands.setContent(block.html, { emitUpdate: false })
    }
  }, [block.html, editor, editing])

  const btn = 'p-1 hover:bg-white/10 rounded text-white'

  return (
    <BlockWrapper block={block} kind="text" onContextMenu={onContextMenu}>
      <div
        className="relative h-full w-full rounded-md border border-[#2a2a2a] shadow-lg"
        style={{ background: block.bg }}
        onDoubleClick={() => setEditing(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setEditing(false)
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

        <div data-no-drag className="h-full w-full overflow-auto p-3 text-sm text-white">
          {editor && editing && (
            <div data-no-drag className="sticky top-0 z-10 mb-1 flex gap-0.5 rounded border border-neutral-700 bg-neutral-900 p-1 shadow-xl">
              <button className={btn} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={12} /></button>
              <button className={btn} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={12} /></button>
              <button className={btn} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={12} /></button>
              <button className={btn} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={12} /></button>
              <button className={btn} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={12} /></button>
              <button className={btn} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={12} /></button>
            </div>
          )}
          {editor && (
            <EditorContent editor={editor} className="prose prose-invert prose-sm max-w-none focus:outline-none [&_*]:outline-none" />
          )}
        </div>
      </div>
    </BlockWrapper>
  )
}
