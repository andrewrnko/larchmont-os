// Floating timer widget — stopwatch + countdown modes.
// Lives in the bottom-left of the canvas area.

'use client'

import { useState, useEffect, useRef } from 'react'
import { Timer as TimerIcon, Play, Pause, RotateCcw, X } from 'lucide-react'

function fmt(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function TimerWidget() {
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number | null>(null)
  const offsetRef = useRef(0)

  useEffect(() => {
    if (!running) return
    startRef.current = Date.now()
    const id = setInterval(() => {
      setElapsed(offsetRef.current + (Date.now() - (startRef.current ?? Date.now())))
    }, 100)
    return () => clearInterval(id)
  }, [running])

  const toggle = () => {
    if (running) {
      offsetRef.current = elapsed
      setRunning(false)
    } else {
      setRunning(true)
    }
  }

  const reset = () => {
    setRunning(false)
    setElapsed(0)
    offsetRef.current = 0
    startRef.current = null
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#141414]/95 px-2.5 py-1.5 text-[14px] text-neutral-400 backdrop-blur hover:text-white"
        title="Timer"
      >
        <TimerIcon size={13} />
      </button>
    )
  }

  return (
    <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-md border border-[#2a2a2a] bg-[#141414]/95 px-3 py-2 text-neutral-300 shadow-lg backdrop-blur">
      <TimerIcon size={13} className="text-amber-500" />
      <span className="font-mono text-[32px] tabular-nums text-white">{fmt(elapsed)}</span>
      <button
        onClick={toggle}
        className={`rounded p-1 ${running ? 'bg-amber-600/20 text-amber-400' : 'bg-green-600/20 text-green-400'} hover:opacity-80`}
        title={running ? 'Pause' : 'Start'}
      >
        {running ? <Pause size={12} /> : <Play size={12} />}
      </button>
      <button onClick={reset} className="rounded bg-neutral-800 p-1 text-neutral-400 hover:text-white" title="Reset">
        <RotateCcw size={12} />
      </button>
      <button onClick={() => setOpen(false)} className="text-neutral-600 hover:text-white" title="Close">
        <X size={12} />
      </button>
    </div>
  )
}
