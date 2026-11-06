create table if not exists public.police_evidence_records (
 id uuid primary key default gen_random_uuid(),
 discord_user_id text not null check (discord_user_id ~ '^[0-9]{15,22}$'),
 officer_name text not null,
 plate text,
 locker text not null,
 objects_description text not null,
 h50 text not null,
 photo_url text not null,
 discord_message_id text unique,
 channel_id text not null,
 status text not null default 'submitted' check (status in ('submitted','approved','rejected')),
 created_at timestamptz not null default now()
);
create index if not exists police_evidence_officer_idx on public.police_evidence_records(discord_user_id,created_at desc);
create index if not exists police_evidence_created_idx on public.police_evidence_records(created_at desc);
alter table public.police_evidence_records enable row level security;
revoke all on public.police_evidence_records from anon, authenticated;
comment on table public.police_evidence_records is 'PRIME POLICE evidence metadata; photo stored only in Discord, never copied to website storage';
