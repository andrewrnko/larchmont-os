// Subpage editor overlay.
// Uses uncontrolled textareas with refs to avoid the "Enter loses text" bug
// that happens when controlled contentEditable is re-rendered mid-keystroke.
// Includes deadline, icon picker, color picker, and a connections list with
// click-to-jump-to-block (closes overlay and centers viewport on target).

'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { useCanvasStore, uid, useActiveBoard } from './store'
import type { PageBlock, SubPageBlock } from './types'
import {
  ChevronLeft, Calendar, Palette, Link2, ArrowRight, GripVertical, Trash2, Copy, ArrowRightLeft,
  Heading1, Heading2, Heading3, Type, List, ListOrdered, Square, Minus, ImageIcon,
  type LucideIcon,
} from 'lucide-react'

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })

const BLOCK_TYPES: { type: SubPageBlock['type']; label: string; Icon: LucideIcon; description: string }[] = [
  { type: 'h1',       label: 'Heading 1',     Icon: Heading1,    description: 'Large heading' },
  { type: 'h2',       label: 'Heading 2',     Icon: Heading2,    description: 'Medium heading' },
  { type: 'h3',       label: 'Heading 3',     Icon: Heading3,    description: 'Small heading' },
  { type: 'p',        label: 'Paragraph',     Icon: Type,        description: 'Plain text' },
  { type: 'bullet',   label: 'Bullet list',   Icon: List,        description: 'Unordered list' },
  { type: 'numbered', label: 'Numbered list', Icon: ListOrdered, description: 'Ordered list' },
  { type: 'todo',     label: 'To-do',         Icon: Square,      description: 'Checkbox item' },
  { type: 'divider',  label: 'Divider',       Icon: Minus,       description: 'Horizontal rule' },
  { type: 'image',    label: 'Image',         Icon: ImageIcon,   description: 'Image from URL' },
]

const COLORS = ['#0a0a0a', '#1a1a1a', '#1b2a1f', '#1a1f2a', '#2a1a1f', '#2a261a', '#241a2a', '#3a1a0a']

export function SubpageEditor() {
  const openPageBlockId = useCanvasStore((s) => s.openPageBlockId)
  const openPage = useCanvasStore((s) => s.openPage)
  const updateBlock = useCanvasStore((s) => s.updateBlock)
  const centerOnBlock = useCanvasStore((s) => s.centerOnBlock)
  const board = useActiveBoard()

  const pageBlock =
    openPageBlockId && board
      ? (board.blocks.find((b) => b.id === openPageBlockId && b.kind === 'page') as PageBlock | undefined)
      : null

  const [slashMenu, setSlashMenu] = useState<{ blockId: string; x: number; y: number; filter: string; selected: number } | null>(null)
  const [blockMenu, setBlockMenu] = useState<{ blockId: string; x: number; y: number; showTurnInto: boolean } | null>(null)
  const [iconOpen, setIconOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  // Track focused block so only its placeholder shows — no more stacked
  // "Type / for commands…" strings on every empty line (Notion-style).
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null)
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const focusNextRef = useRef<string | null>(null)

  // Dismiss slash menu on outside click
  useEffect(() => {
    if (!slashMenu) return
    const dismiss = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-slash-menu]')) {
        setSlashMenu(null)
      }
    }
    window.addEventListener('mousedown', dismiss)
    return () => window.removeEventListener('mousedown', dismiss)
  }, [slashMenu])

  // Dismiss block context menu on outside click
  useEffect(() => {
    if (!blockMenu) return
    const dismiss = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-block-menu]')) {
        setBlockMenu(null)
      }
    }
    window.addEventListener('mousedown', dismiss)
    return () => window.removeEventListener('mousedown', dismiss)
  }, [blockMenu])

  useEffect(() => {
    if (focusNextRef.current && refs.current[focusNextRef.current]) {
      refs.current[focusNextRef.current]?.focus()
      focusNextRef.current = null
    }
  })

  if (!pageBlock) return <AnimatePresence />

  const setContent = (content: SubPageBlock[]) => updateBlock(pageBlock.id, { content })

  const commitTextFromRef = (id: string): SubPageBlock[] | null => {
    const el = refs.current[id]
    if (!el) return null
    return pageBlock.content.map((x) => (x.id === id ? ({ ...x, text: el.value } as SubPageBlock) : x))
  }

  const insertAfter = (id: string, type: SubPageBlock['type']) => {
    const updated = commitTextFromRef(id) ?? pageBlock.content
    const newItem: SubPageBlock =
      type === 'image'
        ? { id: uid(), type: 'image', src: '' }
        : type === 'divider'
        ? { id: uid(), type: 'divider', text: '' }
        : { id: uid(), type, text: '', checked: false }
    const idx = updated.findIndex((x) => x.id === id)
    const next = [...updated]
    next.splice(idx + 1, 0, newItem)
    focusNextRef.current = newItem.id
    setContent(next)
  }

  const removeItem = (id: string) => {
    const next = pageBlock.content.filter((x) => x.id !== id)
    if (next.length === 0) {
      next.push({ id: uid(), type: 'p', text: '' })
    }
    setContent(next)
  }

  const duplicateItem = (id: string) => {
    const updated = commitTextFromRef(id) ?? pageBlock.content
    const idx = updated.findIndex((x) => x.id === id)
    if (idx < 0) return
    const orig = updated[idx]
    const clone = { ...orig, id: uid() } as SubPageBlock
    const next = [...updated]
    next.splice(idx + 1, 0, clone)
    focusNextRef.current = clone.id
    setContent(next)
  }

  const moveItem = (fromId: string, toId: string) => {
    if (fromId === toId) return
    const updated = commitTextFromRef(fromId) ?? pageBlock.content
    const fromIdx = updated.findIndex((x) => x.id === fromId)
    const toIdx = updated.findIndex((x) => x.id === toId)
    if (fromIdx < 0 || toIdx < 0) return
    const next = [...updated]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    setContent(next)
  }

  const changeType = (id: string, type: SubPageBlock['type']) => {
    const updated = commitTextFromRef(id) ?? pageBlock.content
    setContent(
      updated.map((x) =>
        x.id === id
          ? type === 'image'
            ? ({ id: x.id, type: 'image', src: '' } as SubPageBlock)
            : type === 'divider'
            ? ({ id: x.id, type: 'divider', text: '' } as SubPageBlock)
            : ({ id: x.id, type, text: 'text' in x ? x.text : '', checked: false } as SubPageBlock)
          : x
      )
    )
  }

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  const getFilteredTypes = (filter: string) => {
    const fl = filter.toLowerCase()
    const norm = (s: string) => s.toLowerCase().replace(/[-\s]/g, '')
    return BLOCK_TYPES.filter((t) =>
      t.label.toLowerCase().includes(fl) || norm(t.label).includes(norm(filter)) || t.description.toLowerCase().includes(fl)
    )
  }

  const applySlashCommand = (type: SubPageBlock['type'], blockId: string) => {
    // Clear the textarea DOM value
    const el = refs.current[blockId]
    if (el) el.value = ''
    // Apply type change and clear text in a single state update
    const newContent = pageBlock.content.map((x) =>
      x.id === blockId
        ? type === 'image'
          ? ({ id: x.id, type: 'image', src: '' } as SubPageBlock)
          : type === 'divider'
          ? ({ id: x.id, type: 'divider', text: '' } as SubPageBlock)
          : ({ id: x.id, type, text: '', checked: false } as SubPageBlock)
        : x
    )
    setContent(newContent)
    setSlashMenu(null)
    focusNextRef.current = blockId
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>, item: SubPageBlock) => {
    // --- SLASH MENU IS OPEN ---
    if (slashMenu && slashMenu.blockId === item.id) {
      const filtered = getFilteredTypes(slashMenu.filter)

      if (e.key === 'Escape') {
        e.preventDefault()
        setSlashMenu(null)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashMenu((m) => m ? { ...m, selected: (m.selected + 1) % Math.max(filtered.length, 1) } : m)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashMenu((m) => m ? { ...m, selected: ((m.selected - 1) + filtered.length) % Math.max(filtered.length, 1) } : m)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const cmd = filtered[slashMenu.selected]
        if (cmd) applySlashCommand(cmd.type, slashMenu.blockId)
        return
      }
      if (e.key === 'Backspace') {
        if (slashMenu.filter.length > 0) {
          setSlashMenu((m) => m ? { ...m, filter: m.filter.slice(0, -1), selected: 0 } : m)
        } else {
          setSlashMenu(null)
        }
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setSlashMenu((m) => m ? { ...m, filter: m.filter + e.key, selected: 0 } : m)
        return
      }
      return
    }

    // --- SLASH MENU IS CLOSED ---
    if (e.key === '/') {
      const val = e.currentTarget.value
      if (val.trim() === '') {
        const rect = e.currentTarget.getBoundingClientRect()
        setSlashMenu({ blockId: item.id, x: rect.left, y: rect.bottom, filter: '', selected: 0 })
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Notion-style list exit: pressing Enter on an EMPTY list item
      // (bullet/todo/numbered) converts it to a plain paragraph instead
      // of adding another empty list item.
      const val = e.currentTarget.value
      const isListItem = item.type === 'bullet' || item.type === 'todo' || item.type === 'numbered'
      if (isListItem && val === '') {
        changeType(item.id, 'p')
        return
      }
      // Otherwise, insert a new line of the same type (or 'p' if current isn't a list)
      insertAfter(item.id, isListItem ? item.type : 'p')
    }

    if (e.key === 'Backspace' && pageBlock.content.length > 1) {
      const val = e.currentTarget.value
      const cursor = e.currentTarget.selectionStart
      if (val === '' && cursor === 0) {
        e.preventDefault()
        const idx = pageBlock.content.findIndex((x) => x.id === item.id)
        if (idx > 0) {
          const prevId = pageBlock.content[idx - 1].id
          focusNextRef.current = prevId
        }
        removeItem(item.id)
      }
    }
  }

  // Connections linked to this page block
  const connections =
    board?.connectors
      .filter((c) => c.fromBlockId === pageBlock.id || c.toBlockId === pageBlock.id)
      .map((c) => {
        const otherId = c.fromBlockId === pageBlock.id ? c.toBlockId : c.fromBlockId
        const other = board.blocks.find((b) => b.id === otherId)
        return { connector: c, other }
      })
      .filter((x) => x.other) ?? []

  const renderItem = (item: SubPageBlock) => {
    const isDragOver = dragOverId === item.id && dragId !== item.id

    // Drag handle — sits inline left of content
    const dragHandle = (
      <div
        className="shrink-0 w-6 flex items-center justify-center self-center opacity-0 group-hover/block:opacity-100 cursor-grab active:cursor-grabbing select-none"
        draggable
        onDragStart={() => setDragId(item.id)}
        onDragEnd={() => { setDragId(null); setDragOverId(null) }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          const rect = (e.target as HTMLElement).getBoundingClientRect()
          setBlockMenu({ blockId: item.id, x: rect.left, y: rect.bottom + 4, showTurnInto: false })
        }}
      >
        <GripVertical size={14} className="text-[#555450] hover:text-[#c8c4bc]" />
      </div>
    )

    const blockContextMenu = (e: React.MouseEvent) => {
      e.preventDefault()
      setBlockMenu({
        blockId: item.id,
        x: Math.min(e.clientX, window.innerWidth - 200),
        y: Math.min(e.clientY, window.innerHeight - 260),
        showTurnInto: false,
      })
    }

    const dropProps = {
      onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOverId(item.id) },
      onDragLeave: () => setDragOverId(null),
      onDrop: () => { if (dragId) moveItem(dragId, item.id); setDragId(null); setDragOverId(null) },
    }

    if (item.type === 'divider') {
      // Clicking a divider should NOT land the user in an unfocusable element.
      // Move focus to the next text block, or insert a new paragraph and
      // focus that. The <hr> inside is pointer-events-none so the click
      // actually hits the row wrapper.
      return (
        <div
          key={item.id}
          className={`group/block flex cursor-text items-center gap-0 rounded py-2 ${isDragOver ? 'bg-[color:var(--cs-accent)]/10 border-t border-[color:var(--cs-accent)]/40' : ''}`}
          onContextMenu={blockContextMenu}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('[data-drag-handle]')) return
            const idx = pageBlock.content.findIndex((x) => x.id === item.id)
            const next = pageBlock.content[idx + 1]
            if (next && 'text' in next) {
              refs.current[next.id]?.focus()
            } else {
              insertAfter(item.id, 'p')
            }
          }}
          {...dropProps}
        >
          {dragHandle}
          <hr className="pointer-events-none flex-1" style={{ borderColor: 'var(--border)' }} />
        </div>
      )
    }
    if (item.type === 'image') {
      return (
        <div
          key={item.id}
          className={`group/block flex items-start gap-0 py-1 rounded ${isDragOver ? 'bg-[color:var(--cs-accent)]/10 border-t border-[color:var(--cs-accent)]/40' : ''}`}
          onContextMenu={blockContextMenu}
          {...dropProps}
        >
          {dragHandle}
          <div className="flex-1">
            {item.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.src} alt="" className="max-h-96 rounded" />
            ) : (
              <input
                className="w-full rounded bg-[#242422] px-3 py-2 text-[15px] text-white outline-none placeholder:text-[#555450]"
                placeholder="Paste image URL and press Enter…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = (e.target as HTMLInputElement).value
                    setContent(pageBlock.content.map((x) => (x.id === item.id ? ({ ...x, src: v } as SubPageBlock) : x)))
                  }
                }}
              />
            )}
          </div>
        </div>
      )
    }
    // Tightened tracking on headings to match the canvas title labels.
    const cls =
      item.type === 'h1' ? 'text-[22px] font-semibold leading-[1.2] tracking-[-0.018em]'
      : item.type === 'h2' ? 'text-[19px] font-semibold leading-[1.2] tracking-[-0.012em]'
      : item.type === 'h3' ? 'text-[17px] font-semibold leading-[1.2] tracking-[-0.008em]'
      : 'text-[15px] leading-[1.55]'
    // Compute numbered list index
    const numberedIndex = item.type === 'numbered'
      ? (() => {
          let count = 0
          for (const block of pageBlock.content) {
            if (block.id === item.id) { count++; break }
            if (block.type === 'numbered') count++
            else count = 0
          }
          return count
        })()
      : 0

    return (
      <div
        key={item.id}
        className={`group/block flex cursor-text items-start gap-0 rounded py-1 ${isDragOver ? 'bg-[color:var(--cs-accent)]/10 border-t border-[color:var(--cs-accent)]/40' : ''}`}
        onContextMenu={blockContextMenu}
        onClick={(e) => {
          // Permissive click-to-focus: unless the click lands on a genuinely
          // interactive element (textarea, input, button, drag handle),
          // focus the row's textarea. Fixes the "click between blocks and
          // nothing happens" gap.
          const tgt = e.target as HTMLElement
          if (tgt.tagName === 'TEXTAREA' || tgt.tagName === 'INPUT' || tgt.tagName === 'BUTTON') return
          if (tgt.closest('[data-drag-handle]')) return
          refs.current[item.id]?.focus()
        }}
        {...dropProps}
      >
        {dragHandle}
        {item.type === 'bullet' && <span className="shrink-0 text-[15px] leading-[1.5] mr-2" style={{ color: 'var(--text1)' }}>•</span>}
        {item.type === 'numbered' && <span className="shrink-0 min-w-[1.4em] text-right font-mono text-[15px] leading-[1.5] mr-2" style={{ color: 'var(--text1)' }}>{numberedIndex}.</span>}
        {item.type === 'todo' && (
          <button
            onClick={() =>
              setContent(
                pageBlock.content.map((x) => (x.id === item.id ? ({ ...x, checked: !(item.checked ?? false) } as SubPageBlock) : x))
              )
            }
            // Standardized checkbox: 14×14, rounded-sm, border token unchecked,
            // accent-filled when checked. Matches every other Creative Studio
            // checkbox (Tiptap task list, tasks block, daily repeatables).
            className="shrink-0 mt-[3px] mr-2 flex h-[14px] w-[14px] items-center justify-center rounded-[3px] border transition-colors duration-150"
            style={{
              borderColor: item.checked ? 'var(--accent)' : 'var(--border-strong)',
              background: item.checked ? 'var(--accent)' : 'transparent',
            }}
            aria-label={item.checked ? 'Mark as not done' : 'Mark as done'}
          >
            {item.checked && (
              <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="#0a0a09" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 8 7 12 13 4" />
              </svg>
            )}
          </button>
        )}
        <textarea
          ref={(el) => {
            refs.current[item.id] = el
            if (el) autoResize(el)
          }}
          defaultValue={item.text}
          rows={1}
          placeholder={focusedBlockId === item.id ? "Type '/' for commands…" : ''}
          className={`flex-1 resize-none overflow-hidden bg-transparent placeholder:text-[color:var(--text3)] focus:outline-none ${cls} ${
            item.type === 'todo' && item.checked ? 'line-through' : ''
          }`}
          style={{ color: item.type === 'todo' && item.checked ? 'var(--text2)' : 'var(--text0)' }}
          onInput={(e) => autoResize(e.currentTarget)}
          onFocus={() => setFocusedBlockId(item.id)}
          onBlur={(e) => {
            if (slashMenu?.blockId === item.id) return
            setFocusedBlockId((prev) => (prev === item.id ? null : prev))
            setContent(pageBlock.content.map((x) => (x.id === item.id ? ({ ...x, text: e.target.value } as SubPageBlock) : x)))
          }}
          onKeyDown={(e) => handleKey(e, item)}
        />
      </div>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        key="subpage"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 overflow-auto"
        style={{ background: 'var(--bg0)' }}
      >
        <div
          className="sticky top-0 z-10 border-b px-6 py-3 backdrop-blur"
          style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg0) 80%, transparent)' }}
        >
          <button
            onClick={() => openPage(null)}
            className="flex items-center gap-2 text-[15px] transition-colors duration-150"
            style={{ color: 'var(--text2)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text0)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text2)')}
          >
            <ChevronLeft size={12} /> Creative Studio / {board?.name} /{' '}
            <span style={{ color: 'var(--text0)' }}>{pageBlock.title}</span>
          </button>
        </div>

        <div className="mx-auto max-w-3xl px-8 py-8">
          {/* Header */}
          <div className="mb-4 flex items-start gap-3">
            <button
              onClick={() => setIconOpen((v) => !v)}
              className="text-3xl hover:scale-110 transition-transform"
              title="Change icon"
            >
              {pageBlock.icon}
            </button>
            <input
              className="flex-1 bg-transparent text-[28px] font-semibold leading-[1.15] outline-none"
              style={{
                color: 'var(--text0)',
                letterSpacing: '-0.022em',
              }}
              defaultValue={pageBlock.title}
              onBlur={(e) => updateBlock(pageBlock.id, { title: e.target.value })}
            />
          </div>

          {/* Properties bar */}
          <div className="mb-6 flex flex-wrap items-center gap-4 text-[15px]" style={{ color: 'var(--text2)' }}>
            <div className="flex items-center gap-2">
              <Calendar size={12} />
              <span>Due</span>
              <input
                type="date"
                defaultValue={pageBlock.deadline ?? ''}
                className="rounded px-2 py-1 outline-none"
                style={{ background: 'var(--bg2)', color: 'var(--text0)' }}
                onChange={(e) => updateBlock(pageBlock.id, { deadline: e.target.value })}
              />
            </div>
            <button
              onClick={() => setColorOpen((v) => !v)}
              className="flex items-center gap-2 transition-colors duration-150"
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text0)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text2)')}
            >
              <Palette size={12} /> Color
            </button>
            <div className="flex items-center gap-2">
              <Link2 size={12} />
              <span>{connections.length} connection{connections.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          {iconOpen && (
            <div className="mb-4">
              <EmojiPicker
                onEmojiClick={(d) => {
                  updateBlock(pageBlock.id, { icon: d.emoji })
                  setIconOpen(false)
                }}
                width={320}
                height={360}
              />
            </div>
          )}

          {colorOpen && (
            <div className="mb-4 flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className="h-8 w-8 rounded border"
                  style={{ background: c, borderColor: 'var(--border)' }}
                  onClick={() => {
                    updateBlock(pageBlock.id, { color: c })
                    setColorOpen(false)
                  }}
                />
              ))}
            </div>
          )}

          {/* Connections list */}
          {connections.length > 0 && (
            <div
              className="mb-6 rounded border p-3"
              style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg2) 70%, transparent)' }}
            >
              <div className="mb-2 font-mono text-[13px] font-medium uppercase tracking-[0.06em] text-[color:var(--cs-accent)]">Linked to</div>
              <div className="space-y-1">
                {connections.map(({ connector, other }) => (
                  <button
                    key={connector.id}
                    onClick={() => centerOnBlock(other!.id)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[14px] transition-colors duration-150 hover:bg-[color:var(--cs-accent)]/10"
                    style={{ color: 'var(--text1)' }}
                  >
                    <span className="font-mono text-[13px] uppercase" style={{ color: 'var(--text2)' }}>{other!.kind}</span>
                    <span className="flex-1 truncate">
                      {('title' in other! ? (other as { title?: string }).title : null) ||
                        ('text' in other! ? (other as { text?: string }).text : null) ||
                        '(untitled)'}
                    </span>
                    <ArrowRight size={10} className="text-[color:var(--cs-accent)]" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Content blocks — click anywhere below the content column to add
              a new line. Fills remaining viewport so even a nearly-empty page
              has a huge clickable target. */}
          <div
            className="min-h-[calc(100vh-240px)]"
            onClick={(e) => {
              if (e.target !== e.currentTarget) return
              const last = pageBlock.content[pageBlock.content.length - 1]
              if (last && 'text' in last && last.text === '') {
                refs.current[last.id]?.focus()
              } else if (last) {
                insertAfter(last.id, 'p')
              }
            }}
          >
            {pageBlock.content.map(renderItem)}
          </div>
        </div>

        {/* Slash command menu */}
        {slashMenu && (() => {
          const filtered = getFilteredTypes(slashMenu.filter)
          return (
            <div
              data-slash-menu
              className="fixed z-[60] w-60 overflow-hidden rounded-md border py-1 shadow-2xl"
              style={{
                left: Math.min(slashMenu.x, window.innerWidth - 240),
                top: Math.min(slashMenu.y, window.innerHeight - 300),
                background: 'var(--bg2)',
                borderColor: 'var(--border)',
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-1 text-[11.5px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--text3)' }}>
                Turn into {slashMenu.filter && <span style={{ color: 'var(--cs-accent)' }}>· {slashMenu.filter}</span>}
              </div>
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-[13px]" style={{ color: 'var(--text2)' }}>No match — press Esc</div>
              )}
              {filtered.map((t, i) => {
                const Icon = t.Icon
                const active = i === slashMenu.selected
                return (
                  <button
                    key={t.type}
                    className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors duration-100 ${
                      active ? 'bg-[color:var(--cs-accent)]/20 text-[color:var(--cs-accent2)]' : 'text-[color:var(--text1)] hover:bg-[color:var(--bg3)]'
                    }`}
                    onMouseEnter={() => setSlashMenu((m) => m ? { ...m, selected: i } : m)}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      applySlashCommand(t.type, slashMenu.blockId)
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
                    <span className="flex-1 truncate">{t.label}</span>
                    <span className="text-[11.5px] truncate" style={{ color: 'var(--text3)' }}>{t.description}</span>
                  </button>
                )
              })}
            </div>
          )
        })()}

        {/* Block context menu (right-click or grip click) */}
        {blockMenu && (() => {
          const menuBlock = pageBlock.content.find((x) => x.id === blockMenu.blockId)
          if (!menuBlock) return null
          return (
            <div
              data-block-menu
              className="fixed z-[60] w-52 overflow-hidden rounded-md border py-1 shadow-2xl"
              style={{
                left: blockMenu.x,
                top: blockMenu.y,
                background: 'var(--bg2)',
                borderColor: 'var(--border)',
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {!blockMenu.showTurnInto ? (
                <>
                  <button
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors duration-100"
                    style={{ color: 'var(--text1)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg3)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setBlockMenu((m) => m ? { ...m, showTurnInto: true } : m) }}
                  >
                    <ArrowRightLeft size={14} style={{ color: 'var(--text2)' }} />
                    <span className="flex-1">Turn into</span>
                    <span className="text-[13px]" style={{ color: 'var(--text3)' }}>›</span>
                  </button>
                  <button
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors duration-100"
                    style={{ color: 'var(--text1)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg3)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onMouseDown={(e) => {
                      e.preventDefault(); e.stopPropagation()
                      duplicateItem(blockMenu.blockId)
                      setBlockMenu(null)
                    }}
                  >
                    <Copy size={14} style={{ color: 'var(--text2)' }} />
                    Duplicate
                  </button>
                  <div className="my-1 h-px" style={{ background: 'var(--border)' }} />
                  <button
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] text-red-400 hover:bg-red-500/10"
                    onMouseDown={(e) => {
                      e.preventDefault(); e.stopPropagation()
                      removeItem(blockMenu.blockId)
                      setBlockMenu(null)
                    }}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-1 text-left text-[13px] transition-colors duration-100"
                    style={{ color: 'var(--text2)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg3)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setBlockMenu((m) => m ? { ...m, showTurnInto: false } : m) }}
                  >
                    ‹ Back
                  </button>
                  <div className="my-1 h-px" style={{ background: 'var(--border)' }} />
                  {BLOCK_TYPES.map((t) => {
                    const Icon = t.Icon
                    const active = menuBlock.type === t.type
                    return (
                      <button
                        key={t.type}
                        className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] transition-colors duration-100 ${
                          active ? 'bg-[color:var(--cs-accent)]/20 text-[color:var(--cs-accent2)]' : 'text-[color:var(--text1)] hover:bg-[color:var(--bg3)]'
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault(); e.stopPropagation()
                          applySlashCommand(t.type, blockMenu.blockId)
                          setBlockMenu(null)
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
                        {t.label}
                      </button>
                    )
                  })}
                </>
              )}
            </div>
          )
        })()}
      </motion.div>
    </AnimatePresence>
  )
}
