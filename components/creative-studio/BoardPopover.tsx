// Compact board switcher — replaces the old fixed 240px sidebar.
// Default state: just a pinned button in the top-left of the canvas showing
// the current board's icon. Clicking it opens a floating panel with the
// full board list, create/rename/delete/import/export — same features as the
// old BoardSidebar, just out of the way.

'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trash2, Download, Upload, ChevronDown, X,
} from 'lucide-react'
import { useCanvasStore, exportAllData, importAllData } from './store'

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })

export function BoardPopover() {
  const boards = useCanvasStore((s) => s.boards)
  const activeId = useCanvasStore((s) => s.activeBoardId)
  const setActive = useCanvasStore((s) => s.setActiveBoard)
  const createBoard = useCanvasStore((s) => s.createBoard)
  const deleteBoard = useCanvasStore((s) => s.deleteBoard)
  const renameBoard = useCanvasStore((s) => s.renameBoard)

  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📄')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const activeBoard = boards.find((b) => b.id === activeId)
  const rootBoards = boards.filter((b) => !b.parentId)
  const childrenOf = (id: string) => boards.filter((b) => b.parentId === id)

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
        setPickerOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setCreating(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const handleExport = () => {
    const json = exportAllData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `larchmont-cs-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const json = e.target?.result as string
      const result = importAllData(json)
      setImportStatus(
        result.ok
          ? `Imported ${result.boardCount} board${result.boardCount === 1 ? '' : 's'}`
          : result.error ?? 'Import failed'
      )
      setTimeout(() => setImportStatus(null), 3000)
    }
    reader.readAsText(file)
  }

  const submitCreate = () => {
    if (name.trim()) createBoard(name.trim(), icon)
    setName('')
    setIcon('📄')
    setCreating(false)
    setPickerOpen(false)
  }

  const renderBoard = (id: string, depth = 0) => {
    const b = boards.find((x) => x.id === id)
    if (!b) return null
    const children = childrenOf(id)
    const isActive = activeId === id
    return (
      <div key={id}>
        <div
          className={`group relative flex cursor-pointer items-center gap-2.5 py-[7px] pr-2.5 text-[13px] transition-colors duration-150 ${
            isActive
              ? 'text-[color:var(--cs-text0)]'
              : 'text-[color:var(--cs-text1)] hover:bg-[color:var(--cs-bg3)] hover:text-[color:var(--cs-text0)]'
          }`}
          style={{
            paddingLeft: 14 + depth * 14,
            background: isActive ? 'var(--cs-bg3)' : undefined,
            borderLeft: isActive
              ? '2px solid var(--cs-accent)'
              : '2px solid transparent',
          }}
          onClick={() => {
            setActive(id)
            setOpen(false)
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setRenamingId(id)
          }}
        >
          <span className="text-[15px] leading-none">{b.icon}</span>
          {renamingId === id ? (
            <input
              autoFocus
              defaultValue={b.name}
              className="flex-1 bg-transparent text-[13px] outline-none"
              style={{ color: 'var(--cs-text0)' }}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                renameBoard(id, e.target.value || b.name)
                setRenamingId(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') setRenamingId(null)
              }}
            />
          ) : (
            <span className="flex-1 truncate">{b.name}</span>
          )}
          <button
            className="opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            style={{ color: 'var(--cs-text3)' }}
            onClick={(e) => {
              e.stopPropagation()
              if (confirm(`Delete board "${b.name}"?`)) deleteBoard(id)
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#e05050')}
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = 'var(--cs-text3)')
            }
          >
            <Trash2 size={14} />
          </button>
        </div>
        {children.map((c) => renderBoard(c.id, depth + 1))}
      </div>
    )
  }

  return (
    /* Single wrapper pinned to the top-right of the canvas.
       - Button stays visible in the corner, out of the Toolbar's left-center path.
       - Panel opens from the right edge and grows LEFT + DOWN, so it never
         collides with the floating left-side Toolbar.
       - One container ref → outside-click logic works for button + panel. */
    <div ref={popoverRef} className="absolute right-3 top-3 z-30">
      {/* ── Pinned toggle button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2.5 rounded-[8px] border px-3 text-[13px] font-medium shadow-sm transition-colors duration-150 hover:bg-[color:var(--cs-bg3)]"
        style={{
          background: 'var(--cs-bg2)',
          borderColor: 'var(--cs-border2)',
          color: 'var(--cs-text0)',
        }}
        title="Switch board"
      >
        <span className="text-[15px] leading-none">{activeBoard?.icon ?? '📄'}</span>
        <span className="max-w-[180px] truncate">
          {activeBoard?.name ?? 'Boards'}
        </span>
        <ChevronDown
          size={14}
          style={{
            color: 'var(--cs-text2)',
            transform: open ? 'rotate(180deg)' : undefined,
            transition: 'transform 150ms ease',
          }}
        />
      </button>

      {/* ── Floating panel — right-aligned so it grows leftward from the button ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute right-0 top-[42px] flex w-[288px] flex-col overflow-hidden rounded-[10px] border shadow-[0_12px_40px_rgba(0,0,0,0.4)]"
            style={{
              background: 'var(--cs-bg1)',
              borderColor: 'var(--cs-border2)',
              maxHeight: 'min(480px, calc(100vh - 220px))',
            }}
          >
            {/* Panel header */}
            <div
              className="flex items-center justify-between border-b px-3 py-2.5"
              style={{ borderColor: 'var(--cs-border)' }}
            >
              <span
                className="text-[11.5px] font-medium uppercase"
                style={{ color: 'var(--cs-text3)', letterSpacing: '0.08em' }}
              >
                Boards
              </span>
              <div className="flex items-center gap-1">
                <button
                  className="flex h-7 w-7 items-center justify-center rounded-[6px] transition-colors duration-150 hover:bg-[color:var(--cs-bg3)]"
                  style={{ color: 'var(--cs-text2)' }}
                  onClick={() => setCreating((v) => !v)}
                  title="New board"
                >
                  <Plus size={14} />
                </button>
                <button
                  className="flex h-7 w-7 items-center justify-center rounded-[6px] transition-colors duration-150 hover:bg-[color:var(--cs-bg3)]"
                  style={{ color: 'var(--cs-text2)' }}
                  onClick={() => setOpen(false)}
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Create form */}
            {creating && (
              <div
                className="border-b px-3 py-2.5"
                style={{ borderColor: 'var(--cs-border)' }}
              >
                <div className="flex gap-1.5">
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[16px] transition-colors duration-150"
                    style={{ background: 'var(--cs-bg3)' }}
                    onClick={() => setPickerOpen((v) => !v)}
                  >
                    {icon}
                  </button>
                  <input
                    autoFocus
                    className="h-8 flex-1 rounded-[6px] border px-2.5 text-[13px] outline-none"
                    style={{
                      background: 'var(--cs-bg2)',
                      borderColor: 'var(--cs-border)',
                      color: 'var(--cs-text0)',
                    }}
                    placeholder="Board name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitCreate()
                      if (e.key === 'Escape') setCreating(false)
                    }}
                  />
                </div>
                {pickerOpen && (
                  <div className="relative mt-1">
                    <div className="absolute z-50">
                      <EmojiPicker
                        onEmojiClick={(d) => {
                          setIcon(d.emoji)
                          setPickerOpen(false)
                        }}
                        width={260}
                        height={320}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Board list */}
            <div className="flex-1 overflow-auto py-1">
              {rootBoards.length === 0 && (
                <div className="px-3 py-2 text-[13px]" style={{ color: 'var(--cs-text3)' }}>
                  No boards yet.
                </div>
              )}
              {rootBoards.map((b) => renderBoard(b.id))}
            </div>

            {/* Footer: export/import */}
            <div
              className="space-y-1.5 border-t p-2.5"
              style={{ borderColor: 'var(--cs-border)' }}
            >
              {importStatus && (
                <div
                  className="rounded-[6px] px-2.5 py-1.5 text-center text-[12px]"
                  style={{
                    background: 'color-mix(in srgb, var(--cs-accent) 10%, transparent)',
                    color: 'var(--cs-accent2)',
                  }}
                >
                  {importStatus}
                </div>
              )}
              <div className="flex gap-1.5">
                <button
                  onClick={handleExport}
                  className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[6px] border px-2 text-[12.5px] transition-colors duration-150"
                  style={{
                    background: 'var(--cs-bg2)',
                    borderColor: 'var(--cs-border)',
                    color: 'var(--cs-text1)',
                  }}
                  title="Export all boards"
                >
                  <Download size={13} />
                  Export
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[6px] border px-2 text-[12.5px] transition-colors duration-150"
                  style={{
                    background: 'var(--cs-bg2)',
                    borderColor: 'var(--cs-border)',
                    color: 'var(--cs-text1)',
                  }}
                  title="Import boards"
                >
                  <Upload size={13} />
                  Import
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImport(file)
                  e.target.value = ''
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
