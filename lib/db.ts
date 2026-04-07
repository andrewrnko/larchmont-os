import { supabase } from './supabase'

// ── DB row types (snake_case matching Supabase) ──────────────────
export type DBProject = {
  id: string
  name: string
  category: string | null
  status: string
  progress: number
  deadline: string | null
  description: string | null
  created_at: string
}

export type DBTask = {
  id: string
  name: string
  project_id: string | null
  priority: string
  status: string
  due_date: string | null
  started_at: string | null
  completed_at: string | null
  estimated_minutes: number | null
  actual_minutes: number | null
  description: string | null
  created_at: string
}

export type DBEvent = {
  id: string
  name: string
  type: string | null
  status: string
  date_time: string | null
  location: string | null
  created_at: string
}

export type DBCampaign = {
  id: string
  name: string
  goal: string | null
  status: string
  channels: string[] | null
  created_at: string
}

export type DBInboxItem = {
  id: string
  title: string
  status: string
  source: string | null
  created_at: string
}

export type DBContentItem = {
  id: string
  title: string
  format: string | null
  status: string
  project_id: string | null
  created_at: string
}

export type DBVoiceNote = {
  id: string
  title: string | null
  file_url: string
  file_path: string
  duration_seconds: number | null
  created_at: string
}

export type DBDailyDebrief = {
  id: string
  date: string
  morning_plan: object[]
  completed_tasks: object[]
  incomplete_tasks: object[]
  completion_rate: number | null
  p0_hit: boolean
  context_switches: number
  energy_level: string | null
  wins: string | null
  gaps: string | null
  tomorrow_p0: string | null
  messages: { id: string; role: string; content: string; timestamp: string }[]
  created_at: string
}

export type DBWeeklyReview = {
  id: string
  week_start: string
  week_end: string
  project_velocity: object[]
  completion_rate: number | null
  p0_hit_rate: number | null
  stalled_tasks: object[]
  top_wins: object[]
  biggest_gaps: string | null
  next_week_priorities: object[]
  messages: { id: string; role: string; content: string; timestamp: string }[]
  created_at: string
}

export type DBPerformanceMetric = {
  id: string
  date: string
  metric_type: string
  metric_key: string
  metric_value: number | null
  metadata: Record<string, unknown>
  created_at: string
}

export type DBAsset = {
  id: string
  name: string
  file_url: string
  file_path: string
  file_type: string | null
  file_size: number | null
  created_at: string
}

export type DBResource = {
  id: string
  title: string
  category: string | null
  content: string | null
  url: string | null
  file_url: string | null
  source: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type DBBriefingSession = {
  id: string
  date: string
  time_of_day: string | null
  messages: { id: string; role: string; content: string; timestamp: string }[]
  day_plan: string | null
  completed_at: string | null
  created_at: string
}

// ── App types (camelCase) ────────────────────────────────────────
export type Project = {
  id: string
  name: string
  category: string
  status: string
  progress: number
  deadline?: string
  description?: string
  createdAt: string
}

export type Task = {
  id: string
  name: string
  projectId: string | null
  priority: string
  status: string
  dueDate?: string
  startedAt?: string
  completedAt?: string
  estimatedMinutes?: number
  actualMinutes?: number
  description?: string
  createdAt: string
}

export type AppEvent = {
  id: string
  name: string
  type: string
  status: string
  dateTime?: string
  location?: string
  createdAt: string
}

export type Campaign = {
  id: string
  name: string
  goal: string
  status: string
  channels: string[]
  createdAt: string
}

export type InboxItem = {
  id: string
  title: string
  status: string
  source?: string
  createdAt: string
}

export type ContentItem = {
  id: string
  title: string
  format: string
  status: string
  projectId?: string
  createdAt: string
}

export type VoiceNote = {
  id: string
  title: string
  fileUrl: string
  filePath: string
  durationSeconds?: number
  createdAt: string
}

export type DailyDebrief = {
  id: string
  date: string
  morningPlan: object[]
  completedTasks: object[]
  incompleteTasks: object[]
  completionRate?: number
  p0Hit: boolean
  contextSwitches: number
  energyLevel?: string
  wins?: string
  gaps?: string
  tomorrowP0?: string
  messages: { id: string; role: string; content: string; timestamp: string }[]
  createdAt: string
}

export type WeeklyReview = {
  id: string
  weekStart: string
  weekEnd: string
  projectVelocity: object[]
  completionRate?: number
  p0HitRate?: number
  stalledTasks: object[]
  topWins: object[]
  biggestGaps?: string
  nextWeekPriorities: object[]
  messages: { id: string; role: string; content: string; timestamp: string }[]
  createdAt: string
}

export type PerformanceMetric = {
  id: string
  date: string
  metricType: string
  metricKey: string
  metricValue?: number
  metadata: Record<string, unknown>
  createdAt: string
}

export type AssetRecord = {
  id: string
  name: string
  fileUrl: string
  filePath: string
  fileType?: string
  fileSize?: number
  createdAt: string
}

export type Resource = {
  id: string
  title: string
  category?: string
  content?: string
  url?: string
  fileUrl?: string
  source?: string
  metadata: Record<string, unknown>
  createdAt: string
}

export type BriefingSession = {
  id: string
  date: string
  timeOfDay: string
  messages: { id: string; role: string; content: string; timestamp: string }[]
  dayPlan?: string
  completedAt?: string
  createdAt: string
}

// ── Mappers ──────────────────────────────────────────────────────
const mapProject = (r: DBProject): Project => ({
  id: r.id, name: r.name, category: r.category ?? '',
  status: r.status, progress: r.progress,
  deadline: r.deadline ?? undefined, description: r.description ?? undefined,
  createdAt: r.created_at,
})

const mapTask = (r: DBTask): Task => ({
  id: r.id, name: r.name, projectId: r.project_id,
  priority: r.priority, status: r.status,
  dueDate: r.due_date ?? undefined,
  startedAt: r.started_at ?? undefined,
  completedAt: r.completed_at ?? undefined,
  estimatedMinutes: r.estimated_minutes ?? undefined,
  actualMinutes: r.actual_minutes ?? undefined,
  description: r.description ?? undefined,
  createdAt: r.created_at,
})

const mapEvent = (r: DBEvent): AppEvent => ({
  id: r.id, name: r.name, type: r.type ?? '',
  status: r.status, dateTime: r.date_time ?? undefined,
  location: r.location ?? undefined, createdAt: r.created_at,
})

const mapCampaign = (r: DBCampaign): Campaign => ({
  id: r.id, name: r.name, goal: r.goal ?? '',
  status: r.status, channels: r.channels ?? [],
  createdAt: r.created_at,
})

const mapInboxItem = (r: DBInboxItem): InboxItem => ({
  id: r.id, title: r.title, status: r.status,
  source: r.source ?? undefined, createdAt: r.created_at,
})

const mapContentItem = (r: DBContentItem): ContentItem => ({
  id: r.id, title: r.title, format: r.format ?? '',
  status: r.status, projectId: r.project_id ?? undefined,
  createdAt: r.created_at,
})

const mapVoiceNote = (r: DBVoiceNote): VoiceNote => ({
  id: r.id, title: r.title ?? r.file_path.split('/').pop() ?? 'Untitled',
  fileUrl: r.file_url, filePath: r.file_path,
  durationSeconds: r.duration_seconds ?? undefined,
  createdAt: r.created_at,
})

const mapAsset = (r: DBAsset): AssetRecord => ({
  id: r.id, name: r.name, fileUrl: r.file_url, filePath: r.file_path,
  fileType: r.file_type ?? undefined, fileSize: r.file_size ?? undefined,
  createdAt: r.created_at,
})

const mapResource = (r: DBResource): Resource => ({
  id: r.id, title: r.title, category: r.category ?? undefined,
  content: r.content ?? undefined, url: r.url ?? undefined,
  fileUrl: r.file_url ?? undefined, source: r.source ?? undefined,
  metadata: r.metadata ?? {}, createdAt: r.created_at,
})

const mapBriefingSession = (r: DBBriefingSession): BriefingSession => ({
  id: r.id, date: r.date, timeOfDay: r.time_of_day ?? 'morning',
  messages: r.messages ?? [],
  dayPlan: r.day_plan ?? undefined,
  completedAt: r.completed_at ?? undefined,
  createdAt: r.created_at,
})

const mapDebrief = (r: DBDailyDebrief): DailyDebrief => ({
  id: r.id, date: r.date,
  morningPlan: r.morning_plan ?? [],
  completedTasks: r.completed_tasks ?? [],
  incompleteTasks: r.incomplete_tasks ?? [],
  completionRate: r.completion_rate ?? undefined,
  p0Hit: r.p0_hit ?? false,
  contextSwitches: r.context_switches ?? 0,
  energyLevel: r.energy_level ?? undefined,
  wins: r.wins ?? undefined,
  gaps: r.gaps ?? undefined,
  tomorrowP0: r.tomorrow_p0 ?? undefined,
  messages: r.messages ?? [],
  createdAt: r.created_at,
})

const mapWeeklyReview = (r: DBWeeklyReview): WeeklyReview => ({
  id: r.id, weekStart: r.week_start, weekEnd: r.week_end,
  projectVelocity: r.project_velocity ?? [],
  completionRate: r.completion_rate ?? undefined,
  p0HitRate: r.p0_hit_rate ?? undefined,
  stalledTasks: r.stalled_tasks ?? [],
  topWins: r.top_wins ?? [],
  biggestGaps: r.biggest_gaps ?? undefined,
  nextWeekPriorities: r.next_week_priorities ?? [],
  messages: r.messages ?? [],
  createdAt: r.created_at,
})

const mapMetric = (r: DBPerformanceMetric): PerformanceMetric => ({
  id: r.id, date: r.date,
  metricType: r.metric_type, metricKey: r.metric_key,
  metricValue: r.metric_value ?? undefined,
  metadata: r.metadata ?? {},
  createdAt: r.created_at,
})

// ── Projects ─────────────────────────────────────────────────────
export const db = {
  projects: {
    async list(): Promise<Project[]> {
      const { data, error } = await supabase
        .from('projects').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data as DBProject[]).map(mapProject)
    },
    async insert(v: { name: string; category?: string; status?: string; progress?: number; deadline?: string; description?: string }): Promise<Project> {
      const { data, error } = await supabase
        .from('projects').insert([v]).select().single()
      if (error) throw error
      return mapProject(data as DBProject)
    },
    async update(id: string, v: Partial<{ name: string; category: string; status: string; progress: number; deadline: string | null; description: string }>): Promise<Project> {
      const { data, error } = await supabase
        .from('projects').update(v).eq('id', id).select().single()
      if (error) throw error
      return mapProject(data as DBProject)
    },
    async delete(id: string): Promise<void> {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
    },
  },

  tasks: {
    async list(projectId?: string): Promise<Task[]> {
      let q = supabase.from('tasks').select('*').order('created_at', { ascending: false })
      if (projectId) q = q.eq('project_id', projectId)
      const { data, error } = await q
      if (error) throw error
      return (data as DBTask[]).map(mapTask)
    },
    async listToday(): Promise<Task[]> {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('tasks').select('*')
        .eq('due_date', today)
        .order('priority', { ascending: true })
      if (error) throw error
      return (data as DBTask[]).map(mapTask)
    },
    async listSince(since: string): Promise<Task[]> {
      const { data, error } = await supabase
        .from('tasks').select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as DBTask[]).map(mapTask)
    },
    async listStalled(days = 5): Promise<Task[]> {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('tasks').select('*')
        .lt('created_at', cutoff)
        .not('status', 'in', '("Done","Cancelled")')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data as DBTask[]).map(mapTask)
    },
    async insert(v: { name: string; project_id?: string | null; priority?: string; status?: string; due_date?: string | null; estimated_minutes?: number | null }): Promise<Task> {
      const { data, error } = await supabase
        .from('tasks').insert([v]).select().single()
      if (error) throw error
      return mapTask(data as DBTask)
    },
    async update(id: string, v: Partial<{ name: string; project_id: string | null; priority: string; status: string; due_date: string | null; started_at: string | null; completed_at: string | null; actual_minutes: number | null; estimated_minutes: number | null; description: string | null }>): Promise<Task> {
      const { data, error } = await supabase
        .from('tasks').update(v).eq('id', id).select().single()
      if (error) throw error
      return mapTask(data as DBTask)
    },
    async delete(id: string): Promise<void> {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
  },

  events: {
    async list(): Promise<AppEvent[]> {
      const { data, error } = await supabase
        .from('events').select('*').order('date_time', { ascending: true })
      if (error) throw error
      return (data as DBEvent[]).map(mapEvent)
    },
    async insert(v: { name: string; type?: string; status?: string; date_time?: string; location?: string }): Promise<AppEvent> {
      const { data, error } = await supabase
        .from('events').insert([v]).select().single()
      if (error) throw error
      return mapEvent(data as DBEvent)
    },
    async update(id: string, v: Partial<{ name: string; type: string; status: string; date_time: string; location: string }>): Promise<AppEvent> {
      const { data, error } = await supabase
        .from('events').update(v).eq('id', id).select().single()
      if (error) throw error
      return mapEvent(data as DBEvent)
    },
    async delete(id: string): Promise<void> {
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (error) throw error
    },
  },

  campaigns: {
    async list(): Promise<Campaign[]> {
      const { data, error } = await supabase
        .from('campaigns').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data as DBCampaign[]).map(mapCampaign)
    },
    async insert(v: { name: string; goal?: string; status?: string; channels?: string[] }): Promise<Campaign> {
      const { data, error } = await supabase
        .from('campaigns').insert([v]).select().single()
      if (error) throw error
      return mapCampaign(data as DBCampaign)
    },
    async update(id: string, v: Partial<{ name: string; goal: string; status: string; channels: string[] }>): Promise<Campaign> {
      const { data, error } = await supabase
        .from('campaigns').update(v).eq('id', id).select().single()
      if (error) throw error
      return mapCampaign(data as DBCampaign)
    },
    async delete(id: string): Promise<void> {
      const { error } = await supabase.from('campaigns').delete().eq('id', id)
      if (error) throw error
    },
  },

  inbox: {
    async list(): Promise<InboxItem[]> {
      const { data, error } = await supabase
        .from('inbox_items').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data as DBInboxItem[]).map(mapInboxItem)
    },
    async insert(v: { title: string; status?: string; source?: string }): Promise<InboxItem> {
      const { data, error } = await supabase
        .from('inbox_items').insert([v]).select().single()
      if (error) throw error
      return mapInboxItem(data as DBInboxItem)
    },
    async update(id: string, v: Partial<{ title: string; status: string; source: string }>): Promise<InboxItem> {
      const { data, error } = await supabase
        .from('inbox_items').update(v).eq('id', id).select().single()
      if (error) throw error
      return mapInboxItem(data as DBInboxItem)
    },
    async delete(id: string): Promise<void> {
      const { error } = await supabase.from('inbox_items').delete().eq('id', id)
      if (error) throw error
    },
  },

  content: {
    async list(): Promise<ContentItem[]> {
      const { data, error } = await supabase
        .from('content_items').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data as DBContentItem[]).map(mapContentItem)
    },
    async insert(v: { title: string; format?: string; status?: string; project_id?: string | null }): Promise<ContentItem> {
      const { data, error } = await supabase
        .from('content_items').insert([v]).select().single()
      if (error) throw error
      return mapContentItem(data as DBContentItem)
    },
    async update(id: string, v: Partial<{ title: string; format: string; status: string; project_id: string | null }>): Promise<ContentItem> {
      const { data, error } = await supabase
        .from('content_items').update(v).eq('id', id).select().single()
      if (error) throw error
      return mapContentItem(data as DBContentItem)
    },
    async delete(id: string): Promise<void> {
      const { error } = await supabase.from('content_items').delete().eq('id', id)
      if (error) throw error
    },
  },

  voiceNotes: {
    async list(): Promise<VoiceNote[]> {
      const { data, error } = await supabase
        .from('voice_notes').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data as DBVoiceNote[]).map(mapVoiceNote)
    },
    async insert(v: { title?: string; file_url: string; file_path: string; duration_seconds?: number }): Promise<VoiceNote> {
      const { data, error } = await supabase
        .from('voice_notes').insert([v]).select().single()
      if (error) throw error
      return mapVoiceNote(data as DBVoiceNote)
    },
    async update(id: string, v: Partial<{ title: string }>): Promise<VoiceNote> {
      const { data, error } = await supabase
        .from('voice_notes').update(v).eq('id', id).select().single()
      if (error) throw error
      return mapVoiceNote(data as DBVoiceNote)
    },
    async delete(id: string, filePath: string): Promise<void> {
      await supabase.storage.from('voice-notes').remove([filePath])
      const { error } = await supabase.from('voice_notes').delete().eq('id', id)
      if (error) throw error
    },
    async upload(file: File): Promise<{ url: string; path: string }> {
      // Upload via server-side route (uses service role key, bypasses RLS)
      const form = new FormData()
      form.append('file', file, file.name)
      const res = await fetch('/api/voice-notes/upload', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(err.error ?? 'Upload failed')
      }
      return res.json() as Promise<{ url: string; path: string }>
    },
  },

  briefingSessions: {
    async list(): Promise<BriefingSession[]> {
      const { data, error } = await supabase
        .from('briefing_sessions').select('*').order('created_at', { ascending: false }).limit(7)
      if (error) throw error
      return (data as DBBriefingSession[]).map(mapBriefingSession)
    },
    async insert(v: { id?: string; date: string; time_of_day: string; messages?: object[] }): Promise<BriefingSession> {
      const { data, error } = await supabase
        .from('briefing_sessions').insert([{ ...v, messages: v.messages ?? [] }]).select().single()
      if (error) throw error
      return mapBriefingSession(data as DBBriefingSession)
    },
    async update(id: string, v: Partial<{ messages: object[]; day_plan: string; completed_at: string }>): Promise<void> {
      const { error } = await supabase
        .from('briefing_sessions').update(v).eq('id', id)
      if (error) throw error
    },
  },

  debriefs: {
    async today(): Promise<DailyDebrief | null> {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase.from('daily_debriefs').select('*').eq('date', today).maybeSingle()
      return data ? mapDebrief(data as DBDailyDebrief) : null
    },
    async list(limit = 30): Promise<DailyDebrief[]> {
      const { data, error } = await supabase
        .from('daily_debriefs').select('*').order('date', { ascending: false }).limit(limit)
      if (error) throw error
      return (data as DBDailyDebrief[]).map(mapDebrief)
    },
    async upsert(v: {
      date: string; completion_rate?: number | null; p0_hit?: boolean; energy_level?: string | null
      wins?: string | null; gaps?: string | null; tomorrow_p0?: string | null
      messages?: object[]; completed_tasks?: object[]; incomplete_tasks?: object[]
    }): Promise<DailyDebrief> {
      const { data, error } = await supabase
        .from('daily_debriefs').upsert([v], { onConflict: 'date' }).select().single()
      if (error) throw error
      return mapDebrief(data as DBDailyDebrief)
    },
    async update(id: string, v: Partial<{
      messages: object[]; completion_rate: number; p0_hit: boolean
      energy_level: string; wins: string; gaps: string; tomorrow_p0: string
    }>): Promise<void> {
      const { error } = await supabase.from('daily_debriefs').update(v).eq('id', id)
      if (error) throw error
    },
  },

  weeklyReviews: {
    async list(limit = 12): Promise<WeeklyReview[]> {
      const { data, error } = await supabase
        .from('weekly_reviews').select('*').order('week_start', { ascending: false }).limit(limit)
      if (error) throw error
      return (data as DBWeeklyReview[]).map(mapWeeklyReview)
    },
    async upsert(v: {
      week_start: string; week_end: string; completion_rate?: number | null
      p0_hit_rate?: number | null; biggest_gaps?: string | null
      stalled_tasks?: object[]; top_wins?: object[]; next_week_priorities?: object[]
      messages?: object[]; project_velocity?: object[]
    }): Promise<WeeklyReview> {
      const { data, error } = await supabase
        .from('weekly_reviews').upsert([v], { onConflict: 'week_start' }).select().single()
      if (error) throw error
      return mapWeeklyReview(data as DBWeeklyReview)
    },
  },

  metrics: {
    async list(opts: { metricType?: string; since?: string; limit?: number } = {}): Promise<PerformanceMetric[]> {
      let q = supabase.from('performance_metrics').select('*').order('date', { ascending: true })
      if (opts.metricType) q = q.eq('metric_type', opts.metricType)
      if (opts.since) q = q.gte('date', opts.since)
      if (opts.limit) q = q.limit(opts.limit)
      const { data, error } = await q
      if (error) throw error
      return (data as DBPerformanceMetric[]).map(mapMetric)
    },
    async insert(v: { date: string; metric_type: string; metric_key: string; metric_value?: number | null; metadata?: Record<string, unknown> }): Promise<PerformanceMetric> {
      const { data, error } = await supabase
        .from('performance_metrics').insert([v]).select().single()
      if (error) throw error
      return mapMetric(data as DBPerformanceMetric)
    },
    async insertMany(rows: Array<{ date: string; metric_type: string; metric_key: string; metric_value?: number | null; metadata?: Record<string, unknown> }>): Promise<void> {
      const { error } = await supabase.from('performance_metrics').insert(rows)
      if (error) throw error
    },
  },

  assets: {
    // Uses Supabase Storage directly — no database table required.
    // Original filename is encoded in the storage path as:
    //   {sanitized-original-name}___{uuid}.{ext}
    async list(): Promise<AssetRecord[]> {
      const { data, error } = await supabase.storage.from('assets').list('', {
        limit: 200,
        sortBy: { column: 'created_at', order: 'desc' },
      })
      if (error) throw error
      return (data ?? [])
        .filter((obj) => obj.id) // exclude placeholder folders
        .map((obj) => {
          // Decode original name from path: "{sanitized-name}___{uuid}.{ext}"
          const sep = '___'
          const originalName = obj.name.includes(sep)
            ? obj.name.split(sep).slice(1).join(sep) // everything after first ___
            : obj.name
          const { data: urlData } = supabase.storage.from('assets').getPublicUrl(obj.name)
          return {
            id: obj.id!,
            name: originalName,
            fileUrl: urlData.publicUrl,
            filePath: obj.name,
            fileType: obj.metadata?.mimetype ?? undefined,
            fileSize: obj.metadata?.size ?? undefined,
            createdAt: obj.created_at,
          } as AssetRecord
        })
    },
    async insert(_v: { name: string; file_url: string; file_path: string; file_type?: string; file_size?: number }): Promise<AssetRecord> {
      // No-op: upload() now returns a full AssetRecord. This method exists for compat only.
      throw new Error('Use db.assets.upload() — insert is not needed with Storage-only assets')
    },
    async delete(_id: string, filePath: string): Promise<void> {
      const { error } = await supabase.storage.from('assets').remove([filePath])
      if (error) throw error
    },
    async upload(file: File): Promise<AssetRecord> {
      const ext = file.name.split('.').pop() ?? 'bin'
      const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${sanitized}___${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('assets').upload(path, file, { contentType: file.type })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path)
      return {
        id: path, // use path as stable id until list refreshes with real id
        name: file.name,
        fileUrl: urlData.publicUrl,
        filePath: path,
        fileType: file.type,
        fileSize: file.size,
        createdAt: new Date().toISOString(),
      }
    },
  },

  resources: {
    async list(): Promise<Resource[]> {
      const { data, error } = await supabase
        .from('resources').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data as DBResource[]).map(mapResource)
    },
    async insert(v: { title: string; category?: string; content?: string; url?: string; file_url?: string; source?: string; metadata?: Record<string, unknown> }): Promise<Resource> {
      const { data, error } = await supabase
        .from('resources').insert([v]).select().single()
      if (error) throw error
      return mapResource(data as DBResource)
    },
    async update(id: string, v: Partial<{ title: string; category: string; content: string; url: string }>): Promise<Resource> {
      const { data, error } = await supabase
        .from('resources').update(v).eq('id', id).select().single()
      if (error) throw error
      return mapResource(data as DBResource)
    },
    async delete(id: string): Promise<void> {
      const { error } = await supabase.from('resources').delete().eq('id', id)
      if (error) throw error
    },
  },

  settings: {
    async get(key: string): Promise<string | null> {
      const { data } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle()
      return data?.value ?? null
    },
    async getAll(): Promise<Record<string, string>> {
      const { data } = await supabase.from('app_settings').select('key,value')
      if (!data) return {}
      return Object.fromEntries(data.map((r: { key: string; value: string }) => [r.key, r.value]))
    },
    async set(key: string, value: string): Promise<void> {
      const { error } = await supabase
        .from('app_settings')
        .upsert([{ key, value, updated_at: new Date().toISOString() }], { onConflict: 'key' })
      if (error) throw error
    },
    async delete(key: string): Promise<void> {
      const { error } = await supabase.from('app_settings').delete().eq('key', key)
      if (error) throw error
    },
  },
}

// ── Briefing context for API route ───────────────────────────────
export async function getBriefingContext() {
  const now = new Date().toISOString()
  const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  try {
    const [projects, tasks, events, content, campaigns, inboxItems] = await Promise.all([
      supabase.from('projects').select('*').eq('status', 'Active'),
      supabase.from('tasks').select('*').not('status', 'in', '("Done","Cancelled")'),
      supabase.from('events').select('*').gte('date_time', now).lte('date_time', sevenDays),
      supabase.from('content_items').select('*').not('status', 'in', '("Published","Archived","Idea")'),
      supabase.from('campaigns').select('*').eq('status', 'Active'),
      supabase.from('inbox_items').select('*').eq('status', 'New').order('created_at', { ascending: false }),
    ])

    const inbox = (inboxItems.data ?? []) as DBInboxItem[]
    return {
      projects: (projects.data ?? []) as DBProject[],
      tasks: (tasks.data ?? []) as DBTask[],
      events: (events.data ?? []) as DBEvent[],
      content: (content.data ?? []) as DBContentItem[],
      campaigns: (campaigns.data ?? []) as DBCampaign[],
      inboxItems: inbox,
      inboxUnread: inbox.length,
    }
  } catch {
    // Return empty context if Supabase is unavailable (e.g. credentials not yet set)
    return { projects: [], tasks: [], events: [], content: [], campaigns: [], inboxItems: [], inboxUnread: 0 }
  }
}

// ── Debrief context for API route ────────────────────────────────
export async function getDebriefContext() {
  const today = new Date().toISOString().split('T')[0]
  try {
    const [todayTasks, todayBriefing] = await Promise.all([
      supabase.from('tasks').select('*').eq('due_date', today),
      supabase.from('briefing_sessions').select('*').eq('date', today).order('created_at', { ascending: false }).limit(1),
    ])

    const tasks = (todayTasks.data ?? []) as DBTask[]
    const completedTasks = tasks.filter((t) => t.status === 'Done' || t.completed_at != null)
    const incompleteTasks = tasks.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled' && t.completed_at == null)
    const p0Tasks = tasks.filter((t) => t.priority === 'P0')
    const p0Hit = p0Tasks.length > 0 && p0Tasks.every((t) => t.status === 'Done')
    const dayPlan = (todayBriefing.data?.[0] as DBBriefingSession | undefined)?.day_plan ?? null

    return { tasks, completedTasks, incompleteTasks, p0Hit, dayPlan, today }
  } catch {
    return { tasks: [], completedTasks: [], incompleteTasks: [], p0Hit: false, dayPlan: null, today }
  }
}

// ── Weekly review context for API route ─────────────────────────
export async function getWeeklyReviewContext() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const today = new Date().toISOString().split('T')[0]
  try {
    const [recentTasks, debriefs, projects, stalledResult] = await Promise.all([
      supabase.from('tasks').select('*').gte('created_at', sevenDaysAgo),
      supabase.from('daily_debriefs').select('*').gte('date', sevenDaysAgo.split('T')[0]).order('date', { ascending: true }),
      supabase.from('projects').select('*').eq('status', 'Active'),
      supabase.from('tasks').select('*')
        .lt('created_at', sevenDaysAgo)
        .not('status', 'in', '("Done","Cancelled")'),
    ])

    const tasks = (recentTasks.data ?? []) as DBTask[]
    const completedThisWeek = tasks.filter((t) => t.completed_at != null || t.status === 'Done')
    const debriefData = debriefs.data ?? []
    const stalledTasks = (stalledResult.data ?? []) as DBTask[]
    const activeProjects = (projects.data ?? []) as DBProject[]

    // Average completion rate from debriefs
    const avgCompletion = debriefData.length > 0
      ? Math.round(debriefData.reduce((sum, d) => sum + ((d as DBDailyDebrief).completion_rate ?? 0), 0) / debriefData.length)
      : null

    return { tasks, completedThisWeek, debriefData: debriefData as DBDailyDebrief[], stalledTasks, activeProjects, avgCompletion, today }
  } catch {
    return { tasks: [], completedThisWeek: [], debriefData: [], stalledTasks: [], activeProjects: [], avgCompletion: null, today }
  }
}
