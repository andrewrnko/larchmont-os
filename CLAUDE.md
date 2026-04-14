# Larchmont OS — Claude Code Project Guide

Larchmont OS is a Next.js 15 TypeScript dashboard for managing a water damage restoration business. Treat it as a production internal tool — correctness and a working build matter more than novelty.

## Stack

- **Framework:** Next.js 15 (App Router, Turbopack)
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS
- **Database / Auth:** Supabase (Postgres + RLS)
- **Editor:** Tiptap
- **State:** Zustand
- **Hosting:** Vercel

## Local development

- Dev server: `npm run dev` on **port 3000**
- **Never kill port 3000** — that's Larchmont OS. Other local projects run on 3001+; if a port conflict appears, move the other service, not this one.
- Type check: `npx tsc --noEmit`
- Local AI: Ollama runs at `http://localhost:11434` with `gemma3:27b` available for local inference tasks. Prefer Ollama for anything that doesn't need frontier capability.

## Deploy

- Push to `main` on GitHub → Vercel auto-deploys.
- There is no staging branch; treat `main` as production.

## Required workflow rules

1. **Always run `npx tsc --noEmit` before finishing any task.** If it fails, fix it or explicitly flag the remaining errors — never hand back a task with unresolved type errors.
2. **When the build fails**, delegate to the `build-error-resolver` agent rather than ad-hoc debugging.
3. **When planning a new feature**, invoke the `planner` agent first to produce an implementation plan before writing code.
4. **When reviewing code**, run both `typescript-reviewer` and `code-reviewer` agents. They cover different axes (type safety vs. general quality) — use them together, not as substitutes.
5. **Prefer editing existing files over creating new ones.** Larchmont OS already has established patterns under `app/`, `components/`, and `lib/` — match them.

## Where things live

- `app/` — Next.js App Router routes and API handlers
- `components/` — React components, domain-organized (e.g. `components/creative-studio/`)
- `lib/` — shared utilities, clients, and domain logic
- `supabase/` — schema and migrations
- `docs/` — project documentation

## Agents, skills, commands

Project-scoped agents live in `.claude/agents/`, skills in `.claude/skills/`, commands in `.claude/commands/`. Use them instead of reinventing workflows.
