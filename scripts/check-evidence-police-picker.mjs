import assert from 'node:assert/strict';
import {startParticipantPicker,handleParticipantPicker} from '../supabase/functions/prime-police-discord/evidence-participants.ts';
import {evidenceForm} from '../supabase/functions/prime-police-discord/evidence.ts';
const police='1539970134482092038',expelled='1539970134482092034',veto='1564310246128619560',id=n=>String(300000000000000000n+BigInt(n)),actor=id(0),h50=id(10);
let roster=Array.from({length:61},(_,n)=>({discord_user_id:id(n),full_name:'Agente '+String(n).padStart(2,'0'),plate:String(n),status:n===6?'inactive':'active'}));
const roles=new Map([[id(1),[]],[id(2),[police,expelled]],[id(3),[police,veto]]]),bots=new Set([id(4)]),missing=new Set([id(5)]);
const tasks=[],replies=[],reads=[];let fail=false;
const context={response:(type,data)=>Response.json({type,data}),ephemeral:content=>Response.json({type:4,data:{content}}),reply:async(i,p)=>replies.push(p),waitUntil:p=>tasks.push(p),discord:async path=>{if(fail)throw Error('Unavailable');const user=path.split('/').at(-1);if(missing.has(user))throw Object.assign(Error('Not found'),{status:404});return{roles:roles.get(user)||[police],user:{bot:bots.has(user)}};},db:async (path,init)=>{
 reads.push(path);const active=roster.filter(p=>p.status==='active');if(path==='rpc/police_evidence_h50_search'){const q=JSON.parse(init.body).p_search.toLowerCase();return active.filter(p=>(p.full_name+' '+p.plate).toLowerCase().includes(q)).slice(0,26);}
 if(path.includes('&order=')){const offset=Number(path.match(/offset=(\d+)/)[1]);return active.slice(offset,offset+26);}
 if(path.includes('&discord_user_id=in.(')){const ids=path.match(/in\.\(([^)]+)\)/)[1].split(',');return active.filter(p=>ids.includes(p.discord_user_id));}
 return active.filter(p=>p.discord_user_id===actor);
}};
const menu=(message,prefix)=>message.components.flatMap(r=>r.components).find(p=>p.custom_id.startsWith(prefix));
async function interact(message,custom,values){replies.length=0;const r=await handleParticipantPicker({type:3,message,data:{custom_id:custom,...(values?{values}:{})}},actor,context,evidenceForm);await Promise.all(tasks.splice(0));return{response:await r.json(),message:replies.at(-1)};}
let response=await startParticipantPicker({},actor,context,h50,'H50').json();assert.equal(response.type,7);assert.equal(tasks.length,0,'Initial participant screen opens without network requests');let message=(await interact(response.data,'prime_evidence_people:'+h50+':0')).message;
let page=menu(message,'prime_evidence_pick:');
for(const n of [1,2,3,4,5,6])assert(!page.options.some(p=>p.value===id(n)),n+' must be hidden');
assert(page.options.some(p=>p.value===actor));assert(page.options.length<=25);assert(message.components.length<=5);
let step=await interact(message,page.custom_id,[actor,id(7)]);message=step.message;assert.equal(menu(message,'prime_evidence_team:').options.length,2);
step=await interact(message,'prime_evidence_people:'+h50+':25');message=step.message;assert.equal(menu(message,'prime_evidence_team:').options.length,2);
page=menu(message,'prime_evidence_pick:');const third=page.options[0].value;
message=(await interact(message,page.custom_id,[third])).message;assert.equal(menu(message,'prime_evidence_team:').options.length,3);
message=(await interact(message,'prime_evidence_people:'+h50+':0')).message;page=menu(message,'prime_evidence_pick:');assert(page.options.find(p=>p.value===actor).default);assert(page.options.find(p=>p.value===id(7)).default);
const final=await interact(message,'prime_evidence_ready:'+h50);assert.equal(final.response.type,9);assert.equal(final.response.data.components[1].component.type,3);assert.equal(final.response.data.components[1].component.options.length,3);
let callbackCount=0;await handleParticipantPicker({type:3,message,data:{custom_id:'prime_evidence_ready:'+h50}},actor,{...context,openModal:async(i,form)=>{callbackCount++;assert.equal(form.components[1].component.type,3);return new Response(null,{status:202});}},evidenceForm);assert.equal(callbackCount,1);
assert.equal((await interact(message,page.custom_id,[id(1)])).response.type,4,'Forged values rejected');
assert.equal((await interact(message,'prime_evidence_people:'+h50+':26')).response.type,4);
// A role removed since selection disappears on the next page render.
roles.set(id(7),[]);message=(await interact(message,'prime_evidence_people:'+h50+':0')).message;assert(!menu(message,'prime_evidence_pick:').options.some(p=>p.value===id(7)));assert(!menu(message,'prime_evidence_team:').options.some(p=>p.value===id(7)));
// New active officer is read from the database, not a static list.
roster.unshift({discord_user_id:id(99),full_name:'Agente nuevo',plate:'99',status:'active'});message=(await interact(message,'prime_evidence_people:'+h50+':0')).message;assert(menu(message,'prime_evidence_pick:').options.some(p=>p.value===id(99)));
let team=menu(message,'prime_evidence_team:');message=(await interact(message,team.custom_id,[actor])).message;assert.equal(menu(message,'prime_evidence_team:').options.length,1);
team=menu(message,'prime_evidence_team:');message=(await interact(message,team.custom_id,[])).message;assert(!menu(message,'prime_evidence_team:'));assert(menu(message,'prime_evidence_ready:').disabled);
assert.equal((await interact(message,'prime_evidence_ready:'+h50)).response.type,4);
// Name/plate search keeps the current team and only returns eligible police.
let modal=await interact(message,'prime_evidence_find_people:'+h50);assert.equal(modal.response.type,9);
async function searchPeople(source,value){const opened=await interact(source,'prime_evidence_find_people:'+h50);replies.length=0;const response=await handleParticipantPicker({type:5,message:source,data:{custom_id:opened.response.data.custom_id,components:[{type:18,component:{custom_id:'participant_query',value}}]}},actor,context,evidenceForm);await Promise.all(tasks.splice(0));return{response:await response.json(),message:replies.at(-1)};}
message=(await searchPeople(message,'Agente 00')).message;let found=menu(message,'prime_evidence_pick:');assert.equal(found.options.length,1);assert.equal(found.options[0].value,actor);
message=(await interact(message,found.custom_id,[actor])).message;assert.equal(menu(message,'prime_evidence_team:').options.length,1);
message=(await searchPeople(message,'Agente nuevo')).message;found=menu(message,'prime_evidence_pick:');assert(menu(message,'prime_evidence_team:').options.some(p=>p.value===actor));
message=(await interact(message,found.custom_id,[id(99)])).message;assert.equal(menu(message,'prime_evidence_team:').options.length,2);
message=(await searchPeople(message,'Agente 01')).message;assert(!menu(message,'prime_evidence_pick:'),'Staff/non-police excluded from search');assert.equal(menu(message,'prime_evidence_team:').options.length,2);
message=(await searchPeople(message,'no existe')).message;assert(!menu(message,'prime_evidence_pick:'));assert.equal(menu(message,'prime_evidence_team:').options.length,2);
const lostContext=await handleParticipantPicker({type:5,data:{custom_id:'prime_evidence_people_search:'+h50+':2',components:[{type:18,component:{custom_id:'participant_query',value:'Agente'}}]}},actor,context,evidenceForm);assert.equal((await lostContext.json()).type,4,'Missing message cannot silently lose a selected team');
fail=true;message=(await interact(message,'prime_evidence_people:'+h50+':0')).message;assert.deepEqual(message.components,[]);assert(reads.some(p=>p.includes('status=eq.active')));
console.log('Police-only participant picker: live role/active roster filter, bots and restrictions hidden, cross-page selections, removals, fresh reads, forged values denied, string-select modal and fail-closed errors: PASS');
