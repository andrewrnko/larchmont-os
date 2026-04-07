import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getDebriefContext } from '@/lib/db'
import { buildDebriefSystemPrompt } from '@/lib/briefing-debrief'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    const context = await getDebriefContext()
    const systemPrompt = buildDebriefSystemPrompt(context)

    const stream = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1200,
      system: systemPrompt,
      messages,
      stream: true,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        controller.close()
      },
    })

    return new NextResponse(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (error) {
    console.error('Debrief API error:', error)
    return NextResponse.json({ error: 'Failed to generate debrief response' }, { status: 500 })
  }
}
