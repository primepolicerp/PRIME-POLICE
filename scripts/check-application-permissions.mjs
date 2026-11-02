import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {applicationPermissions,applicationScopeAllowed,UCOP_APPLICATION_ROLES,UCOP_TRAINEE_ROLE} from '../supabase/functions/prime-police-panel/application-permissions.ts';
import {validatePersonnelMovement} from '../supabase/functions/prime-police-panel/personnel-status.ts';
import {validateDecisionCorrection} from '../supabase/functions/prime-police-panel/decision-correction.ts';
const director='1539970134544748562',staff='1539970134544748556';
for(const role of UCOP_APPLICATION_ROLES)assert(applicationPermissions([role]).direct);
assert(!applicationPermissions([UCOP_TRAINEE_ROLE]).direct);
assert(!applicationPermissions([UCOP_TRAINEE_ROLE,UCOP_APPLICATION_ROLES[0]]).direct);
assert(applicationPermissions([UCOP_TRAINEE_ROLE,UCOP_APPLICATION_ROLES[1]]).direct);
assert(applicationPermissions([UCOP_TRAINEE_ROLE,director]).direct);
assert(!applicationPermissions([staff]).direct);
assert(applicationPermissions([UCOP_TRAINEE_ROLE]).applicationsOnly);
for(const action of ['personnel','change-requests','rank-change','transfer-decision','absence-register'])assert(!applicationScopeAllowed(action,new URLSearchParams()));
assert(applicationScopeAllowed('records',new URLSearchParams({kind:'applications'})));
assert(!applicationScopeAllowed('records',new URLSearchParams({kind:'personnel'})));

const source=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/prime-police-panel/change-requests.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ',''));
const actor='111111111111111111',target='222222222222222222',id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
function setup(roles){
 const state={roles,queue:[],executed:0,record:{id,discord_user_id:target,full_name:'Ejemplo',status:'pending',created_at:'2026-11-01T00:00:00Z'}};
 const json=(body,status=200)=>Response.json(body,{status});
 const db=async(path,init)=>{
  if(path.startsWith('police_personnel?'))return[{...state.record,updated_at:'2026-11-01T00:00:00Z'}];
  if(path.startsWith('police_applications'))return[state.record];
  if(path.startsWith('police_change_requests')){
   const p=new URL('https://test/?'+(path.split('?')[1]||'')).searchParams;
   const body=init?.body?JSON.parse(init.body):null;
   const matches=r=>['id','status','action','resource_key'].every(k=>!p.has(k)||(p.get(k).startsWith('eq.')?r[k]===p.get(k).slice(3):p.get(k).slice(4,-1).split(',').includes(r[k])));
   if(init?.method==='POST'){
    if(state.queue.some(r=>r.action===body.action&&r.resource_key===body.resource_key&&['pending','processing'].includes(r.status)))throw Error('409 duplicate proposal');
    const row={...body,id:crypto.randomUUID(),status:'pending'};state.queue.push(row);return[row];
   }
   const rows=state.queue.filter(matches);
   if(init?.method==='PATCH')rows.forEach(r=>Object.assign(r,body));
   return rows;
  }
  return[];
 };
 const locks=new Map();
 const withOperationLock=async(key,fn)=>{
  const previous=locks.get(key)||Promise.resolve();let release;
  const gate=new Promise(resolve=>release=resolve);locks.set(key,previous.then(()=>gate));
  await previous;try{return await fn();}finally{release();}
 };
 const context=vm.createContext({Request,Response,URL,TextEncoder,crypto,console:{error(){}},applicationPermissions,validateDecisionCorrection,validatePersonnelMovement,accessMember:async()=>({roles:state.roles,nick:'Gestor'}),withOperationLock,writeAudit:async()=>{},discordFailure:()=>null});
 vm.runInContext(source,context);
 const c={db,json,authorizedUser:async()=>actor,discord:async()=>({}),dispatch:async req=>{state.executed++;state.record.status=(await req.json()).action==='accept'?'accepted':'rejected';return json({ok:true});}};
 const req=(action,body)=>new Request('https://test/?panel='+action,{method:'POST',body:JSON.stringify(body)});
 const run=(action,body)=>context.interceptChanges(req(action,body),action,c);
 return{state,run};
}
for(const role of UCOP_APPLICATION_ROLES)for(const action of ['accept','reject']){
 const t=setup([role]);assert.equal((await t.run('decision',{id,action})).status,200);assert.equal(t.state.executed,1);assert.equal(t.state.queue.length,0);
}
for(const roles of [[UCOP_TRAINEE_ROLE],[UCOP_TRAINEE_ROLE,UCOP_APPLICATION_ROLES[0]],[staff]])for(const action of ['accept','reject']){
 const t=setup(roles);const result=await t.run('decision',{id,action,reason:'Observación'});assert((await result.json()).pending_approval);assert.equal(t.state.executed,0);
 t.state.roles=[director];assert.equal((await t.run('decision',{id,action})).status,409,'A stale tab cannot bypass the queue, even as Directiva');
 assert.equal((await t.run('change-request-review',{id:t.state.queue[0].id,decision:'approve'})).status,200);assert.equal(t.state.executed,1);
 assert.equal((await t.run('change-request-review',{id:t.state.queue[0].id,decision:'approve'})).status,409);assert.equal(t.state.executed,1);
}
{
 const t=setup([UCOP_TRAINEE_ROLE]);const results=await Promise.all([t.run('decision',{id,action:'reject'}),t.run('decision',{id,action:'accept'})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(t.state.queue.length,1);
 t.state.roles=[director];await t.run('change-request-review',{id:t.state.queue[0].id,decision:'reject'});assert.equal(t.state.record.status,'pending');assert.equal(t.state.executed,0);
 t.state.roles=[UCOP_APPLICATION_ROLES[0]];assert.equal((await t.run('decision',{id,action:'accept'})).status,200);assert.equal(t.state.executed,1);
}
{
 const t=setup([UCOP_TRAINEE_ROLE]);await t.run('decision',{id,action:'reject'});t.state.record.full_name='Corregido por otro gestor';t.state.roles=[director];assert.equal((await t.run('change-request-review',{id:t.state.queue[0].id,decision:'approve'})).status,409);assert.equal(t.state.queue[0].status,'failed');assert.equal(t.state.executed,0);
}
console.log('Application permissions: UCOP direct accept/reject, trainee approval, restricted data, concurrent proposals, stale tabs, discard, stale records and single execution: PASS');

for(const action of ['personnel-departure','personnel-reentry']){const t=setup([UCOP_APPLICATION_ROLES[0]]);t.state.record.status=action==='personnel-departure'?'active':'inactive';const body={discord_user_id:target,operation_id:crypto.randomUUID(),expected_updated_at:'2026-11-01T00:00:00Z',effective_date:new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'}),departure_type:'despido',rank_role_id:'1564309793802428567',unit:'POLICIA',reason:'Motivo comprobado'};assert((await (await t.run(action,body)).json()).pending_approval);assert.equal(t.state.executed,0);t.state.roles=[director];assert.equal((await t.run('change-request-review',{id:t.state.queue[0].id,decision:'approve'})).status,200);assert.equal(t.state.executed,1);}
console.log('Personnel departures and reentries preserve UCOP proposals and Directiva approval: PASS');
