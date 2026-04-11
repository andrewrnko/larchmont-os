'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart2, Send, RotateCcw, X, CheckCircle2 } from 'lucide-react'
import { useToastStore } from '@/lib/store'
import { db } from '@/lib/db'
import type { WeeklyReview } from '@/lib/db'
import { cn } from '@/lib/utils'
import { ErrorBoundary } from '@/components/error-boundary'
import { startOfWeek, endOfWeek, format, subDays } from 'date-fns'

interface ReviewMessage {
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
  const [thisWeekReview, setThisWeekReview] = useState<WeeklyReview | null>(null)
  const [weekStats, setWeekStats] = useState({ completed: 0, debriefs: 0, avgRate: 0 })

  useEffect(() => {
    setMounted(true)
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const sevenDaysAgo = subDays(new Date(), 7).toISOString()
    Promise.all([
      db.weeklyReviews.list(1),
      db.tasks.listSince(sevenDaysAgo),
      db.debriefs.list(7),
    ]).then(([reviews, tasks, debriefs]) => {
      const thisWeek = reviews.find((r) => r.weekStart === weekStart) ?? null
      setThisWeekReview(thisWeek)
      const completed = tasks.filter((t) => t.status === 'Done').length
      const debriefsDone = debriefs.length
      const rates = debriefs.map((d) => d.completionRate ?? 0).filter((r) => r > 0)
      const avgRate = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0
      setWeekStats({ completed, debriefs: debriefsDone, avgRate })
    }).catch(() => {})
  }, [])

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d')
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d')

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
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10">
                <BarChart2 className="h-6 w-6 text-violet-400" />
              </div>
            </div>
            <h1 className="mb-1 text-[16px] font-bold text-[var(--text-primary)]">Weekly Review</h1>
            <p className="text-[14px] text-[var(--text-tertiary)]">{weekStart} — {weekEnd}</p>
            {thisWeekReview && (
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>This week's review already logged</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-px border-b border-[var(--border)] bg-[var(--border)]">
            {[
              { label: 'Tasks Done', value: mounted ? String(weekStats.completed) : '—', highlight: weekStats.completed > 0 },
              { label: 'Debriefs', value: mounted ? `${weekStats.debriefs}/7` : '—', highlight: weekStats.debriefs >= 5 },
              { label: 'Avg Rate', value: mounted && weekStats.avgRate > 0 ? `${weekStats.avgRate}%` : '—', highlight: weekStats.avgRate >= 70 },
            ].map((s) => (
              <div key={s.label} className="bg-[var(--surface)] px-4 py-3 text-center">
                <div className={cn('text-[16px] font-bold', s.highlight ? 'text-violet-400' : 'text-[var(--text-primary)]')}>{s.value}</div>
                <div className="text-[11px] text-[var(--text-tertiary)]">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="px-6 py-5">
            <button
              onClick={onStart}
              className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-violet-500 py-3 text-[14px] font-semibold text-white hover:opacity-90 transition-opacity"
            >
              <BarChart2 className="h-4 w-4" />
              Start Weekly Review
            </button>
            <p className="mt-2 text-center text-[12px] text-[var(--text-tertiary)]">~5 min · Reviews the full week</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Active session ──────────────────────────────────────────────

function ActiveSession({ onEnd }: { onEnd: () => void }) {
  const [messages, setMessages] = useState<ReviewMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const greetingSent = useRef(false)
  const { addToast } = useToastStore()

  const isStreaming = messages.some((m) => m.isStreaming)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (!isStreaming) textareaRef.current?.focus() }, [isStreaming])

  const updateLastAssistant = (content: string, streaming: boolean) => {
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
    setMessages((prev) => [...prev, { id: msgId, role: 'assistant', content: '', timestamp: new Date().toISOString(), isStreaming: true }])
    try {
      const res = await fetch('/api/weekly-review', {
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

      // Auto-save when review summary is generated
      if (accumulated.includes('## Week Review') && !saved) {
        setSaved(true)
        const convHistory = [...convMessages.map(m => ({ id: crypto.randomUUID(), ...m, timestamp: new Date().toISOString() })), { id: msgId, role: 'assistant' as const, content: accumulated, timestamp: new Date().toISOString() }]
        fetch('/api/weekly-review/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary: accumulated, messages: convHistory }),
        }).then(() => addToast({ type: 'success', message: 'Weekly review saved' })).catch(() => {})
      }
    } catch {
      updateLastAssistant('Sorry, had trouble connecting. Try again.', false)
      addToast({ type: 'error', message: 'Weekly review connection failed' })
    }
    setIsSending(false)
  }

  useEffect(() => {
    if (!greetingSent.current) {
      greetingSent.current = true
      setIsSending(true)
      sendToAPI([{ role: 'user', content: 'Start the weekly review.' }])
    }
  }, [])

  const handleSend = async () => {
    if (!input.trim() || isSending) return
    const text = input.trim()
    setInput('')
    setIsSending(true)
    const userMsg: ReviewMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])
    const history = messages.filter((m) => !m.isStreaming).map((m) => ({ role: m.role, content: m.content }))
    history.push({ role: 'user', content: text })
    await sendToAPI(history)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3.5">
        <div className="flex items-center gap-3">
          <BarChart2 className="h-4 w-4 text-violet-400" />
          <span className="text-[14px] font-semibold text-[var(--text-primary)]">Weekly Review</span>
          <span className="text-[13px] text-[var(--text-tertiary)]">
            {format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d')} — {format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d')}
          </span>
          {saved && (
            <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] text-green-400">
              <CheckCircle2 className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
        <button onClick={onEnd}
          className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-strong)] transition-colors">
          <X className="h-3.5 w-3.5" /> End
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-[680px] space-y-5">
          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn('flex flex-col max-w-[65%]', msg.role === 'user' ? 'items-end' : 'items-start')}>
                  <div className={cn('rounded-[12px] px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap',
                    msg.role === 'user' ? 'bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)]' : 'text-[var(--text-primary)]')}>
                    {msg.content}
                    {msg.isStreaming && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-violet-400" />}
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
        <div className="mx-auto max-w-[680px] flex gap-3">
          <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)}
            autoFocus disabled={isStreaming}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend() } }}
            placeholder="Reply..." rows={2}
            className={cn('flex-1 resize-none rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)]',
              'px-4 py-3 text-[14px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)]',
              'focus:border-violet-400 focus:outline-none transition-colors disabled:opacity-50')}
          />
          <button onClick={handleSend} disabled={!input.trim() || isStreaming}
            className="flex h-[76px] w-[76px] flex-shrink-0 items-center justify-center rounded-[8px] bg-violet-500 text-white hover:opacity-90 disabled:opacity-40 transition-opacity">
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────

export default function WeeklyReviewPage() {
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
