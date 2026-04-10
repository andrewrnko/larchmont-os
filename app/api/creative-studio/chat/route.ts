// API route: Creative Studio AI Assistant.
// Receives user message + context from connected blocks.
// For Google Doc links in context, fetches the published HTML export to get full content.

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Extract Google Doc IDs from context and fetch their content.
async function enrichGoogleDocs(context: string): Promise<string> {
  const docIdRegex = /https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/g
  const ids = new Set<string>()
  let match
  while ((match = docIdRegex.exec(context)) !== null) {
    ids.add(match[1])
  }

  if (ids.size === 0) return context

  let enriched = context
  for (const docId of ids) {
    try {
      // Google Docs can be exported as plain text if published or shared publicly
      const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`
      const res = await fetch(exportUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LarchmontOS/1.0)' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      })
      if (res.ok) {
        const text = await res.text()
        if (text.length > 100 && !text.includes('<!DOCTYPE html>')) {
          // Truncate very long docs
          const truncated = text.length > 15000 ? text.slice(0, 15000) + '\n\n[... truncated at 15,000 chars]' : text
          enriched += `\n\n--- GOOGLE DOC CONTENT (${docId}) ---\n${truncated}`
        }
      }
    } catch {
      // Silently skip — doc may be private
    }
  }

  return enriched
}

export async function POST(req: NextRequest) {
  try {
    const { message, context, history } = await req.json() as {
      message: string
      context: string
      history: { role: 'user' | 'assistant'; content: string }[]
    }

    // Enrich with Google Doc content if any doc links are in context
    const enrichedContext = await enrichGoogleDocs(context)

    const systemPrompt = `You are an AI assistant embedded in a creative studio canvas. You have access to the content of blocks connected to you on the canvas. Use this context to answer questions, brainstorm, analyze, and help the user with their creative work.

CONNECTED BLOCK CONTENT:
${enrichedContext || '(No blocks connected yet — ask the user to connect blocks to you using the connector anchors)'}

Be concise, direct, and helpful. Use markdown formatting (bold, lists, headings) for clarity. Reference specific content from the connected blocks when relevant.

TASK CREATION: When the user asks you to create a task list, make tasks, or generate action items, include a JSON block at the END of your response in this exact format:
\`\`\`tasks
[{"title":"Task name","priority":1},{"title":"Another task","priority":2}]
\`\`\`
Priority is 1, 2, or 3. This will auto-create a Tasks node on their canvas. Only include this when the user explicitly asks for tasks to be created.`

    const messages: Anthropic.MessageParam[] = [
      ...history.slice(-20).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ]

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    return NextResponse.json({ response: text })
  } catch (err) {
    console.error('Creative Studio chat error:', err)
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 })
  }
}
