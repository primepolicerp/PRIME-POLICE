create table public.police_external_ai_reviews (
 kind text not null check(kind in ('applications','transfers')),source_id uuid not null,
 text_hash text not null check(text_hash ~ '^[a-f0-9]{64}$'),
 status text not null check(status in ('processing','completed','failed')),
 result jsonb,lease uuid,locked_until timestamptz,updated_at timestamptz not null default now(),
 requested_by text not null,primary key(kind,source_id,text_hash)
);
create table public.police_external_ai_usage (
 day date primary key,characters integer not null check(characters between 0 and 40000)
);
alter table public.police_external_ai_reviews enable row level security;
alter table public.police_external_ai_usage enable row level security;
revoke all on public.police_external_ai_reviews,public.police_external_ai_usage from public,anon,authenticated;
grant select,insert,update on public.police_external_ai_reviews,public.police_external_ai_usage to service_role;

create function public.reserve_police_external_ai_review(p_kind text,p_id uuid,p_hash text,p_characters integer,p_actor text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare current_review public.police_external_ai_reviews;token uuid:=gen_random_uuid();used integer;
begin
 if p_kind not in ('applications','transfers') or p_id is null or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_characters is null or p_characters<300 or p_characters>36000 or p_actor is null or p_actor !~ '^[0-9]{17,20}$' then raise exception 'Invalid review request';end if;
 perform pg_advisory_xact_lock(hashtextextended('external-ai:'||p_kind||':'||p_id,0));
 select * into current_review from public.police_external_ai_reviews where kind=p_kind and source_id=p_id and text_hash=p_hash;
 if found then
  if current_review.status='completed' then return jsonb_build_object('state','cached','result',current_review.result);end if;
  if current_review.status='processing' and current_review.locked_until>now() then return jsonb_build_object('state','busy');end if;
  if current_review.updated_at>now()-interval '1 minute' then return jsonb_build_object('state','busy');end if;
 end if;
 insert into public.police_external_ai_usage(day,characters) values((now() at time zone 'UTC')::date,p_characters)
 on conflict(day) do update set characters=police_external_ai_usage.characters+excluded.characters
 where police_external_ai_usage.characters+excluded.characters<=40000 returning characters into used;
 if not found then return jsonb_build_object('state','quota');end if;
 insert into public.police_external_ai_reviews(kind,source_id,text_hash,status,lease,locked_until,requested_by)
 values(p_kind,p_id,p_hash,'processing',token,now()+interval '2 minutes',p_actor)
 on conflict(kind,source_id,text_hash) do update set status='processing',result=null,lease=token,locked_until=now()+interval '2 minutes',updated_at=now(),requested_by=p_actor;
 return jsonb_build_object('state','reserved','lease',token);
end $$;
revoke all on function public.reserve_police_external_ai_review(text,uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.reserve_police_external_ai_review(text,uuid,text,integer,text) to service_role;
