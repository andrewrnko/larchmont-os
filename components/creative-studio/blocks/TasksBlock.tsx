// Tasks block — real checkbox task list with priority labels and focus button.
// Connected to planner's focus mode. AI assistant can read and create tasks here.

'use client'

import { useState } from 'react'
import { useCanvasStore, uid } from '../store'
import { usePlannerStore } from '../store'
import type { TasksBlock, TaskItem } from '../types'
import { BlockWrapper } from '../BlockWrapper'
import { Plus, Play, Trash2, CheckSquare } from 'lucide-react'

const PRIORITY_COLORS: Record<number, string> = {
  1: 'text-[color:var(--cs-accent)] bg-[color:var(--cs-accent)]/15',
  2: 'text-blue-400 bg-blue-400/15',
  3: 'text-[#c8c4bc] bg-neutral-500/15',
}

interface Props {
  block: TasksBlock
  onContextMenu?: (e: React.MouseEvent) => void
}

export function TasksBlockView({ block, onContextMenu }: Props) {
  const updateBlock = useCanvasStore((s) => s.updateBlock)
  const startFocus = usePlannerStore((s) => s.startFocus)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<1 | 2 | 3>(1)

  const setItems = (fn: (items: TaskItem[]) => TaskItem[]) => {
    updateBlock(block.id, { taskItems: fn(block.taskItems) })
  }

  const addTask = () => {
    if (!newTitle.trim()) return
    const item: TaskItem = {
      id: uid(),
      title: newTitle.trim(),
      done: false,
      priority: newPriority,
      createdAt: Date.now(),
    }
    setItems((t) => [...t, item])
    setNewTitle('')
    import('../tracking').then((m) => m.trackTaskCompleted({ rank: newPriority, title: item.title })).catch(() => {})
  }

  const toggleDone = (id: string) => {
    setItems((t) =>
      t.map((x) =>
        x.id === id ? { ...x, done: !x.done, completedAt: !x.done ? Date.now() : undefined } : x
      )
    )
  }

  const removeTask = (id: string) => {
    setItems((t) => t.filter((x) => x.id !== id))
  }

  const handleFocus = (item: TaskItem) => {
    startFocus(item.id, 25)
  }

  const doneCount = block.taskItems.filter((t) => t.done).length
  const totalCount = block.taskItems.length

  return (
    <BlockWrapper block={block} kind="tasks" onContextMenu={onContextMenu}>
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-lg border shadow-lg"
        style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <CheckSquare size={15} className="text-[color:var(--cs-accent)]" />
            <input
              className="bg-transparent text-[15px] font-semibold outline-none"
              style={{ color: 'var(--text0)' }}
              defaultValue={block.label}
              onBlur={(e) => updateBlock(block.id, { label: e.target.value })}
            />
          </div>
          {totalCount > 0 && (
            <span className="font-mono text-[13px] text-[#888780]">
              {doneCount}/{totalCount}
            </span>
          )}
        </div>

        {/* Task list */}
        <div data-scrollable className="flex-1 overflow-auto p-3 space-y-0.5">
          {block.taskItems
            .sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3))
            .map((item) => (
              <div
                key={item.id}
                className={`group flex items-center gap-3 rounded-md px-3 py-2 ${
                  item.done ? 'opacity-40' : 'hover:bg-[#242422]'
                }`}
                style={{ minHeight: 36 }}
              >
                <button
                  onClick={() => toggleDone(item.id)}
                  className="flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[3px] border transition-colors duration-150"
                  style={{
                    borderColor: item.done ? 'var(--accent)' : 'var(--border-strong)',
                    background: item.done ? 'var(--accent)' : 'transparent',
                  }}
                  aria-label={item.done ? 'Mark as not done' : 'Mark as done'}
                >
                  {item.done && (
                    <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="#0a0a09" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 8 7 12 13 4" />
                    </svg>
                  )}
                </button>
                {item.priority && (
                  <span
                    className={`rounded px-2.5 py-0.5 font-mono text-[15px] font-bold ${
                      PRIORITY_COLORS[item.priority] ?? PRIORITY_COLORS[3]
                    }`}
                  >
                    P{item.priority}
                  </span>
                )}
                <span
                  className={`flex-1 text-[15px] leading-[1.5] ${
                    item.done ? 'text-[#888780] line-through' : 'text-white'
                  }`}
                >
                  {item.title}
                </span>
                {!item.done && (
                  <button
                    onClick={() => handleFocus(item)}
                    className="rounded bg-[color:var(--cs-accent)]/20 p-1.5 text-[color:var(--cs-accent2)] opacity-0 group-hover:opacity-100 hover:bg-[color:var(--cs-accent2)]/40"
                    title="Start Focus"
                  >
                    <Play size={11} />
                  </button>
                )}
                <button
                  onClick={() => removeTask(item.id)}
                  className="text-[#555450] opacity-0 group-hover:opacity-100 hover:text-red-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
        </div>

        {/* Add task input */}
        <div className="border-t border-[color:rgba(255,255,255,0.07)] p-3">
          <div className="flex gap-1.5">
            <div className="flex gap-0.5">
              {([1, 2, 3] as const).map((p) => (
                <button
                  key={p}
                  className={`rounded px-2.5 py-1 font-mono text-[15px] font-bold ${
                    newPriority === p
                      ? PRIORITY_COLORS[p]
                      : 'text-[#555450] hover:text-[#c8c4bc]'
                  }`}
                  onClick={() => setNewPriority(p)}
                >
                  P{p}
                </button>
              ))}
            </div>
            <input
              className="flex-1 rounded bg-[#1c1c1a] px-3 py-1.5 text-[15px] leading-[1.5] text-white outline-none placeholder:text-[#555450]"
              placeholder="Add task…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addTask() }
              }}
            />
            <button
              onClick={addTask}
              disabled={!newTitle.trim()}
              className="rounded bg-[color:var(--cs-accent)] p-1.5 text-black disabled:opacity-30 hover:bg-[color:var(--cs-accent2)]"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>
    </BlockWrapper>
  )
}
