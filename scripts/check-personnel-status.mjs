import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {REAL_RANKS,realRank,rankedNickname,shouldAssignUcopBranch} from '../supabase/functions/_shared/real-ranks.ts';
const source=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/prime-police-panel/personnel-status.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ',''));
const target='222222222222222222',actor='111111111111111111',police='1539970134482092038',ucop='1539970134519578773',rank='1564309793802428567',pasante='1564308664557506691',staff='1539970134544748556';
const stamp='2026-11-01T12:00:00Z',today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'});
function scenario(options={}){
 const state={person:{discord_user_id:target,full_name:'Agente Ejemplo',plate:'0123',rank_name:'Raso',rank_role_id:rank,unit:'POLICIA',status:options.reentry?'inactive':'active',updated_at:stamp},roles:new Set([police,rank,ucop,staff]),writes:[],events:[],calls:0,failed:false};
 const context=vm.createContext({Request,Response,Date,BigInt,Set,console:{error(){}},REAL_RANKS,realRank,rankedNickname,shouldAssignUcopBranch,writeAudit:async()=>{}});vm.runInContext(source,context);
 const c={actorName:'Directiva de prueba',json:(body,status=200)=>Response.json(body,{status}),
  discord:async(path,init)=>{
   state.calls++;if(path.endsWith('/roles')&&!init)return[{id:rank,permissions:options.protected?'8':'0'},{id:pasante,permissions:'0'}];
   if(!init)return{roles:[...state.roles],nick:'Anterior'};
   state.writes.push({path,...init});if(options.discordFail&&!state.failed&&state.writes.length===2){state.failed=true;throw Error('Discord API 403');}
   const id=path.split('/').at(-1);if(init.method==='DELETE')state.roles.delete(id);if(init.method==='PUT')state.roles.add(id);return{};
  },
  db:async(path,init)=>{
   if(path.startsWith('police_personnel?'))return[state.person];
   if(path.startsWith('police_personnel_movements'))return state.events;
   if(path.startsWith('police_rank_roles'))return[{role_id:rank},{role_id:pasante}];
   if(path==='rpc/change_police_personnel_status'){
    const b=JSON.parse(init.body);assert.equal(b.p_actor,actor);assert.equal(b.p_actor_name,c.actorName);if(options.dbFail)throw Error('Database rejected');
    state.person.status=b.p_kind==='departure'?'inactive':'active';state.events.push({id:b.p_operation,discord_user_id:target,actor_id:actor,kind:b.p_kind});if(options.replyLost)throw Error('Timeout after commit');return{ok:true,person:state.person};
   }throw Error(path);
  }};
 const body={discord_user_id:target,operation_id:crypto.randomUUID(),expected_updated_at:stamp,effective_date:today,reason:'Motivo comprobado',departure_type:'despido',rank_role_id:options.pasante?pasante:rank,unit:options.pasante?'UCOP':'POLICIA'};
 const run=()=>context.changePersonnelStatus(new Request('https://test',{method:'POST',body:JSON.stringify(body)}),options.reentry?'personnel-reentry':'personnel-departure',actor,c);
 return{state,body,run};
}
let t=scenario();assert.equal((await t.run()).status,200);assert.equal(t.state.person.status,'inactive');assert.deepEqual([...t.state.roles],[staff]);assert.equal(t.state.events.length,1);const n=t.state.calls;await t.run();assert.equal(t.state.calls,n);assert.equal(t.state.events.length,1);
for(const options of [{discordFail:true},{dbFail:true}]){t=scenario(options);assert.equal((await t.run()).status,502);assert.equal(t.state.person.status,'active');assert.deepEqual([...t.state.roles].sort(),[police,rank,ucop,staff].sort());assert.equal(t.state.events.length,0);}
t=scenario({replyLost:true});assert.equal((await t.run()).status,200);assert.equal(t.state.person.status,'inactive');assert.equal(t.state.events.length,1);assert.deepEqual([...t.state.roles],[staff]);
t=scenario({reentry:true,protected:true});assert.equal((await t.run()).status,409);assert.equal(t.state.writes.length,0);
t=scenario({reentry:true,pasante:true});assert.equal((await t.run()).status,200);assert(t.state.roles.has(police));assert(t.state.roles.has(pasante));assert(t.state.roles.has(staff));assert(!t.state.roles.has(ucop));assert(!t.state.roles.has(rank));
t=scenario();t.body.expected_updated_at='2025-01-01T00:00:00Z';assert.equal((await t.run()).status,409);assert.equal(t.state.calls,0);
t=scenario();t.body.departure_type='inventado';assert.equal((await t.run()).status,409);assert.equal(t.state.calls,0);
console.log('Personnel status: restricted role changes, rollback, uncertain commit recovery, same-file reentry, trainee branch, idempotency, stale versions and reason validation: PASS');
