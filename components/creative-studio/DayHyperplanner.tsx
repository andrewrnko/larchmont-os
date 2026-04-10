// Day Hyperplanner — P1 dominant, P2/P3 subordinate.
// Each rank is a column holding up to 5 tasks. Enter appends a new task.
// Backspace on an empty title deletes that task.

'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Check, X, ChevronDown, ChevronUp, Archive, Sunrise, Plus } from 'lucide-react'
import { usePlannerStore } from './store'
import type { PriorityTask } from './types'

const MAX_PER_RANK = 5

export function DayHyperplanner() {
  const tasks = usePlannerStore((s) => s.tasks)
  const drifting = usePlannerStore((s) => s.drifting)
  const driftingSince = usePlannerStore((s) => s.driftingSince)
  const focus = usePlannerStore((s) => s.focus)
  const log = usePlannerStore((s) => s.log)
  const addTask = usePlannerStore((s) => s.addTask)
  const updateTask = usePlannerStore((s) => s.updateTask)
  const removeTask = usePlannerStore((s) => s.removeTask)
  const toggleDone = usePlannerStore((s) => s.toggleDone)
  const setDrifting = usePlannerStore((s) => s.setDrifting)
  const startFocus = usePlannerStore((s) => s.startFocus)
  const resetDay = usePlannerStore((s) => s.resetDay)

  const [collapsed, setCollapsed] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [warn, setWarn] = useState(false)
  const [, tick] = useState(0)

  const byRank = (r: 1 | 2 | 3) => tasks.filter((t) => t.rank === r).sort((a, b) => a.createdAt - b.createdAt)
  const firstP1Open = byRank(1).find((t) => !t.done)

  // Distraction guard
  useEffect(() => {
    const id = setInterval(() => {
      const p1Done = !firstP1Open
      const shouldWarn =
        !!drifting &&
        !!driftingSince &&
        Date.now() - driftingSince > 10 * 60 * 1000 &&
        !p1Done &&
        !focus
      setWarn(shouldWarn)
      tick((n) => n + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [drifting, driftingSince, firstP1Open, focus])

  useEffect(() => {
    if (warn) document.body.classList.add('cs-distraction-warn')
    else document.body.classList.remove('cs-distraction-warn')
    return () => document.body.classList.remove('cs-distraction-warn')
  }, [warn])

  const renderTaskRow = (task: PriorityTask, isP1: boolean) => (
    <div key={task.id} className={`flex items-start gap-2 ${task.done ? 'opacity-50' : ''}`}>
      <button
        onClick={() => toggleDone(task.id)}
        className={`mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          task.done ? 'border-amber-500 bg-amber-500 text-black' : 'border-neutral-500'
        }`}
      >
        {task.done && <Check size={10} />}
      </button>
      <input
        className={`flex-1 bg-transparent outline-none ${isP1 ? 'text-base' : 'text-sm'} text-white ${
          task.done ? 'line-through' : ''
        }`}
        value={task.title}
        onChange={(e) => updateTask(task.id, { title: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            // Append a new blank task in same rank
            if (byRank(task.rank).length < MAX_PER_RANK) addTask('', task.rank)
          } else if (e.key === 'Backspace' && (e.currentTarget.value === '' || task.title === '')) {
            e.preventDefault()
            removeTask(task.id)
          }
        }}
      />
      {!task.done && (
        <button
          onClick={() => startFocus(task.id, task.estimateMin ?? 25)}
          className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium hover:opacity-80 ${
            isP1 ? 'bg-amber-500 text-black' : 'bg-amber-500/20 text-amber-400'
          }`}
          title="Start Focus"
        >
          <Play size={10} />
        </button>
      )}
    </div>
  )

  const renderRankCol = (rank: 1 | 2 | 3) => {
    const isP1 = rank === 1
    const items = byRank(rank)
    return (
      <div
        className={`relative rounded-lg border ${
          isP1
            ? 'border-amber-600 bg-gradient-to-br from-[#2a1a0a] to-[#1a1208] shadow-[0_0_32px_rgba(245,158,11,0.18)]'
            : 'border-[#2a2a2a] bg-[#141414]'
        } ${isP1 ? 'p-4' : 'p-2.5'}`}
      >
        <div
          className={`mb-2 flex items-center justify-between font-mono ${
            isP1 ? 'text-[11px] text-amber-500' : 'text-[10px] text-neutral-500'
          } uppercase tracking-wider`}
        >
          <span>P{rank}</span>
          <span className="text-neutral-600">
            {items.length}/{MAX_PER_RANK}
          </span>
        </div>
        <div className="space-y-1.5">
          {items.map((t) => renderTaskRow(t, isP1))}
          {items.length < MAX_PER_RANK && <AddTaskInput rank={rank} isP1={isP1} onAdd={addTask} />}
        </div>
      </div>
    )
  }

  if (collapsed) {
    return (
      <div className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#0d0d0d] px-4 py-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-amber-500">Day Hyperplanner</span>
        <button onClick={() => setCollapsed(false)} className="text-neutral-500 hover:text-white">
          <ChevronDown size={14} />
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="border-b border-[#2a2a2a] bg-[#0d0d0d] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-amber-500">Day Hyperplanner</span>
          <div className="flex items-center gap-2 text-[10px] text-neutral-500">
            <button onClick={() => setLogOpen(true)} className="flex items-center gap-1 hover:text-white">
              <Archive size={10} /> Yesterday
            </button>
            <button
              onClick={() => confirm('Reset day? Completed tasks archive.') && resetDay()}
              className="flex items-center gap-1 hover:text-white"
            >
              <Sunrise size={10} /> Reset
            </button>
            <button onClick={() => setCollapsed(true)} className="hover:text-white">
              <ChevronUp size={14} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_1fr]">
          {renderRankCol(1)}
          {renderRankCol(2)}
          {renderRankCol(3)}
        </div>
        {firstP1Open && (
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-neutral-500">Currently drifting to</span>
            <input
              className="flex-1 rounded bg-[#141414] px-2 py-1 text-[11px] text-white outline-none"
              placeholder="what are you actually doing right now?"
              value={drifting}
              onChange={(e) => setDrifting(e.target.value)}
            />
            {warn && <span className="font-mono text-[10px] text-red-400">⚠ drifting &gt; 10min</span>}
          </div>
        )}
      </div>

      <AnimatePresence>
        {logOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.2 }}
            className="fixed right-0 top-0 z-[60] h-full w-80 border-l border-[#2a2a2a] bg-[#0a0a0a] p-4 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase text-amber-500">Archive</span>
              <button onClick={() => setLogOpen(false)} className="text-neutral-500 hover:text-white">
                <X size={14} />
              </button>
            </div>
            {log.length === 0 && <div className="text-[11px] text-neutral-600">Nothing archived yet.</div>}
            {log.map((entry) => (
              <div key={entry.date} className="mb-3">
                <div className="mb-1 font-mono text-[10px] text-neutral-500">{entry.date}</div>
                {entry.tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-[11px] text-neutral-300">
                    <span className={t.done ? 'text-amber-500' : 'text-neutral-600'}>{t.done ? '✓' : '○'}</span>
                    <span className="font-mono text-[10px] text-neutral-600">P{t.rank}</span>
                    <span className={t.done ? 'line-through' : ''}>{t.title}</span>
                  </div>
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function AddTaskInput({
  rank,
  isP1,
  onAdd,
}: {
  rank: 1 | 2 | 3
  isP1?: boolean
  onAdd: (title: string, rank: 1 | 2 | 3) => void
}) {
  const [val, setVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center gap-2 opacity-60 hover:opacity-100">
      <Plus size={10} className="text-neutral-600" />
      <input
        ref={inputRef}
        className={`flex-1 bg-transparent outline-none placeholder:text-neutral-600 ${
          isP1 ? 'text-base text-white' : 'text-sm text-neutral-300'
        }`}
        placeholder={isP1 ? 'Add a P1 priority…' : `Add P${rank}…`}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && val.trim()) {
            onAdd(val.trim(), rank)
            setVal('')
            setTimeout(() => inputRef.current?.focus(), 0)
          }
        }}
      />
    </div>
  )
}
