// API route: AI page generation for the Creative Studio connector-drop flow.
// User drags a connector from a source block and types a prompt — this route
// takes the source block context, the user prompt, and optionally a summary
// of neighboring blocks on the board, then returns a structured page payload
// that the canvas can drop into a PageBlock in place.

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface GeneratePageBody {
  /** The user's description of what the page should cover. */
  prompt: string
  /** A short text summary of the block the connector was dragged from. */
  sourceContext?: string
  /** A short text summary of other blocks on the same board. */
  boardContext?: string
  /** Optional board title for extra context. */
  boardName?: string
  /** Summaries of OTHER boards in the workspace for cross-board reference. */
  workspaceContext?: string
}

const SUB_BLOCK_TYPES = ['h1', 'h2', 'h3', 'p', 'bullet', 'numbered', 'todo', 'divider'] as const
type SubBlockType = (typeof SUB_BLOCK_TYPES)[number]

interface AIBlock {
  type: SubBlockType
  text: string
  checked?: boolean
}

interface AIPageResponse {
  title: string
  icon: string
  blocks: AIBlock[]
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, sourceContext, boardContext, boardName, workspaceContext } =
      (await req.json()) as GeneratePageBody

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured on the server' },
        { status: 500 }
      )
    }

    const systemPrompt = `You are Drew's AI assistant inside Larchmont OS Creative Studio — a visual canvas for planning creative and business work. Drew runs Larchmont Builds (water damage restoration) and ScaleGenie (marketing automation SaaS).

The user just dragged a connector out from an existing block on their canvas and wants a new **page** connected to it. Your job: generate a fully organized, action-ready page based on the user's prompt and the source context.

## Output format

Return ONLY valid JSON — no markdown fences, no prose, no explanation. The JSON must match this exact shape:

{
  "title": "Short page title (3-8 words)",
  "blocks": [
    { "type": "h1", "text": "Main heading" },
    { "type": "p", "text": "Opening context paragraph" },
    { "type": "h2", "text": "Section heading" },
    { "type": "bullet", "text": "Bullet point" },
    { "type": "numbered", "text": "Ordered step" },
    { "type": "todo", "text": "Action item", "checked": false },
    { "type": "divider", "text": "" }
  ]
}

Do NOT include an "icon" field. The icon is fixed to 📄 by the client.

## Block type rules

- **h1** — use exactly once near the top as the page's main title
- **h2** — major sections
- **h3** — subsections (rarely needed; prefer h2)
- **p** — paragraphs of context or explanation. Keep them short — 1-3 sentences.
- **bullet** — unordered list items
- **numbered** — ordered list items (steps, sequences)
- **todo** — actionable tasks (always include "checked": false)
- **divider** — visual separator between major sections (text should be empty string)

## Content rules

- Return between **10 and 24 blocks**. Be thorough but not padded.
- Lead with h1 + a 1-paragraph context that references the source block by name/idea if the source context is provided.
- If the prompt implies planning or "next steps", emit a mix of todos + bullets organized under h2 sections like "Immediate actions", "This week", "Open questions".
- Use numbered for sequences (day-by-day plans, phased work).
- Every todo should be concrete and actionable — start with a verb. Include owners/deadlines inline if implied by context.
- Use dividers sparingly — only between major sections.
- Think in Drew's voice: direct, sharp, no fluff, no corporate language. Reference real names from the context when relevant.
- Reference neighboring blocks from the board context AND other boards in the workspace when the prompt touches on work that spans them. If the user asks for "next steps" and there's a related brief/transcript/page on another board, pull key details from it.
- Do NOT pick an icon — the client always uses 📄 for generated pages.

## Absolutely do NOT

- Wrap the JSON in \`\`\`json code fences
- Add any text before or after the JSON
- Use block types other than the ones listed
- Say "Certainly" or "Here is" — output JSON only`

    const userContext = [
      boardName ? `Active board: "${boardName}"` : '',
      sourceContext ? `\n## Source block (what the connector was dragged from)\n${sourceContext}` : '',
      boardContext ? `\n## Other blocks on this board (for reference)\n${boardContext}` : '',
      workspaceContext ? `\n## Other boards in the workspace (cross-board reference)\n${workspaceContext}` : '',
      `\n## Prompt\n${prompt}`,
    ]
      .filter(Boolean)
      .join('\n')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContext }],
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    // Defensive: strip code fences if the model added them anyway
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()

    let parsed: AIPageResponse
    try {
      parsed = JSON.parse(cleaned) as AIPageResponse
    } catch (err) {
      console.error('generate-page: failed to parse AI JSON:', cleaned.slice(0, 500), err)
      return NextResponse.json(
        { error: 'AI returned malformed JSON. Try a simpler prompt.' },
        { status: 502 }
      )
    }

    // Validate structure — drop unknown block types, ensure strings exist
    const safeBlocks = Array.isArray(parsed.blocks)
      ? parsed.blocks
          .filter((b): b is AIBlock => {
            if (!b || typeof b !== 'object') return false
            if (!SUB_BLOCK_TYPES.includes(b.type as SubBlockType)) return false
            if (typeof b.text !== 'string') return false
            return true
          })
          .slice(0, 32) // hard cap
      : []

    return NextResponse.json({
      title: typeof parsed.title === 'string' ? parsed.title.slice(0, 120) : 'Untitled',
      // Icon is always 📄 — the user wants a consistent document icon for
      // every AI-generated page, not whatever the model picks.
      icon: '📄',
      blocks: safeBlocks,
    })
  } catch (err) {
    console.error('generate-page error:', err)
    return NextResponse.json({ error: 'Failed to generate page' }, { status: 500 })
  }
}
