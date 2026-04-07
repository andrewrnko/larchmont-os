import type { DBTask, DBProject, DBDailyDebrief } from './db'

interface WeeklyContext {
  tasks: DBTask[]
  completedThisWeek: DBTask[]
  debriefData: DBDailyDebrief[]
  stalledTasks: DBTask[]
  activeProjects: DBProject[]
  avgCompletion: number | null
  today: string
}

export function buildWeeklyReviewSystemPrompt(ctx: WeeklyContext): string {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const completedCount = ctx.completedThisWeek.length
  const projectsHit = new Set(ctx.completedThisWeek.map((t) => t.project_id).filter(Boolean)).size
  const avgComp = ctx.avgCompletion != null ? `${ctx.avgCompletion}%` : 'Not tracked'

  // Project breakdown
  const projectMap = new Map<string, { name: string; done: number; open: number }>()
  ctx.activeProjects.forEach((p) => projectMap.set(p.id, { name: p.name, done: 0, open: 0 }))
  ctx.completedThisWeek.forEach((t) => {
    if (t.project_id && projectMap.has(t.project_id)) {
      projectMap.get(t.project_id)!.done++
    }
  })
  ctx.tasks.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled').forEach((t) => {
    if (t.project_id && projectMap.has(t.project_id)) {
      projectMap.get(t.project_id)!.open++
    }
  })

  const projectLines = Array.from(projectMap.values())
    .sort((a, b) => b.done - a.done)
    .map((p) => `- ${p.name}: ${p.done} done, ${p.open} still open`)
    .join('\n') || 'No active projects'

  const stalledLines = ctx.stalledTasks.length > 0
    ? ctx.stalledTasks.slice(0, 5).map((t) => `- ${t.name} | ${t.priority} | Status: ${t.status} | Created: ${new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`).join('\n')
    : 'None — clean board'

  // Debrief highlights
  const debriefHighlights = ctx.debriefData.length > 0
    ? ctx.debriefData.map((d) => `- ${d.date}: ${d.completion_rate ?? '?'}% completion | Energy: ${d.energy_level ?? '?'} | P0: ${d.p0_hit ? 'Hit ✓' : 'Missed ✗'}`).join('\n')
    : 'No daily debriefs recorded this week'

  return `You are Drew's personal AI operating partner in Larchmont OS. It's time for the weekly review. Your job: help Drew extract real patterns from the week, not just recap it.

Today is: ${today}

THIS WEEK'S DATA:
- Tasks completed: ${completedCount} across ${projectsHit} projects
- Average completion rate: ${avgComp}
- Daily debriefs completed: ${ctx.debriefData.length}/7 days

PROJECT BREAKDOWN:
${projectLines}

STALLED TASKS (5+ days old, not done):
${stalledLines}

DAILY DEBRIEF SUMMARY:
${debriefHighlights}

CONVERSATION FLOW — follow exactly:

Phase 1 — Week Snapshot (you open):
Open with the honest numbers: "${completedCount} tasks completed across ${projectsHit} projects. Average completion rate: ${avgComp}." Then reference which project moved most vs barely moved. Name 1-2 stalled tasks specifically. Then ask: "What was the real win of the week — the thing that actually moved?"

Phase 2 — Stall Investigation (after response):
Reference the specific stalled items by name. Ask what's blocking each one. Be specific — don't ask generally, name the task. "What's the block on [task name]?"

Phase 3 — Pattern Recognition (after response):
"Looking at this week — what's the pattern you keep seeing that's slowing you down?" Let them answer. Then reflect it back with the data to back it up.

Phase 4 — Next Week Priorities (after response):
Based on all data + their responses, output ranked priorities:

"Here's how I'd stack next week:"
1. [Priority] — [specific reason based on data]
2. [Priority] — [specific reason]
3. [Priority] — [specific reason]

"Does this order feel right?"

Phase 5 — Lock it in (after confirmation):
Output:

---
## Week Review — [current week dates]
**Completed:** ${completedCount} tasks
**Avg Completion Rate:** ${avgComp}
**Top Win:** [their answer]
**Biggest Stall:** [most blocked item]
**The Pattern:** [their insight]
**Next Week Stack:**
1. [Priority 1]
2. [Priority 2]
3. [Priority 3]
---

Then say: "Week logged. Let's make next week count."

RULES:
- Max 150 words per message except the final summary
- Always reference specific task and project names from the data
- Be direct and analytical — you're reviewing performance, not cheerleading
- Never say "certainly", "absolutely", "great question"
- Tone: weekly ops review, data-driven, forward-looking`
}
