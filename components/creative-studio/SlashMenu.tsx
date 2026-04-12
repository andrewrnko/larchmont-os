// Reusable slash command menu for textareas.
// Type "/" at the start of a line → menu appears → pick a format → prefix inserted.
// Backspace deletes filter chars, then the "/" itself, dismissing the menu.
// Escape dismisses. Clicking outside dismisses.

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Square, Circle, ArrowRight, ListOrdered,
  Heading1, Heading2, Quote, Minus, Pin, Star,
  type LucideIcon,
} from 'lucide-react'

interface SlashCommand {
  label: string
  prefix: string
  Icon: LucideIcon
  description: string
}

// No /Done — there's only a single To-do that toggles via its checkbox.
const COMMANDS: SlashCommand[] = [
  { label: 'To-do',       prefix: '☐ ',   Icon: Square,      description: 'Checkbox item' },
  { label: 'Bullet',      prefix: '• ',   Icon: Circle,      description: 'Bullet point' },
  { label: 'Arrow',       prefix: '→ ',   Icon: ArrowRight,  description: 'Arrow item' },
  { label: 'Numbered',    prefix: '1. ',  Icon: ListOrdered, description: 'Numbered item' },
  { label: 'Heading',     prefix: '▎ ',   Icon: Heading1,    description: 'Section heading' },
  { label: 'Sub-heading', prefix: '  ▸ ', Icon: Heading2,    description: 'Sub-section' },
  { label: 'Quote',       prefix: '│ ',   Icon: Quote,       description: 'Block quote' },
  { label: 'Divider',     prefix: '────────────────\n', Icon: Minus, description: 'Horizontal line' },
  { label: 'Note',        prefix: '📌 ',  Icon: Pin,         description: 'Pinned note' },
  { label: 'Star',        prefix: '★ ',   Icon: Star,        description: 'Starred item' },
]

interface MenuState {
  open: boolean
  x: number
  y: number
  slashPos: number  // cursor position OF the "/" character in the textarea value
  filter: string
  selected: number
}

const INIT: MenuState = { open: false, x: 0, y: 0, slashPos: 0, filter: '', selected: 0 }

export function useSlashMenu(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  onValueChange: (val: string) => void
) {
  const [menu, setMenu] = useState<MenuState>(INIT)

  // Close menu on outside click
  useEffect(() => {
    if (!menu.open) return
    const close = () => setMenu(INIT)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menu.open])

  const applyCommand = useCallback((cmd: SlashCommand) => {
    const ta = textareaRef.current
    if (!ta) return
    const val = ta.value
    // Replace from the "/" through any filter text with the prefix
    const before = val.slice(0, menu.slashPos)
    const afterSlashAndFilter = val.slice(menu.slashPos + 1 + menu.filter.length)
    const newVal = before + cmd.prefix + afterSlashAndFilter
    ta.value = newVal
    const newCursor = menu.slashPos + cmd.prefix.length
    ta.selectionStart = ta.selectionEnd = newCursor
    ta.focus()
    onValueChange(newVal)
    setMenu(INIT)
  }, [textareaRef, menu.slashPos, menu.filter, onValueChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = textareaRef.current
    if (!ta) return

    // --- MENU IS CLOSED ---
    if (!menu.open) {
      if (e.key === '/') {
        const cursor = ta.selectionStart
        const val = ta.value
        const lineStart = val.lastIndexOf('\n', cursor - 1) + 1
        const lineText = val.slice(lineStart, cursor)
        // Only trigger if "/" is typed on an empty or whitespace-only line
        if (lineText.trim() === '') {
          const rect = ta.getBoundingClientRect()
          setMenu({
            open: true,
            x: rect.left + 16,
            y: Math.min(rect.bottom - 40, rect.top + 40),
            slashPos: cursor, // the "/" will be at this position after the keypress
            filter: '',
            selected: 0,
          })
          // Let the "/" character be typed normally — we'll remove it when applying
        }
      }
      return
    }

    // --- MENU IS OPEN ---
    const matchCmd = (c: SlashCommand, f: string) => {
      const fl = f.toLowerCase()
      const norm = (s: string) => s.toLowerCase().replace(/[-\s]/g, '')
      return c.label.toLowerCase().includes(fl) || norm(c.label).includes(norm(f)) || c.description.toLowerCase().includes(fl)
    }
    const filtered = COMMANDS.filter((c) => matchCmd(c, menu.filter))

    if (e.key === 'Escape') {
      e.preventDefault()
      setMenu(INIT)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMenu((m) => ({ ...m, selected: (m.selected + 1) % Math.max(filtered.length, 1) }))
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMenu((m) => ({ ...m, selected: (m.selected - 1 + filtered.length) % Math.max(filtered.length, 1) }))
      return
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const cmd = filtered[menu.selected]
      if (cmd) applyCommand(cmd)
      return
    }

    if (e.key === 'Backspace') {
      if (menu.filter.length > 0) {
        // Remove last filter char — let the native backspace handle the textarea
        setMenu((m) => ({ ...m, filter: m.filter.slice(0, -1), selected: 0 }))
        // Don't prevent default — let the textarea handle the backspace naturally
      } else {
        // No filter left — the next backspace will delete the "/" itself
        // Close the menu and let native backspace remove the "/"
        setMenu(INIT)
      }
      return
    }

    // Printable character → add to filter
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      setMenu((m) => ({ ...m, filter: m.filter + e.key, selected: 0 }))
      // Let the character be typed into the textarea naturally
    }
  }, [menu, textareaRef, applyCommand])

  const matchCmd = (c: SlashCommand, f: string) => {
    const fl = f.toLowerCase()
    const norm = (s: string) => s.toLowerCase().replace(/[-\s]/g, '')
    return c.label.toLowerCase().includes(fl) || norm(c.label).includes(norm(f)) || c.description.toLowerCase().includes(fl)
  }
  const filtered = COMMANDS.filter((c) => matchCmd(c, menu.filter))

  const menuElement = typeof window !== 'undefined' ? createPortal(
    <AnimatePresence>
      {menu.open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="fixed z-[9999] w-60 overflow-hidden rounded-md border border-[color:var(--border)] bg-[color:var(--bg2)] py-1 shadow-2xl"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()} // prevent the outside-click close
        >
          <div className="px-3 py-1 text-[11.5px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--text3)' }}>
            Turn into {menu.filter && <span style={{ color: 'var(--cs-accent)' }}>· {menu.filter}</span>}
          </div>
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-[13px]" style={{ color: 'var(--text2)' }}>No match — press Esc</div>
          )}
          {filtered.map((cmd, i) => {
            const Icon = cmd.Icon
            const active = i === menu.selected
            return (
              <button
                key={cmd.label}
                className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors duration-100 ${
                  active ? 'bg-[color:var(--cs-accent)]/20 text-[color:var(--cs-accent2)]' : 'text-[color:var(--text1)] hover:bg-[color:var(--bg3)]'
                }`}
                onMouseEnter={() => setMenu((m) => ({ ...m, selected: i }))}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  applyCommand(cmd)
                }}
              >
                <span
                  className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[4px]"
                  style={{
                    background: active ? 'color-mix(in srgb, var(--cs-accent) 25%, transparent)' : 'var(--bg3)',
                    color: active ? 'var(--cs-accent)' : 'var(--text1)',
                  }}
                >
                  <Icon size={14} strokeWidth={2} />
                </span>
                <span className="flex-1 truncate">{cmd.label}</span>
                <span className="text-[11.5px] truncate" style={{ color: 'var(--text3)' }}>{cmd.description}</span>
              </button>
            )
          })}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  ) : null

  return { handleKeyDown, menu: menuElement, isOpen: menu.open }
}
