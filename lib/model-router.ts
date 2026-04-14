// Dual-engine model router.
// - Local (free): gemma3:27b via Ollama at http://localhost:11434
// - Cloud (paid): Claude via @anthropic-ai/sdk
//
// Local handles bulk / first-draft / classify / extract work. Cloud handles
// anything that ships to users, any tool-calling, and final synthesis.
//
// Public surface:
//   chat(prompt, taskType, opts?)       — routes, auto-retries, falls back
//   chainedTask(problem, opts?)         — local explore -> local score -> cloud finalize
//   isLocalHealthy()                    — ping the Ollama server
//   costSummary() / printCostSummary()  — cost tracker (local vs cloud, $ spent, $ saved)
//   resetCostCounters()

import Anthropic from '@anthropic-ai/sdk'

// ── Config ─────────────────────────────────────────────────────────────────

export const OLLAMA_URL = 'http://localhost:11434/v1/chat/completions'
export const OLLAMA_TAGS_URL = 'http://localhost:11434/api/tags'
export const OLLAMA_MODEL = 'gemma3:27b'

/** Default cloud model. Callers can override per call via opts.cloudModel. */
export const DEFAULT_CLOUD_MODEL = 'claude-sonnet-4-6'

/** Abort a local call after this many ms. Gemma 27B can be slow under memory pressure. */
export const OLLAMA_TIMEOUT_MS = 60_000
/** One retry then fall back to cloud. */
export const OLLAMA_RETRIES = 1

// ── Task types ─────────────────────────────────────────────────────────────

export type LocalTaskType =
  | 'summarize'
  | 'brainstorm'
  | 'draft'
  | 'classify'
  | 'extract'
  | 'scan'
  | 'explain'
  | 'translate'
  | 'generate_variants'
  | 'score'
  | 'first_pass'
  | 'test_cases'

export type CloudTaskType =
  | 'code'
  | 'architecture'
  | 'security'
  | 'final_copy'
  | 'synthesis'
  | 'tool_use'
  | 'ships_to_users'

export type TaskType = LocalTaskType | CloudTaskType

const LOCAL_TASKS: ReadonlySet<string> = new Set<LocalTaskType>([
  'summarize', 'brainstorm', 'draft', 'classify', 'extract',
  'scan', 'explain', 'translate', 'generate_variants', 'score',
  'first_pass', 'test_cases',
])

export function isLocalTask(taskType: TaskType): boolean {
  return LOCAL_TASKS.has(taskType)
}

// ── Public call shape ──────────────────────────────────────────────────────

export interface ChatOptions {
  /** Optional system / instruction prompt. */
  system?: string
  /** Defaults to 0.7 for local (exploration), 0.3 for cloud (precision). */
  temperature?: number
  /** Max output tokens. Default 2048. */
  maxTokens?: number
  /** Override the cloud model used on cloud path or on local-fallback. */
  cloudModel?: string
  /** Force a tier and skip the task-type classification. */
  force?: 'local' | 'cloud'
  /** Abort signal from the caller (merged with our timeout). */
  signal?: AbortSignal
}

export interface ChatResult {
  content: string
  tier: 'local' | 'cloud'
  model: string
  tokens: { prompt: number; completion: number }
  /** True when the call was routed local but fell back to cloud. */
  fellBack: boolean
}

// ── Cost logger ────────────────────────────────────────────────────────────
// Rough pricing for Claude Sonnet 4 family, $ per 1K tokens. Callers can still
// override the cloud model per call; the summary intentionally uses one rate
// so the "savings" number is interpretable as a consistent benchmark.

const CLOUD_RATES = { input: 0.003, output: 0.015 } as const

interface CostBucket { calls: number; promptTokens: number; completionTokens: number }

const counters: { local: CostBucket; cloud: CostBucket; fellBack: number } = {
  local: { calls: 0, promptTokens: 0, completionTokens: 0 },
  cloud: { calls: 0, promptTokens: 0, completionTokens: 0 },
  fellBack: 0,
}

function recordCall(tier: 'local' | 'cloud', tokens: { prompt: number; completion: number }, fellBack: boolean) {
  counters[tier].calls += 1
  counters[tier].promptTokens += tokens.prompt
  counters[tier].completionTokens += tokens.completion
  if (fellBack) counters.fellBack += 1
}

export interface CostSummary {
  local: CostBucket
  cloud: CostBucket
  fellBack: number
  localPct: number
  cloudDollars: number
  savedDollars: number
}

export function costSummary(): CostSummary {
  const cloudDollars =
    (counters.cloud.promptTokens / 1000) * CLOUD_RATES.input +
    (counters.cloud.completionTokens / 1000) * CLOUD_RATES.output
  const savedDollars =
    (counters.local.promptTokens / 1000) * CLOUD_RATES.input +
    (counters.local.completionTokens / 1000) * CLOUD_RATES.output
  const total = counters.local.calls + counters.cloud.calls
  const localPct = total ? Math.round((counters.local.calls / total) * 100) : 0
  return {
    local: { ...counters.local },
    cloud: { ...counters.cloud },
    fellBack: counters.fellBack,
    localPct,
    cloudDollars,
    savedDollars,
  }
}

export function printCostSummary(): void {
  const s = costSummary()
  // eslint-disable-next-line no-console
  console.log(
    `[router] ${s.localPct}% local | local=${s.local.calls} cloud=${s.cloud.calls} fellBack=${s.fellBack}` +
    ` | spent=$${s.cloudDollars.toFixed(4)} saved=$${s.savedDollars.toFixed(4)}`,
  )
}

export function resetCostCounters(): void {
  counters.local = { calls: 0, promptTokens: 0, completionTokens: 0 }
  counters.cloud = { calls: 0, promptTokens: 0, completionTokens: 0 }
  counters.fellBack = 0
}

// ── Local path: Ollama OpenAI-compatible endpoint ──────────────────────────

interface OpenAIChoice { message?: { role: string; content: string } }
interface OpenAIUsage { prompt_tokens?: number; completion_tokens?: number }
interface OpenAIResponse {
  choices?: OpenAIChoice[]
  usage?: OpenAIUsage
  error?: { message?: string }
}

function mergeSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  if (!a) return b
  if (!b) return a
  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  if (a.aborted || b.aborted) ctrl.abort()
  else {
    a.addEventListener('abort', onAbort, { once: true })
    b.addEventListener('abort', onAbort, { once: true })
  }
  return ctrl.signal
}

async function callLocal(prompt: string, opts: ChatOptions): Promise<Omit<ChatResult, 'fellBack'>> {
  const messages = [
    ...(opts.system ? [{ role: 'system' as const, content: opts.system }] : []),
    { role: 'user' as const, content: prompt },
  ]

  const timeoutCtrl = new AbortController()
  const timer = setTimeout(() => timeoutCtrl.abort(), OLLAMA_TIMEOUT_MS)

  try {
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 2048,
        stream: false,
      }),
      signal: mergeSignals(timeoutCtrl.signal, opts.signal),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Ollama HTTP ${res.status}: ${body.slice(0, 300)}`)
    }

    const data = (await res.json()) as OpenAIResponse
    if (data.error?.message) throw new Error(`Ollama error: ${data.error.message}`)
    const content = data.choices?.[0]?.message?.content ?? ''
    return {
      content,
      tier: 'local',
      model: OLLAMA_MODEL,
      tokens: {
        prompt: data.usage?.prompt_tokens ?? 0,
        completion: data.usage?.completion_tokens ?? 0,
      },
    }
  } finally {
    clearTimeout(timer)
  }
}

// ── Cloud path: Anthropic SDK ──────────────────────────────────────────────

let cloudClient: Anthropic | null = null
function getCloud(): Anthropic {
  if (!cloudClient) cloudClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return cloudClient
}

async function callCloud(prompt: string, opts: ChatOptions): Promise<Omit<ChatResult, 'fellBack'>> {
  const model = opts.cloudModel ?? DEFAULT_CLOUD_MODEL
  const res = await getCloud().messages.create({
    model,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.3,
    ...(opts.system ? { system: opts.system } : {}),
    messages: [{ role: 'user', content: prompt }],
  })
  const content = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
  return {
    content,
    tier: 'cloud',
    model,
    tokens: { prompt: res.usage.input_tokens, completion: res.usage.output_tokens },
  }
}

// ── Public: chat() ─────────────────────────────────────────────────────────

/**
 * Route a prompt to local or cloud based on `taskType`. Local tasks automatically
 * retry once on failure then fall back to cloud. Cloud tasks go straight to Claude.
 */
export async function chat(
  prompt: string,
  taskType: TaskType,
  opts: ChatOptions = {},
): Promise<ChatResult> {
  const tier = opts.force ?? (isLocalTask(taskType) ? 'local' : 'cloud')

  if (tier === 'cloud') {
    const r = await callCloud(prompt, opts)
    recordCall('cloud', r.tokens, false)
    return { ...r, fellBack: false }
  }

  // Local path with retry, then fallback to cloud
  let lastErr: unknown
  for (let attempt = 0; attempt <= OLLAMA_RETRIES; attempt++) {
    try {
      const r = await callLocal(prompt, opts)
      recordCall('local', r.tokens, false)
      return { ...r, fellBack: false }
    } catch (err) {
      lastErr = err
      if (opts.force === 'local') throw err
    }
  }

  // eslint-disable-next-line no-console
  console.warn(
    `[router] local (${OLLAMA_MODEL}) failed after ${OLLAMA_RETRIES + 1} attempts; falling back to cloud. Cause:`,
    lastErr instanceof Error ? lastErr.message : lastErr,
  )
  const r = await callCloud(prompt, opts)
  recordCall('cloud', r.tokens, true)
  return { ...r, fellBack: true }
}

// ── Public: chainedTask() — local explore -> local score -> cloud finalize ─

export interface ChainedTaskOptions {
  /** Options to generate in the first local pass. Default 10. */
  optionCount?: number
  /** How many top candidates to hand to the cloud. Default 3. */
  topK?: number
  /** Override the cloud model for the finalization step. */
  cloudModel?: string
  /** Extra guidance inserted into the generation prompt. */
  generateHint?: string
  /** Extra guidance inserted into the scoring prompt. */
  scoreHint?: string
  /** Override the default finalization instruction. */
  finalizeInstruction?: string
}

export interface ChainedTaskResult {
  problem: string
  /** Full raw list of generated options from the local model. */
  rawOptions: string
  /** Parsed top-K candidates (text only, numbering stripped). */
  topOptions: string[]
  /** Final polished output from the cloud model. */
  finalized: string
  calls: { local: number; cloud: number }
}

/**
 * Explore → Filter → Decide:
 *   1. local generates N divergent options (free)
 *   2. local ranks + returns top K (free)
 *   3. cloud picks the best and produces an implementation-ready version (paid)
 * The cloud only sees the filtered top K, never the raw N.
 */
export async function chainedTask(
  problem: string,
  opts: ChainedTaskOptions = {},
): Promise<ChainedTaskResult> {
  const n = opts.optionCount ?? 10
  const k = opts.topK ?? 3

  // 1) local divergent generation
  const genPrompt =
    `Generate ${n} distinct approaches to the problem below. ` +
    `Number each line from 1 to ${n}. One sentence per approach — concrete and specific. ` +
    `Include at least one unconventional angle.\n\n` +
    `Problem: ${problem}` +
    (opts.generateHint ? `\nAdditional guidance: ${opts.generateHint}` : '')
  const gen = await chat(genPrompt, 'brainstorm', { temperature: 0.85, maxTokens: 1200 })

  // 2) local scoring & ranking
  const scorePrompt =
    `Here are ${n} approaches to "${problem}":\n\n${gen.content}\n\n` +
    `Rank them by overall fit (feasibility × impact). Return ONLY the top ${k} as a numbered list, ` +
    `one per line, in this exact form:\n` +
    `1. <approach text>\n2. <approach text>\n3. <approach text>\n` +
    `No headers, no explanations, no extra commentary.` +
    (opts.scoreHint ? `\nScoring hint: ${opts.scoreHint}` : '')
  const ranked = await chat(scorePrompt, 'score', { temperature: 0.2, maxTokens: 600 })

  const topOptions = ranked.content
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, k)

  // 3) cloud finalization from only the filtered top K
  const finalizeInstruction =
    opts.finalizeInstruction ??
    `Review the top ${topOptions.length} candidate approaches below. Pick the single best one ` +
    `and produce a polished, implementation-ready version. Be specific and actionable. ` +
    `Start your answer with "CHOSEN: <one-sentence summary>" then the plan.`
  const finalPrompt =
    `Problem: ${problem}\n\nTop ${topOptions.length} candidate approaches:\n` +
    topOptions.map((o, i) => `${i + 1}. ${o}`).join('\n') +
    `\n\n${finalizeInstruction}`
  const final = await chat(finalPrompt, 'synthesis', {
    cloudModel: opts.cloudModel,
    temperature: 0.4,
    maxTokens: 1500,
  })

  return {
    problem,
    rawOptions: gen.content,
    topOptions,
    finalized: final.content,
    calls: { local: 2, cloud: 1 },
  }
}

// ── Health check ───────────────────────────────────────────────────────────

/** Quick probe of the local Ollama server. Returns true if /api/tags responds. */
export async function isLocalHealthy(): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2000)
    const res = await fetch(OLLAMA_TAGS_URL, { signal: ctrl.signal })
    clearTimeout(t)
    return res.ok
  } catch {
    return false
  }
}
