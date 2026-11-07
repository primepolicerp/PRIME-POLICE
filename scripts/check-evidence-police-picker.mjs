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
const teamIds=message=>Array.from(String(message.embeds?.[0]?.description||'').matchAll(/discord\.com\/users\/(\d+)/g),m=>m[1]);
async function searchPeople(source,value){const opened=await interact(source,'prime_evidence_find_people:'+h50);assert.equal(opened.response.type,9);replies.length=0;const response=await handleParticipantPicker({type:5,message:source,data:{custom_id:opened.response.data.custom_id,components:[{type:18,component:{custom_id:'participant_query',value}}]}},actor,context,evidenceForm);await Promise.all(tasks.splice(0));return{response:await response.json(),message:replies.at(-1)};}
let initial=await startParticipantPicker({},actor,context,h50,'H50').json();assert.equal(initial.type,7);assert.equal(tasks.length,0);let message=initial.data;
assert.equal((await interact(message,'prime_evidence_ready:'+h50)).response.type,4);
// One match is one button, not two repeated menus.
message=(await searchPeople(message,'Agente 00')).message;let add=menu(message,'prime_evidence_add:');assert(add);assert(!message.components.flatMap(r=>r.components).some(c=>c.type===3));
message=(await interact(message,add.custom_id)).message;assert.deepEqual(teamIds(message),[actor]);assert.equal(message.components.length,1);assert(!message.components.flatMap(r=>r.components).some(c=>c.type===3));
message=(await searchPeople(message,'Agente 07')).message;add=menu(message,'prime_evidence_add:');message=(await interact(message,add.custom_id)).message;assert.deepEqual(teamIds(message),[actor,id(7)]);
// Searching again and empty/restricted results retain the existing team.
for(const query of ['no existe','Agente 01']){message=(await searchPeople(message,query)).message;assert(!menu(message,'prime_evidence_add:'));assert.deepEqual(teamIds(message),[actor,id(7)]);}
let ready=await interact(message,'prime_evidence_ready:'+h50);assert.equal(ready.response.type,9);assert.equal(ready.response.data.components[1].component.options.length,2);
// The full roster is still available; only one selection menu is shown.
message=(await interact(message,'prime_evidence_people:'+h50+':0')).message;let page=menu(message,'prime_evidence_pick:');
for(const n of [1,2,3,4,5,6])assert(!page.options.some(p=>p.value===id(n)),n+' excluded');assert.equal(message.components.flatMap(r=>r.components).filter(c=>c.type===3).length,1);
message=(await interact(message,'prime_evidence_people:'+h50+':25')).message;page=menu(message,'prime_evidence_pick:');const third=page.options[0].value;message=(await interact(message,page.custom_id,[third])).message;assert.deepEqual(teamIds(message),[actor,id(7),third]);
// Removal is a separate optional screen, never a second main-screen menu.
let edit=await interact(message,'prime_evidence_edit_team:'+h50);const remove=menu(edit.response.data,'prime_evidence_team:');message=(await interact(edit.response.data,remove.custom_id,[actor,id(7)])).message;assert.deepEqual(teamIds(message),[actor,id(7)]);
roles.set(id(7),[]);message=(await searchPeople(message,'Agente 07')).message;assert.deepEqual(teamIds(message),[actor]);assert(!menu(message,'prime_evidence_add:'));
roster.unshift({discord_user_id:id(99),full_name:'Agente nuevo',plate:'99',status:'active'});message=(await searchPeople(message,'99')).message;add=menu(message,'prime_evidence_add:');assert(add.custom_id.endsWith(id(99)));message=(await interact(message,add.custom_id)).message;assert.deepEqual(teamIds(message),[actor,id(99)]);
assert.equal((await interact(message,'prime_evidence_add:'+h50+':'+id(1))).response.type,4,'Unlisted button rejected');
assert.equal((await interact(message,'prime_evidence_people:'+h50+':26')).response.type,4);
edit=await interact(message,'prime_evidence_edit_team:'+h50);message=(await interact(edit.response.data,menu(edit.response.data,'prime_evidence_team:').custom_id,[])).message;assert.deepEqual(teamIds(message),[]);assert.equal((await interact(message,'prime_evidence_ready:'+h50)).response.type,4);
const lost=await handleParticipantPicker({type:5,data:{custom_id:'prime_evidence_people_search:'+h50+':2',components:[{type:18,component:{custom_id:'participant_query',value:'Agente'}}]}},actor,context,evidenceForm);assert.equal((await lost.json()).type,4);
// Already open legacy team menus remain usable after deployment.
const legacy={components:[{components:[{custom_id:'prime_evidence_team:'+h50+':0',options:[{label:'Actor',value:actor}]}]}]};ready=await interact(legacy,'prime_evidence_ready:'+h50);assert.equal(ready.response.type,9);
fail=true;message=(await interact(message,'prime_evidence_people:'+h50+':0')).message;assert.deepEqual(message.components,[]);
console.log('Simple participants: one-click search matches, no duplicated menus, team preserved across searches/pages, optional removal, fresh police-only roles, legacy compatibility and forged selections blocked: PASS');
