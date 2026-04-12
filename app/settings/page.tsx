'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, RotateCcw, Check, Settings } from 'lucide-react'
import { db } from '@/lib/db'
import { useToastStore } from '@/lib/store'
import { PageHeader } from '@/components/shared/page-header'
import { AppearanceSection } from '@/components/settings/appearance-section'
import { cn } from '@/lib/utils'

// Default labels — these are the fallback values when nothing is saved
const DEFAULT_LABELS: Record<string, string> = {
  'dashboard.p0Tasks': "Today's P0 Tasks",
  'dashboard.liveProjects': 'Live Projects',
  'dashboard.contentPipeline': 'Content in Pipeline',
  'dashboard.nextShoot': 'Next Shoot / Event',
  'nav.dashboard': 'Dashboard',
  'nav.briefing': 'Daily Briefing',
  'nav.debrief': 'End of Day Debrief',
  'nav.weeklyReview': 'Weekly Review',
  'nav.analytics': 'Analytics',
  'nav.inbox': 'Inbox',
  'nav.projects': 'Projects',
  'nav.tasks': 'Tasks',
  'nav.briefs': 'Creative Briefs',
  'nav.campaigns': 'Campaigns',
  'nav.assets': 'Assets',
  'nav.resources': 'Resource Library',
  'nav.brand': 'Brand Identity',
  'nav.events': 'Events & Shoots',
  'nav.content': 'Content Pipeline',
  'nav.voiceNotes': 'Voice Notes',
}

const LABEL_GROUPS = [
  {
    title: 'Dashboard Stats',
    description: 'Labels shown on the main dashboard KPI cards',
    keys: ['dashboard.p0Tasks', 'dashboard.liveProjects', 'dashboard.contentPipeline', 'dashboard.nextShoot'],
  },
  {
    title: 'Navigation Labels',
    description: 'Sidebar navigation item labels',
    keys: [
      'nav.dashboard', 'nav.briefing', 'nav.debrief', 'nav.weeklyReview',
      'nav.analytics', 'nav.inbox', 'nav.projects', 'nav.tasks',
      'nav.briefs', 'nav.campaigns', 'nav.assets', 'nav.resources',
      'nav.brand', 'nav.events', 'nav.content', 'nav.voiceNotes',
    ],
  },
]

function LabelRow({ labelKey, value, defaultValue, onChange }: {
  labelKey: string
  value: string
  defaultValue: string
  onChange: (key: string, val: string) => void
}) {
  const isModified = value !== defaultValue
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
      <div className="w-52 flex-shrink-0">
        <p className="text-[11px] text-[var(--text-tertiary)] font-mono">{labelKey}</p>
        {isModified && (
          <p className="text-[11px] text-[var(--accent)] mt-0.5">Modified</p>
        )}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(labelKey, e.target.value)}
        placeholder={defaultValue}
        className={cn(
          'flex-1 rounded-[6px] border bg-[var(--surface-2)] px-3 py-1.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none transition-colors',
          isModified ? 'border-[var(--accent)]/50 focus:border-[var(--accent)]' : 'border-[var(--border)] focus:border-[var(--accent)]'
        )}
      />
      {isModified && (
        <button
          onClick={() => onChange(labelKey, defaultValue)}
          className="flex-shrink-0 rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)] transition-colors"
          title="Reset to default"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const [labels, setLabels] = useState<Record<string, string>>(DEFAULT_LABELS)
  const [savedLabels, setSavedLabels] = useState<Record<string, string>>(DEFAULT_LABELS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { addToast } = useToastStore()

  const load = useCallback(async () => {
    try {
      const stored = await db.settings.getAll()
      const merged = { ...DEFAULT_LABELS }
      for (const [k, v] of Object.entries(stored)) {
        if (k in DEFAULT_LABELS) merged[k] = v
      }
      setLabels(merged)
      setSavedLabels(merged)
    } catch {
      // Default labels still work offline
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleChange = (key: string, value: string) => {
    setLabels((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Save each modified label to Supabase
      const ops = Object.entries(labels).map(([k, v]) => db.settings.set(k, v))
      await Promise.all(ops)
      setSavedLabels({ ...labels })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      addToast({ type: 'success', message: 'Settings saved' })
    } catch {
      addToast({ type: 'error', message: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const handleResetAll = async () => {
    setLabels({ ...DEFAULT_LABELS })
    try {
      const ops = Object.keys(DEFAULT_LABELS).map((k) => db.settings.delete(k))
      await Promise.all(ops)
      setSavedLabels({ ...DEFAULT_LABELS })
      addToast({ type: 'success', message: 'Labels reset to defaults' })
    } catch {
      addToast({ type: 'error', message: 'Failed to reset' })
    }
  }

  const hasChanges = JSON.stringify(labels) !== JSON.stringify(savedLabels)

  return (
    <div className="min-h-full p-6">
      <PageHeader
        title="Settings"
        description="Customize labels and preferences"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetAll}
              className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset All
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={cn(
                'flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-all',
                saved
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : 'bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90 disabled:opacity-40'
              )}
            >
              {saved ? <Check className="h-3.5 w-3.5" /> : saving ? null : <Save className="h-3.5 w-3.5" />}
              {saved ? 'Saved' : saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-[8px] bg-[var(--surface-2)]" />
          ))}
        </div>
      ) : (
        <div className="max-w-2xl space-y-8">
          {/* ── Appearance ── */}
          <AppearanceSection />

          {LABEL_GROUPS.map((group) => (
            <div key={group.title} className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <div className="border-b border-[var(--border)] px-5 py-4">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-[var(--accent)]" />
                  <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">{group.title}</h2>
                </div>
                <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">{group.description}</p>
              </div>
              <div className="px-5">
                {group.keys.map((key) => (
                  <LabelRow
                    key={key}
                    labelKey={key}
                    value={labels[key] ?? DEFAULT_LABELS[key]}
                    defaultValue={DEFAULT_LABELS[key]}
                    onChange={handleChange}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* ── SIZE TEST — Cohesive Type Scale ── */}
          <div className="rounded-[10px] border border-dashed border-amber-500/40 bg-[var(--surface)] p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-amber-500">SIZE TEST — Cohesive Type Scale</h2>
            </div>

            {/* ── Scale Reference ── */}
            <div className="mb-6 space-y-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] p-4">
              <p className="text-[16px] font-medium text-[var(--text-primary)]">16px — Section titles / Block headers</p>
              <p className="text-[14px] text-[var(--text-primary)]">14px — Body text / Task text / Node text</p>
              <p className="text-[13px] text-[var(--text-primary)]">13px — Secondary text / Placeholders / Input</p>
              <p className="text-[12px] text-[var(--text-primary)]">12px — Labels / Badges / Captions / Counts</p>
              <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-primary)]">11px — Uppercase tracking labels (DAY HYPERPLANNER etc)</p>
            </div>

            {/* ── Sample Components ── */}
            <div className="space-y-5">

              {/* Task List Row */}
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Task List Row</p>
                <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-[14px] w-[14px] flex-shrink-0 items-center justify-center rounded-[3px] border border-[var(--border-strong)]" />
                    <span className="flex-1 text-[14px] text-[var(--text-primary)]">Review brand deck for Larchmont launch</span>
                    <span className="rounded-[4px] bg-red-500/10 px-1.5 py-0.5 text-[11px] font-medium text-red-400">P1</span>
                  </div>
                </div>
              </div>

              {/* Mind Map Node */}
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Mind Map Node</p>
                <div className="inline-block rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-[20px] py-[10px]">
                  <span className="text-[14px] text-[var(--text-primary)]">Content Strategy</span>
                </div>
              </div>

              {/* Storyboard Frame */}
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Storyboard Frame</p>
                <div className="w-[200px] rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden">
                  <div className="aspect-video bg-[var(--surface)] flex items-center justify-center">
                    <span className="text-[13px] text-[var(--text-tertiary)]">Drop media here</span>
                  </div>
                  <div className="px-3 py-2">
                    <span className="text-[13px] text-[var(--text-primary)]">Scene 1 — Opening</span>
                  </div>
                </div>
              </div>

              {/* Card Header */}
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Card Header</p>
                <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[16px] font-medium text-[var(--text-primary)]">Campaign Overview</span>
                    <span className="text-[12px] text-[var(--text-tertiary)]">12 items</span>
                  </div>
                </div>
              </div>

            </div>

            <div className="mt-5 rounded-[6px] bg-amber-500/5 border border-amber-500/20 px-3 py-2">
              <p className="text-[12px] text-amber-400/80">Rule: max 5px between adjacent scale levels. Scale: 16 → 14 → 13 → 12 → 11</p>
            </div>
          </div>

          <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="mb-1 text-[14px] font-semibold text-[var(--text-primary)]">API Keys</h2>
            <p className="mb-4 text-[12px] text-[var(--text-tertiary)]">Configured via <code className="rounded bg-[var(--surface-2)] px-1 font-mono text-[11px]">.env.local</code> — not editable here for security.</p>
            {[
              { label: 'Anthropic API Key', key: 'ANTHROPIC_API_KEY' },
              { label: 'Supabase URL', key: 'NEXT_PUBLIC_SUPABASE_URL' },
              { label: 'Supabase Anon Key', key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY' },
              { label: 'Groq API Key (Whisper)', key: 'GROQ_API_KEY' },
            ].map(({ label, key }) => (
              <div key={key} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                <span className="text-[13px] text-[var(--text-primary)]">{label}</span>
                <code className="text-[11px] text-[var(--text-tertiary)] font-mono">{key}</code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
