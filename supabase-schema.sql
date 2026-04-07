-- Run this in Supabase SQL Editor

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  status text default 'Active',
  progress int default 0,
  deadline date,
  description text,
  created_at timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_id uuid references projects(id) on delete cascade,
  priority text default 'P1',
  status text default 'Not Started',
  due_date date,
  created_at timestamptz default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  status text default 'Planned',
  date_time timestamptz,
  location text,
  created_at timestamptz default now()
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  goal text,
  status text default 'Active',
  channels text[],
  created_at timestamptz default now()
);

create table if not exists inbox_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text default 'New',
  source text,
  created_at timestamptz default now()
);

create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  format text,
  status text default 'Idea',
  project_id uuid references projects(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists voice_notes (
  id uuid primary key default gen_random_uuid(),
  title text,
  file_url text not null,
  file_path text not null,
  duration_seconds int,
  created_at timestamptz default now()
);

create table if not exists briefing_sessions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time_of_day text,
  messages jsonb default '[]',
  day_plan text,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Enable RLS (optional but recommended)
-- alter table projects enable row level security;
-- Create a storage bucket called 'voice-notes' in the Supabase dashboard (set to public)
