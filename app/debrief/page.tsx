'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Moon, Send, RotateCcw, X, CheckCircle2, Clock } from 'lucide-react'
import { useBriefingStore, useToastStore } from '@/lib/store'
import { db } from '@/lib/db'
import type { Task } from '@/lib/db'
import { cn } from '@/lib/utils'
import { ErrorBoundary } from '@/components/error-boundary'

interface DebriefMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isStreaming?: boolean
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// ── Pre-session ────────────────────────────────────────────────

function PreSession({ onStart }: { onStart: () => void }) {
  const [mounted, setMounted] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [todayDebrief, setTodayDebrief] = useState<boolean>(false)
  useEffect(() => {
    setMounted(true)
    Promise.all([db.tasks.listToday(), db.debriefs.today()])
      .then(([t, d]) => { setTasks(t); setTodayDebrief(d != null) })
      .catch(() => {})
  }, [])

  const doneTasks = tasks.filter((t) => t.status === 'Done' || t.completedAt)
  const openTasks = tasks.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled' && !t.completedAt)
  const total = tasks.length
  const rate = total > 0 ? Math.round((doneTasks.length / total) * 100) : 0
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-[480px]"
      >
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="border-b border-[var(--border)] px-6 py-6 text-center">
            <div className="mb-3 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10">
                <Moon className="h-6 w-6 text-indigo-400" />
              </div>
            </div>
            <h1 className="mb-1 text-[24px] font-bold text-[var(--text-primary)]">End of Day Debrief</h1>
            <p className="text-[14px] text-[var(--text-tertiary)]">{today}</p>
            {todayDebrief && (
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Today's debrief already logged</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-px border-b border-[var(--border)] bg-[var(--border)]">
            {[
              { label: 'Tasks Done', value: mounted ? String(doneTasks.length) : '—', highlight: doneTasks.length > 0 },
              { label: 'Still Open', value: mounted ? String(openTasks.length) : '—', highlight: openTasks.length > 0 },
              { label: 'Completion', value: mounted && total > 0 ? `${rate}%` : '—', highlight: rate >= 75 },
            ].map((s) => (
              <div key={s.label} className="bg-[var(--surface)] px-4 py-3 text-center">
                <div className={cn('text-[20px] font-bold', s.highlight ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]')}>{s.value}</div>
                <div className="text-[11px] text-[var(--text-tertiary)]">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="px-6 py-5">
            <button
              onClick={onStart}
              className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-indigo-500 py-3 text-[15px] font-semibold text-white hover:opacity-90 transition-opacity"
            >
              <Moon className="h-4 w-4" />
              Start Debrief
            </button>
            <p className="mt-2 text-center text-[12px] text-[var(--text-tertiary)]">~3 min · Reviews your actual day</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Active session ──────────────────────────────────────────────

function ActiveSession({ onEnd }: { onEnd: () => void }) {
  const [messages, setMessages] = useState<DebriefMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const greetingSent = useRef(false)
  const { addToast } = useToastStore()

  const isStreaming = messages.some((m) => m.isStreaming)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    if (!isStreaming) textareaRef.current?.focus()
  }, [isStreaming])

  const addAssistantMessage = (id: string): void => {
    const msg: DebriefMessage = { id, role: 'assistant', content: '', timestamp: new Date().toISOString(), isStreaming: true }
    setMessages((prev) => [...prev, msg])
  }

  const updateLastAssistant = (content: string, streaming: boolean): void => {
    setMessages((prev) => {
      const updated = [...prev]
      const lastIdx = updated.length - 1
      if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
        updated[lastIdx] = { ...updated[lastIdx], content, isStreaming: streaming }
      }
      return updated
    })
  }

  const sendToAPI = async (convMessages: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    const msgId = crypto.randomUUID()
    addAssistantMessage(msgId)
    try {
      const res = await fetch('/api/debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: convMessages }),
      })
      if (!res.ok) throw new Error('API error')
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        updateLastAssistant(accumulated, true)
      }
      updateLastAssistant(accumulated, false)

      // Auto-save when debrief summary is generated
      if (accumulated.includes('## Day Summary') && !saved) {
        setSaved(true)
        const convHistory = [...convMessages.map(m => ({ id: crypto.randomUUID(), ...m, timestamp: new Date().toISOString() })), { id: msgId, role: 'assistant' as const, content: accumulated, timestamp: new Date().toISOString() }]
        const todayTasks = await db.tasks.listToday().catch(() => [])
        fetch('/api/debrief/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            summary: accumulated,
            messages: convHistory,
            completedTasks: todayTasks.filter((t) => t.status === 'Done').map((t) => ({ id: t.id, name: t.name, priority: t.priority })),
            incompleteTasks: todayTasks.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled').map((t) => ({ id: t.id, name: t.name, priority: t.priority })),
          }),
        }).then(() => addToast({ type: 'success', message: 'Debrief saved' })).catch(() => {})
      }
    } catch {
      updateLastAssistant('Sorry, had trouble connecting. Try again.', false)
      addToast({ type: 'error', message: 'Debrief connection failed' })
    }
    setIsSending(false)
  }

  // Send initial greeting
  useEffect(() => {
    if (!greetingSent.current) {
      greetingSent.current = true
      setIsSending(true)
      sendToAPI([{ role: 'user', content: 'Start the debrief.' }])
    }
  }, [])

  const handleSend = async () => {
    if (!input.trim() || isSending) return
    const text = input.trim()
    setInput('')
    setIsSending(true)
    const userMsg: DebriefMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])
    const history = messages.filter((m) => !m.isStreaming).map((m) => ({ role: m.role, content: m.content }))
    history.push({ role: 'user', content: text })
    await sendToAPI(history)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3.5">
        <div className="flex items-center gap-3">
          <Moon className="h-4 w-4 text-indigo-400" />
          <span className="text-[14px] font-semibold text-[var(--text-primary)]">End of Day Debrief</span>
          <span className="text-[13px] text-[var(--text-tertiary)]">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
          {saved && (
            <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] text-green-400">
              <CheckCircle2 className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onEnd}
            className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="h-3.5 w-3.5" /> End Session
          </button>
          <button
            onClick={() => { setMessages([]); greetingSent.current = false; setSaved(false); setTimeout(() => { greetingSent.current = false; setIsSending(true); sendToAPI([{ role: 'user', content: 'Start the debrief.' }]) }, 50) }}
            className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            title="Restart"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-[680px] space-y-5">
          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start', 'max-w-[65%]')}>
                  <div className={cn('rounded-[12px] px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap',
                    msg.role === 'user' ? 'bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)]' : 'text-[var(--text-primary)]')}>
                    {msg.content}
                    {msg.isStreaming && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-indigo-400" />}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">{formatTime(msg.timestamp)}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-[var(--border)] px-6 py-4">
        <div className="mx-auto max-w-[680px]">
          <div className="flex gap-3">
            <textarea
              ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)}
              autoFocus disabled={isStreaming}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend() } }}
              placeholder="Reply..." rows={2}
              className={cn('flex-1 resize-none rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)]',
                'px-4 py-3 text-[14px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)]',
                'focus:border-indigo-400 focus:outline-none transition-colors disabled:opacity-50')}
            />
            <button onClick={handleSend} disabled={!input.trim() || isStreaming}
              className="flex h-[76px] w-[76px] flex-shrink-0 items-center justify-center rounded-[8px] bg-indigo-500 text-white hover:opacity-90 disabled:opacity-40 transition-opacity">
              <Send className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">⌘↵ to send</p>
        </div>
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────

export default function DebriefPage() {
  const [started, setStarted] = useState(false)
  return (
    <ErrorBoundary>
      <div className={cn('h-full', started ? 'flex flex-col' : '')}>
        {!started
          ? <PreSession onStart={() => setStarted(true)} />
          : <ActiveSession onEnd={() => setStarted(false)} />
        }
      </div>
    </ErrorBoundary>
  )
}
