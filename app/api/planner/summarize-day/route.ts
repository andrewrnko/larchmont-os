// End-of-day summary endpoint. Reads completed/skipped blocks and generates
// a short reflection paragraph. Local-first (summarize is a local task type).

import { NextRequest, NextResponse } from 'next/server'
import { chat } from '@/lib/model-router'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      date: string
      blocks?: Array<{
        title: string
        category: string
        start_time: string
        end_time: string
        status: string
        actual_duration_minutes: number | null
      }>
    }
    if (!body.date) return NextResponse.json({ error: 'date required' }, { status: 400 })

    const prompt = `Summarize the day of ${body.date}. 3–5 sentences, reflective, specific.
Lead with what got done and total focused time. Note what slipped and why. End with one concrete suggestion for tomorrow.

Blocks:
${JSON.stringify(body.blocks ?? [], null, 2)}`

    const res = await chat(prompt, 'summarize', {
      temperature: 0.5,
      maxTokens: 500,
    })
    return NextResponse.json({ summary: res.content.trim(), tier: res.tier, fellBack: res.fellBack })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'summarize-day failed' },
      { status: 500 },
    )
  }
}
