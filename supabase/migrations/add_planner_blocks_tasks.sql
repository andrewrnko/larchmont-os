-- Planner: time-blocked day + unscheduled task bank.
-- Single-user app, RLS disabled to match existing convention.

-- Enums
do $$ begin
  create type planner_category as enum ('deep_work','admin','client','personal','travel','buffer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type planner_block_status as enum ('planned','in_progress','done','skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type planner_task_status as enum ('unscheduled','scheduled','done');
exception when duplicate_object then null; end $$;

-- Blocks: one row per concrete block, or per repeat template.
-- Repeat templates live with is_repeating=true; the renderer projects virtual
-- instances for each matching day. A per-day override row uses parent_repeat_id
-- to supersede a template on a specific date.
create table if not exists planner_blocks (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  title text not null default '',
  category planner_category not null default 'deep_work',
  start_time time not null,
  end_time time not null,
  status planner_block_status not null default 'planned',
  notes text,
  actual_duration_minutes int,
  timer_started_at timestamptz,
  is_repeating boolean not null default false,
  repeat_days int[] default '{}',
  repeat_start_date date,
  is_locked boolean not null default false,
  priority int not null default 3 check (priority between 1 and 5),
  color text,
  parent_repeat_id uuid references planner_blocks(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists planner_blocks_date_idx on planner_blocks(date);
create index if not exists planner_blocks_repeating_idx on planner_blocks(is_repeating) where is_repeating = true;
create index if not exists planner_blocks_parent_idx on planner_blocks(parent_repeat_id);

-- Unscheduled task bank. assigned_date is set when dragged onto a day.
create table if not exists planner_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  priority int not null default 3 check (priority between 1 and 5),
  estimated_minutes int,
  assigned_date date,
  status planner_task_status not null default 'unscheduled',
  category planner_category,
  created_at timestamptz not null default now()
);

create index if not exists planner_tasks_status_idx on planner_tasks(status);
create index if not exists planner_tasks_assigned_idx on planner_tasks(assigned_date);

alter table planner_blocks disable row level security;
alter table planner_tasks disable row level security;
