'use client'

import { useState, useRef } from 'react'
import { Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useToastStore } from '@/lib/store'
import { db } from '@/lib/db'
import { cn } from '@/lib/utils'

export function QuickCapture() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [type, setType] = useState('Note')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { addToast } = useToastStore()

  const TYPES = ['Note', 'Task', 'Content Idea', 'Resource', 'Strategy', 'Lead/Opportunity']

  const handleCapture = async () => {
    if (!text.trim() || saving) return
    setSaving(true)
    try {
      await db.inbox.insert({ title: text.trim(), status: 'New', source: type })
      addToast({ type: 'success', message: 'Captured to Inbox' })
      setText('')
      setType('Note')
      setOpen(false)
    } catch {
      addToast({ type: 'error', message: 'Failed to capture — try again' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((o) => !o); setTimeout(() => textareaRef.current?.focus(), 50) }}
        className={cn(
          'flex w-full items-center gap-2 rounded-[6px] px-2.5 py-2 text-[13px] font-medium',
          'bg-[var(--accent)] text-[var(--accent-fg)]',
          'hover:opacity-90 transition-opacity duration-150',
          'focus-visible:outline-2 focus-visible:outline-[var(--accent)]'
        )}
        aria-label="Quick capture (⌘⇧N)"
      >
        <Zap className="h-4 w-4 flex-shrink-0" />
        <span>Quick Capture</span>
        <kbd className="ml-auto rounded bg-[rgba(0,0,0,0.15)] px-1 font-mono text-[10px]">⌘⇧N</kbd>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={cn(
              'absolute bottom-full left-0 right-0 mb-2 rounded-[8px]',
              'border border-[var(--border)] bg-[var(--surface)] p-3',
              'shadow-[var(--shadow-modal)]'
            )}
          >
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleCapture() }
                if (e.key === 'Escape') setOpen(false)
              }}
              placeholder="Drop anything here — idea, task, link..."
              rows={3}
              className={cn(
                'w-full resize-none rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)]',
                'px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)]',
                'focus:border-[var(--accent)] focus:outline-none transition-colors'
              )}
            />
            <div className="mt-2 flex items-center gap-2">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={cn(
                  'min-w-0 flex-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)]',
                  'px-2 py-1.5 text-[12px] text-[var(--text-secondary)]',
                  'focus:border-[var(--accent)] focus:outline-none'
                )}
                aria-label="Capture type"
              >
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <button
                onClick={handleCapture}
                disabled={!text.trim() || saving}
                className={cn(
                  'flex-shrink-0 rounded-[6px] px-3 py-1.5 text-[12px] font-medium',
                  'bg-[var(--accent)] text-[var(--accent-fg)]',
                  'hover:opacity-90 disabled:opacity-40 transition-opacity'
                )}
              >
                {saving ? '...' : 'Capture'}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--text-tertiary)]">⌘↵ to capture · Esc to close</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
