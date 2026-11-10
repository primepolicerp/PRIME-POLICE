-- Existing payments and history remain intact. Manual roleplay bookkeeping only.
alter table public.police_bonuses drop constraint police_bonuses_kind_check;
alter table public.police_bonuses add constraint police_bonuses_kind_check check(kind in ('weekly','monthly','special','promotion'));
alter table public.police_bonuses add column delivered_on date,add column promoted_rank text not null default '';
-- Old payment timestamps remain available; do not invent missing delivery dates.
create or replace function public.police_bonus_register(p_kind text,p_period date,p_search text default '',p_offset integer default 0,p_archived boolean default false)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare result jsonb;
begin
 if p_kind is null or p_kind not in ('weekly','monthly','special','promotion') or p_period is null or p_period not between date '2020-01-01' and date '2100-12-31'
 or p_offset is null or p_offset<0 or p_offset>1000000 or p_search is null or length(p_search)>100
 or (p_kind='weekly' and extract(isodow from p_period)<>1) or (p_kind='monthly' and extract(day from p_period)<>1) then raise exception 'Invalid bonus filters';end if;
 with roster as (
 select p.discord_user_id,p.full_name,p.plate,p.rank_name,p.unit,p.status as personnel_status,
 b.id,b.delivered_on,b.promoted_rank,b.amount,coalesce(b.status,'pending') as status,b.reason,coalesce(b.version,0) as version,b.updated_at,b.updated_by_name,b.paid_at
 from public.police_personnel p left join public.police_bonuses b on b.discord_user_id=p.discord_user_id and b.kind=p_kind and b.period_start=p_period
 where (p.status='active' or (coalesce(p_archived,false) and b.id is not null))
 ), filtered as (
 select * from roster where p_search='' or position(lower(p_search) in lower(full_name||' '||plate||' '||rank_name))>0
 ), page as (select * from filtered order by lower(full_name),discord_user_id limit 30 offset p_offset)
 select jsonb_build_object('records',coalesce((select jsonb_agg(to_jsonb(x) order by lower(x.full_name),x.discord_user_id) from page x),'[]'::jsonb),
 'total',(select count(*) from filtered),'summary',(select jsonb_build_object('agents',count(*),'paid',count(*) filter(where status='paid'),
 'pending',count(*) filter(where status='pending'),'excluded',count(*) filter(where status='excluded'),
 'paid_amount',coalesce(sum(amount) filter(where status='paid'),0)) from roster)) into result;
 return result;
end;$$;


drop function public.police_bonus_save(text,text,date,numeric,text,text,integer,text,text);
create function public.police_bonus_save(p_user text,p_kind text,p_period date,p_amount numeric,p_status text,p_reason text,p_expected integer,p_actor text,p_actor_name text,p_delivered_on date default null,p_promoted_rank text default '')
returns jsonb language plpgsql security invoker set search_path=public as $$
declare person public.police_personnel; previous public.police_bonuses; saved public.police_bonuses; had_previous boolean;
begin
 if p_user is null or p_user !~ '^[0-9]{17,20}$' or p_actor is null or p_actor !~ '^[0-9]{17,20}$'
 or p_kind is null or p_kind not in ('weekly','monthly','special','promotion') or p_period is null or p_period not between date '2020-01-01' and date '2100-12-31'
 or (p_kind='weekly' and extract(isodow from p_period)<>1) or (p_kind='monthly' and extract(day from p_period)<>1)
 or p_amount is null or p_amount<0 or p_amount>9999999999.99 or p_amount<>round(p_amount,2)
 or p_status is null or p_status not in ('pending','paid','excluded') or (p_status='paid' and p_amount<=0)
 or p_reason is null or length(btrim(p_reason)) not between 3 and 1000 or p_expected is null or p_expected<0
 or (p_delivered_on is not null and p_delivered_on not between date '2020-01-01' and date '2100-12-31')
 or p_promoted_rank is null or length(p_promoted_rank)>100 or (p_kind='promotion' and length(btrim(p_promoted_rank))<1)
 or p_actor_name is null or length(btrim(p_actor_name)) not between 1 and 100 then return jsonb_build_object('ok',false,'code','invalid');end if;
 -- Serialize this agent/period, including the initial insert. Protect concurrent departure.
 perform pg_advisory_xact_lock(hashtextextended('bonus:'||p_kind||':'||p_period::text||':'||p_user,0));
 select * into person from public.police_personnel where discord_user_id=p_user for share;
 if not found then return jsonb_build_object('ok',false,'code','not_found');end if;
 select * into previous from public.police_bonuses where kind=p_kind and period_start=p_period and discord_user_id=p_user for update;
 had_previous:=found;
 if (had_previous and previous.version<>p_expected) or (not had_previous and p_expected<>0) then return jsonb_build_object('ok',false,'code','conflict');end if;
 if person.status<>'active' and not had_previous then return jsonb_build_object('ok',false,'code','inactive');end if;
 if had_previous then
 update public.police_bonuses set delivered_on=case when p_status='paid' then coalesce(p_delivered_on,previous.delivered_on,current_date) else p_delivered_on end,promoted_rank=case when p_kind='promotion' then btrim(p_promoted_rank) else '' end,amount=p_amount,status=p_status,reason=btrim(p_reason),version=version+1,
 updated_by=p_actor,updated_by_name=btrim(p_actor_name),updated_at=clock_timestamp(),
 paid_at=case when p_status='paid' then coalesce(previous.paid_at,clock_timestamp()) else null end
 where id=previous.id returning * into saved;
 else
 insert into public.police_bonuses(delivered_on,promoted_rank,discord_user_id,kind,period_start,full_name,plate,rank_name,amount,status,reason,updated_by,updated_by_name,paid_at)
 values(case when p_status='paid' then coalesce(p_delivered_on,current_date) else p_delivered_on end,case when p_kind='promotion' then btrim(p_promoted_rank) else '' end,p_user,p_kind,p_period,person.full_name,person.plate,person.rank_name,p_amount,p_status,btrim(p_reason),p_actor,btrim(p_actor_name),case when p_status='paid' then clock_timestamp() end) returning * into saved;
 end if;
 insert into public.police_bonus_history(bonus_id,before_record,after_record,actor,actor_name)
 values(saved.id,case when had_previous then to_jsonb(previous) end,to_jsonb(saved),p_actor,btrim(p_actor_name));
 return jsonb_build_object('ok',true,'record',to_jsonb(saved));
end;$$;

revoke all on function public.police_bonus_save(text,text,date,numeric,text,text,integer,text,text,date,text) from public,anon,authenticated;
grant execute on function public.police_bonus_save(text,text,date,numeric,text,text,integer,text,text,date,text) to service_role;
