-- One public status message. Occupancy only; duration stays in the private panel.
create table public.police_h50_status (
 id integer primary key default 1 check(id=1),
 channel_id text not null default '1568766177524719776' check(channel_id='1568766177524719776'),
 message_id text check(message_id ~ '^[0-9]{17,20}$'),
 revision bigint not null default 0, published_revision bigint not null default -1,
 lease uuid,locked_until timestamptz,next_attempt_at timestamptz not null default now(),last_error text
);
alter table public.police_h50_status enable row level security;
revoke all on public.police_h50_status from public,anon,authenticated;
grant select,update on public.police_h50_status to service_role;
insert into public.police_h50_status(id) values(1);

create function public.mark_police_h50_status() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if TG_OP='INSERT' or new.started_at is distinct from old.started_at or new.ended_at is distinct from old.ended_at then
  update public.police_h50_status set revision=revision+1,next_attempt_at=least(next_attempt_at,now()) where id=1;
 end if;
 return null;
end; $$;
create trigger h50_status_changed after insert or update of started_at,ended_at on public.police_h50_shifts for each row execute function public.mark_police_h50_status();

create function public.claim_police_h50_status() returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare state public.police_h50_status; operators jsonb;
begin
 select * into state from public.police_h50_status where id=1 and message_id is not null and revision>published_revision and next_attempt_at<=now() and (locked_until is null or locked_until<now()) for update skip locked;
 if not found then return null; end if;
 update public.police_h50_status set lease=gen_random_uuid(),locked_until=now()+interval '45 seconds' where id=1 returning * into state;
 select coalesce(jsonb_agg(jsonb_build_object('full_name',a.full_name,'plate',a.plate) order by a.started_at,a.id),'[]'::jsonb) into operators from (select full_name,plate,started_at,id from public.police_h50_shifts where ended_at is null order by started_at,id limit 2) a;
 return jsonb_build_object('channel_id',state.channel_id,'message_id',state.message_id,'revision',state.revision,'lease',state.lease,'active',operators);
end; $$;

create function public.finish_police_h50_status(p_lease uuid,p_revision bigint,p_error text default null) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare state public.police_h50_status;
begin
 update public.police_h50_status set
 published_revision=case when p_error is null then greatest(published_revision,p_revision) else published_revision end,
 last_error=left(p_error,200),next_attempt_at=case when p_error is null then now() else now()+interval '30 seconds' end,
 lease=null,locked_until=null
 where id=1 and lease=p_lease and p_revision>=0 and p_revision<=revision returning * into state;
 if not found then return jsonb_build_object('accepted',false,'dirty',true); end if;
 return jsonb_build_object('accepted',true,'dirty',state.revision>state.published_revision);
end; $$;
revoke all on function public.mark_police_h50_status(),public.claim_police_h50_status(),public.finish_police_h50_status(uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.claim_police_h50_status(),public.finish_police_h50_status(uuid,bigint,text) to service_role;
