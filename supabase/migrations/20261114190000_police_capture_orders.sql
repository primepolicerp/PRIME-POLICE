create table if not exists public.police_capture_orders (
 id uuid primary key default gen_random_uuid(),
 discord_user_id text not null,
 full_name text not null,
 plate text not null,
 last_rank text not null default '',
 desertion_date date not null,
 reason text not null default 'Abandono del cuerpo sin presentar la baja correspondiente',
 issued_by_id text not null,
 issued_by_name text not null,
 status text not null default 'active' check(status in ('active','captured','cancelled')),
 capture_notes text not null default '',
 captured_by_id text,
 captured_by_name text,
 captured_at timestamptz,
 cancelled_by_id text,
 cancelled_by_name text,
 cancelled_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint police_capture_orders_discord_id check(discord_user_id ~ '^[0-9]{17,20}$'),
 constraint police_capture_orders_issuer_id check(issued_by_id ~ '^[0-9]{17,20}$')
);
create unique index if not exists police_capture_orders_one_active_per_agent
 on public.police_capture_orders(discord_user_id) where status='active';
create index if not exists police_capture_orders_status_date
 on public.police_capture_orders(status,created_at desc);
alter table public.police_capture_orders enable row level security;
revoke all on public.police_capture_orders from public,anon,authenticated;
grant select,insert,update on public.police_capture_orders to service_role;
