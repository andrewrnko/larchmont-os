import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { chat } from '@/lib/model-router'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { dayPlan } = await req.json()
    console.log('[populate] 1. Received dayPlan:', dayPlan?.slice(0, 200))

    if (!dayPlan) {
      return NextResponse.json({ error: 'dayPlan is required' }, { status: 400 })
    }

    // Routed through model-router — extraction is a local task (gemma3:27b).
    // Falls back to Haiku if the local model is down.
    const extraction = await chat(
      `Extract project and tasks from this day plan.
Respond with ONLY a JSON object. No explanation. No markdown. No backticks. Just raw JSON exactly like this format:
{"projectName":"Example Project","tasks":[{"name":"Task name","priority":"P0","timeBlock":"morning"}]}

Rules:
- projectName = the value in "The Win:" section (short noun phrase like "Larchmont Builds Brand Refresh")
- Include ALL tasks from Morning Block and Afternoon Block time entries
- The main win task gets P0, all supporting tasks get P1
- Omit items from "Don't Touch Today", "Watch Out For", and "If You Have 15 Minutes Extra"
- Task names should be concise action phrases (verb + object)

Day plan to extract from:
${dayPlan}`,
      'extract',
      { temperature: 0.1, maxTokens: 600, cloudModel: 'claude-haiku-4-5-20251001' }
    )

    const raw = extraction.content.trim()
    console.log(`[populate] 2. Extraction response (tier=${extraction.tier}, model=${extraction.model}):`, raw)

    let parsed: { projectName: string; tasks: { name: string; priority: string; timeBlock: string }[] }
    try {
      const clean = raw
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .replace(/^\s*[\r\n]/gm, '')
        .trim()
      console.log('[populate] 3. Cleaned JSON string:', clean.slice(0, 300))
      parsed = JSON.parse(clean)
      console.log('[populate] 3b. Parsed successfully:', JSON.stringify(parsed).slice(0, 200))
    } catch (parseErr: any) {
      console.error('[populate] JSON parse failed. Raw was:', raw)
      return NextResponse.json({ error: `JSON parse failed: ${parseErr.message}`, raw }, { status: 422 })
    }

    if (!parsed.projectName || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
      console.error('[populate] Invalid structure:', parsed)
      return NextResponse.json({ error: 'Invalid day plan structure — missing projectName or tasks', parsed }, { status: 422 })
    }

    // Find or create project (case-insensitive name match)
    console.log('[populate] 4. Looking up project:', parsed.projectName)
    const { data: existing } = await supabase
      .from('projects')
      .select('id, name')
      .ilike('name', parsed.projectName)
      .maybeSingle()
    console.log('[populate] 4b. Project lookup result:', existing)

    let projectId: string
    if (existing) {
      projectId = existing.id
      console.log('[populate] 5. Using existing project:', projectId)
    } else {
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({ name: parsed.projectName, status: 'Active', progress: 0 })
        .select('id')
        .single()
      if (projectError) {
        console.error('[populate] Project insert error:', projectError)
        throw projectError
      }
      projectId = newProject.id
      console.log('[populate] 5. Created new project:', projectId, parsed.projectName)
    }

    // Insert tasks
    const today = new Date().toISOString().split('T')[0]
    const tasks = parsed.tasks.map((t) => ({
      name: t.name,
      project_id: projectId,
      priority: ['P0', 'P1', 'P2', 'P3'].includes(t.priority) ? t.priority : 'P1',
      status: 'Not Started',
      due_date: today,
    }))
    console.log('[populate] 6. Tasks to insert:', JSON.stringify(tasks))

    const { data: createdTasks, error: tasksError } = await supabase
      .from('tasks')
      .insert(tasks)
      .select('id, name')
    if (tasksError) {
      console.error('[populate] Tasks insert error:', tasksError)
      throw tasksError
    }
    console.log('[populate] 7. Created tasks:', createdTasks)

    return NextResponse.json({
      projectId,
      projectName: parsed.projectName,
      taskIds: createdTasks?.map((t) => t.id) ?? [],
      taskCount: tasks.length,
    })
  } catch (e: any) {
    console.error('[populate] Fatal error:', e.message, e)
    return NextResponse.json({ error: e.message ?? 'Failed to populate workspace', step: 'see server logs' }, { status: 500 })
  }
}
