'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Inbox, CheckCircle2, Archive, Sparkles, Check, Plus, X, Trash2 } from 'lucide-react'
import { db, type InboxItem } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { useToastStore } from '@/lib/store'
import { PageHeader } from '@/components/shared/page-header'
import { ViewSwitcher } from '@/components/shared/view-switcher'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'

type Tab = 'New' | 'Processed' | 'Archived'

function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('New')
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const { addToast } = useToastStore()

  const load = useCallback(async () => {
    try {
      const data = await db.inbox.list()
      setItems(data)
    } catch {
      addToast({ type: 'error', message: 'Failed to load inbox' })
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => { load() }, [load])

  // Realtime: when Quick Capture inserts a new inbox item, prepend it instantly
  useEffect(() => {
    const channel = supabase
      .channel('inbox-inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inbox_items' },
        (payload) => {
          const r = payload.new as { id: string; title: string; status: string; source?: string; created_at: string }
          setItems((prev) => {
            // Don't add if already present (e.g. optimistic update from same tab)
            if (prev.some((i) => i.id === r.id)) return prev
            const item: InboxItem = {
              id: r.id,
              title: r.title,
              status: r.status as InboxItem['status'],
              source: r.source ?? undefined,
              createdAt: r.created_at,
            }
            return [item, ...prev]
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)
    const opt: InboxItem = {
      id: 'temp-' + Date.now(), title: newTitle.trim(),
      status: 'New', createdAt: new Date().toISOString(),
    }
    setItems((prev) => [opt, ...prev])
    setNewTitle('')
    setShowAdd(false)
    try {
      const created = await db.inbox.insert({ title: opt.title })
      setItems((prev) => prev.map((i) => i.id === opt.id ? created : i))
      addToast({ type: 'success', message: 'Added to inbox' })
    } catch {
      setItems((prev) => prev.filter((i) => i.id !== opt.id))
      addToast({ type: 'error', message: 'Failed to add item' })
    } finally {
      setAdding(false)
    }
  }

  const handleAction = async (id: string, status: 'Processed' | 'Archived') => {
    setActionId(id)
    const item = items.find((i) => i.id === id)
    setTimeout(async () => {
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status } : i))
      setActionId(null)
      try {
        await db.inbox.update(id, { status })
      } catch {
        if (item) setItems((prev) => prev.map((i) => i.id === id ? item : i))
        addToast({ type: 'error', message: 'Failed to update item' })
      }
    }, 300)
  }

  const handleDelete = async (id: string) => {
    const item = items.find((i) => i.id === id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    try {
      await db.inbox.delete(id)
    } catch {
      if (item) setItems((prev) => [item, ...prev])
      addToast({ type: 'error', message: 'Failed to delete item' })
    }
  }

  const newItems = items.filter((i) => i.status === 'New')
  const processedItems = items.filter((i) => i.status === 'Processed')
  const archivedItems = items.filter((i) => i.status === 'Archived')
  const currentItems = activeTab === 'New' ? newItems : activeTab === 'Processed' ? processedItems : archivedItems

  const tabOptions = [
    { value: 'New' as const, label: `New${newItems.length > 0 ? ` (${newItems.length})` : ''}`, icon: Inbox },
    { value: 'Processed' as const, label: 'Processed', icon: CheckCircle2 },
    { value: 'Archived' as const, label: 'Archived', icon: Archive },
  ]

  return (
    <div className="min-h-full p-6">
      <PageHeader
        title="Inbox"
        description={newItems.length > 0 ? `${newItems.length} unread` : 'All caught up'}
        actions={
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 rounded-[6px] bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-90 transition-opacity">
            <Plus className="h-4 w-4" />
            Add Item
          </button>
        }
      />

      <div className="mb-5">
        <ViewSwitcher options={tabOptions} value={activeTab} onChange={setActiveTab} />
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.form
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            onSubmit={handleAdd}
            className="mb-4 rounded-[8px] border border-[var(--accent)]/30 bg-[var(--surface)] p-3"
          >
            <div className="flex items-center gap-2">
              <input
                value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus required
                placeholder="Capture a thought, idea, or task..."
                className="flex-1 bg-transparent text-[14px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none"
              />
              <button type="button" onClick={() => setShowAdd(false)} className="rounded-[6px] p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] transition-colors"><X className="h-4 w-4" /></button>
              <button type="submit" disabled={adding || !newTitle.trim()} className="rounded-[6px] bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-[var(--accent-fg)] hover:opacity-90 disabled:opacity-50 transition-opacity">
                {adding ? '...' : 'Add'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-[8px] bg-[var(--surface-2)]" />)}
        </div>
      ) : currentItems.length === 0 ? (
        <EmptyState
          icon={activeTab === 'New' ? Sparkles : activeTab === 'Processed' ? CheckCircle2 : Archive}
          heading={activeTab === 'New' ? 'Inbox zero' : activeTab === 'Processed' ? 'Nothing processed yet' : 'Nothing archived'}
          subtext={activeTab === 'New' ? 'No new items. Click "Add Item" to capture something.' : 'Items you action will appear here.'}
          cta={activeTab === 'New' ? <button onClick={() => setShowAdd(true)} className="rounded-[6px] bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-90 transition-opacity">Add First Item</button> : undefined}
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {currentItems.map((item) => (
              <motion.div key={item.id} layout
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.25 }}
                className={cn('rounded-[8px] border bg-[var(--surface)] p-4 transition-all',
                  item.status === 'New' ? 'border-[var(--border)] hover:border-[var(--border-strong)]' : 'border-[var(--border)] opacity-75',
                  actionId === item.id && 'opacity-40 pointer-events-none'
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className={cn('flex-1 text-[14px] leading-relaxed', item.status === 'New' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]')}>
                    {item.title}
                  </p>
                  <span className="flex-shrink-0 text-[11px] text-[var(--text-tertiary)]">{formatDate(item.createdAt)}</span>
                </div>
                {item.status === 'New' && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleAction(item.id, 'Processed')}
                      className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--accent)] bg-[var(--accent-muted)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-fg)] transition-all">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Process
                    </button>
                    <button onClick={() => handleAction(item.id, 'Archived')}
                      className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[12px] text-[var(--text-secondary)] hover:border-[var(--border-strong)] transition-all">
                      <Archive className="h-3.5 w-3.5" /> Archive
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="ml-auto rounded-[6px] border border-[var(--border)] p-1.5 text-[var(--text-tertiary)] hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
