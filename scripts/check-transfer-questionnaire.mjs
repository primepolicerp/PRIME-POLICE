import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {TRANSFER_QUESTIONS,validTransferAnswers} from '../supabase/functions/_shared/transfer-questions.ts';
import {transferIdentityModal,transferQuestionsModal,handleTransferSteps} from '../supabase/functions/prime-police-discord/transfer-steps.ts';
import {reviewSubmissionAnswers} from '../supabase/functions/prime-police-panel/application-review.ts';
const user='222222222222222222',guild='1539970134469378068',input=(id,placeholder,required=true,style=2,max=4000)=>({type:4,custom_id:id,required,style,max_length:max}),response=(type,data)=>Response.json({type,data});
const identity=(await transferIdentityModal(input,response).json()).data;assert.equal(identity.components.length,4);assert(identity.components[0].content.includes('¿Cuántos años tienes dentro del rol (IC) y fuera del rol (OOC)?'));assert.deepEqual(identity.components.slice(1).map(x=>x.component.custom_id),['full_name','age_ic','age_ooc']);
for(let step=1;step<=3;step++){
 const modal=(await transferQuestionsModal('11111111-1111-4111-8111-111111111111',step,input,response).json()).data;
 assert(modal.title.length<=45);assert(modal.custom_id.length<=100);assert(modal.components.length<=5);
 assert.equal(modal.components[0].type,10);assert(modal.components[0].content.length<=4000);
 for(const q of TRANSFER_QUESTIONS.slice((step-1)*3,step*3))assert(modal.components[0].content.includes(q.question));
 for(const label of modal.components.slice(1)){assert(label.label.length<=45);assert(label.component.required);assert.equal(label.component.max_length,4000);}
}
let tasks=[],draft=null,edits=[],submissions=[],writes=0;
globalThis.EdgeRuntime={waitUntil:p=>tasks.push(p)};
const c={input,response,ephemeral:content=>response(4,{content,flags:64}),values:i=>i.answers,edit:async(i,p)=>edits.push(p),process:async(i,u,name,a)=>{submissions.push(a);return{ok:true};},db:async(path,init={})=>{
 if(!init.method){assert(path.includes('discord_user_id=eq.'+user));assert(path.includes('consumed_at=is.null'));assert(path.includes('expires_at=gt.'));return draft&&!draft.consumed_at?[draft]:[];}
 writes++;const body=JSON.parse(init.body);if(init.method==='POST'){draft=body;return [];}
 if(path.includes('&step=eq.')&&Number(path.match(/step=eq\.(\d)/)[1])!==draft.step)return[];draft={...draft,...body};return[draft];
}};
const interaction=(type,id,answers={})=>({type,guild_id:guild,data:{custom_id:id},answers});
const call=async i=>{const res=await handleTransferSteps(i,user,'Cuenta',c);await Promise.all(tasks);tasks=[];return res&&await res.json();};
assert.equal((await call(interaction(5,'prime_transfer_identity',{full_name:'Nombre 25',age_ic:'25',age_ooc:'18'}))).type,4);assert.equal(writes,0);
assert.equal((await call(interaction(5,'prime_transfer_identity',{full_name:'Nombre Apellido',age_ic:'0',age_ooc:'18'}))).type,4);assert.equal(writes,0);
await call(interaction(5,'prime_transfer_identity',{full_name:'Nombre Apellido',age_ic:'25',age_ooc:'18'}));assert.equal(draft.step,1);assert.equal(submissions.length,0);const draftId=draft.id;
assert.equal((await call({...interaction(3,'prime_transfer_continue:'+draftId),guild_id:'other'})).type,4);
assert.equal((await call(interaction(3,'prime_transfer_continue:bad'))).type,4);
for(let step=1;step<=3;step++){
 assert.equal((await call(interaction(3,'prime_transfer_continue:'+draftId))).type,9);
 const values=Object.fromEntries(TRANSFER_QUESTIONS.slice((step-1)*3,step*3).map(q=>[q.key,'Respuesta '+q.number]));
 assert.equal((await call(interaction(5,'prime_transfer_answers:'+step+':'+draftId,{}))).type,4);
 await call(interaction(5,'prime_transfer_answers:'+step+':'+draftId,values));
 if(step<3){assert.equal(draft.step,step+1);assert.equal(submissions.length,0);
  await call(interaction(5,'prime_transfer_answers:'+step+':'+draftId,values));assert.equal(draft.step,step+1);assert.equal(submissions.length,0);
 }
}
assert.equal(submissions.length,1);assert(validTransferAnswers(submissions[0]));assert.equal(submissions[0].full_name,'Nombre Apellido');assert.equal(submissions[0].age_ic,25);assert.equal(submissions[0].age_ooc,18);assert.equal(submissions[0].submission_id,draftId);assert(draft.consumed_at);assert.deepEqual(draft.payload,{});
assert.equal((await call(interaction(3,'prime_transfer_continue:'+draftId))).type,4);
// Execute the real final persistence path, retaining legacy already-open forms.
const source=readFileSync('supabase/functions/prime-police-discord/index.ts','utf8');let saved=[],replies=[],pending=false,veto=false;
const context=vm.createContext({TRANSFER_QUESTIONS,validTransferAnswers,isRecruitmentVetoed:async()=>veto,discord:async()=>({roles:[]}),RECRUITMENT_VETO_MESSAGE:'Vetado',editInteractionReply:async(i,m)=>replies.push(m),db:async(path,init={})=>{if(init.method==='POST'){const row=JSON.parse(init.body);saved.push(row);return[{...row,id:row.id||draftId}];}return pending?[{id:draftId}]:[];}});
vm.runInContext(stripTypeScriptTypes(source.slice(source.indexOf('async function processTransferSubmit('),source.indexOf('async function processRankRequest('))),context);
assert.equal((await context.processTransferSubmit({},user,'Cuenta',submissions[0])).ok,true);assert.equal(saved.length,1);for(const q of TRANSFER_QUESTIONS)assert.equal(saved[0].answers[q.key],submissions[0][q.key]);assert.equal(saved[0].age_ic,25);assert.equal(saved[0].age_ooc,18);assert.equal(saved[0].id,draftId);
await context.processTransferSubmit({},user,'Cuenta',{...submissions[0],contribution:''});assert.equal(saved.length,1);
pending=true;await context.processTransferSubmit({},user,'Cuenta',submissions[0]);assert.equal(saved.length,1);pending=false;
veto=true;await context.processTransferSubmit({},user,'Cuenta',submissions[0]);assert.equal(saved.length,1);veto=false;
assert.equal((await context.processTransferSubmit({},user,'Cuenta',{full_name:'Nombre Antiguo',age_ic:'25',age_ooc:'18',source_current_data:'Ciudad | Policia | Cabo',transfer_reason:'Traslado por cambio de ciudad'})).ok,true);assert.equal(saved.length,2);assert.equal(saved[1].current_rank,'Cabo');assert.equal(saved[1].answers,undefined);
for(const q of TRANSFER_QUESTIONS)assert(reviewSubmissionAnswers('transfers',{id:'one',discord_user_id:user,answers:{[q.key]:'ChatGPT: respuesta de ejemplo'}},[]).flags.some(f=>f.question===q.title));
console.log('Transfer questionnaire: all ten topics, separate ages, Discord limits, private four-step completion, expiry/owner filters, stale-step rejection, full persistence, veto/duplicate protections and legacy forms: PASS');
