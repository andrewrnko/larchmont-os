// AI Assistant block — chat interface that pulls context from connected blocks.

'use client'

import { useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { useCanvasStore, useActiveBoard, uid } from '../store'
import type {
  AssistantBlock, AnyBlock, TextBlock, StickyBlock, TranscriptBlock,
  PageBlock, MindMapBlock, StoryboardBlock, TasksBlock, ChatMessage,
} from '../types'
import { BlockWrapper } from '../BlockWrapper'
import { Bot, Send, Loader2, Trash2 } from 'lucide-react'

// Extract text content from any block for context injection.
function blockToText(block: AnyBlock): string {
  switch (block.kind) {
    case 'text': return `[Text Note] ${(block as TextBlock).html.replace(/<[^>]+>/g, '')}`
    case 'sticky': return `[Sticky] ${(block as StickyBlock).text}`
    case 'transcript': {
      const t = block as TranscriptBlock
      return `[Transcript: ${t.title}${t.source ? ` — ${t.source}` : ''}]\n${t.transcript}`
    }
    case 'page': {
      const p = block as PageBlock
      const body = p.content.map((c) => ('text' in c ? c.text : '')).filter(Boolean).join('\n')
      return `[Page: ${p.title}]\n${body}`
    }
    case 'mindmap': {
      const m = block as MindMapBlock
      const nodes = m.nodes.map((n) => `- ${n.label}${n.notes ? `: ${n.notes}` : ''}`).join('\n')
      return `[Mind Map]\n${nodes}`
    }
    case 'storyboard': {
      const s = block as StoryboardBlock
      const frames = s.frames.map((f) => `${f.label}: ${f.notes}${f.detailedNotes ? `\n${f.detailedNotes}` : ''}`).join('\n')
      return `[Storyboard]\n${frames}`
    }
    case 'tasks': {
      const tk = block as TasksBlock
      const items = tk.taskItems.map((t) => `${t.done ? '☑' : '☐'} ${t.priority ? `P${t.priority}` : ''} ${t.title}`).join('\n')
      return `[Task List: ${tk.label}]\n${items || '(empty)'}`
    }
    case 'embed': {
      const e = block as import('../types').EmbedBlock
      return `[Link: ${e.title || e.url || '(no url)'}]\nURL: ${e.url}\n${e.description || ''}`
    }
    default: return ''
  }
}

interface Props {
  block: AssistantBlock
  onContextMenu?: (e: React.MouseEvent) => void
}

export function AssistantBlockView({ block, onContextMenu }: Props) {
  const updateBlock = useCanvasStore((s) => s.updateBlock)
  const board = useActiveBoard()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Find all blocks connected TO this assistant block
  const getConnectedContext = (): string => {
    if (!board) return ''
    const connectedIds = new Set<string>()
    for (const c of board.connectors) {
      if (c.toBlockId === block.id) connectedIds.add(c.fromBlockId)
      if (c.fromBlockId === block.id) connectedIds.add(c.toBlockId)
    }
    if (connectedIds.size === 0) return ''
    return board.blocks
      .filter((b) => connectedIds.has(b.id))
      .map(blockToText)
      .filter(Boolean)
      .join('\n\n---\n\n')
  }

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim(), timestamp: Date.now() }
    const nextMessages = [...block.messages, userMsg]
    updateBlock(block.id, { messages: nextMessages })
    setInput('')
    setLoading(true)
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50)

    try {
      const context = getConnectedContext()
      const res = await fetch('/api/creative-studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          context,
          history: nextMessages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      let responseText: string = data.response || data.error || 'No response'

      // Check for task creation block in response
      const taskMatch = responseText.match(/```tasks\n([\s\S]*?)```/)
      if (taskMatch) {
        try {
          const taskData = JSON.parse(taskMatch[1]) as { title: string; priority?: number }[]
          // Create a Tasks block on the canvas near the assistant
          const addBlockAt = useCanvasStore.getState().addBlockAt
          const taskBlockId = addBlockAt('tasks', block.x + block.w + 40, block.y)
          if (taskBlockId && taskData.length > 0) {
            const taskItems = taskData.map((t) => ({
              id: uid(),
              title: t.title,
              done: false,
              priority: (t.priority ?? 2) as 1 | 2 | 3,
              createdAt: Date.now(),
            }))
            useCanvasStore.getState().updateBlock(taskBlockId, {
              label: 'AI-Generated Tasks',
              taskItems,
            })
            // Connect the new task block to this assistant
            useCanvasStore.getState().addConnector({
              id: uid(),
              fromBlockId: block.id,
              toBlockId: taskBlockId,
              style: 'curved',
              arrow: 'one',
              color: '#e8a045',
              weight: 2,
            })
          }
        } catch {}
        // Remove the tasks code block from the displayed message
        responseText = responseText.replace(/```tasks\n[\s\S]*?```/, '✅ *Task list created on canvas*')
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: responseText,
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
  const connectedCount = board
    ? board.connectors.filter((c) => c.toBlockId === block.id || c.fromBlockId === block.id).length
    : 0

  return (
    <BlockWrapper block={block} kind="assistant" onContextMenu={onContextMenu}>
      <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-amber-800/40 bg-[#0a0a0a] shadow-[0_0_24px_rgba(245,158,11,0.08)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#111] px-3 py-2">
          <div className="flex items-center gap-2">
            <Bot size={14} className="text-amber-500" />
            <span className="font-mono text-[11px] font-medium text-amber-400">AI ASSISTANT</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-neutral-500">{connectedCount} node{connectedCount !== 1 ? 's' : ''}</span>
            <button onClick={clearChat} className="text-neutral-600 hover:text-red-400" title="Clear chat">
              <Trash2 size={10} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-auto p-2 space-y-2">
          {block.messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center p-4">
              <Bot size={24} className="mb-2 text-amber-500/40" />
              <p className="text-[11px] text-neutral-500">
                Connect blocks to me, then ask questions about them.
              </p>
              <p className="mt-1 text-[10px] text-neutral-700">
                I can read sticky notes, text, transcripts, pages, mind maps, and storyboards.
              </p>
            </div>
          )}
          {block.messages.map((msg, i) => (
            <div
              key={i}
              className={`rounded-md px-3 py-2 text-[12px] leading-relaxed overflow-hidden ${
                msg.role === 'user'
                  ? 'ml-6 bg-amber-600/15 text-amber-100'
                  : 'mr-6 bg-[#1a1a1a] text-neutral-300'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-invert prose-sm max-w-none break-words [&_a]:text-amber-400 [&_a]:underline [&_code]:text-amber-300 [&_strong]:text-white [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
                  <Markdown>{msg.content}</Markdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              )}
            </div>
          ))}
          {loading && (
            <div className="mr-6 flex items-center gap-2 rounded-md bg-[#1a1a1a] px-3 py-2 text-[11px] text-neutral-500">
              <Loader2 size={12} className="animate-spin" /> Thinking…
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-[#2a2a2a] p-2">
          <div className="flex gap-1">
            <input
              className="flex-1 rounded bg-[#141414] px-3 py-2 text-[12px] text-white outline-none placeholder:text-neutral-600"
              placeholder="Ask about connected blocks…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="rounded bg-amber-600 p-2 text-black hover:bg-amber-500 disabled:opacity-30"
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>
    </BlockWrapper>
  )
}
