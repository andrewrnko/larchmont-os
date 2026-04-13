// AI Assistant block — full canvas intelligence layer.
// Reads EVERY block on the canvas (not just connected ones), sends full
// context to the AI, and executes structured actions against the store.

'use client'

import { useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { useCanvasStore, useActiveBoard, uid } from '../store'
import type { AssistantBlock, AnyBlock, ChatMessage, Connector } from '../types'
import { BlockWrapper } from '../BlockWrapper'
import { Bot, Send, Loader2, Trash2 } from 'lucide-react'
import {
  buildCanvasContext,
  parseAIResponse,
  executeActions,
  type ActionResult,
} from '../ai-graph'

interface Props {
  block: AssistantBlock
  onContextMenu?: (e: React.MouseEvent) => void
}

export function AssistantBlockView({ block, onContextMenu }: Props) {
  const updateBlock = useCanvasStore((s) => s.updateBlock)
  const addBlockAt = useCanvasStore((s) => s.addBlockAt)
  const addConnector = useCanvasStore((s) => s.addConnector)
  const board = useActiveBoard()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Canvas stats for header
  const blockCount = board ? board.blocks.length - 1 : 0 // exclude self
  const groupCount = board ? board.blocks.filter((b) => b.kind === 'group').length : 0
  const mindmapCount = board ? board.blocks.filter((b) => b.kind === 'mindmap').length : 0

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim(), timestamp: Date.now() }
    const nextMessages = [...block.messages, userMsg]
    updateBlock(block.id, { messages: nextMessages })
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50)

    try {
      // Build full canvas context (ALL blocks, not just connected)
      const canvasContext = board ? buildCanvasContext(block.id, board) : ''

      const res = await fetch('/api/creative-studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          canvasContext,
          history: nextMessages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      const responseText: string = data.response || data.error || 'No response'
      const serverActions = Array.isArray(data.actions) ? data.actions : []

      // Fallback: parse response text for embedded actions
      const parsed = parseAIResponse(responseText)
      const allActions = serverActions.length > 0 ? serverActions : parsed.actions

      // Always strip code fences and raw JSON from display
      let displayMessage = serverActions.length > 0 ? responseText : parsed.message
      displayMessage = displayMessage
        .replace(/```(?:json)?\s*\n?[\s\S]*?```/g, '')  // remove fenced blocks
        .replace(/^\s*\{[\s\S]*"actions"\s*:\s*\[[\s\S]*\]\s*\}\s*$/g, '') // remove bare JSON
        .trim()
      if (!displayMessage) displayMessage = parsed.message || 'Done.'

      // Execute actions
      let actionResults: ActionResult[] = []
      if (allActions.length > 0) {
        const cs = useCanvasStore.getState()
        const currentBoard = cs.boards.find((b) => b.id === cs.activeBoardId)
        if (currentBoard) {
          actionResults = executeActions(
            allActions,
            currentBoard,
            (id, patch) => useCanvasStore.getState().updateBlock(id, patch),
            (kind, x, y) => useCanvasStore.getState().addBlockAt(kind, x, y),
            block,
            (c: Connector) => useCanvasStore.getState().addConnector(c),
          )
        }
      }

      // Build detailed action summary
      let statusLine = ''
      if (actionResults.length > 0) {
        const lines: string[] = []
        for (const r of actionResults) {
          if (r.success) {
            lines.push(`✓ ${r.description}`)
          } else {
            lines.push(`⚠ ${r.action.type}: ${r.description}`)
          }
        }
        statusLine = '\n\n' + lines.join('\n')
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: displayMessage + statusLine,
        timestamp: Date.now(),
      }
      updateBlock(block.id, { messages: [...nextMessages, assistantMsg] })
    } catch {
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: 'Failed to reach the assistant. Check your connection.',
        timestamp: Date.now(),
      }
      updateBlock(block.id, { messages: [...nextMessages, errMsg] })
    } finally {
      setLoading(false)
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100)
    }
  }

  const clearChat = () => updateBlock(block.id, { messages: [] })

  // Auto-grow textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  return (
    <BlockWrapper block={block} kind="assistant" onContextMenu={onContextMenu}>
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-[color:var(--cs-accent)]/30 bg-[#111110]"
        style={{ boxShadow: '0 0 24px color-mix(in srgb, var(--cs-accent) 8%, transparent)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[color:rgba(255,255,255,0.07)] bg-[#1c1c1a] px-4 py-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Bot size={15} className="text-[color:var(--cs-accent)]" />
              <span className="font-mono text-[13px] font-medium uppercase tracking-[0.06em] text-[color:var(--cs-accent)]">AI Assistant</span>
            </div>
            <span className="mt-0.5 text-[11px] text-[#555450]">
              Canvas: {blockCount} block{blockCount !== 1 ? 's' : ''} · {groupCount} group{groupCount !== 1 ? 's' : ''} · {mindmapCount} mind map{mindmapCount !== 1 ? 's' : ''}
            </span>
          </div>
          <button onClick={clearChat} className="text-[#555450] hover:text-red-400" title="Clear chat">
            <Trash2 size={14} />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} data-scrollable className="flex-1 overflow-auto p-3 space-y-2">
          {block.messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center p-4">
              <Bot size={32} className="mb-3 text-[color:var(--cs-accent)]/40" />
              <p className="text-[15px] leading-[1.5] text-[#888780]">
                I can see everything on your canvas.
              </p>
              <p className="mt-1 text-[14px] leading-[1.5] text-[#555450]">
                Ask me to build projects, add nodes, create tasks, organize groups, or analyze your work.
              </p>
            </div>
          )}
          {block.messages.map((msg, i) => (
            <div key={i}>
              <div
                className={`rounded-lg px-4 py-3 text-[15px] leading-[1.5] overflow-hidden ${
                  msg.role === 'user'
                    ? 'ml-6 bg-[color:var(--cs-accent)]/15 text-[#f0ede8]'
                    : 'mr-6 bg-[#242422] text-[#c8c4bc]'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-invert prose-sm max-w-none break-words [&_a]:text-[color:var(--cs-accent2)] [&_a]:underline [&_code]:text-[color:var(--cs-accent2)] [&_strong]:text-white [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="mr-6 flex items-center gap-2 rounded-md bg-[#242422] px-3 py-2 text-[15px] text-[#888780]">
              <Loader2 size={12} className="animate-spin" /> Thinking...
            </div>
          )}
        </div>

        {/* Input — multi-line textarea */}
        <div className="border-t border-[color:rgba(255,255,255,0.07)] p-3">
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              className="flex-1 resize-none rounded-md bg-[#1c1c1a] px-3 py-2 text-[15px] leading-[1.5] text-white outline-none placeholder:text-[#555450]"
              placeholder="Talk to your canvas..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
              }}
              rows={1}
              style={{ maxHeight: 120 }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="shrink-0 rounded-md bg-[color:var(--cs-accent)] p-2 text-black hover:bg-[color:var(--cs-accent2)] disabled:opacity-30"
            >
              <Send size={16} />
            </button>
          </div>
          {input.length > 200 && (
            <div className="mt-1 text-right text-[11px] text-[#555450]">{input.length} chars</div>
          )}
        </div>
      </div>
    </BlockWrapper>
  )
}
