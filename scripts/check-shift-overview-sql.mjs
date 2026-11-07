import {PGlite} from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const pg=new PGlite();
await pg.exec(`create role anon;create role authenticated;create role service_role;create table public.police_duty_shifts(id uuid default gen_random_uuid(),discord_user_id text,full_name text,plate text,unit text,started_at timestamptz,ended_at timestamptz);`);
await pg.exec(fs.readFileSync(new URL('../supabase/migrations/20261107140407_shift_workspace_overview.sql',import.meta.url),'utf8'));
const user='111111111111111111';
await pg.query(`insert into public.police_duty_shifts(discord_user_id,full_name,plate,unit,started_at,ended_at) values
($1,'Agente de prueba','0012','POLICIA','2026-11-01T22:00Z','2026-11-02T02:00Z'),
($1,'Agente de prueba','0012','POLICIA','2026-11-02T10:00Z','2026-11-02T10:20Z'),
('222222222222222222','Otro','0020','CIC','2026-11-02T10:00Z','2026-11-02T11:00Z')`,[user]);
const run=async(from,to,search='',unit=null,who=null)=>(await pg.query('select public.police_shift_overview($1,$2,$3,$4,$5) as data',[from,to,search,unit,who])).rows[0].data;
let r=await run('2026-11-01T23:00Z','2026-11-02T23:00Z','',null,user);
assert.equal(r.total,2);assert.equal(r.completed,2);assert.equal(r.incomplete,1);assert.equal(r.service_seconds,3*3600+20*60);assert.equal(r.days[0].date,'2026-11-02');assert.equal(r.days[0].seconds,r.service_seconds);
r=await run('2026-11-01T00:00Z','2026-11-03T00:00Z','',null,user);assert.equal(r.days.length,2);assert.equal(r.days[0].seconds,3600);assert.equal(r.days[1].seconds,3*3600+1200);
assert.equal((await run('2026-11-01T00:00Z','2026-11-03T00:00Z','0020')).officers,1);
assert.equal((await run('2026-11-01T00:00Z','2026-11-03T00:00Z','','CIC')).service_seconds,3600);
for(const [start,end,hours] of [['2026-03-28T23:00Z','2026-03-29T22:00Z',23],['2026-10-24T22:00Z','2026-10-25T23:00Z',25]]){
 await pg.query("insert into public.police_duty_shifts(discord_user_id,full_name,plate,unit,started_at,ended_at)values($1,'DST','0012','POLICIA',$2,$3)",[user,start,end]);
 const d=await run(start,end,'',null,user);assert.equal(d.service_seconds,hours*3600);assert.equal(d.days.length,1);assert.equal(d.days[0].seconds,hours*3600);
}
await pg.query("insert into public.police_duty_shifts(discord_user_id,full_name,plate,unit,started_at,ended_at)values($1,'Boundary','0012','POLICIA','2026-11-02T23:00Z','2026-11-02T23:00Z')",[user]);
r=await run('2026-11-02T23:00Z','2026-11-03T23:00Z','',null,user);assert.equal(r.total,1,'Previous day ending at midnight must be excluded');assert.equal(r.service_seconds,0);
await assert.rejects(()=>run('2026-01-01','2028-01-01'));
assert.equal((await pg.query("select has_function_privilege('anon','public.police_shift_overview(timestamptz,timestamptz,text,text,text)','execute') as allowed")).rows[0].allowed,false);
console.log('Shift overview SQL: overnight clipping, complete-period totals, short-shift threshold, person/branch/search filters, 23/25-hour DST days, midnight boundary and private grants: PASS');await pg.close();
