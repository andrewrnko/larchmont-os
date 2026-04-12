// Floating menu that appears when a connector drag is released on empty canvas.
// Lets the user instantly create a block at the drop point and connect it to
// the source block — no more "drag block in, then drag connector".
//
// Two modes:
//   1. Block type picker (default) — shows a list of block kinds + an
//      "AI page" entry point.
//   2. AI prompt mode — textarea where the user describes what the new page
//      should contain. Backend generates structured content and the page
//      block is populated in place.
//
// Position is anchored in screen space (fixed positioning). Closes on Escape,
// click-outside, or explicit selection.

'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Type, StickyNote, ImageIcon, Film, GitBranch, FileText, CheckSquare,
  FileAudio, Bot, Link2, Sparkles, X,
} from 'lucide-react'
import type { BlockKind } from './types'

export interface DropMenuState {
  /** Screen position to anchor the menu */
  clientX: number
  clientY: number
  /** World coords where the new block will be placed */
  worldX: number
  worldY: number
  /** Source block id — the connector will go from here to the new block */
  fromBlockId: string
}

interface Option {
  kind: BlockKind
  label: string
  icon: typeof Type
  description: string
}

const BLOCK_OPTIONS: Option[] = [
  { kind: 'page',       label: 'Page',       icon: FileText,    description: 'Full document with headings' },
  { kind: 'tasks',      label: 'Tasks',      icon: CheckSquare, description: 'Checklist with priorities' },
  { kind: 'text',       label: 'Text Note',  icon: Type,        description: 'Rich text block' },
  { kind: 'sticky',     label: 'Sticky',     icon: StickyNote,  description: 'Quick colored note' },
  { kind: 'mindmap',    label: 'Mind Map',   icon: GitBranch,   description: 'Branching brainstorm' },
  { kind: 'storyboard', label: 'Storyboard', icon: Film,        description: 'Frame-by-frame shot list' },
  { kind: 'image',      label: 'Image',      icon: ImageIcon,   description: 'Paste or upload' },
  { kind: 'transcript', label: 'Transcript', icon: FileAudio,   description: 'Reference text' },
  { kind: 'assistant',  label: 'AI Chat',    icon: Bot,         description: 'Assistant for connected blocks' },
  { kind: 'embed',      label: 'Embed',      icon: Link2,       description: 'Web URL preview' },
]

interface Props {
  state: DropMenuState | null
  onClose: () => void
  onCreateBlock: (kind: BlockKind, worldX: number, worldY: number, fromBlockId: string) => void
  onCreatePageFromAI: (prompt: string, worldX: number, worldY: number, fromBlockId: string) => Promise<void>
}

// Outer host — always mounted in Canvas. Only renders its body when a drop
// is active. This wrapper exists so the inner body can remount fresh on each
// open (local state resets naturally, no props-driven reset effect needed).
export function ConnectorDropMenu(props: Props) {
  const { state } = props
  return (
    <AnimatePresence>
      {state && (
        <DropMenuBody
          key={`${state.fromBlockId}-${state.clientX}-${state.clientY}`}
          {...props}
          state={state}
        />
      )}
    </AnimatePresence>
  )
}

interface BodyProps extends Omit<Props, 'state'> {
  state: DropMenuState
}

function DropMenuBody({ state, onClose, onCreateBlock, onCreatePageFromAI }: BodyProps) {
  const [aiMode, setAiMode] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Auto-focus AI input when entering AI mode
  useEffect(() => {
    if (aiMode) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [aiMode])

  // Close on Escape + click-outside. Delay the click-outside listener so the
  // pointerup that spawned the menu doesn't immediately dismiss it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (aiBusy) return
        onClose()
      }
    }
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        if (aiBusy) return
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    const t = setTimeout(() => document.addEventListener('mousedown', onClick), 120)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
      clearTimeout(t)
    }
  }, [onClose, aiBusy])

  const handleAISubmit = async () => {
    if (!aiPrompt.trim() || aiBusy) return
    setAiBusy(true)
    setAiError(null)
    try {
      await onCreatePageFromAI(aiPrompt.trim(), state.worldX, state.worldY, state.fromBlockId)
      onClose()
    } catch (err) {
      console.error('AI page generation failed:', err)
      setAiError(err instanceof Error ? err.message : 'Generation failed')
      setAiBusy(false)
    }
  }

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, y: -4, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.96 }}
      transition={{ duration: 0.14, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="fixed z-[100] w-[300px] rounded-lg border shadow-2xl backdrop-blur"
      style={{
        left: Math.min(state.clientX + 8, typeof window !== 'undefined' ? window.innerWidth - 316 : 0),
        top: Math.min(state.clientY + 8, typeof window !== 'undefined' ? window.innerHeight - 420 : 0),
        background: 'color-mix(in srgb, var(--bg2) 95%, transparent)',
        borderColor: 'var(--border2)',
      }}
    >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
              {aiMode ? 'Ask AI' : 'Connect to…'}
            </div>
            <button
              onClick={() => !aiBusy && onClose()}
              disabled={aiBusy}
              className="transition-colors duration-150 disabled:opacity-40"
              style={{ color: 'var(--text3)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text1)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text3)')}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>

          {aiMode ? (
            // ── AI prompt mode ──
            <div className="p-3 space-y-3">
              <div className="flex items-center gap-2" style={{ color: 'var(--text1)' }}>
                <Sparkles size={14} style={{ color: 'var(--cs-accent)' }} />
                <span className="text-[12.5px]">What should this page cover?</span>
              </div>
              <textarea
                ref={inputRef}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    handleAISubmit()
                  }
                }}
                placeholder="e.g. Break down next steps for the brand refresh — tasks, owners, deadlines"
                className="w-full resize-none rounded border px-2.5 py-2 text-[13px] focus:outline-none transition-colors"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--bg1)',
                  color: 'var(--text0)',
                }}
                rows={3}
                disabled={aiBusy}
              />
              {aiError && (
                <div className="text-[11.5px]" style={{ color: '#e05050' }}>
                  {aiError}
                </div>
              )}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => !aiBusy && setAiMode(false)}
                  disabled={aiBusy}
                  className="text-[12px] transition-colors duration-150 disabled:opacity-40"
                  style={{ color: 'var(--text3)' }}
                  onMouseEnter={(e) => !aiBusy && (e.currentTarget.style.color = 'var(--text1)')}
                  onMouseLeave={(e) => !aiBusy && (e.currentTarget.style.color = 'var(--text3)')}
                >
                  ← Back
                </button>
                <button
                  onClick={handleAISubmit}
                  disabled={!aiPrompt.trim() || aiBusy}
                  className="flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-medium transition-all duration-150 disabled:opacity-50"
                  style={{
                    background: 'var(--cs-accent)',
                    color: '#111110',
                  }}
                >
                  {aiBusy ? (
                    <>
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} />
                      Generate
                      <span className="ml-1 opacity-60">⌘↵</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            // ── Block type selection ──
            <div className="p-1.5 max-h-[380px] overflow-y-auto">
              <button
                onClick={() => setAiMode(true)}
                className="group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors duration-150"
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded"
                  style={{
                    background: 'color-mix(in srgb, var(--cs-accent) 15%, transparent)',
                    color: 'var(--cs-accent)',
                  }}
                >
                  <Sparkles size={15} strokeWidth={2.2} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium truncate" style={{ color: 'var(--text0)' }}>
                    New page from AI prompt
                  </div>
                  <div className="text-[11.5px] truncate" style={{ color: 'var(--text3)' }}>
                    Generate a structured page with context from this block
                  </div>
                </div>
              </button>

              <div className="my-1.5 h-px" style={{ background: 'var(--border)' }} />

              {BLOCK_OPTIONS.map((opt) => {
                const Icon = opt.icon
                return (
                  <button
                    key={opt.kind}
                    onClick={() => {
                      onCreateBlock(opt.kind, state.worldX, state.worldY, state.fromBlockId)
                      onClose()
                    }}
                    className="group flex w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-left transition-colors duration-150"
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg3)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded"
                      style={{
                        background: 'var(--bg3)',
                        color: 'var(--text1)',
                      }}
                    >
                      <Icon size={14} strokeWidth={2.1} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] truncate" style={{ color: 'var(--text0)' }}>
                        {opt.label}
                      </div>
                      <div className="text-[11px] truncate" style={{ color: 'var(--text3)' }}>
                        {opt.description}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
      )}
    </motion.div>
  )
}
