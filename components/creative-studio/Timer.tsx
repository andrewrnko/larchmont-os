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
        className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[13px] backdrop-blur transition-colors duration-150"
        style={{
          background: 'color-mix(in srgb, var(--bg2) 95%, transparent)',
          borderColor: 'var(--border)',
          color: 'var(--text1)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text0)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text1)')}
        title="Timer"
      >
        <TimerIcon size={13} />
      </button>
    )
  }

  return (
    <div
      className="absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-md border px-3 py-2 shadow-lg backdrop-blur"
      style={{
        background: 'color-mix(in srgb, var(--bg2) 95%, transparent)',
        borderColor: 'var(--border)',
        color: 'var(--text1)',
      }}
    >
      <TimerIcon size={13} className="text-[color:var(--cs-accent)]" />
      <span className="font-mono text-[32px] tabular-nums" style={{ color: 'var(--text0)' }}>
        {fmt(elapsed)}
      </span>
      <button
        onClick={toggle}
        className={`rounded p-1 ${running ? 'bg-[color:var(--cs-accent)]/20 text-[color:var(--cs-accent2)]' : 'bg-green-600/20 text-green-400'} hover:opacity-80`}
        title={running ? 'Pause' : 'Start'}
      >
        {running ? <Pause size={12} /> : <Play size={12} />}
      </button>
      <button
        onClick={reset}
        className="rounded p-1 transition-colors duration-150"
        style={{ background: 'var(--bg3)', color: 'var(--text1)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text0)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text1)')}
        title="Reset"
      >
        <RotateCcw size={12} />
      </button>
      <button
        onClick={() => setOpen(false)}
        className="transition-colors duration-150"
        style={{ color: 'var(--text3)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text0)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text3)')}
        title="Close"
      >
        <X size={12} />
      </button>
    </div>
  )
}
