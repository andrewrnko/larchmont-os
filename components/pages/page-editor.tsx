'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type {
  ChangeEvent,
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Square, CheckSquare } from 'lucide-react'
import { usePagesStore } from '@/lib/pages-store'
import type { BlockType, PageBlock } from '@/lib/pages-store'
import { PageHeader } from '@/components/shared/page-header'

// ─── Constants ─────────────────────────────────────────────────────────────

const ICON_PRESETS = ['📄', '📝', '✅', '🎯', '💡', '🔖', '📎', '📊', '🎨'] as const

interface SlashCommand {
  label: string
  type: BlockType
  level?: 1 | 2 | 3
}

const SLASH_COMMANDS: readonly SlashCommand[] = [
  { label: 'Heading 1', type: 'heading', level: 1 },
  { label: 'Heading 2', type: 'heading', level: 2 },
  { label: 'Heading 3', type: 'heading', level: 3 },
  { label: 'Text', type: 'text' },
  { label: 'To-do', type: 'todo' },
  { label: 'Quote', type: 'quote' },
  { label: 'Divider', type: 'divider' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  if (sec < 10) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

// ─── Sortable block wrapper ────────────────────────────────────────────────

interface SortableBlockProps {
  block: PageBlock
  children: (dragHandleProps: {
    attributes: ReturnType<typeof useSortable>['attributes']
    listeners: ReturnType<typeof useSortable>['listeners']
  }) => React.ReactNode
}

function SortableBlock({ block, children }: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="group">
      {children({ attributes, listeners })}
    </div>
  )
}

// ─── Slash menu ────────────────────────────────────────────────────────────

interface SlashMenuProps {
  x: number
  y: number
  activeIndex: number
  onSelect: (cmd: SlashCommand) => void
  onHover: (index: number) => void
}

function SlashMenu({ x, y, activeIndex, onSelect, onHover }: SlashMenuProps) {
  return (
    <div
      className="fixed z-50 w-[200px] rounded-[8px] border bg-[color:var(--bg1)] py-1"
      style={{
        left: x,
        top: y,
        borderColor: 'var(--border)',
      }}
    >
      {SLASH_COMMANDS.map((cmd, i) => (
        <button
          key={cmd.label}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(cmd)
          }}
          onMouseEnter={() => onHover(i)}
          className="flex w-full items-center px-3 py-1.5 text-left text-[13px] transition-colors duration-100"
          style={{
            background: i === activeIndex ? 'var(--bg3)' : 'transparent',
            color: 'var(--text1)',
          }}
        >
          {cmd.label}
        </button>
      ))}
    </div>
  )
}

// ─── Block row (renders per-type editor) ───────────────────────────────────

interface BlockRowProps {
  pageId: string
  block: PageBlock
  index: number
  totalBlocks: number
  registerRef: (id: string, el: HTMLElement | null) => void
  focusPrev: (index: number) => void
  focusNext: (index: number) => void
}

function BlockRow({
  pageId,
  block,
  index,
  totalBlocks,
  registerRef,
  focusPrev,
  focusNext,
}: BlockRowProps) {
  const updateBlock = usePagesStore((s) => s.updateBlock)
  const addBlock = usePagesStore((s) => s.addBlock)
  const removeBlock = usePagesStore((s) => s.removeBlock)

  const [localValue, setLocalValue] = useState(block.content)
  // Track focus so we only render the placeholder on the currently-focused
  // block — prevents the "Type / for commands" text from stacking across
  // every empty line (Notion-style).
  const [focused, setFocused] = useState(false)
  const [slashMenu, setSlashMenu] = useState<{
    x: number
    y: number
    activeIndex: number
  } | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Sync local state when store changes externally.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalValue(block.content)
  }, [block.content])

  // Auto-resize textarea.
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [localValue, block.type])

  const commitValue = (value: string) => {
    if (value !== block.content) {
      updateBlock(pageId, block.id, { content: value })
    }
  }

  const addTextAfter = () => {
    const newId = addBlock(pageId, { type: 'text', content: '' }, index + 1)
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-block-id="${newId}"]`
      )
      el?.focus()
    }, 0)
  }

  const deleteSelf = () => {
    removeBlock(pageId, block.id)
    setTimeout(() => focusPrev(index), 0)
  }

  const handleKeyDown = (
    e: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (slashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashMenu({
          ...slashMenu,
          activeIndex: (slashMenu.activeIndex + 1) % SLASH_COMMANDS.length,
        })
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashMenu({
          ...slashMenu,
          activeIndex:
            (slashMenu.activeIndex - 1 + SLASH_COMMANDS.length) %
            SLASH_COMMANDS.length,
        })
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        applySlashCommand(SLASH_COMMANDS[slashMenu.activeIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setSlashMenu(null)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      commitValue(localValue)
      addTextAfter()
      return
    }

    if (e.key === 'Backspace' && localValue.length === 0 && totalBlocks > 1) {
      e.preventDefault()
      deleteSelf()
      return
    }

    if (e.key === 'ArrowUp' && !e.shiftKey) {
      const target = e.currentTarget
      if (
        target instanceof HTMLInputElement ||
        (target instanceof HTMLTextAreaElement &&
          target.selectionStart === 0)
      ) {
        e.preventDefault()
        commitValue(localValue)
        focusPrev(index)
      }
      return
    }

    if (e.key === 'ArrowDown' && !e.shiftKey) {
      const target = e.currentTarget
      if (
        target instanceof HTMLInputElement ||
        (target instanceof HTMLTextAreaElement &&
          target.selectionStart === target.value.length)
      ) {
        e.preventDefault()
        commitValue(localValue)
        focusNext(index)
      }
    }
  }

  const applySlashCommand = (cmd: SlashCommand) => {
    setSlashMenu(null)
    const patch: Partial<PageBlock> = { type: cmd.type, content: '' }
    if (cmd.type === 'heading') {
      patch.level = cmd.level ?? 1
    }
    if (cmd.type === 'todo') {
      patch.done = false
    }
    setLocalValue('')
    updateBlock(pageId, block.id, patch)
  }

  const handleTextChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value
    setLocalValue(value)

    if (block.type === 'text' && value === '/') {
      const rect = e.currentTarget.getBoundingClientRect()
      setSlashMenu({
        x: rect.left,
        y: rect.bottom + 4,
        activeIndex: 0,
      })
    } else if (slashMenu && !value.startsWith('/')) {
      setSlashMenu(null)
    }
  }

  const setRef = (el: HTMLElement | null) => {
    registerRef(block.id, el)
    if (el instanceof HTMLTextAreaElement) textareaRef.current = el
    if (el instanceof HTMLInputElement) inputRef.current = el
  }

  // ─── Block-type rendering ───────────────────────────────────────────────

  const renderContent = () => {
    if (block.type === 'divider') {
      return (
        <div
          className="my-3 h-px w-full"
          style={{ background: 'var(--border)' }}
        />
      )
    }

    if (block.type === 'heading') {
      const level = block.level ?? 1
      const sizeClass =
        level === 1
          ? 'text-[24px]'
          : level === 2
          ? 'text-[20px]'
          : 'text-[17px]'
      return (
        <input
          ref={setRef}
          data-block-id={block.id}
          type="text"
          value={localValue}
          placeholder={focused ? `Heading ${level}` : ''}
          onChange={handleTextChange}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            commitValue(localValue)
          }}
          onKeyDown={handleKeyDown}
          className={`w-full bg-transparent font-semibold outline-none placeholder:text-[color:var(--text3)] ${sizeClass}`}
          style={{ color: 'var(--text0)' }}
        />
      )
    }

    if (block.type === 'todo') {
      const done = block.done ?? false
      return (
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() =>
              updateBlock(pageId, block.id, { done: !done })
            }
            className="mt-[2px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] transition-colors duration-150"
            style={{ color: done ? 'var(--accent)' : 'var(--text2)' }}
            aria-label={done ? 'Mark as not done' : 'Mark as done'}
          >
            {done ? <CheckSquare size={18} strokeWidth={2.2} /> : <Square size={18} strokeWidth={2.2} />}
          </button>
          <input
            ref={setRef}
            data-block-id={block.id}
            type="text"
            value={localValue}
            placeholder={focused ? 'To-do' : ''}
            onChange={handleTextChange}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false)
              commitValue(localValue)
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-[14px] outline-none placeholder:text-[color:var(--text3)]"
            style={{
              color: done ? 'var(--text2)' : 'var(--text0)',
              textDecoration: done ? 'line-through' : 'none',
            }}
          />
        </div>
      )
    }

    if (block.type === 'quote') {
      return (
        <div
          className="pl-3 italic"
          style={{ borderLeft: '2px solid var(--accent)' }}
        >
          <textarea
            ref={setRef}
            data-block-id={block.id}
            value={localValue}
            placeholder={focused ? 'Quote' : ''}
            onChange={handleTextChange}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false)
              commitValue(localValue)
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            className="w-full resize-none overflow-hidden bg-transparent text-[14px] leading-[1.6] italic outline-none placeholder:text-[color:var(--text3)]"
            style={{ color: 'var(--text1)' }}
          />
        </div>
      )
    }

    // text
    return (
      <textarea
        ref={setRef}
        data-block-id={block.id}
        value={localValue}
        placeholder={focused ? "Type something, or press / for commands…" : ''}
        onChange={handleTextChange}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          commitValue(localValue)
        }}
        onKeyDown={handleKeyDown}
        rows={1}
        className="w-full resize-none overflow-hidden bg-transparent text-[14px] leading-[1.6] outline-none placeholder:text-[color:var(--text3)]"
        style={{ color: 'var(--text0)' }}
      />
    )
  }

  return (
    <>
      {renderContent()}
      {slashMenu && (
        <SlashMenu
          x={slashMenu.x}
          y={slashMenu.y}
          activeIndex={slashMenu.activeIndex}
          onSelect={applySlashCommand}
          onHover={(i) =>
            setSlashMenu((prev) => (prev ? { ...prev, activeIndex: i } : prev))
          }
        />
      )}
    </>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export function PageEditor({ pageId }: { pageId: string }) {
  const hydrated = usePagesStore((s) => s.hydrated)
  const page = usePagesStore((s) =>
    s.pages.find((p) => p.id === pageId)
  )
  const renamePage = usePagesStore((s) => s.renamePage)
  const setPageIcon = usePagesStore((s) => s.setPageIcon)
  const addBlock = usePagesStore((s) => s.addBlock)
  const reorderBlocks = usePagesStore((s) => s.reorderBlocks)

  const [titleDraft, setTitleDraft] = useState(page?.title ?? '')
  const blockRefs = useRef<Map<string, HTMLElement>>(new Map())

  // Sync local title draft when the loaded page changes. Standard
  // prop-driven reset; the lint rule is overzealous for this pattern.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (page) setTitleDraft(page.title)
  }, [page?.id, page?.title])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const blockIds = useMemo(
    () => page?.blocks.map((b) => b.id) ?? [],
    [page?.blocks]
  )

  if (!hydrated) return null

  if (!page) {
    return (
      <div
        className="mx-auto max-w-[760px] px-6 pb-16 pt-8 text-[14px]"
        style={{ color: 'var(--text2)' }}
      >
        Page not found
      </div>
    )
  }

  const registerRef = (id: string, el: HTMLElement | null) => {
    if (el) blockRefs.current.set(id, el)
    else blockRefs.current.delete(id)
  }

  const focusBlockAt = (index: number) => {
    const target = page.blocks[index]
    if (!target) return
    const el = blockRefs.current.get(target.id)
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.focus()
      if ('setSelectionRange' in el) {
        const len = el.value.length
        el.setSelectionRange(len, len)
      }
    }
  }

  const focusPrev = (from: number) => {
    for (let i = from - 1; i >= 0; i--) {
      const b = page.blocks[i]
      if (b.type !== 'divider') {
        focusBlockAt(i)
        return
      }
    }
  }

  const focusNext = (from: number) => {
    for (let i = from + 1; i < page.blocks.length; i++) {
      const b = page.blocks[i]
      if (b.type !== 'divider') {
        focusBlockAt(i)
        return
      }
    }
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = page.blocks.findIndex((b) => b.id === active.id)
    const to = page.blocks.findIndex((b) => b.id === over.id)
    if (from === -1 || to === -1) return
    reorderBlocks(pageId, from, to)
  }

  const cycleIcon = () => {
    const current = ICON_PRESETS.indexOf(
      page.icon as (typeof ICON_PRESETS)[number]
    )
    const next = ICON_PRESETS[(current + 1) % ICON_PRESETS.length]
    setPageIcon(pageId, next)
  }

  const commitTitle = () => {
    if (titleDraft !== page.title) {
      renamePage(pageId, titleDraft)
    }
  }

  const handleAddBlock = () => {
    // Don't stack empty lines — focus the existing empty last block instead.
    const last = page.blocks[page.blocks.length - 1]
    if (last && last.type === 'text' && last.content === '') {
      const el = document.querySelector<HTMLElement>(`[data-block-id="${last.id}"]`)
      el?.focus()
      return
    }
    const id = addBlock(pageId, { type: 'text', content: '' })
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-block-id="${id}"]`
      )
      el?.focus()
    }, 0)
  }

  const tintBg = `${page.tint}26`

  return (
    <>
      {/* Sticky breadcrumb bar — full width, matches other pages */}
      <PageHeader title={page.title || 'Untitled'} />

      <div className="mx-auto max-w-[760px] pb-16 pt-4">
      {/* Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={cycleIcon}
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-[8px] text-[22px] transition-colors duration-100"
          style={{ background: tintBg, color: page.tint }}
          aria-label="Change page icon"
        >
          {page.icon}
        </button>
        <input
          type="text"
          value={titleDraft}
          placeholder="Untitled"
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
          className="w-full bg-transparent text-[32px] font-semibold outline-none placeholder:text-[color:var(--text3)]"
          style={{ color: 'var(--text0)', border: 'none' }}
        />
        <div
          className="mt-1 text-[12px]"
          style={{ color: 'var(--text3)' }}
        >
          Last edited {formatRelativeTime(page.updatedAt)}
        </div>
      </div>

      {/* Block list — click below the last block to add a new line. */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blockIds}
          strategy={verticalListSortingStrategy}
        >
          <div
            className="flex flex-col min-h-[200px]"
            onClick={(e) => {
              // Only trigger on empty area clicks, not on a child block
              if (e.target === e.currentTarget) handleAddBlock()
            }}
          >
            {page.blocks.map((block, index) => (
              <SortableBlock key={block.id} block={block}>
                {({ attributes, listeners }) => (
                  <div className="group relative flex items-start gap-1 py-[2px] pl-6 pr-6">
                    <button
                      type="button"
                      {...attributes}
                      {...listeners}
                      className="absolute left-0 top-[6px] flex h-5 w-5 cursor-grab items-center justify-center opacity-0 transition-opacity duration-100 group-hover:opacity-100 active:cursor-grabbing"
                      style={{ color: 'var(--text3)' }}
                      aria-label="Drag to reorder"
                    >
                      <GripVertical size={16} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <BlockRow
                        pageId={pageId}
                        block={block}
                        index={index}
                        totalBlocks={page.blocks.length}
                        registerRef={registerRef}
                        focusPrev={focusPrev}
                        focusNext={focusNext}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        usePagesStore
                          .getState()
                          .removeBlock(pageId, block.id)
                      }}
                      className="absolute right-0 top-[6px] flex h-5 w-5 items-center justify-center opacity-0 transition-opacity duration-100 group-hover:opacity-100 hover:text-[color:var(--text1)]"
                      style={{ color: 'var(--text3)' }}
                      aria-label="Delete block"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </SortableBlock>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      </div>
    </>
  )
}
