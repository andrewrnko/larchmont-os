// Plan-my-week AI endpoint. Proposes time blocks across 7 days given
// unscheduled tasks and already-scheduled blocks.

import { NextRequest, NextResponse } from 'next/server'
import { chat } from '@/lib/model-router'

interface ProposedBlock {
  date: string
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
    const body = await req.json() as {
      weekStart: string
      tasks?: Array<{ title: string; priority?: number; estimated_minutes?: number | null }>
      existingBlocks?: Array<{ date: string; start_time: string; end_time: string; title: string }>
    }
    if (!body.weekStart) return NextResponse.json({ error: 'weekStart required' }, { status: 400 })

    const prompt = `You are a planning assistant. Build a week schedule.

Week begins Monday ${body.weekStart}. Working hours: 07:00–20:00.
Categories: deep_work, admin, client, personal, travel, buffer.

Already scheduled blocks (do NOT duplicate):
${JSON.stringify(body.existingBlocks ?? [], null, 2)}

Unscheduled tasks to place:
${JSON.stringify(body.tasks ?? [], null, 2)}

Propose new time blocks. Return ONLY a JSON object with this shape, no prose, no fences:
{"blocks":[{"date":"YYYY-MM-DD","start_time":"HH:MM","end_time":"HH:MM","title":"...","category":"deep_work","priority":3}]}

Rules:
- Place higher-priority tasks earlier in the week and earlier in the day.
- Cluster deep_work in mornings, admin after lunch, buffer between heavy blocks.
- Do not overlap existing blocks.
- No block shorter than 30 minutes or longer than 3 hours.
- Weekends: personal/buffer only unless a task is explicitly urgent.`

    const res = await chat(prompt, 'synthesis', {
      temperature: 0.4,
      maxTokens: 2000,
    })

    let parsed: { blocks: ProposedBlock[] } = { blocks: [] }
    try {
      parsed = JSON.parse(extractJson(res.content))
    } catch {
      parsed = { blocks: [] }
    }
    return NextResponse.json({ ...parsed, tier: res.tier, fellBack: res.fellBack })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'plan-week failed' },
      { status: 500 },
    )
  }
}
