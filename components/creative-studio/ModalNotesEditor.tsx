// Tiptap-based rich text editor for node modals (mind map + standalone nodes).
// Renders headings, bullet lists, task lists, blockquotes, and horizontal rules.
// Slash commands via the shared TiptapSlashMenu. Storage format: HTML string.

'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Underline from '@tiptap/extension-underline'
import { useTiptapSlashMenu } from './TiptapSlashMenu'

// ── Markdown → HTML conversion ───────────────────────────────────
// Converts markdown-style body strings from the AI into HTML that
// Tiptap can render with full formatting.

function markdownToHtml(text: string): string {
  if (!text) return '<p></p>'
  // If it already looks like HTML, use as-is
  if (text.trim().startsWith('<')) return text

  const lines = text.split('\n')
  const result: string[] = []
  let inUl = false
  let inOl = false
  let inTaskList = false

  const closeOpenLists = () => {
    if (inUl) { result.push('</ul>'); inUl = false }
    if (inOl) { result.push('</ol>'); inOl = false }
    if (inTaskList) { result.push('</ul>'); inTaskList = false }
  }

  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const parseInline = (s: string): string => {
    // Bold: **text** or __text__
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    s = s.replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_ (not inside bold)
    s = s.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    s = s.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>')
    return s
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    // Skip empty lines — close any open lists
    if (!trimmed) {
      closeOpenLists()
      continue
    }

    // H1
    if (trimmed.startsWith('# ')) {
      closeOpenLists()
      result.push(`<h1>${parseInline(escapeHtml(trimmed.slice(2).trim()))}</h1>`)
      continue
    }
    // H2
    if (trimmed.startsWith('## ')) {
      closeOpenLists()
      result.push(`<h2>${parseInline(escapeHtml(trimmed.slice(3).trim()))}</h2>`)
      continue
    }
    // H3
    if (trimmed.startsWith('### ')) {
      closeOpenLists()
      result.push(`<h3>${parseInline(escapeHtml(trimmed.slice(4).trim()))}</h3>`)
      continue
    }
    // Horizontal rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      closeOpenLists()
      result.push('<hr>')
      continue
    }
    // Task items: - [ ] or - [x]
    if (/^[-*]\s*\[([ xX])\]\s/.test(trimmed)) {
      if (inUl) { result.push('</ul>'); inUl = false }
      if (inOl) { result.push('</ol>'); inOl = false }
      if (!inTaskList) { result.push('<ul data-type="taskList">'); inTaskList = true }
      const checked = trimmed[trimmed.indexOf('[') + 1] !== ' '
      const text = trimmed.replace(/^[-*]\s*\[[ xX]\]\s*/, '')
      result.push(`<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox"${checked ? ' checked="checked"' : ''}><span></span></label><div><p>${parseInline(escapeHtml(text))}</p></div></li>`)
      continue
    }
    // Checkbox unicode: ☐ / ☑
    if (trimmed.startsWith('☐ ') || trimmed.startsWith('☑ ')) {
      if (inUl) { result.push('</ul>'); inUl = false }
      if (inOl) { result.push('</ol>'); inOl = false }
      if (!inTaskList) { result.push('<ul data-type="taskList">'); inTaskList = true }
      const checked = trimmed.startsWith('☑')
      const text = trimmed.slice(2)
      result.push(`<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox"${checked ? ' checked="checked"' : ''}><span></span></label><div><p>${parseInline(escapeHtml(text))}</p></div></li>`)
      continue
    }
    // Bullet list: - item or * item or • item
    if (/^[-*•]\s+/.test(trimmed)) {
      if (inOl) { result.push('</ol>'); inOl = false }
      if (inTaskList) { result.push('</ul>'); inTaskList = false }
      if (!inUl) { result.push('<ul>'); inUl = true }
      const text = trimmed.replace(/^[-*•]\s+/, '')
      result.push(`<li><p>${parseInline(escapeHtml(text))}</p></li>`)
      continue
    }
    // Ordered list: 1. item
    if (/^\d+\.\s+/.test(trimmed)) {
      if (inUl) { result.push('</ul>'); inUl = false }
      if (inTaskList) { result.push('</ul>'); inTaskList = false }
      if (!inOl) { result.push('<ol>'); inOl = true }
      const text = trimmed.replace(/^\d+\.\s+/, '')
      result.push(`<li><p>${parseInline(escapeHtml(text))}</p></li>`)
      continue
    }
    // Blockquote: > text
    if (trimmed.startsWith('> ')) {
      closeOpenLists()
      result.push(`<blockquote><p>${parseInline(escapeHtml(trimmed.slice(2).trim()))}</p></blockquote>`)
      continue
    }
    // Plain paragraph
    closeOpenLists()
    result.push(`<p>${parseInline(escapeHtml(trimmed))}</p>`)
  }
  closeOpenLists()

  return result.join('') || '<p></p>'
}

// ── Component ──────────────────────────────────────────────────────

interface Props {
  defaultValue: string
  onChange: (val: string) => void
  placeholder?: string
}

export function ModalNotesEditor({ defaultValue, onChange, placeholder }: Props) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Underline,
    ],
    content: markdownToHtml(defaultValue),
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML()
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => onChange(html), 200)
    },
  })

  const { menu: slashMenuElement } = useTiptapSlashMenu(editor)

  // Auto-focus on mount
  useEffect(() => {
    if (editor && !editor.isFocused) {
      setTimeout(() => editor.commands.focus('end'), 80)
    }
  }, [editor])

  // Cleanup save timer
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  return (
    <>
      <div
        data-no-drag
        data-scrollable
        className="min-h-0 flex-1 cursor-text overflow-y-auto p-6 pb-10 cs-node-editor"
        onClick={() => editor?.commands.focus('end')}
      >
        {editor && (
          <EditorContent
            editor={editor}
            className="max-w-none text-[15px] leading-[1.6] focus:outline-none [&_*]:outline-none [&_h1]:text-[20px] [&_h1]:font-semibold [&_h1]:leading-[1.3] [&_h1]:mb-2 [&_h1]:mt-3 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:leading-[1.3] [&_h2]:mb-1.5 [&_h2]:mt-2 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:leading-[1.3] [&_h3]:mb-1 [&_h3]:mt-1.5 [&_p]:my-1 [&_p]:leading-[1.5] [&_ul]:my-1.5 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:my-1.5 [&_ol]:pl-5 [&_ol]:list-decimal [&_li]:my-0.5 [&_li]:pl-0.5 [&_hr]:my-3 [&_hr]:border-[rgba(255,255,255,0.08)] [&_blockquote]:border-l-2 [&_blockquote]:border-[#555550] [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-[#a8a49c] [&_strong]:font-bold [&_em]:italic"
            style={{ color: '#f0ede8' }}
          />
        )}
      </div>
      {slashMenuElement}
    </>
  )
}
