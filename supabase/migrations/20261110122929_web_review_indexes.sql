-- Cover existing foreign keys without changing records or public access.
create index if not exists police_bonuses_personnel_idx on public.police_bonuses(discord_user_id);
create index if not exists police_nie_drafts_application_idx on public.police_nie_drafts(application_id);
