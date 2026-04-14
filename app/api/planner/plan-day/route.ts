// Plan-my-day AI endpoint. Proposes time blocks for a single day.

import { NextRequest, NextResponse } from 'next/server'
import { chat, isLocalHealthy } from '@/lib/model-router'

interface ProposedBlock {
  start_time: string
  end_time: string
  title: string
  category: 'deep_work' | 'admin' | 'client' | 'personal' | 'travel' | 'buffer'
  priority?: number
}

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]+?)```/)
  if (fence) return fence[1].trim()
  return text.trim()
}

export async function POST(req: NextRequest) {
  try {
    let body: {
      date?: string
      existingBlocks?: Array<{ start_time: string; end_time: string; title: string; category?: string; is_locked?: boolean }>
      openTasks?: Array<{ title: string; priority?: number; estimated_minutes?: number | null }>
    }
    try {
      body = await req.json()
    } catch (parseErr) {
      console.error('[plan-day] invalid JSON body', parseErr)
      return NextResponse.json({ blocks: [], error: 'Invalid JSON body' })
    }

    if (!body?.date) {
      return NextResponse.json({ blocks: [], error: 'date required' })
    }

    const prompt = `You are a focus-first day planner. Plan ${body.date} (working hours 07:00–20:00).

Existing blocks (do NOT overlap, do NOT duplicate):
${JSON.stringify(body.existingBlocks ?? [], null, 2)}

Open tasks to place today:
${JSON.stringify(body.openTasks ?? [], null, 2)}

Return ONLY JSON, no prose, no fences:
{"blocks":[{"start_time":"HH:MM","end_time":"HH:MM","title":"...","category":"deep_work","priority":3}]}

Rules:
- Morning: one or two deep_work blocks of 90 minutes.
- Midday: admin, client work.
- Include at least one 30-min buffer between heavy blocks.
- Never overlap existing blocks.
- Prefer hour-aligned starts (:00 or :30).`

    // Validate model availability: if local is down, force cloud.
    let forceTier: 'local' | 'cloud' | undefined
    try {
      const localUp = await isLocalHealthy()
      if (!localUp) forceTier = 'cloud'
    } catch (healthErr) {
      console.warn('[plan-day] health check threw, defaulting to cloud', healthErr)
      forceTier = 'cloud'
    }

    let res
    try {
      res = await chat(prompt, 'synthesis', {
        temperature: 0.4,
        maxTokens: 1500,
        ...(forceTier ? { force: forceTier } : {}),
      })
    } catch (modelErr) {
      console.error('[plan-day] model call failed', modelErr)
      return NextResponse.json({
        blocks: [],
        error: modelErr instanceof Error ? modelErr.message : 'model call failed',
      })
    }

    let parsed: { blocks: ProposedBlock[] } = { blocks: [] }
    try {
      const raw = JSON.parse(extractJson(res.content))
      if (raw && Array.isArray(raw.blocks)) parsed = raw as { blocks: ProposedBlock[] }
    } catch (parseErr) {
      console.warn('[plan-day] could not parse model output', parseErr, res.content?.slice(0, 400))
      return NextResponse.json({
        blocks: [],
        error: 'model returned unparseable output',
        tier: res.tier,
        fellBack: res.fellBack,
      })
    }

    return NextResponse.json({
      blocks: parsed.blocks ?? [],
      tier: res.tier,
      fellBack: res.fellBack,
    })
  } catch (err) {
    console.error('[plan-day] unhandled error', err)
    return NextResponse.json({
      blocks: [],
      error: err instanceof Error ? err.message : 'plan-day failed',
    })
  }
}
