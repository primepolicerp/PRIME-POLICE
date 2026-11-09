import {DEPARTURE_ROLES,departureRoleChoice,hasPersonnelRestriction} from '../supabase/functions/_shared/departure-roles.ts';
import {departureCard,announceDeparture,DEPARTURE_CHANNEL} from '../supabase/functions/prime-police-panel/departure-announcements.ts';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {REAL_RANKS,realRank,rankedNickname,shouldAssignUcopBranch} from '../supabase/functions/_shared/real-ranks.ts';
const source=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/prime-police-panel/personnel-status.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ',''));
const target='222222222222222222',actor='111111111111111111',police='1539970134482092038',ucop='1539970134519578773',rank='1564309793802428567',pasante='1564308664557506691',staff='1539970134544748556';
const stamp='2026-11-01T12:00:00Z',today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'});
function scenario(options={}){
 const state={person:{discord_user_id:target,full_name:'Agente Ejemplo',plate:'0123',rank_name:options.chief?'Jefe UCOP':'Raso',rank_role_id:options.chief?'1539970134544748559':rank,unit:'POLICIA',status:options.reentry?'inactive':'active',updated_at:stamp},roles:new Set([police,rank,ucop,staff]),writes:[],events:[],announcements:[],calls:0,failed:false};
 const context=vm.createContext({Request,Response,Date,BigInt,Set,console:{error(){}},REAL_RANKS,realRank,rankedNickname,shouldAssignUcopBranch,DEPARTURE_ROLES,departureRoleChoice,hasPersonnelRestriction,writeAudit:async()=>{},announceDeparture:async notice=>{assert.equal(state.person.status,'inactive');assert.equal(notice.approvedBy,'Directiva de prueba');state.announcements.push(notice);return '';}});vm.runInContext(source,context);
 const c={actorName:'Directiva de prueba',actorIsDirector:options.director!==false,json:(body,status=200)=>Response.json(body,{status}),
  discord:async(path,init)=>{
   state.calls++;if(path==='/users/@me')return{id:'999999999999999999'};if(path.endsWith('/members/999999999999999999'))return{roles:['bot-role']};
   if(path.endsWith('/roles')&&!init)return[{id:'integration-role',position:200,managed:true,permissions:'0'},...Array.from({length:80},(_,i)=>({id:'extra-'+i,position:5,managed:false,permissions:'0'})),{id:'bot-role',position:100,permissions:'268435456'},{id:staff,name:'Staff',position:options.highRole?101:20,managed:false,permissions:'8'},{id:police,position:2,permissions:'0'},{id:ucop,position:15,permissions:'0'},{id:rank,position:3,permissions:options.protected?'8':'0'},{id:pasante,position:4,permissions:'0'},{id:'1539970134544748559',position:30,permissions:'8'},...Object.values(DEPARTURE_ROLES).map(r=>({id:r.id,position:1,permissions:'0'}))];
   if(!init)return{roles:[...state.roles],nick:'Anterior'};
   state.writes.push({path,...init});if(options.discordFail&&!state.failed&&state.writes.length===1){state.failed=true;throw Error('Discord API 403');}
   const payload=init.body?JSON.parse(init.body):{};if(init.method==='PATCH'&&payload.roles){state.roles=new Set(payload.roles);if(options.partialRoleFailure&&!state.failed){state.failed=true;state.roles.add(staff);}return{roles:[...state.roles]};}
   const id=path.split('/').at(-1);if(init.method==='DELETE')state.roles.delete(id);if(init.method==='PUT')state.roles.add(id);return{};
  },
  db:async(path,init)=>{
   if(path.startsWith('police_personnel?'))return[state.person];
   if(path.startsWith('police_personnel_movements'))return path.includes('kind=eq.departure')?(options.proof?[{previous_rank_name:'Jefe UCOP'}]:[]):state.events;
   if(path.startsWith('police_rank_roles'))return[{role_id:rank},{role_id:pasante},{role_id:'1539970134544748559'}];
   if(path==='rpc/change_police_personnel_status'){
    const b=JSON.parse(init.body);assert.equal(b.p_actor,actor);assert.equal(b.p_actor_name,c.actorName);if(options.dbFail)throw Error('Database rejected');
    state.person.status=b.p_kind==='departure'?'inactive':'active';if(b.p_kind==='departure')state.person.departure_role=b.p_departure_role;state.events.push({id:b.p_operation,discord_user_id:target,actor_id:actor,kind:b.p_kind});if(options.replyLost)throw Error('Timeout after commit');return{ok:true,person:state.person};
   }throw Error(path);
  }};
 const body={discord_user_id:target,operation_id:crypto.randomUUID(),expected_updated_at:stamp,effective_date:today,reason:'Motivo comprobado',departure_type:'despido',rank_role_id:options.chief?'1539970134544748559':options.pasante?pasante:rank,unit:options.pasante||options.chief?'UCOP':'POLICIA',restore_previous_rank:Boolean(options.restore)};
 const run=()=>context.changePersonnelStatus(new Request('https://test',{method:'POST',body:JSON.stringify(body)}),options.reentry?'personnel-reentry':'personnel-departure',actor,c);
 return{state,body,run};
}
let t=scenario();assert.equal((await t.run()).status,200);assert.equal(t.state.person.status,'inactive');assert.deepEqual([...t.state.roles].sort(),[DEPARTURE_ROLES.expelled.id].sort());assert.equal(t.state.events.length,1);assert.equal(t.state.announcements.length,1);const n=t.state.calls;await t.run();assert.equal(t.state.calls,n);assert.equal(t.state.announcements.length,1);assert.equal(t.state.events.length,1);
for(const options of [{discordFail:true},{dbFail:true}]){t=scenario(options);assert.equal((await t.run()).status,502);assert.equal(t.state.person.status,'active');assert.deepEqual([...t.state.roles].sort(),[police,rank,ucop,staff].sort());assert.equal(t.state.events.length,0);assert.equal(t.state.announcements.length,0);}
t=scenario({replyLost:true});assert.equal((await t.run()).status,200);assert.equal(t.state.person.status,'inactive');assert.equal(t.state.events.length,1);assert.deepEqual([...t.state.roles].sort(),[DEPARTURE_ROLES.expelled.id].sort());
t=scenario({reentry:true,protected:true,director:false});assert.equal((await t.run()).status,409);assert.equal(t.state.writes.length,0);
t=scenario({reentry:true,pasante:true});assert.equal((await t.run()).status,200);assert(t.state.roles.has(police));assert(t.state.roles.has(pasante));assert(t.state.roles.has(staff));assert(!t.state.roles.has(ucop));assert(!t.state.roles.has(rank));assert.equal(t.state.announcements.length,0);
t=scenario();t.body.expected_updated_at='2025-01-01T00:00:00Z';assert.equal((await t.run()).status,409);assert.equal(t.state.calls,0);
t=scenario();t.body.departure_type='inventado';assert.equal((await t.run()).status,409);assert.equal(t.state.calls,0);
console.log('Personnel status: restricted role changes, rollback, uncertain commit recovery, same-file reentry, trainee branch, idempotency, stale versions and reason validation: PASS');

const data={eventId:crypto.randomUUID(),userId:target,name:'Agente Prueba',plate:'0123',rank:'Raso',type:'Despido',date:today,approvedBy:'Directiva Prueba',timestamp:new Date().toISOString()};const card=departureCard(data);assert.deepEqual(card.allowed_mentions,{parse:[]});assert(card.nonce.length<=25);assert(!JSON.stringify(card).includes('Observación privada'));let notices=[],failOnce=true;assert.equal(await announceDeparture(data,async(path,init)=>{notices.push({path,init});if(init.method==='GET')return{guild_id:'1539970134469378068',type:0};if(failOnce){failOnce=false;throw Error('Connection interrupted');}return{id:'notice'};}),'');assert.equal(notices.length,3);assert.equal(notices[1].init.body,notices[2].init.body);assert(notices[1].path.includes(DEPARTURE_CHANNEL));assert(await announceDeparture(data,async()=>({guild_id:'other',type:0})));console.log('Departure notices: configured destination, safe fields/mentions, stable retries and announcement errors do not undo a departure: PASS');

assert.equal(departureRoleChoice('renuncia'),'voluntary');assert.equal(departureRoleChoice('jubilacion'),'voluntary');assert.equal(departureRoleChoice('corrupcion'),'expelled');assert.equal(departureRoleChoice('ck'),'none');assert.equal(departureRoleChoice('otro','banned'),'banned');assert.equal(departureRoleChoice('otro','constructor'),null);
for(const role of ['discharged','voluntary','expelled','banned']){t=scenario();t.body.departure_role=role;assert.equal((await t.run()).status,200);assert(t.state.roles.has(DEPARTURE_ROLES[role].id));assert.equal(t.state.person.departure_role,role);}
t=scenario({reentry:true});t.state.roles.add(DEPARTURE_ROLES.voluntary.id);assert.equal((await t.run()).status,200);assert(!t.state.roles.has(DEPARTURE_ROLES.voluntary.id));
for(const role of ['expelled','banned']){t=scenario({reentry:true});t.state.roles.add(DEPARTURE_ROLES[role].id);assert.equal((await t.run()).status,409);assert.equal(t.state.writes.length,0);}
t=scenario({reentry:true});t.state.person.departure_role='banned';assert.equal((await t.run()).status,409);assert.equal(t.state.calls,0);
t=scenario();t.state.roles.add(DEPARTURE_ROLES.banned.id);t.body.departure_role='voluntary';assert.equal((await t.run()).status,409);assert.equal(t.state.writes.length,0);
console.log('Departure markers: defaults, explicit veto, exact marker replacement, voluntary reentry cleanup, rollback and veto/expulsion protection: PASS');

for(const options of [{chief:true},{chief:true,restore:false,proof:false},{protected:true}]){t=scenario({reentry:true,...options});assert.equal((await t.run()).status,200);assert(t.state.roles.has(t.body.rank_role_id));}
for(const options of [{chief:true},{protected:true}]){t=scenario({reentry:true,director:false,...options});assert.equal((await t.run()).status,409);assert.equal(t.state.writes.length,0);}
console.log('Elevated official ranks: Directiva may assign on reentry without obsolete restoration restrictions; non-Directiva cannot: PASS');

t=scenario();for(let i=0;i<80;i++)t.state.roles.add('extra-'+i);assert.equal((await t.run()).status,200);assert.deepEqual([...t.state.roles],[DEPARTURE_ROLES.expelled.id]);assert.equal(t.state.writes.filter(w=>w.body&&JSON.parse(w.body).roles).length,1);
t=scenario({highRole:true});assert.equal((await t.run()).status,409);assert.equal(t.state.writes.length,0);assert.equal(t.state.events.length,0);
t=scenario({partialRoleFailure:true});assert.equal((await t.run()).status,502);assert.deepEqual([...t.state.roles].sort(),[police,rank,ucop,staff].sort());assert.equal(t.state.events.length,0);
t=scenario();t.state.roles.add('integration-role');const automatic=await t.run();assert.equal(automatic.status,200);assert.deepEqual([...t.state.roles].sort(),['integration-role',DEPARTURE_ROLES.expelled.id].sort());assert((await automatic.json()).warning.includes('automático'));
t=scenario();t.body.departure_role='none';assert.equal((await t.run()).status,409);assert.equal(t.state.calls,0);
console.log('Full departure removal: staff and 80 other manual roles removed in one update; hierarchy blocks before writes; failed confirmation rolls back; automatic roles reported; marker required: PASS');

// The general Baja marker is reversible and cannot bypass a veto or expulsion.
assert.equal(DEPARTURE_ROLES.discharged.id,'1569323526610092234');
assert.equal(departureRoleChoice('otro','discharged'),'discharged');
assert.equal(hasPersonnelRestriction([DEPARTURE_ROLES.discharged.id]),false);
t=scenario({reentry:true});t.state.person.departure_role='discharged';t.state.roles.add(DEPARTURE_ROLES.discharged.id);assert.equal((await t.run()).status,200);assert(!t.state.roles.has(DEPARTURE_ROLES.discharged.id));assert(t.state.roles.has(police));
for(const restricted of ['expelled','banned']){t=scenario();t.state.roles.add(DEPARTURE_ROLES[restricted].id);t.body.departure_role='discharged';assert.equal((await t.run()).status,409);assert.equal(t.state.writes.length,0);}
console.log('General Baja: selected role assigned, saved as discharged, removed on reentry, veto/expulsion cannot be downgraded: PASS');
