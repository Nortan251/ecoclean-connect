-- Module F part 2: track which quests each user has claimed (server-validated).
alter table public.profiles add column if not exists claimed_quests jsonb not null default '[]'::jsonb;
