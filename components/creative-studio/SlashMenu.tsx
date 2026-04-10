// Reusable slash command menu for any textarea.
// Usage: wrap a textarea, pass its ref and value. When user types "/" at the
// start of a line, this menu appears and inserts formatted text.

'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export interface SlashCommand {
  label: string
  prefix: string      // inserted at line start
  description: string
}

const COMMANDS: SlashCommand[] = [
  { label: 'Heading 1',   prefix: '# ',     description: 'Large heading' },
  { label: 'Heading 2',   prefix: '## ',    description: 'Medium heading' },
  { label: 'Heading 3',   prefix: '### ',   description: 'Small heading' },
  { label: 'Bullet',      prefix: '- ',     description: 'Bullet list item' },
  { label: 'To-do',       prefix: '[ ] ',   description: 'Checkbox item' },
  { label: 'Numbered',    prefix: '1. ',    description: 'Numbered list item' },
  { label: 'Quote',       prefix: '> ',     description: 'Block quote' },
  { label: 'Divider',     prefix: '---\n',  description: 'Horizontal line' },
  { label: 'Code',        prefix: '```\n',  description: 'Code block' },
]

interface Props {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onInsert: (newValue: string) => void
}

export function useSlashMenu(textareaRef: React.RefObject<HTMLTextAreaElement | null>, onInsert: (val: string) => void) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState(0)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = textareaRef.current
    if (!ta) return

    if (e.key === '/' && !open) {
      const val = ta.value
      const cursor = ta.selectionStart
      const lineStart = val.lastIndexOf('\n', cursor - 1) + 1
      const lineText = val.slice(lineStart, cursor)
      // Only open if "/" is typed at start of line or after only whitespace
      if (lineText.trim() === '') {
        const rect = ta.getBoundingClientRect()
        setPos({ x: rect.left + 12, y: rect.top + 24 })
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
      setSelected((s) => (s + 1) % filtered.length)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => (s - 1 + filtered.length) % filtered.length)
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[selected]
      if (cmd) applyCommand(cmd)
      return
    }

    // Build filter from characters after "/"
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
    const lineStart = val.lastIndexOf('\n', cursor - 1) + 1
    // Replace from lineStart to cursor (the "/" + any filter chars) with the prefix
    const before = val.slice(0, lineStart)
    const after = val.slice(cursor + 1) // +1 to eat the "/" character that triggered it
    const newVal = before + cmd.prefix + after
    onInsert(newVal)
    setOpen(false)
    // Set cursor after prefix
    setTimeout(() => {
      if (ta) {
        ta.value = newVal
        const newCursor = lineStart + cmd.prefix.length
        ta.selectionStart = ta.selectionEnd = newCursor
        ta.focus()
      }
    }, 0)
  }

  const filtered = COMMANDS.filter((c) => c.label.toLowerCase().includes(filter.toLowerCase()))

  const menu = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="fixed z-[9999] w-52 overflow-hidden rounded-md border border-[#2a2a2a] bg-[#141414] py-1 shadow-2xl"
          style={{ left: pos.x, top: pos.y }}
        >
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
                e.preventDefault() // prevent textarea blur
                applyCommand(cmd)
              }}
            >
              <span>{cmd.label}</span>
              <span className="text-[10px] text-neutral-600">{cmd.description}</span>
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )

  return { handleKeyDown, menu, isOpen: open }
}
