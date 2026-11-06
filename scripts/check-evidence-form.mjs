import assert from 'node:assert/strict';
import {evidenceForm,evidenceSearchModal,evidenceSubmission,recentPastedPhoto,handleEvidenceInteraction} from '../supabase/functions/prime-police-discord/evidence.ts';
const actor='111111111111111111',responsible='222222222222222222',guild='1539970134469378068',role='1539970134482092038',photoId='333333333333333333';
const person={discord_user_id:responsible,full_name:'Pedro Martinez',plate:'0002',discord_username:'PEDRITO'},author={discord_user_id:actor,full_name:'Agente Ejemplo',plate:'0123'};
const wrap=component=>({type:18,component});
const submission=()=>({type:5,guild_id:guild,member:{roles:[role]},data:{custom_id:'prime_evidence_submit',components:[wrap({custom_id:'evidence_locker',value:'29'}),wrap({custom_id:'evidence_objects',value:'Dos objetos'}),wrap({custom_id:'evidence_h50_user',values:[responsible]}),wrap({custom_id:'evidence_photo',values:[photoId]})],resolved:{attachments:{[photoId]:{id:photoId,content_type:'image/png',size:100,url:'https://cdn.discordapp.com/attachments/123/456/photo.png'}}}}});
const form=evidenceForm(person);assert.equal(form.components.length,5);for(const row of form.components.filter(row=>[4,5].includes(row.component?.type)))assert(row.component.required);assert.equal(form.components[3].component.type,5);assert.equal(form.components[4].component.required,false);assert.equal(form.components[4].component.min_values,0);
assert.equal(evidenceSearchModal().components[0].component.required,true);assert.equal(evidenceSubmission(submission()).h50Id,responsible);
const calls=[],tasks=[];let currentRoles=[role],h50Active=true,authorActive=true,matches=[person],photoMessages=[],photoUsed=false;
const c={response:(type,data)=>Response.json({type,data}),ephemeral:content=>Response.json({type:4,data:{flags:64,content}}),waitUntil:p=>tasks.push(p),reply:async(i,payload)=>calls.push({reply:payload}),discord:async(path,init)=>{calls.push({discord:path,init});return init?.method==='POST'?{id:'444444444444444444'}:path.includes('/messages?')?photoMessages:{roles:currentRoles};},db:async(path,init)=>{calls.push({db:path,init});if(path.startsWith('rpc/'))return matches;if(path==='police_evidence_records')return[];if(path.startsWith('police_evidence_records?'))return photoUsed?[{id:'used'}]:[];return path.includes(actor)?authorActive?[author]:[]:h50Active?[person]:[];}};
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
await run(submission());const saved=JSON.parse(calls.find(x=>x.db==='police_evidence_records').init.body);assert.equal(saved.h50,'Pedro Martinez · #0002');assert(!('photo_url'in saved));assert.equal(saved.discord_user_id,actor);assert.equal(saved.officer_name,author.full_name);assert(calls.find(x=>x.discord?.includes('/messages')).init.body.includes('cdn.discordapp.com'));
const search={type:5,guild_id:guild,member:{roles:[role]},data:{custom_id:'prime_evidence_h50_search',components:[wrap({custom_id:'evidence_h50_query',value:'PEDRITO'})]}};
assert.equal((await run(search)).type,5);let result=calls.find(x=>x.reply?.components)?.reply;const select=result.components[0].components[0];assert.equal(select.options[0].value,responsible);assert.equal(JSON.parse(calls.find(x=>x.db?.startsWith('rpc/')).init.body).p_search,'PEDRITO');
const selected={type:3,guild_id:guild,member:{roles:[role]},data:{custom_id:'prime_evidence_h50_select',values:[responsible]},message:{components:result.components}};let opened=await run(selected);assert.equal(opened.type,9);assert.equal(opened.data.components[3].component.type,5);assert.equal(calls.length,0,'Opening modal must not wait for network');
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
const direct=await run({type:3,guild_id:guild,member:{roles:[role]},data:{custom_id:'prime_evidence_open'}});assert.equal(direct.type,9);assert.equal(direct.data.custom_id,'prime_evidence_submit');assert.equal(direct.data.components[3].component.type,5);
// Production opens through Discord's validating callback, rather than the inline mock.
let modalCalls=0;
const throughCallback=await handleEvidenceInteraction({type:3,guild_id:guild,member:{roles:[role]},data:{custom_id:'prime_evidence_open'}},actor,{...c,openModal:async(i,data)=>{modalCalls++;assert.equal(data.components[3].component.type,5);return new Response(null,{status:202});}});
assert.equal(throughCallback.status,202);assert.equal(modalCalls,1);
for(const modal of [evidenceForm(),evidenceForm(person),evidenceSearchModal()]){
 assert(modal.title.length<=45);assert(modal.components.length<=5);
 for(const row of modal.components.filter(row=>row.type===18)){assert(row.label.length<=45);assert((row.description||'').length<=100);}
}
console.log('Evidence form: one-step user picker, fresh active roster validation, mandatory photo by upload or recent own Discord screenshot, strict nonblank fields, no image storage, duplicate screenshot rejected: PASS');
