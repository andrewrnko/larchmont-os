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
import { ChevronLeft, Calendar, Palette, Link2, ArrowRight, GripVertical, Trash2, Copy, ArrowRightLeft } from 'lucide-react'

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })

const BLOCK_TYPES: { type: SubPageBlock['type']; label: string; icon: string; description: string }[] = [
  { type: 'h1', label: 'Heading 1', icon: 'H1', description: 'Large heading' },
  { type: 'h2', label: 'Heading 2', icon: 'H2', description: 'Medium heading' },
  { type: 'h3', label: 'Heading 3', icon: 'H3', description: 'Small heading' },
  { type: 'p', label: 'Paragraph', icon: '¶', description: 'Plain text' },
  { type: 'bullet', label: 'Bullet list', icon: '•', description: 'Unordered list' },
  { type: 'numbered', label: 'Numbered list', icon: '#', description: 'Ordered list' },
  { type: 'todo', label: 'To-do', icon: '☐', description: 'Checkbox item' },
  { type: 'divider', label: 'Divider', icon: '—', description: 'Horizontal rule' },
  { type: 'image', label: 'Image', icon: '🖼', description: 'Image from URL' },
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

  const getFilteredTypes = (filter: string) =>
    BLOCK_TYPES.filter((t) => t.label.toLowerCase().includes(filter.toLowerCase()))

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
      insertAfter(item.id, item.type === 'bullet' || item.type === 'todo' || item.type === 'numbered' ? item.type : 'p')
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
        <GripVertical size={14} className="text-neutral-600 hover:text-neutral-400" />
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
      return (
        <div
          key={item.id}
          className={`group/block flex items-center gap-0 py-2 rounded ${isDragOver ? 'bg-amber-500/10 border-t border-amber-500/40' : ''}`}
          onContextMenu={blockContextMenu}
          {...dropProps}
        >
          {dragHandle}
          <hr className="flex-1 border-[#2a2a2a]" />
        </div>
      )
    }
    if (item.type === 'image') {
      return (
        <div
          key={item.id}
          className={`group/block flex items-start gap-0 py-1 rounded ${isDragOver ? 'bg-amber-500/10 border-t border-amber-500/40' : ''}`}
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
                className="w-full rounded bg-[#1a1a1a] px-3 py-2 text-sm text-white outline-none"
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
    const cls =
      item.type === 'h1' ? 'text-3xl font-bold'
      : item.type === 'h2' ? 'text-2xl font-semibold'
      : item.type === 'h3' ? 'text-xl font-semibold'
      : 'text-base'
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
        className={`group/block flex items-start gap-0 py-1 rounded ${isDragOver ? 'bg-amber-500/10 border-t border-amber-500/40' : ''}`}
        onContextMenu={blockContextMenu}
        {...dropProps}
      >
        {dragHandle}
        {item.type === 'bullet' && <span className="shrink-0 leading-[1.5rem] text-neutral-500 mr-1">•</span>}
        {item.type === 'numbered' && <span className="shrink-0 min-w-[1.2em] text-right font-mono leading-[1.5rem] text-neutral-500 mr-1">{numberedIndex}.</span>}
        {item.type === 'todo' && (
          <input
            type="checkbox"
            checked={item.checked ?? false}
            onChange={(e) =>
              setContent(
                pageBlock.content.map((x) => (x.id === item.id ? ({ ...x, checked: e.target.checked } as SubPageBlock) : x))
              )
            }
            className="shrink-0 mt-[5px] mr-1"
          />
        )}
        <textarea
          ref={(el) => {
            refs.current[item.id] = el
            if (el) autoResize(el)
          }}
          defaultValue={item.text}
          rows={1}
          placeholder="Type '/' for commands…"
          className={`flex-1 resize-none overflow-hidden bg-transparent text-white placeholder:text-neutral-600 focus:outline-none ${cls} ${
            item.type === 'todo' && item.checked ? 'text-neutral-500 line-through' : ''
          }`}
          onInput={(e) => autoResize(e.currentTarget)}
          onBlur={(e) => {
            if (slashMenu?.blockId === item.id) return
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
        style={{ background: '#0a0a0a' }}
      >
        <div className="sticky top-0 z-10 border-b border-[#2a2a2a] bg-black/70 px-6 py-3 backdrop-blur">
          <button
            onClick={() => openPage(null)}
            className="flex items-center gap-2 text-[11px] text-neutral-500 hover:text-white"
          >
            <ChevronLeft size={12} /> Creative Studio / {board?.name} /{' '}
            <span className="text-white">{pageBlock.title}</span>
          </button>
        </div>

        <div className="mx-auto max-w-3xl px-8 py-8">
          {/* Header */}
          <div className="mb-4 flex items-start gap-3">
            <button
              onClick={() => setIconOpen((v) => !v)}
              className="text-5xl hover:scale-110 transition-transform"
              title="Change icon"
            >
              {pageBlock.icon}
            </button>
            <input
              className="flex-1 bg-transparent text-4xl font-bold text-white outline-none"
              defaultValue={pageBlock.title}
              onBlur={(e) => updateBlock(pageBlock.id, { title: e.target.value })}
            />
          </div>

          {/* Properties bar */}
          <div className="mb-6 flex flex-wrap items-center gap-4 text-[11px] text-neutral-500">
            <div className="flex items-center gap-2">
              <Calendar size={12} />
              <span>Due</span>
              <input
                type="date"
                defaultValue={pageBlock.deadline ?? ''}
                className="rounded bg-[#1a1a1a] px-2 py-1 text-white outline-none"
                onChange={(e) => updateBlock(pageBlock.id, { deadline: e.target.value })}
              />
            </div>
            <button
              onClick={() => setColorOpen((v) => !v)}
              className="flex items-center gap-2 hover:text-white"
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
                  className="h-8 w-8 rounded border border-[#2a2a2a]"
                  style={{ background: c }}
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
            <div className="mb-6 rounded border border-[#2a2a2a] bg-black/30 p-3">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-amber-500">Linked to</div>
              <div className="space-y-1">
                {connections.map(({ connector, other }) => (
                  <button
                    key={connector.id}
                    onClick={() => centerOnBlock(other!.id)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12px] text-neutral-300 hover:bg-amber-500/10"
                  >
                    <span className="font-mono text-[9px] uppercase text-neutral-500">{other!.kind}</span>
                    <span className="flex-1 truncate">
                      {('title' in other! ? (other as { title?: string }).title : null) ||
                        ('text' in other! ? (other as { text?: string }).text : null) ||
                        '(untitled)'}
                    </span>
                    <ArrowRight size={10} className="text-amber-500" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Content blocks */}
          <div>
            {pageBlock.content.map(renderItem)}
            <button
              onClick={() => {
                const lastItem = pageBlock.content[pageBlock.content.length - 1]
                insertAfter(lastItem?.id ?? '', 'p')
              }}
              className="mt-2 w-full rounded py-2 text-center text-[12px] text-neutral-600 hover:bg-[#1a1a1a] hover:text-neutral-400"
            >
              + Add a line
            </button>
          </div>
        </div>

        {/* Slash command menu */}
        {slashMenu && (() => {
          const filtered = getFilteredTypes(slashMenu.filter)
          return (
            <div
              data-slash-menu
              className="fixed z-[60] w-56 overflow-hidden rounded-md border border-[#2a2a2a] bg-[#141414] py-1 shadow-2xl"
              style={{
                left: Math.min(slashMenu.x, window.innerWidth - 240),
                top: Math.min(slashMenu.y, window.innerHeight - 300),
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-neutral-600">
                Turn into {slashMenu.filter && <span className="text-amber-500">· {slashMenu.filter}</span>}
              </div>
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-[11px] text-neutral-500">No match — press Esc</div>
              )}
              {filtered.map((t, i) => (
                <button
                  key={t.type}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] ${
                    i === slashMenu.selected ? 'bg-amber-500/20 text-amber-300' : 'text-neutral-200 hover:bg-[#1a1a1a]'
                  }`}
                  onMouseEnter={() => setSlashMenu((m) => m ? { ...m, selected: i } : m)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    applySlashCommand(t.type, slashMenu.blockId)
                  }}
                >
                  <span className="w-5 text-center text-[14px] leading-none">{t.icon}</span>
                  <span className="flex-1">{t.label}</span>
                  <span className="text-[10px] text-neutral-600">{t.description}</span>
                </button>
              ))}
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
              className="fixed z-[60] w-48 overflow-hidden rounded-md border border-[#2a2a2a] bg-[#141414] py-1 shadow-2xl"
              style={{ left: blockMenu.x, top: blockMenu.y }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {!blockMenu.showTurnInto ? (
                <>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-neutral-200 hover:bg-[#1a1a1a]"
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setBlockMenu((m) => m ? { ...m, showTurnInto: true } : m) }}
                  >
                    <ArrowRightLeft size={12} className="text-neutral-500" />
                    <span className="flex-1">Turn into</span>
                    <span className="text-[10px] text-neutral-600">›</span>
                  </button>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-neutral-200 hover:bg-[#1a1a1a]"
                    onMouseDown={(e) => {
                      e.preventDefault(); e.stopPropagation()
                      duplicateItem(blockMenu.blockId)
                      setBlockMenu(null)
                    }}
                  >
                    <Copy size={12} className="text-neutral-500" />
                    Duplicate
                  </button>
                  <div className="my-1 h-px bg-[#2a2a2a]" />
                  <button
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-red-400 hover:bg-red-500/10"
                    onMouseDown={(e) => {
                      e.preventDefault(); e.stopPropagation()
                      removeItem(blockMenu.blockId)
                      setBlockMenu(null)
                    }}
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-1 text-left text-[10px] text-neutral-500 hover:bg-[#1a1a1a]"
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setBlockMenu((m) => m ? { ...m, showTurnInto: false } : m) }}
                  >
                    ‹ Back
                  </button>
                  <div className="my-1 h-px bg-[#2a2a2a]" />
                  {BLOCK_TYPES.map((t) => (
                    <button
                      key={t.type}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] ${
                        menuBlock.type === t.type ? 'bg-amber-500/20 text-amber-300' : 'text-neutral-200 hover:bg-[#1a1a1a]'
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault(); e.stopPropagation()
                        applySlashCommand(t.type, blockMenu.blockId)
                        setBlockMenu(null)
                      }}
                    >
                      <span className="w-5 text-center text-[13px] leading-none">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </>
              )}
            </div>
          )
        })()}
      </motion.div>
    </AnimatePresence>
  )
}
