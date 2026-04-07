import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getBriefingContext } from '@/lib/db'
import { buildSystemPrompt } from '@/lib/briefing'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Tools ──────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_project',
    description: 'Create a new project in the workspace. Use immediately when the user asks to add or create a project — no confirmation needed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Project name' },
        status: { type: 'string', enum: ['Planning', 'Active', 'In Review', 'Complete', 'Paused'], description: 'Status (default: Active)' },
        category: { type: 'string', description: 'Category: Brand, Video, Web, Events, Paid Ads, Print, Ops, or Strategy' },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task, optionally inside a named project. Use immediately when the user asks to add or create a task — no confirmation needed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Task name' },
        project_name: { type: 'string', description: 'Project name to attach this task to. Will find an existing project by name or create it if it does not exist.' },
        priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'], description: 'Priority (default: P2)' },
        status: { type: 'string', enum: ['Not Started', 'In Progress', 'Blocked', 'Done'], description: 'Status (default: Not Started)' },
        due_date: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_task',
    description: 'Update an existing task\'s status, priority, or due date. Use immediately when user asks to change a task.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_name: { type: 'string', description: 'Name of the task to update (partial match OK)' },
        status: { type: 'string', enum: ['Not Started', 'In Progress', 'Blocked', 'Done'] },
        priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
        due_date: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
      },
      required: ['task_name'],
    },
  },
  {
    name: 'update_project',
    description: 'Update an existing project\'s status or progress. Use immediately when user asks to change a project.',
    input_schema: {
      type: 'object' as const,
      properties: {
        project_name: { type: 'string', description: 'Name of the project to update (partial match OK)' },
        status: { type: 'string', enum: ['Planning', 'Active', 'In Review', 'Complete', 'Paused'] },
        progress: { type: 'number', description: 'Progress percentage 0–100' },
      },
      required: ['project_name'],
    },
  },
]

// ── Tool executor ──────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    if (name === 'create_project') {
      const { data, error } = await supabase
        .from('projects')
        .insert({ name: input.name, status: input.status ?? 'Active', category: input.category ?? null, progress: 0 })
        .select('id, name').single()
      if (error) throw error
      return `SUCCESS: Project "${data.name}" was created.`
    }

    if (name === 'create_task') {
      let projectId: string | null = null
      if (input.project_name) {
        const { data: existing } = await supabase
          .from('projects').select('id').ilike('name', `%${input.project_name}%`).limit(1).maybeSingle()
        if (existing) {
          projectId = existing.id
        } else {
          const { data: created } = await supabase
            .from('projects').insert({ name: input.project_name, status: 'Active', progress: 0 }).select('id').single()
          projectId = created?.id ?? null
        }
      }
      const { data, error } = await supabase
        .from('tasks')
        .insert({ name: input.name, project_id: projectId, priority: input.priority ?? 'P2', status: input.status ?? 'Not Started', due_date: input.due_date ?? null })
        .select('id, name').single()
      if (error) throw error
      return `SUCCESS: Task "${data.name}" was created${input.project_name ? ` inside project "${input.project_name}"` : ''}.`
    }

    if (name === 'update_task') {
      const { data: found } = await supabase
        .from('tasks').select('id, name').ilike('name', `%${input.task_name}%`).limit(1).maybeSingle()
      if (!found) return `No task found matching "${input.task_name}"`
      const updates: Record<string, unknown> = {}
      if (input.status) updates.status = input.status
      if (input.priority) updates.priority = input.priority
      if (input.due_date) updates.due_date = input.due_date
      const { error } = await supabase.from('tasks').update(updates).eq('id', found.id)
      if (error) throw error
      const changedFields = Object.keys(updates).map(k => `${k}: ${updates[k]}`).join(', ')
      return `SUCCESS: Task "${found.name}" was updated (${changedFields}).`
    }

    if (name === 'update_project') {
      const { data: found } = await supabase
        .from('projects').select('id, name').ilike('name', `%${input.project_name}%`).limit(1).maybeSingle()
      if (!found) return `No project found matching "${input.project_name}"`
      const updates: Record<string, unknown> = {}
      if (input.status) updates.status = input.status
      if (input.progress !== undefined) updates.progress = input.progress
      const { error } = await supabase.from('projects').update(updates).eq('id', found.id)
      if (error) throw error
      const changedFields = Object.keys(updates).map(k => `${k}: ${updates[k]}`).join(', ')
      return `SUCCESS: Project "${found.name}" was updated (${changedFields}).`
    }

    return `Unknown tool: ${name}`
  } catch (e: unknown) {
    return `Error: ${e instanceof Error ? e.message : String(e)}`
  }
}

// ── Route handler ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    const hour = new Date().getHours()
    const context = await getBriefingContext()
    const systemPrompt = buildSystemPrompt(context, hour)

    // First call — non-streaming so we can detect tool use before committing to a stream
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      system: systemPrompt,
      messages,
      tools: TOOLS,
    })

    // Separate text content from tool use blocks
    let initialText = ''
    const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = []

    for (const block of response.content) {
      if (block.type === 'text') initialText += block.text
      if (block.type === 'tool_use') {
        toolCalls.push({ id: block.id, name: block.name, input: block.input as Record<string, unknown> })
      }
    }

    const encoder = new TextEncoder()

    // No tool calls — return text directly
    if (toolCalls.length === 0) {
      return new NextResponse(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(initialText))
            controller.close()
          },
        }),
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      )
    }

    // Execute tool calls sequentially (order matters — create project before task)
    const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = []
    for (const tool of toolCalls) {
      const result = await executeTool(tool.name, tool.input)
      toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: result })
    }

    // Build confirmation hint from tool results so model knows exactly what to report
    const confirmationHint = toolResults
      .map((r) => r.content)
      .join(' ')

    // Follow-up call — stream the natural language response after tool execution
    const followUpStream = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1000,
      system: systemPrompt + `\n\nTool results: ${confirmationHint}\nYou MUST confirm what was just done using the exact names above. Be brief.`,
      messages: [
        ...messages,
        { role: 'assistant' as const, content: response.content },
        { role: 'user' as const, content: toolResults },
      ],
      stream: true,
    })

    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of followUpStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        controller.close()
      },
    })

    return new NextResponse(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  } catch (error) {
    console.error('Assistant API error:', error)
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 })
  }
}
