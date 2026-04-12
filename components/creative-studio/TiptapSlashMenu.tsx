// Slash command menu for Tiptap editors.
// Intercepts `/` at line start, opens a floating menu, applies Tiptap
// commands on selection. Matches the visual treatment of the textarea-based
// SlashMenu.tsx but talks to a Tiptap Editor instead of an HTMLTextAreaElement.

'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, Minus, Type, Square,
  type LucideIcon,
} from 'lucide-react'
import type { Editor } from '@tiptap/react'

interface TiptapSlashCommand {
  label: string
  description: string
  Icon: LucideIcon
  /** Run the command against the editor (after the "/filter" text is deleted). */
  action: (editor: Editor) => void
}

const COMMANDS: TiptapSlashCommand[] = [
  {
    label: 'Heading 1',
    description: 'Large section heading',
    Icon: Heading1,
    action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: 'Heading 2',
    description: 'Medium section heading',
    Icon: Heading2,
    action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: 'Heading 3',
    description: 'Small section heading',
    Icon: Heading3,
    action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: 'Normal text',
    description: 'Plain paragraph',
    Icon: Type,
    action: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    label: 'Bullet list',
    description: 'Unordered list',
    Icon: List,
    action: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    label: 'Numbered list',
    description: 'Ordered list',
    Icon: ListOrdered,
    action: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    // Matches /checkbox, /check, /todo, /task via the fuzzy filter below.
    label: 'To-do',
    description: 'Checkbox · task list',
    Icon: Square,
    action: (e) => {
      // toggleTaskList is provided by @tiptap/extension-task-list; safe to
      // call via the `any` cast since it's registered as a command at runtime
      // in blocks that include the TaskList extension.
      ;(e.chain().focus() as unknown as { toggleTaskList: () => { run: () => void } })
        .toggleTaskList()
        .run()
    },
  },
  {
    label: 'Quote',
    description: 'Block quote',
    Icon: Quote,
    action: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    label: 'Divider',
    description: 'Horizontal rule',
    Icon: Minus,
    action: (e) => e.chain().focus().setHorizontalRule().run(),
  },
]

interface MenuState {
  x: number
  y: number
  /** Position (in doc) where the "/" was inserted, used to delete it on apply. */
  slashDocPos: number
  filter: string
  selected: number
}

export function useTiptapSlashMenu(editor: Editor | null) {
  const [menu, setMenu] = useState<MenuState | null>(null)

  const close = useCallback(() => setMenu(null), [])

  // Filtered commands based on current filter text. Also matches common
  // aliases (e.g. "check" / "checkbox" / "task" all hit the To-do command)
  // so users who type what they expect get the right result.
  const ALIASES: Record<string, string[]> = {
    'To-do': ['check', 'checkbox', 'task', 'todo', 'done'],
    'Heading 1': ['h1', 'title'],
    'Heading 2': ['h2'],
    'Heading 3': ['h3'],
    'Bullet list': ['ul', 'dash'],
    'Numbered list': ['ol', 'num', '1.', 'ordered'],
    'Divider': ['hr', 'rule', 'separator', 'break'],
    'Normal text': ['p', 'paragraph', 'text'],
    'Quote': ['blockquote', 'cite'],
  }
  const filtered = menu
    ? COMMANDS.filter((c) => {
        const f = menu.filter.toLowerCase()
        if (!f) return true
        if (c.label.toLowerCase().includes(f)) return true
        if (c.description.toLowerCase().includes(f)) return true
        const aliases = ALIASES[c.label] ?? []
        return aliases.some((a) => a.startsWith(f) || f.startsWith(a))
      })
    : COMMANDS

  const applyCommand = useCallback(
    (cmd: TiptapSlashCommand) => {
      if (!editor || !menu) return
      const from = menu.slashDocPos
      const to = from + 1 + menu.filter.length // "/" + filter chars

      // Step 1: delete the "/filter" text via a direct ProseMirror
      // transaction — synchronous, no intermediate re-render.
      const { tr } = editor.state
      tr.delete(from, to)
      editor.view.dispatch(tr)

      // Step 2: apply the block-level transformation immediately.
      // Because dispatch() was synchronous, the editor state already
      // reflects the deletion — so the command operates on the now-empty
      // paragraph and converts it in-place. No ghost blank line.
      cmd.action(editor)
      editor.commands.focus()

      setMenu(null)
    },
    [editor, menu]
  )

  // Install keydown listener on the editor DOM
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom as HTMLElement

    const onKeyDown = (e: KeyboardEvent) => {
      // ---- Menu closed ----
      if (!menu) {
        if (e.key === '/') {
          // Must be at the start of a text node with no preceding non-whitespace
          // on the same line. For Tiptap, we check that the previous character is
          // either undefined, newline, or whitespace.
          const { from } = editor.state.selection
          const $pos = editor.state.doc.resolve(from)
          const before = editor.state.doc.textBetween(Math.max(0, from - 1), from, '\n', '\n')
          const atLineStart = from === $pos.start($pos.depth) || before === ' ' || before === '\n'
          if (atLineStart) {
            // Wait one tick so the "/" is inserted first, then capture position
            setTimeout(() => {
              if (!editor.view.hasFocus()) return
              const after = editor.state.selection.from
              const coords = editor.view.coordsAtPos(after)
              setMenu({
                x: coords.left,
                y: coords.bottom + 6,
                slashDocPos: after - 1,
                filter: '',
                selected: 0,
              })
            }, 0)
          }
        }
        return
      }

      // ---- Menu open ----
      if (e.key === 'Escape') {
        e.preventDefault()
        setMenu(null)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMenu((m) =>
          m ? { ...m, selected: (m.selected + 1) % Math.max(filtered.length, 1) } : null
        )
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMenu((m) =>
          m
            ? { ...m, selected: (m.selected - 1 + filtered.length) % Math.max(filtered.length, 1) }
            : null
        )
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
          setMenu((m) => (m ? { ...m, filter: m.filter.slice(0, -1), selected: 0 } : null))
        } else {
          // Backspace on bare "/" — close menu and let Tiptap delete the "/"
          setMenu(null)
        }
        return
      }
      // Printable character → extend filter
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setMenu((m) => (m ? { ...m, filter: m.filter + e.key, selected: 0 } : null))
      }
    }

    dom.addEventListener('keydown', onKeyDown)
    return () => dom.removeEventListener('keydown', onKeyDown)
  }, [editor, menu, filtered, applyCommand])

  // Close menu if the editor loses focus
  useEffect(() => {
    if (!editor || !menu) return
    const onBlur = () => setMenu(null)
    editor.on('blur', onBlur)
    return () => {
      editor.off('blur', onBlur)
    }
  }, [editor, menu])

  // ---- Menu render (portaled to body) ----
  const menuElement =
    typeof window !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {menu && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.96 }}
                transition={{ duration: 0.14, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="fixed z-[9999] w-60 overflow-hidden rounded-md border py-1 shadow-2xl"
                style={{
                  left: Math.min(menu.x, typeof window !== 'undefined' ? window.innerWidth - 248 : menu.x),
                  top: Math.min(menu.y, typeof window !== 'undefined' ? window.innerHeight - 360 : menu.y),
                  background: 'var(--bg2)',
                  borderColor: 'var(--border)',
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div
                  className="px-3 py-1 text-[11.5px] font-medium uppercase tracking-[0.08em]"
                  style={{ color: 'var(--text3)' }}
                >
                  Turn into {menu.filter && <span style={{ color: 'var(--cs-accent)' }}>· {menu.filter}</span>}
                </div>
                {filtered.length === 0 && (
                  <div className="px-3 py-2 text-[13px]" style={{ color: 'var(--text2)' }}>
                    No match — press Esc
                  </div>
                )}
                {filtered.map((cmd, i) => {
                  const Icon = cmd.Icon
                  const active = i === menu.selected
                  return (
                    <button
                      key={cmd.label}
                      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors duration-100 ${
                        active
                          ? 'bg-[color:var(--cs-accent)]/20 text-[color:var(--cs-accent2)]'
                          : 'text-[color:var(--text1)] hover:bg-[color:var(--bg3)]'
                      }`}
                      onMouseEnter={() => setMenu((m) => (m ? { ...m, selected: i } : null))}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        applyCommand(cmd)
                      }}
                    >
                      <span
                        className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[4px]"
                        style={{
                          background: active
                            ? 'color-mix(in srgb, var(--cs-accent) 25%, transparent)'
                            : 'var(--bg3)',
                          color: active ? 'var(--cs-accent)' : 'var(--text1)',
                        }}
                      >
                        <Icon size={14} strokeWidth={2} />
                      </span>
                      <span className="flex-1 truncate">{cmd.label}</span>
                      <span className="truncate text-[11.5px]" style={{ color: 'var(--text3)' }}>
                        {cmd.description}
                      </span>
                    </button>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )
      : null

  return { menu: menuElement, close, isOpen: menu !== null }
}
