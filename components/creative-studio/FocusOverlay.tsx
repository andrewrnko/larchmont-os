// Focus mode overlay — dims page, floats a bar with elapsed timer.
// Timer uses Date.now delta so it persists across tab switches.

'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Pause } from 'lucide-react'
import { usePlannerStore } from './store'

function fmt(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function FocusOverlay() {
  const focus = usePlannerStore((s) => s.focus)
  const tasks = usePlannerStore((s) => s.tasks)
  const stopFocus = usePlannerStore((s) => s.stopFocus)
  const [, tick] = useState(0)

  useEffect(() => {
    if (!focus?.active) return
    const id = setInterval(() => tick((n) => n + 1), 500)
    return () => clearInterval(id)
  }, [focus?.active])

  const task = focus ? tasks.find((t) => t.id === focus.taskId) : null

  return (
    <AnimatePresence>
      {focus?.active && task && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-[90] bg-black"
          />
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed left-1/2 top-4 z-[95] flex -translate-x-1/2 items-center gap-4 rounded-lg border border-amber-600 bg-[#140d03] px-5 py-3 shadow-[0_0_40px_rgba(245,158,11,0.35)]"
          >
            <div>
              <div className="font-mono text-[13px] font-medium uppercase tracking-[0.06em] text-amber-500">Focus · P1</div>
              <div className="text-[15px] font-semibold text-white">{task.title}</div>
            </div>
            <div className="font-mono text-2xl tabular-nums text-amber-400">
              {fmt(Date.now() - focus.startedAt)}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => stopFocus(true)}
                className="flex items-center gap-1 rounded bg-amber-500 px-3 py-1.5 text-[15px] font-medium text-black hover:bg-amber-400"
              >
                <Check size={12} /> Done
              </button>
              <button
                onClick={() => stopFocus(false)}
                className="rounded bg-[#2a2a2a] p-1.5 text-neutral-300 hover:bg-[#3a3a3a]"
                title="Pause"
              >
                <Pause size={12} />
              </button>
              <button
                onClick={() => stopFocus(false)}
                className="rounded bg-[#2a2a2a] p-1.5 text-neutral-300 hover:bg-red-900"
                title="Abandon"
              >
                <X size={12} />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
