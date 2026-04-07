'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Trash2, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isStreaming?: boolean
}

// ── Persistence ───────────────────────────────────────────────

const STORAGE_KEY = 'larchmont-chat-v1'
const MAX_STORED = 200

function loadMessages(): Message[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as Message[]) : []
  } catch {
    return []
  }
}

function saveMessages(msgs: Message[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-MAX_STORED)))
  } catch {}
}

// ── Helpers ───────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function StreamingCursor() {
  return <span className="ml-0.5 inline-block h-[1em] w-0.5 align-middle animate-pulse bg-[var(--accent)]" />
}

// ── Page ──────────────────────────────────────────────────────

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [mounted, setMounted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load persisted messages on mount
  useEffect(() => {
    setMounted(true)
    setMessages(loadMessages())
  }, [])

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (mounted) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, mounted])

  // Auto-resize textarea
  const adjustHeight = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const send = async () => {
    const text = input.trim()
    if (!text || isSending) return

    setInput('')
    setIsSending(true)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }

    // Build snapshot synchronously from current messages state
    const snapshot = [...messages, userMsg]
    saveMessages(snapshot)
    setMessages(snapshot)

    // Add streaming placeholder
    const aiMsgId = crypto.randomUUID()
    const aiMsg: Message = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    }
    setMessages((prev) => [...prev, aiMsg])

    try {
      // Build API message array from snapshot (last 40, no streaming placeholders)
      const apiMessages = snapshot
        .filter((m) => !m.isStreaming)
        .slice(-40)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      const response = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!response.ok) throw new Error('API error')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, content: accumulated, isStreaming: true } : m))
        )
      }

      // Finalize and persist
      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === aiMsgId ? { ...m, content: accumulated, isStreaming: false } : m
        )
        saveMessages(next)
        return next
      })
    } catch {
      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, content: 'Something went wrong. Try again.', isStreaming: false }
            : m
        )
        saveMessages(next)
        return next
      })
    }

    setIsSending(false)
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const clearConversation = () => {
    setMessages([])
    localStorage.removeItem(STORAGE_KEY)
    textareaRef.current?.focus()
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)]/10">
            <Bot className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <span className="text-[15px] font-semibold text-[var(--text-primary)]">Assistant</span>
        </div>
        {messages.filter((m) => !m.isStreaming).length > 0 && (
          <button
            onClick={clearConversation}
            className="flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-[12px] text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto">
        {!mounted || messages.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)]/10">
                  <Bot className="h-7 w-7 text-[var(--accent)]" />
                </div>
              </div>
              <p className="text-[16px] font-semibold text-[var(--text-primary)]">What can I help with?</p>
              <p className="mt-1.5 text-[13px] text-[var(--text-tertiary)]">
                Ask anything, plan your day, or say "add a project" to get started.
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-5 px-6 py-5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {msg.role === 'user' ? (
                  <div className="max-w-[75%]">
                    <div className="rounded-[14px] rounded-tr-[4px] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[14px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                      {msg.content}
                    </div>
                    <p className="mt-1 text-right text-[11px] text-[var(--text-tertiary)]">
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                ) : (
                  <div className="max-w-[80%]">
                    <p className="text-[14px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                      {msg.content}
                      {msg.isStreaming && <StreamingCursor />}
                    </p>
                    {!msg.isStreaming && msg.content && (
                      <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                        {formatTime(msg.timestamp)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Input ── */}
      <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mx-auto max-w-2xl">
          <div className={cn(
            'flex items-end gap-3 rounded-[12px] border bg-[var(--surface-2)] px-4 py-3 transition-colors',
            isSending ? 'border-[var(--border)]' : 'border-[var(--border)] focus-within:border-[var(--accent)]'
          )}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); adjustHeight() }}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              rows={1}
              disabled={isSending}
              className="flex-1 resize-none bg-transparent text-[14px] leading-relaxed text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={!input.trim() || isSending}
              className="mb-0.5 flex-shrink-0 rounded-[8px] bg-[var(--accent)] p-2 text-[var(--accent-fg)] hover:opacity-90 disabled:opacity-30 transition-opacity"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-[var(--text-tertiary)]">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

    </div>
  )
}
