import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { startOfWeek, endOfWeek, format } from 'date-fns'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { summary, messages } = await req.json()
    if (!summary) return NextResponse.json({ error: 'summary is required' }, { status: 400 })

    const extraction = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Extract data from this week review summary. Return ONLY valid JSON, no markdown:
{
  "completedCount": number,
  "avgCompletionRate": number or null,
  "topWin": "string",
  "biggestStall": "string",
  "thePattern": "string",
  "nextWeekPriorities": ["string", "string", "string"]
}

Summary:
${summary}`,
      }],
    })

    const raw = extraction.content[0].type === 'text' ? extraction.content[0].text.trim() : '{}'
    let parsed: { completedCount?: number; avgCompletionRate?: number | null; topWin?: string; biggestStall?: string; thePattern?: string; nextWeekPriorities?: string[] } = {}
    try { parsed = JSON.parse(raw) } catch { /* fallback */ }

    const now = new Date()
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')

    const { data: review, error } = await supabase
      .from('weekly_reviews')
      .upsert([{
        week_start: weekStart,
        week_end: weekEnd,
        completion_rate: parsed.avgCompletionRate ?? null,
        biggest_gaps: parsed.biggestStall ?? null,
        top_wins: parsed.topWin ? [{ win: parsed.topWin }] : [],
        next_week_priorities: (parsed.nextWeekPriorities ?? []).map((p, i) => ({ rank: i + 1, task: p })),
        messages: messages ?? [],
      }], { onConflict: 'week_start' })
      .select('id')
      .single()

    if (error) throw error

    // Snapshot project progress to performance_metrics
    const { data: projects } = await supabase.from('projects').select('id, name, progress')
    if (projects && projects.length > 0) {
      const today = format(now, 'yyyy-MM-dd')
      await supabase.from('performance_metrics').insert(
        projects.map((p: { id: string; name: string; progress: number }) => ({
          date: today,
          metric_type: 'project_snapshot',
          metric_key: p.id,
          metric_value: p.progress,
          metadata: { projectName: p.name },
        }))
      )
    }

    return NextResponse.json({ reviewId: review?.id, weekStart, weekEnd })
  } catch (error) {
    console.error('Weekly review save error:', error)
    return NextResponse.json({ error: 'Failed to save weekly review' }, { status: 500 })
  }
}
