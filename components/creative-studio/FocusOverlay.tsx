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
            className="fixed left-1/2 top-4 z-[95] flex -translate-x-1/2 items-center gap-4 rounded-lg border border-[color:var(--cs-accent)] px-5 py-3"
            style={{
              background: 'color-mix(in srgb, var(--cs-accent) 14%, var(--cs-bg0))',
              boxShadow: '0 0 40px color-mix(in srgb, var(--cs-accent) 35%, transparent)',
            }}
          >
            <div>
              <div className="font-mono text-[13px] font-medium uppercase tracking-[0.06em] text-[color:var(--cs-accent)]">Focus · P1</div>
              <div className="text-[15px] font-semibold text-white">{task.title}</div>
            </div>
            <div className="font-mono text-2xl tabular-nums text-[color:var(--cs-accent2)]">
              {fmt(Date.now() - focus.startedAt)}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => stopFocus(true)}
                className="flex items-center gap-1 rounded bg-[color:var(--cs-accent)] px-3 py-1.5 text-[15px] font-medium text-black hover:bg-[color:var(--cs-accent2)]"
              >
                <Check size={12} /> Done
              </button>
              <button
                onClick={() => stopFocus(false)}
                className="rounded bg-[#2d2d2a] p-1.5 text-[#c8c4bc] hover:bg-[color:rgba(255,255,255,0.12)]"
                title="Pause"
              >
                <Pause size={12} />
              </button>
              <button
                onClick={() => stopFocus(false)}
                className="rounded bg-[#2d2d2a] p-1.5 text-[#c8c4bc] hover:bg-red-900"
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
