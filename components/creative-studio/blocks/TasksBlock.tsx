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
  1: 'text-amber-500 bg-amber-500/15',
  2: 'text-blue-400 bg-blue-400/15',
  3: 'text-neutral-400 bg-neutral-500/15',
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
    // Track
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
      <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-[#2a2a2a] bg-[#0e0e0d] shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#141412] px-3 py-2">
          <div className="flex items-center gap-2">
            <CheckSquare size={14} className="text-amber-500" />
            <input
              className="bg-transparent text-[14px] font-medium text-white outline-none"
              defaultValue={block.label}
              onBlur={(e) => updateBlock(block.id, { label: e.target.value })}
            />
          </div>
          {totalCount > 0 && (
            <span className="font-mono text-[10px] text-neutral-500">
              {doneCount}/{totalCount}
            </span>
          )}
        </div>

        {/* Task list */}
        <div data-scrollable className="flex-1 overflow-auto p-2 space-y-0.5">
          {block.taskItems
            .sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3))
            .map((item) => (
              <div
                key={item.id}
                className={`group flex items-center gap-2 rounded px-2 py-1.5 ${
                  item.done ? 'opacity-40' : 'hover:bg-[#1a1a1a]'
                }`}
              >
                <button
                  onClick={() => toggleDone(item.id)}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                    item.done
                      ? 'border-amber-500 bg-amber-500 text-black'
                      : 'border-neutral-600'
                  }`}
                >
                  {item.done && '✓'}
                </button>
                {item.priority && (
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                      PRIORITY_COLORS[item.priority] ?? PRIORITY_COLORS[3]
                    }`}
                  >
                    P{item.priority}
                  </span>
                )}
                <span
                  className={`flex-1 text-[13px] ${
                    item.done ? 'text-neutral-500 line-through' : 'text-white'
                  }`}
                >
                  {item.title}
                </span>
                {!item.done && (
                  <button
                    onClick={() => handleFocus(item)}
                    className="rounded bg-amber-500/20 p-1 text-amber-400 opacity-0 group-hover:opacity-100 hover:bg-amber-500/40"
                    title="Start Focus"
                  >
                    <Play size={9} />
                  </button>
                )}
                <button
                  onClick={() => removeTask(item.id)}
                  className="text-neutral-700 opacity-0 group-hover:opacity-100 hover:text-red-400"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
        </div>

        {/* Add task input */}
        <div className="border-t border-[#2a2a2a] p-2">
          <div className="flex gap-1">
            <div className="flex gap-0.5">
              {([1, 2, 3] as const).map((p) => (
                <button
                  key={p}
                  className={`rounded px-1.5 py-1 font-mono text-[10px] font-bold ${
                    newPriority === p
                      ? PRIORITY_COLORS[p]
                      : 'text-neutral-600 hover:text-neutral-400'
                  }`}
                  onClick={() => setNewPriority(p)}
                >
                  P{p}
                </button>
              ))}
            </div>
            <input
              className="flex-1 rounded bg-[#141414] px-2 py-1.5 text-[13px] text-white outline-none placeholder:text-neutral-600"
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
              className="rounded bg-amber-600 p-1 text-black disabled:opacity-30 hover:bg-amber-500"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      </div>
    </BlockWrapper>
  )
}
