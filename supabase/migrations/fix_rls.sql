-- Disable Row Level Security on all tables.
-- This is a single-user personal app with no auth, so RLS is not needed.

alter table briefing_sessions disable row level security;
alter table projects disable row level security;
alter table tasks disable row level security;
alter table events disable row level security;
alter table campaigns disable row level security;
alter table inbox_items disable row level security;
alter table content_items disable row level security;
alter table voice_notes disable row level security;
