alter table public.police_transfer_applications add column answers jsonb
 check(jsonb_typeof(answers)='object');

create table public.police_transfer_drafts (
 id uuid primary key,discord_user_id text not null unique check(discord_user_id ~ '^[0-9]{17,20}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 step integer not null default 1 check(step between 1 and 3),
 created_at timestamptz not null default now(),expires_at timestamptz not null,consumed_at timestamptz
);
alter table public.police_transfer_drafts enable row level security;
revoke all on public.police_transfer_drafts from public,anon,authenticated;
grant select,insert,update,delete on public.police_transfer_drafts to service_role;
