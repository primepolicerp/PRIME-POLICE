import {deliverPrivateNotice} from '../supabase/functions/prime-police-panel/private-notices.ts';
import assert from 'node:assert/strict';
import {workspaceRoute} from '../supabase/functions/prime-police-panel/workspace.ts';
import {durableNotice,deliverClaimedNotice} from '../supabase/functions/prime-police-panel/discord-jobs.ts';
import {expectedPersonnelAccess,personnelAccess} from '../supabase/functions/prime-police-panel/personnel-access.ts';
const json=(v,status=200)=>Response.json(v,{status}),actor='111111111111111111',target='222222222222222222';
let paths=[];const c={json,director:false,applicationsOnly:true,db:async(path,init)=>{paths.push({path,init});return[];}};
let r=await workspaceRoute(new Request('https://test?q=Ejemplo'),'workspace-search',actor,c);assert.equal(r.status,200);assert.equal(paths.length,1);assert(paths[0].path.startsWith('police_available_applications?'));assert(!paths[0].path.includes('answers'));
paths=[];await workspaceRoute(new Request('https://test?q=a'),'workspace-search',actor,c);assert.equal(paths.length,0);
await workspaceRoute(new Request('https://test'),'workspace-summary',actor,c);assert.equal(JSON.parse(paths[0].init.body).p_actor,actor);assert.equal(JSON.parse(paths[0].init.body).p_director,false);
let state={id:crypto.randomUUID(),status:'pending',attempts:0,lease:null},deliveries=0;
const db=async(path,init)=>{
 if(path.startsWith('police_discord_jobs?on_conflict'))return[state];
 if(path.startsWith('rpc/')){if(state.status!=='pending')return null;state={...state,status:'processing',attempts:state.attempts+1,lease:crypto.randomUUID()};return state;}
 if(init?.method==='PATCH'){const b=JSON.parse(init.body);assert(path.includes('lease=eq.'+state.lease));Object.assign(state,b);return[state];}
 return[state];
};
assert.equal(await durableNotice('promotion',{eventId:'one'},async()=>{deliveries++;return '';},db),'');assert.equal(state.status,'sent');await durableNotice('promotion',{eventId:'one'},async()=>{deliveries++;return '';},db);assert.equal(deliveries,1);
state={id:crypto.randomUUID(),status:'pending',attempts:0,lease:null};assert((await durableNotice('promotion',{eventId:'two'},async()=>'Discord unavailable',db)).includes('cola'));assert.equal(state.status,'pending');assert.equal(state.attempts,1);
state={...state,status:'processing',attempts:5,lease:crypto.randomUUID()};await deliverClaimedNotice(state,async()=>'Discord unavailable',db);assert.equal(state.status,'failed');
state={...state,status:'processing',attempts:1,lease:crypto.randomUUID()};await deliverClaimedNotice(state,async()=>'__superseded__',db);assert.equal(state.status,'superseded');
const police='1539970134482092038',ucop='1539970134519578773',cic='1539970134519578772',director='1539970134544748562',rank='1564309793802428567',pasante='1564308664557506691';
assert(expectedPersonnelAccess({unit:'POLICIA'},[police,rank,director]).branch);
assert(!expectedPersonnelAccess({unit:'CIC'},[police,ucop,rank]).branch);
assert(expectedPersonnelAccess({unit:'UCOP',rank_role_id:pasante},[police,pasante]).branch);
const roles=new Set([rank,director,cic]);let writes=0;const person={discord_user_id:target,full_name:'Ejemplo',plate:'0123',status:'active',unit:'UCOP',rank_role_id:rank,updated_at:'2026-11-01'};
const access={json,db:async()=>[person],discord:async(path,init)=>{if(!init)return{roles:[...roles]};writes++;const id=path.split('/').at(-1);if(init.method==='PUT')roles.add(id);else roles.delete(id);return{};}};
// Avoid external audit calls in this unit test by providing a fetch stub.
const originalFetch=globalThis.fetch;globalThis.Deno={env:{get:()=>''}};globalThis.fetch=async()=>new Response('',{status:201});
try{r=await personnelAccess(new Request('https://test',{method:'POST',body:JSON.stringify({discord_user_id:target,expected_updated_at:person.updated_at})}),actor,access);assert.equal(r.status,200);assert(roles.has(police));assert(roles.has(ucop));assert(!roles.has(cic));assert(roles.has(rank));assert(roles.has(director));assert.equal(writes,3);
 roles.add('1564310246128619560');const old=writes;r=await personnelAccess(new Request('https://test',{method:'POST',body:JSON.stringify({discord_user_id:target,expected_updated_at:person.updated_at})}),actor,access);assert.equal(r.status,409);assert.equal(writes,old);
}finally{globalThis.fetch=originalFetch;delete globalThis.Deno;}
console.log('Administrative workspace: scoped search, trusted summary, durable retry without repeated decisions, superseded messages, Police/branch consistency and preserved Directiva/rank: PASS');

const privateData={eventId:'application:one',userId:target,source:{table:'police_applications',id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',status:'accepted',reviewed_at:'2026-11-01T00:00:00Z'},payload:{content:'@everyone'}};let dmCalls=[];const send=async(path,init)=>{dmCalls.push({path,init});return{id:'dm'};};assert.equal(await deliverPrivateNotice(privateData,send,async()=>[{status:'rejected',reviewed_at:'2026-11-02T00:00:00Z'}]),'__superseded__');assert.equal(dmCalls.length,0);assert.equal(await deliverPrivateNotice(privateData,send,async()=>[{status:'accepted',reviewed_at:'2026-11-01T00:00:00Z'}]),'');assert.equal(dmCalls.length,2);const privateBody=JSON.parse(dmCalls[1].init.body);assert.deepEqual(privateBody.allowed_mentions,{parse:[]});assert(privateBody.enforce_nonce);assert(privateBody.nonce.length<=25);console.log('Private notice retries: outdated decisions suppressed, recipient scoped and mentions disabled: PASS');

dmCalls=[];let sourceReads=0;assert.equal(await deliverPrivateNotice(privateData,send,async()=>++sourceReads===1?[{status:'accepted',reviewed_at:'2026-11-01T00:00:00Z',created_at:'2026-10-31T00:00:00Z'}]:[{id:'newer-attempt'}]),'__superseded__');assert.equal(dmCalls.length,0);console.log('Older-attempt private notices are suppressed when a newer application exists: PASS');
