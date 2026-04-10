// Reusable slash command menu for any textarea.
// Inserts visual unicode prefixes that work in plain text (no markdown rendering needed).

'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export interface SlashCommand {
  label: string
  prefix: string
  description: string
}

const COMMANDS: SlashCommand[] = [
  { label: 'To-do',       prefix: '☐ ',      description: 'Checkbox item' },
  { label: 'Done',        prefix: '☑ ',      description: 'Completed item' },
  { label: 'Bullet',      prefix: '• ',      description: 'Bullet point' },
  { label: 'Arrow',       prefix: '→ ',      description: 'Arrow item' },
  { label: 'Numbered',    prefix: '1. ',     description: 'Numbered item' },
  { label: 'Heading',     prefix: '▎ ',      description: 'Section heading' },
  { label: 'Sub-heading', prefix: '  ▸ ',    description: 'Sub-section' },
  { label: 'Quote',       prefix: '│ ',      description: 'Block quote' },
  { label: 'Divider',     prefix: '────────────────\n', description: 'Horizontal line' },
  { label: 'Note',        prefix: '📌 ',     description: 'Pinned note' },
  { label: 'Warning',     prefix: '⚠️ ',     description: 'Warning callout' },
  { label: 'Star',        prefix: '★ ',      description: 'Starred item' },
]

export function useSlashMenu(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  onInsert: (val: string) => void
) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState(0)
  const [slashStart, setSlashStart] = useState(0) // cursor position where "/" was typed

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = textareaRef.current
    if (!ta) return

    if (e.key === '/' && !open) {
      const val = ta.value
      const cursor = ta.selectionStart
      const lineStart = val.lastIndexOf('\n', cursor - 1) + 1
      const lineText = val.slice(lineStart, cursor)
      if (lineText.trim() === '') {
        const rect = ta.getBoundingClientRect()
        // Position menu near cursor
        const lines = val.slice(0, cursor).split('\n').length
        setPos({ x: rect.left + 12, y: rect.top + Math.min(lines * 20, rect.height - 20) })
        setSlashStart(cursor)
        setOpen(true)
        setFilter('')
        setSelected(0)
      }
      return
    }

    if (!open) return

    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      return
    }

    const filtered = COMMANDS.filter((c) => c.label.toLowerCase().includes(filter.toLowerCase()))

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => (s + 1) % Math.max(filtered.length, 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => (s - 1 + filtered.length) % Math.max(filtered.length, 1))
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[selected]
      if (cmd) applyCommand(cmd)
      return
    }

    if (e.key === 'Backspace') {
      if (filter.length === 0) {
        setOpen(false)
      } else {
        setFilter((f) => f.slice(0, -1))
        setSelected(0)
      }
      return
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      setFilter((f) => f + e.key)
      setSelected(0)
    }
  }

  const applyCommand = (cmd: SlashCommand) => {
    const ta = textareaRef.current
    if (!ta) return
    const val = ta.value
    const cursor = ta.selectionStart
    // Find the "/" character and any filter text after it
    const lineStart = val.lastIndexOf('\n', slashStart - 1) + 1
    const before = val.slice(0, lineStart)
    const after = val.slice(cursor + 1) // +1 for the next character after filter
    const newVal = before + cmd.prefix + after
    ta.value = newVal
    const newCursor = lineStart + cmd.prefix.length
    ta.selectionStart = ta.selectionEnd = newCursor
    ta.focus()
    onInsert(newVal)
    setOpen(false)
  }

  const filtered = COMMANDS.filter((c) => c.label.toLowerCase().includes(filter.toLowerCase()))

  const menu = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="fixed z-[9999] w-56 overflow-hidden rounded-md border border-[#2a2a2a] bg-[#141414] py-1 shadow-2xl"
          style={{ left: pos.x, top: pos.y }}
        >
          <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-neutral-600">Insert format</div>
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-[11px] text-neutral-500">No commands match</div>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.label}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] ${
                i === selected ? 'bg-amber-500/20 text-amber-300' : 'text-neutral-200 hover:bg-[#1a1a1a]'
              }`}
              onMouseEnter={() => setSelected(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                applyCommand(cmd)
              }}
            >
              <span className="flex items-center gap-2">
                <span className="w-5 text-center text-[13px]">{cmd.prefix.trim().slice(0, 2)}</span>
                <span>{cmd.label}</span>
              </span>
              <span className="text-[10px] text-neutral-600">{cmd.description}</span>
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )

  return { handleKeyDown, menu, isOpen: open }
}
