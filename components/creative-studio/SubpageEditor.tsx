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
import { ChevronLeft, Calendar, Palette, Link2, ArrowRight } from 'lucide-react'

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })

const BLOCK_TYPES: { type: SubPageBlock['type']; label: string }[] = [
  { type: 'h1', label: 'Heading 1' },
  { type: 'h2', label: 'Heading 2' },
  { type: 'h3', label: 'Heading 3' },
  { type: 'p', label: 'Paragraph' },
  { type: 'bullet', label: 'Bullet list' },
  { type: 'todo', label: 'To-do' },
  { type: 'divider', label: 'Divider' },
  { type: 'image', label: 'Image' },
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

  const [slashMenu, setSlashMenu] = useState<{ blockId: string; x: number; y: number } | null>(null)
  const [iconOpen, setIconOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const focusNextRef = useRef<string | null>(null)

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
      // Keep at least one paragraph so there's always a place to type.
      next.push({ id: uid(), type: 'p', text: '' })
    }
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

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>, item: SubPageBlock) => {
    if (e.key === '/' && e.currentTarget.value === '') {
      const rect = e.currentTarget.getBoundingClientRect()
      setSlashMenu({ blockId: item.id, x: rect.left, y: rect.bottom })
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      insertAfter(item.id, item.type === 'bullet' || item.type === 'todo' ? item.type : 'p')
    }
    // Only delete a block on backspace if the textarea is truly empty AND it's not the last block
    if (e.key === 'Backspace' && pageBlock.content.length > 1) {
      const val = e.currentTarget.value
      const cursor = e.currentTarget.selectionStart
      // Only remove the block if content is empty and cursor is at start
      if (val === '' && cursor === 0) {
        e.preventDefault()
        // Focus the previous block
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
    if (item.type === 'divider') {
      return (
        <div key={item.id} className="group relative my-4">
          <hr className="border-[#2a2a2a]" />
          <button
            onClick={() => removeItem(item.id)}
            className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-[10px] text-neutral-600 hover:text-red-400"
          >
            delete
          </button>
        </div>
      )
    }
    if (item.type === 'image') {
      return (
        <div key={item.id} className="my-2">
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
      )
    }
    const cls =
      item.type === 'h1' ? 'text-3xl font-bold'
      : item.type === 'h2' ? 'text-2xl font-semibold'
      : item.type === 'h3' ? 'text-xl font-semibold'
      : 'text-base'
    return (
      <div key={item.id} className="flex items-start gap-2 py-1">
        {item.type === 'bullet' && <span className="mt-2 text-neutral-500">•</span>}
        {item.type === 'todo' && (
          <input
            type="checkbox"
            checked={item.checked ?? false}
            onChange={(e) =>
              setContent(
                pageBlock.content.map((x) => (x.id === item.id ? ({ ...x, checked: e.target.checked } as SubPageBlock) : x))
              )
            }
            className="mt-2"
          />
        )}
        <textarea
          ref={(el) => {
            refs.current[item.id] = el
            if (el) autoResize(el)
          }}
          defaultValue={item.text}
          rows={1}
          placeholder={item.type === 'p' ? "Type '/' for commands…" : ''}
          className={`flex-1 resize-none overflow-hidden bg-transparent text-white placeholder:text-neutral-600 focus:outline-none ${cls} ${
            item.type === 'todo' && item.checked ? 'text-neutral-500 line-through' : ''
          }`}
          onInput={(e) => autoResize(e.currentTarget)}
          onBlur={(e) =>
            setContent(pageBlock.content.map((x) => (x.id === item.id ? ({ ...x, text: e.target.value } as SubPageBlock) : x)))
          }
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
          <div>{pageBlock.content.map(renderItem)}</div>
        </div>

        {slashMenu && (
          <div
            className="fixed z-[60] w-48 rounded border border-[#2a2a2a] bg-[#141414] py-1 shadow-xl"
            style={{ left: slashMenu.x, top: slashMenu.y }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {BLOCK_TYPES.map((t) => (
              <button
                key={t.type}
                className="block w-full px-3 py-1 text-left text-[12px] text-neutral-200 hover:bg-amber-500/20"
                onClick={() => {
                  // Clear the "/" from the textarea before changing type
                  const el = refs.current[slashMenu.blockId]
                  if (el && (el.value === '/' || el.value.trim() === '/')) {
                    el.value = ''
                    // Commit empty text
                    setContent(pageBlock.content.map((x) => (x.id === slashMenu.blockId ? ({ ...x, text: '' } as SubPageBlock) : x)))
                  }
                  changeType(slashMenu.blockId, t.type)
                  setSlashMenu(null)
                  // Re-focus the textarea
                  focusNextRef.current = slashMenu.blockId
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
