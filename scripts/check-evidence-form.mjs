import assert from 'node:assert/strict';
import {evidenceForm,evidenceSearchModal,evidenceSubmission,recentPastedPhoto,handleEvidenceInteraction} from '../supabase/functions/prime-police-discord/evidence.ts';
const actor='111111111111111111',responsible='222222222222222222',guild='1539970134469378068',role='1539970134482092038',photoId='333333333333333333';
const person={discord_user_id:responsible,full_name:'Pedro Martinez',plate:'0002',discord_username:'PEDRITO'},author={discord_user_id:actor,full_name:'Agente Ejemplo',plate:'0123'};
const wrap=component=>({type:18,component});
const submission=()=>({type:5,guild_id:guild,member:{roles:[role]},data:{custom_id:'prime_evidence_submit',components:[wrap({custom_id:'evidence_locker',value:'29'}),wrap({custom_id:'evidence_objects',value:'Dos objetos'}),wrap({custom_id:'evidence_h50_user',values:[responsible]}),wrap({custom_id:'evidence_photo',values:[photoId]})],resolved:{attachments:{[photoId]:{id:photoId,content_type:'image/png',size:100,url:'https://cdn.discordapp.com/attachments/123/456/photo.png'}}}}});
const form=evidenceForm(person);assert.equal(form.components.length,5);for(const row of form.components.filter(row=>[3,4].includes(row.component?.type)))assert(row.component.required);assert.equal(form.components[3].component.type,3);assert.equal(form.components[4].component.required,false);assert.equal(form.components[4].component.min_values,0);
assert.equal(evidenceSearchModal().components[0].component.required,true);assert.equal(evidenceSubmission(submission()).h50Id,responsible);
const calls=[],tasks=[];let currentRoles=[role],h50Active=true,authorActive=true,matches=[person],photoMessages=[],photoUsed=false,roster=[person],h50Roles=[role];
const c={response:(type,data)=>Response.json({type,data}),ephemeral:content=>Response.json({type:4,data:{flags:64,content}}),waitUntil:p=>tasks.push(p),reply:async(i,payload)=>calls.push({reply:payload}),discord:async(path,init)=>{calls.push({discord:path,init});return init?.method==='POST'?{id:'444444444444444444'}:path.includes('/messages?')?photoMessages:{roles:path.endsWith(responsible)?h50Roles:currentRoles};},db:async(path,init)=>{calls.push({db:path,init});if(path.startsWith('rpc/'))return matches;if(path.includes('&order=full_name.asc')){const offset=Number(path.match(/&offset=(\d+)/)[1]);return roster.slice(offset,offset+101);}if(path==='police_evidence_records')return[];if(path.startsWith('police_evidence_records?'))return photoUsed?[{id:'used'}]:[];return path.includes(actor)?authorActive?[author]:[]:h50Active?[person]:[];}};
async function run(i){calls.length=0;const response=await handleEvidenceInteraction(i,actor,c);await Promise.all(tasks.splice(0));return response?await response.json():null;}
for(const [name,mutate]of [
 ['blank locker',i=>i.data.components[0].component.value='  \n\u200B '],['blank objects',i=>i.data.components[1].component.value='\t\u2060'],
 ['missing H50',i=>i.data.components[2].component.values=[]],['invalid H50',i=>i.data.components[2].component.values=['fake']],
 ['unknown photo',i=>i.data.components[3].component.values=['unknown']],
 ['multiple photos',i=>i.data.components[3].component.values=[photoId,photoId]],['PDF',i=>i.data.resolved.attachments[photoId].content_type='application/pdf'],
 ['empty image',i=>i.data.resolved.attachments[photoId].size=0],['external image',i=>i.data.resolved.attachments[photoId].url='https://example.com/photo.png'],
 ['long locker',i=>i.data.components[0].component.value='a'.repeat(101)],['long objects',i=>i.data.components[1].component.value='a'.repeat(1501)]
 ]){const i=submission();mutate(i);assert(evidenceSubmission(i).error,name);assert.equal((await run(i)).type,4,name);assert.equal(calls.length,0,name+' must not read/write/publish');}
for(const roles of [[],[role,'1539970134482092034'],[role,'1564310246128619560']]){currentRoles=roles;await run(submission());assert(!calls.some(x=>x.init?.method==='POST'));}currentRoles=[role];
h50Active=false;await run(submission());assert(!calls.some(x=>x.init?.method==='POST'));assert(calls.some(x=>x.reply?.content.includes('ya no está')));h50Active=true;
authorActive=false;await run(submission());assert(!calls.some(x=>x.init?.method==='POST'));authorActive=true;
await run(submission());const saved=JSON.parse(calls.find(x=>x.db==='police_evidence_records').init.body);assert.equal(saved.h50,'Pedro Martinez · #0002');assert.equal(saved.h50_discord_user_id,responsible);assert.equal(saved.h50_discord_username,'PEDRITO');const notice=JSON.parse(calls.find(x=>x.discord?.includes('/messages')).init.body);assert.equal(notice.content,'Responsable H-50: <@'+responsible+'>');assert.deepEqual(notice.allowed_mentions,{parse:[],users:[responsible]});assert(!('photo_url'in saved));assert.equal(saved.discord_user_id,actor);assert.equal(saved.officer_name,author.full_name);assert(calls.find(x=>x.discord?.includes('/messages')).init.body.includes('cdn.discordapp.com'));
const search={type:5,guild_id:guild,member:{roles:[role]},data:{custom_id:'prime_evidence_h50_search',components:[wrap({custom_id:'evidence_h50_query',value:'PEDRITO'})]}};
assert.equal((await run(search)).type,5);let result=calls.find(x=>x.reply?.components)?.reply;const select=result.components[0].components[0];assert.equal(select.options[0].value,responsible);assert.equal(JSON.parse(calls.find(x=>x.db?.startsWith('rpc/')).init.body).p_search,'PEDRITO');
const withAt=structuredClone(search);withAt.data.components[0].component.value='@PEDRITO';await run(withAt);assert.equal(JSON.parse(calls.find(x=>x.db?.startsWith('rpc/')).init.body).p_search,'PEDRITO');
const justAt=structuredClone(search);justAt.data.components[0].component.value='@';assert.equal((await run(justAt)).type,4);assert.equal(calls.length,0);
const selected={type:3,guild_id:guild,member:{roles:[role]},data:{custom_id:'prime_evidence_h50_select',values:[responsible]},message:{components:result.components}};let opened=await run(selected);assert.equal(opened.type,9);assert.equal(opened.data.components[3].component.type,3);assert.equal(calls.length,0,'Opening modal must not wait for network');
matches=Array.from({length:26},()=>person);await run(search);assert(calls.some(x=>x.reply?.content.includes('demasiados')));assert(!calls.some(x=>x.reply?.components?.[0]?.components?.[0]?.type===3));
matches=[];await run(search);assert(calls.some(x=>x.reply?.content.includes('No se encontró')));
assert.equal(await run({type:3,data:{custom_id:'another_feature'}}),null);
// Clipboard route: only a fresh image posted by the author in the evidence channel and mentioning RH Police.
const pasted={id:'555555555555555555',channel_id:'1539970137455853693',author:{id:actor},mentions:[{id:'1540484542354428025'}],timestamp:new Date(Date.now()-10000).toISOString(),attachments:[submission().data.resolved.attachments[photoId]]};
assert.equal(recentPastedPhoto([pasted],actor).sourceId,pasted.id);
for(const bad of [{...pasted,author:{id:responsible}},{...pasted,mentions:[]},{...pasted,channel_id:'elsewhere'},{...pasted,timestamp:new Date(Date.now()-700000).toISOString()}])assert(recentPastedPhoto([bad],actor).error);
const noUpload=submission();noUpload.data.components[3].component.values=[];
photoMessages=[];await run(noUpload);assert(!calls.some(x=>x.init?.method==='POST'));assert(calls.some(x=>x.reply?.content.includes('Falta la foto')));
photoMessages=[pasted];await run(noUpload);const fromClipboard=JSON.parse(calls.find(x=>x.db==='police_evidence_records').init.body);assert.equal(fromClipboard.photo_message_id,pasted.id);assert(!('photo_url'in fromClipboard));assert.equal(fromClipboard.h50,'Pedro Martinez · #0002');
photoUsed=true;await run(noUpload);assert(!calls.some(x=>x.init?.method==='POST'));assert(calls.some(x=>x.reply?.content.includes('ya tiene una evidencia')));photoUsed=false;
const open={type:3,guild_id:guild,member:{roles:[role]},data:{custom_id:'prime_evidence_open'}};
const first=await run(open);assert.equal(first.type,9);assert.equal(first.data.custom_id,'prime_evidence_h50_search');assert.equal(calls.length,0);
const list={...open,data:{custom_id:'prime_evidence_h50_page:0'}};
const direct=await run(list);assert.equal(direct.type,6);assert(calls.some(x=>x.db?.includes('status=eq.active&order=')));
assert.equal(calls.find(x=>x.reply?.components)?.reply.components[0].components[0].type,3);
// Discord allows 25 options per select: expose all current agents using up to four menus.
for(const size of [1,25,26,73,91,100,101,173]){
 roster=Array.from({length:size},(_,n)=>({...person,discord_user_id:String(200000000000000000n+BigInt(n))}));
 const allIds=[];
 for(let offset=0;offset<size;offset+=100){
  await run({...open,data:{custom_id:'prime_evidence_h50_page:'+offset}});const payload=calls.find(x=>x.reply?.components)?.reply;
  const menus=payload.components.filter(row=>row.components[0].type===3).map(row=>row.components[0]),buttons=payload.components.at(-1).components;
  assert(payload.components.length<=5);assert.equal(menus.length,Math.ceil(Math.min(100,size-offset)/25));assert.equal(new Set(menus.map(x=>x.custom_id)).size,menus.length);
  for(const menu of menus){assert(menu.options.length<=25);allIds.push(...menu.options.map(x=>x.value));}
  assert.equal(buttons[0].disabled,offset===0);assert.equal(buttons[1].disabled,offset+100>=size);
  const last=menus.at(-1),choice=last.options.at(-1),interaction={type:3,guild_id:guild,member:{roles:[role]},data:{custom_id:last.custom_id,values:[choice.value]},message:{components:payload.components}};
  const chosen=await run(interaction);assert.equal(chosen.type,9);assert.equal(chosen.data.components[3].component.options[0].value,choice.value);assert.equal(calls.length,0);
 }
 assert.equal(allIds.length,size);assert.equal(new Set(allIds).size,size);assert.deepEqual(allIds,roster.map(x=>x.discord_user_id));
}
for(const id of ['prime_evidence_h50_page:-1','prime_evidence_h50_page:26','prime_evidence_h50_page:injection']){assert.equal((await run({...open,data:{custom_id:id}})).type,4);assert.equal(calls.length,0);}
for(const roles of [[],[role,'1564310246128619560'],[role,'1539970134482092034']]){h50Roles=roles;await run(submission());assert(!calls.some(x=>x.init?.method==='POST'));}h50Roles=[role];
let modalCalls=0;
const throughCallback=await handleEvidenceInteraction(selected,actor,{...c,openModal:async(i,data)=>{modalCalls++;assert.equal(data.components[3].component.type,3);assert.equal(data.components[3].component.options[0].value,responsible);return new Response(null,{status:202});}});
assert.equal(throughCallback.status,202);assert.equal(modalCalls,1);
for(const modal of [evidenceForm(person),evidenceSearchModal()]){
 assert(modal.title.length<=45);assert(modal.components.length<=5);
 for(const row of modal.components.filter(row=>row.type===18)){assert(row.label.length<=45);assert((row.description||'').length<=100);}
}
console.log('Evidence form: paginated active-roster picker, fresh active roster validation, mandatory photo by upload or recent own Discord screenshot, strict nonblank fields, no image storage, duplicate screenshot rejected: PASS');
