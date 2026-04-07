-- Add timer tracking columns to tasks
alter table tasks add column if not exists started_at timestamptz;
alter table tasks add column if not exists completed_at timestamptz;
alter table tasks add column if not exists estimated_minutes int;
alter table tasks add column if not exists actual_minutes int;

-- Daily debrief table
create table if not exists daily_debriefs (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  morning_plan jsonb default '[]',
  completed_tasks jsonb default '[]',
  incomplete_tasks jsonb default '[]',
  completion_rate int,
  p0_hit boolean default false,
  context_switches int default 0,
  energy_level text,
  wins text,
  gaps text,
  tomorrow_p0 text,
  messages jsonb default '[]',
  created_at timestamptz default now()
);

-- Weekly review table
create table if not exists weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  week_end date not null,
  project_velocity jsonb default '[]',
  completion_rate int,
  p0_hit_rate int,
  stalled_tasks jsonb default '[]',
  top_wins jsonb default '[]',
  biggest_gaps text,
  next_week_priorities jsonb default '[]',
  messages jsonb default '[]',
  created_at timestamptz default now()
);

-- Performance metrics table
create table if not exists performance_metrics (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  metric_type text not null,
  metric_key text not null,
  metric_value numeric,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Disable RLS on all new tables (single-user app, no auth)
alter table daily_debriefs disable row level security;
alter table weekly_reviews disable row level security;
alter table performance_metrics disable row level security;
