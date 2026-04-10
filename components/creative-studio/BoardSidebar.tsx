// Board sidebar — list, create (with emoji), rename, delete, nest.

'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useCanvasStore } from './store'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })

export function BoardSidebar({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: (v: boolean) => void }) {
  const boards = useCanvasStore((s) => s.boards)
  const activeId = useCanvasStore((s) => s.activeBoardId)
  const setActive = useCanvasStore((s) => s.setActiveBoard)
  const createBoard = useCanvasStore((s) => s.createBoard)
  const deleteBoard = useCanvasStore((s) => s.deleteBoard)
  const renameBoard = useCanvasStore((s) => s.renameBoard)

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📄')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const rootBoards = boards.filter((b) => !b.parentId)
  const childrenOf = (id: string) => boards.filter((b) => b.parentId === id)

  const submitCreate = () => {
    if (name.trim()) createBoard(name.trim(), icon)
    setName('')
    setIcon('📄')
    setCreating(false)
    setPickerOpen(false)
  }

  if (collapsed) {
    return (
      <button
        className="flex h-full w-8 items-center justify-center border-r border-[#2a2a2a] bg-[#101010] text-neutral-500 hover:text-white"
        onClick={() => setCollapsed(false)}
      >
        <ChevronRight size={14} />
      </button>
    )
  }

  const renderBoard = (id: string, depth = 0) => {
    const b = boards.find((x) => x.id === id)
    if (!b) return null
    const children = childrenOf(id)
    return (
      <div key={id}>
        <div
          className={`group flex items-center gap-2 rounded px-2 py-1 text-[12px] cursor-pointer ${
            activeId === id ? 'bg-amber-500/20 text-amber-300' : 'text-neutral-300 hover:bg-[#1a1a1a]'
          }`}
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => setActive(id)}
          onDoubleClick={() => setRenamingId(id)}
        >
          <span>{b.icon}</span>
          {renamingId === id ? (
            <input
              autoFocus
              defaultValue={b.name}
              className="flex-1 bg-transparent outline-none"
              onBlur={(e) => {
                renameBoard(id, e.target.value || b.name)
                setRenamingId(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <span className="flex-1 truncate">{b.name}</span>
          )}
          <button
            className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400"
            onClick={(e) => {
              e.stopPropagation()
              if (confirm(`Delete board "${b.name}"?`)) deleteBoard(id)
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
        {children.map((c) => renderBoard(c.id, depth + 1))}
      </div>
    )
  }

  return (
    <div className="flex h-full w-56 flex-col border-r border-[#2a2a2a] bg-[#101010]">
      <div className="flex items-center justify-between border-b border-[#2a2a2a] px-2 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-amber-500">Boards</span>
        <div className="flex gap-1">
          <button
            className="text-neutral-500 hover:text-white"
            onClick={() => setCreating((v) => !v)}
            title="New board"
          >
            <Plus size={14} />
          </button>
          <button
            className="text-neutral-500 hover:text-white"
            onClick={() => setCollapsed(true)}
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>

      {creating && (
        <div className="border-b border-[#2a2a2a] p-2">
          <div className="flex gap-1">
            <button
              className="w-8 rounded bg-[#1a1a1a] text-lg"
              onClick={() => setPickerOpen((v) => !v)}
            >
              {icon}
            </button>
            <input
              autoFocus
              className="flex-1 rounded bg-[#1a1a1a] px-2 text-[12px] text-white outline-none"
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
            <div className="absolute z-50 mt-1">
              <EmojiPicker
                onEmojiClick={(d) => {
                  setIcon(d.emoji)
                  setPickerOpen(false)
                }}
                width={260}
                height={320}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto p-1">
        {rootBoards.length === 0 && (
          <div className="p-2 text-[11px] text-neutral-600">No boards yet. Click + to create one.</div>
        )}
        {rootBoards.map((b) => renderBoard(b.id))}
      </div>
    </div>
  )
}
