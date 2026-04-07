'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, FolderKanban, CheckSquare, FileEdit, ImageIcon, Library, X } from 'lucide-react'
import { useUIStore, useProjectStore, useTaskStore, useBriefStore, useAssetStore, useResourceStore } from '@/lib/store'
import { cn } from '@/lib/utils'

interface SearchResult {
  id: string
  label: string
  description?: string
  icon: React.ElementType
  href: string
  group: string
}

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { projects } = useProjectStore()
  const { tasks } = useTaskStore()
  const { briefs } = useBriefStore()
  const { assets } = useAssetStore()
  const { resources } = useResourceStore()

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
      }
      if (e.key === 'Escape') setCommandPaletteOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [setCommandPaletteOpen])

  useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setSelected(0)
    }
  }, [commandPaletteOpen])

  const allResults: SearchResult[] = [
    ...projects.map((p) => ({
      id: p.id, label: p.name, description: `${p.entity} · ${p.category}`,
      icon: FolderKanban, href: `/projects/${p.id}`, group: 'Projects',
    })),
    ...tasks.map((t) => ({
      id: t.id, label: t.name, description: `${t.priority} · ${t.status}`,
      icon: CheckSquare, href: `/tasks`, group: 'Tasks',
    })),
    ...briefs.map((b) => ({
      id: b.id, label: b.name, description: `${b.type} Brief`,
      icon: FileEdit, href: `/briefs/${b.id}`, group: 'Briefs',
    })),
    ...assets.map((a) => ({
      id: a.id, label: a.name, description: `${a.type} · v${a.version}`,
      icon: ImageIcon, href: `/assets`, group: 'Assets',
    })),
    ...resources.map((r) => ({
      id: r.id, label: r.name, description: r.category,
      icon: Library, href: `/resources`, group: 'Resources',
    })),
  ]

  const filtered = query.trim()
    ? allResults.filter((r) =>
        r.label.toLowerCase().includes(query.toLowerCase()) ||
        r.description?.toLowerCase().includes(query.toLowerCase())
      )
    : allResults.slice(0, 10)

  // Group results
  const groups = filtered.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.group]) acc[r.group] = []
    acc[r.group].push(r)
    return acc
  }, {})

  const flatResults = Object.values(groups).flat()

  const handleSelect = (result: SearchResult) => {
    router.push(result.href)
    setCommandPaletteOpen(false)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!commandPaletteOpen) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((s) => Math.min(s + 1, flatResults.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((s) => Math.max(s - 1, 0))
      }
      if (e.key === 'Enter' && flatResults[selected]) {
        handleSelect(flatResults[selected])
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [commandPaletteOpen, flatResults, selected])

  if (!commandPaletteOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[500] flex items-start justify-center pt-[20vh] px-4"
        onClick={() => setCommandPaletteOpen(false)}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -4 }}
          transition={{ duration: 0.16, ease: [0.25, 0.46, 0.45, 0.94] }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'relative w-full max-w-[560px] rounded-[12px]',
            'border border-[var(--border)] bg-[var(--surface)]',
            'shadow-[var(--shadow-modal)] overflow-hidden'
          )}
          role="dialog"
          aria-label="Command palette"
          aria-modal="true"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3.5">
            <Search className="h-4 w-4 flex-shrink-0 text-[var(--text-tertiary)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
              placeholder="Search projects, tasks, briefs, assets..."
              className={cn(
                'flex-1 bg-transparent text-[14px] text-[var(--text-primary)]',
                'placeholder-[var(--text-tertiary)] focus:outline-none'
              )}
              aria-label="Search"
            />
            <button
              onClick={() => setCommandPaletteOpen(false)}
              className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] transition-colors"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto py-2" role="listbox">
            {Object.entries(groups).length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-[var(--text-tertiary)]">
                No results for &ldquo;{query}&rdquo;
              </div>
            ) : (
              Object.entries(groups).map(([group, items]) => (
                <div key={group}>
                  <div className="px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                    {group}
                  </div>
                  {items.map((result) => {
                    const Icon = result.icon
                    const idx = flatResults.indexOf(result)
                    return (
                      <button
                        key={result.id}
                        onClick={() => handleSelect(result)}
                        onMouseEnter={() => setSelected(idx)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100',
                          idx === selected
                            ? 'bg-[var(--accent-muted)] text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
                        )}
                        role="option"
                        aria-selected={idx === selected}
                      >
                        <Icon className={cn(
                          'h-4 w-4 flex-shrink-0',
                          idx === selected ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'
                        )} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                            {result.label}
                          </div>
                          {result.description && (
                            <div className="truncate text-[12px] text-[var(--text-tertiary)]">
                              {result.description}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer hints */}
          <div className="flex items-center gap-4 border-t border-[var(--border)] px-4 py-2">
            <span className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
              <kbd className="rounded bg-[var(--surface-2)] px-1 font-mono">↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
              <kbd className="rounded bg-[var(--surface-2)] px-1 font-mono">↵</kbd> open
            </span>
            <span className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
              <kbd className="rounded bg-[var(--surface-2)] px-1 font-mono">Esc</kbd> close
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
