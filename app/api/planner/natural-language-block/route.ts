// Parse natural-language into a single time block.
// "2hr deep work at 9am" -> { start_time, end_time, title, category }

import { NextRequest, NextResponse } from 'next/server'
import { chat } from '@/lib/model-router'

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)```/)
  if (fence) return fence[1].trim()
  return text.trim()
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { text: string; date?: string }
    if (!body.text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

    const prompt = `Parse this description into a single time block. Return ONLY JSON, no prose, no fences:
{"start_time":"HH:MM","end_time":"HH:MM","title":"string","category":"deep_work|admin|client|personal|travel|buffer"}

Defaults:
- 24-hour time, zero-padded.
- If duration is implied but not the start, assume 09:00 start.
- If category is ambiguous, pick "deep_work".
- title: extract the meaningful noun phrase; empty string if none.

Description: "${body.text.replace(/"/g, '\\"')}"`

    const res = await chat(prompt, 'extract', {
      temperature: 0.1,
      maxTokens: 200,
      cloudModel: 'claude-haiku-4-5-20251001',
    })

    let parsed: {
      start_time: string
      end_time: string
      title: string
      category: string
    } = { start_time: '09:00', end_time: '10:00', title: body.text.slice(0, 80), category: 'deep_work' }
    try {
      parsed = JSON.parse(extractJson(res.content))
    } catch {
      // fall through with defaults
    }
    return NextResponse.json({ ...parsed, tier: res.tier, fellBack: res.fellBack })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'parse failed' },
      { status: 500 },
    )
  }
}
