-- Shared Discord leadership roles are distinguished by the personnel division.
-- No existing personnel or historical rows are rewritten.
create or replace function public.police_personnel_division_rank_name()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.rank_role_id in ('1539970134544748558','1539970134544748559') and new.unit in ('CIC','UCOP') then
  new.rank_name := case when new.rank_role_id='1539970134544748558' then 'Subjefe de División ' else 'Jefe de División ' end || new.unit;
 end if;
 return new;
end;
$$;
revoke all on function public.police_personnel_division_rank_name() from public, anon, authenticated;
create trigger police_personnel_division_rank_name
before insert or update of rank_role_id, unit, rank_name on public.police_personnel
for each row execute function public.police_personnel_division_rank_name();
