import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { chat } from '@/lib/model-router'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { summary, messages, completedTasks, incompleteTasks } = await req.json()
    if (!summary) return NextResponse.json({ error: 'summary is required' }, { status: 400 })

    // Routed through model-router — extraction is a local task (gemma3:27b).
    // Falls back to Haiku if the local model is down.
    const extraction = await chat(
      `Extract data from this day summary. Return ONLY valid JSON, no markdown:
{
  "completionRate": number (0-100, from "Completion Rate:" line),
  "wins": "string (from 'The Win:' line)",
  "gaps": "string (from 'What Slipped:' line)",
  "why": "string (from 'Why:' line)",
  "tomorrowP0": "string (from 'Tomorrow's P0:' line)",
  "energyLevel": "string (from 'Energy:' line)"
}

Summary:
${summary}`,
      'extract',
      { temperature: 0.1, maxTokens: 400, cloudModel: 'claude-haiku-4-5-20251001' }
    )

    const raw = extraction.content.trim() || '{}'
    let parsed: { completionRate?: number; wins?: string; gaps?: string; why?: string; tomorrowP0?: string; energyLevel?: string } = {}
    try { parsed = JSON.parse(raw) } catch { /* fallback to empty */ }

    const today = new Date().toISOString().split('T')[0]
    const completionRate = parsed.completionRate ?? null
    const p0Hit = completionRate != null && completionRate === 100

    // Upsert the debrief record
    const { data: debrief, error: debriefError } = await supabase
      .from('daily_debriefs')
      .upsert([{
        date: today,
        completion_rate: completionRate,
        p0_hit: p0Hit,
        energy_level: parsed.energyLevel ?? null,
        wins: parsed.wins ?? null,
        gaps: `${parsed.gaps ?? ''} ${parsed.why ? '— ' + parsed.why : ''}`.trim() || null,
        tomorrow_p0: parsed.tomorrowP0 ?? null,
        messages: messages ?? [],
        completed_tasks: completedTasks ?? [],
        incomplete_tasks: incompleteTasks ?? [],
      }], { onConflict: 'date' })
      .select('id')
      .single()

    if (debriefError) throw debriefError

    // Insert performance metrics
    const metricsToInsert = []
    if (completionRate != null) {
      metricsToInsert.push({ date: today, metric_type: 'completion_rate', metric_key: today, metric_value: completionRate, metadata: {} })
    }
    metricsToInsert.push({ date: today, metric_type: 'p0_hit', metric_key: today, metric_value: p0Hit ? 1 : 0, metadata: {} })
    if (parsed.energyLevel) {
      const energyMap: Record<string, number> = { 'sharp': 5, 'good': 4, 'average': 3, 'tired': 2, 'fumes': 1, 'running on fumes': 1 }
      const energyScore = energyMap[parsed.energyLevel.toLowerCase()] ?? 3
      metricsToInsert.push({ date: today, metric_type: 'energy_level', metric_key: today, metric_value: energyScore, metadata: { raw: parsed.energyLevel } })
    }

    if (metricsToInsert.length > 0) {
      await supabase.from('performance_metrics').insert(metricsToInsert)
    }

    // Update tomorrow's P0 task if we found one
    let tomorrowP0Updated = false
    if (parsed.tomorrowP0) {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      // Find matching task by name (fuzzy)
      const { data: tasks } = await supabase.from('tasks').select('id, name').not('status', 'in', '("Done","Cancelled")')
      const match = tasks?.find((t) => t.name.toLowerCase().includes(parsed.tomorrowP0!.toLowerCase().slice(0, 15)))
      if (match) {
        await supabase.from('tasks').update({ priority: 'P0', due_date: tomorrow }).eq('id', match.id)
        tomorrowP0Updated = true
      }
    }

    return NextResponse.json({ debriefId: debrief?.id, completionRate, tomorrowP0Updated })
  } catch (error) {
    console.error('Debrief save error:', error)
    return NextResponse.json({ error: 'Failed to save debrief' }, { status: 500 })
  }
}
