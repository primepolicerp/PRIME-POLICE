import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {promotionCard,announcePromotion,isRealPromotion,PROMOTION_CHANNEL} from '../supabase/functions/prime-police-panel/promotion-announcements.ts';
import {isDivisionLeader,divisionRankName,realRankRows,sameRankTrack,realRank} from '../supabase/functions/_shared/real-ranks.ts';
const data={eventId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',userId:'222222222222222222',name:'Agente Ejemplo',plate:'0116',previousRank:'Raso en Prácticas',newRank:'Raso',approvedById:'111111111111111111',approvedByName:'Directiva de ejemplo',timestamp:'2026-11-01T12:00:00Z'};
const card=promotionCard(data);assert.equal(card.embeds[0].title,'🎖️ PRIME POLICE · Nuevo ascenso');assert(card.embeds[0].fields.some(f=>f.value.includes('0116')));assert.equal(card.embeds[0].fields.find(f=>f.name==='Aprobado por').value,data.approvedByName);assert.deepEqual(card.allowed_mentions,{parse:[],users:[data.userId]});assert(card.nonce.length<=25);assert.equal(card.enforce_nonce,true);
let calls=[],failOnce=true;
const send=async(path,init)=>{calls.push({path,init});if(init?.method!=='POST')return{guild_id:'1539970134469378068',type:0};if(failOnce){failOnce=false;throw Object.assign(Error('Connection interrupted'),{status:0});}return{id:'message'};};
assert.equal(await announcePromotion(data,send),'');assert.equal(calls.filter(c=>c.init?.method==='POST').length,2);assert.equal(calls[1].init.body,calls[2].init.body);assert(calls[1].path.includes(PROMOTION_CHANNEL));
calls=[];assert(await announcePromotion(data,async(path,init)=>{calls.push({path,init});if(init?.method!=='POST')return{guild_id:'1539970134469378068',type:0};throw Object.assign(Error('Forbidden'),{status:403});}));assert.equal(calls.length,2);
calls=[];assert(await announcePromotion(data,async(path,init)=>{calls.push({path,init});return{guild_id:'other-guild',type:0};}));assert.equal(calls.length,1);
const source=readFileSync(new URL('../supabase/functions/prime-police-panel/hr.ts',import.meta.url),'utf8');
const police='1539970134482092038',old='1539970134482092040',next='1564309793802428567',rh='1539970134519578770';
function scenario({director=true,existing=true,action='promotion',warning='',missingPolice=false,nicknameDenied=false}={}){
 const state={profileSaved:false,historySaved:false,announcements:[],roleDeletes:[],roleAdds:[],queued:false};
 const ranks=realRankRows([{role_id:old},{role_id:next},{role_id:rh}]);
 const member={roles:missingPolice?[old,rh]:[police,old,rh],nick:'Anterior',user:{username:'User'}};
 const profiles=existing?[{discord_user_id:data.userId,full_name:data.name,name_ooc:'OOC',plate:data.plate,rank_name:'Raso en Prácticas',rank_role_id:old,unit:'POLICIA',status:'active'}]:[];
 const req=new Request('https://test',{method:'POST',body:JSON.stringify({discord_user_id:data.userId,rank_role_id:next,action_type:action,reason:'Méritos comprobados',full_name:data.name,name_ooc:'OOC',plate:data.plate,unit:'POLICIA',approved_by_name:'Forged identity'})});
 const requestMembers=new WeakMap([[req,{nick:data.approvedByName}]]);
 const context=vm.createContext({isDivisionLeader,divisionRankName,Request,Response,Date,crypto,console,sameRankTrack,realRank,isRealPromotion,requestMembers,GUILD_ID:'guild',POLICE_ROLE_ID:police,EXPELLED_ROLE_ID:'expelled',VALID_UNITS:new Set(['POLICIA','UCOP','CIC']),enc:encodeURIComponent,validDiscordId:id=>/^\d{17,20}$/.test(id),json:(body,status=200)=>Response.json(body,{status}),allowed:async()=>({userId:data.approvedById,director}),isAssignableRankRole:()=>true,discordFailure:()=>null,
 queueRankAuthorization:async()=>{state.queued=true;return Response.json({pending_authorization:true});},syncPersonnelBranch:async()=>async()=>{},updatePersonnelNickname:async()=>{if(nicknameDenied)throw Object.assign(Error('Discord API 403'),{status:403});return ''},postRankAuditLog:async()=>{},
 announcePromotion:async notice=>{assert(state.profileSaved,'Publish only after the file is saved');state.announcements.push(notice);return warning;},
 discord:async(path,init)=>{if(path.endsWith('/roles')&&!init)return ranks.map(r=>({id:r.role_id,permissions:'0'}));if(init?.method==='DELETE')state.roleDeletes.push(path);if(init?.method==='PUT')state.roleAdds.push(path);return path.endsWith(data.approvedById)?{nick:data.approvedByName,user:{username:'Approver'}}:member;},
 db:async(path,init)=>{if(path.startsWith('police_rank_roles'))return ranks;if(path.startsWith('police_rank_history')){state.historySaved=true;return[{id:data.eventId}];}if(path.startsWith('police_personnel')){if(init){state.profileSaved=true;return[{discord_user_id:data.userId}];}return profiles;}throw Error(path);}});
 vm.runInContext(stripTypeScriptTypes(source.slice(source.indexOf('async function registerPersonnel('),source.indexOf('async function rankConfig(')))+stripTypeScriptTypes(source.slice(source.indexOf('async function changeRank('),source.indexOf('export async function handleHr('))),context);
 return{state,req,context};
}
let s=scenario();let response=await s.context.changeRank(s.req);assert.equal(response.status,200);assert.equal(s.state.announcements.length,1);assert(s.state.historySaved);assert.equal(s.state.announcements[0].approvedByName,data.approvedByName);assert.equal(s.state.announcements[0].eventId,data.eventId);assert(!s.state.roleDeletes.some(path=>path.endsWith(rh)));
s=scenario({warning:'Announcement unavailable'});response=await s.context.changeRank(s.req);assert.equal(response.status,200);assert.equal((await response.json()).warning,'Announcement unavailable');
s=scenario({director:false});response=await s.context.changeRank(s.req);assert(s.state.queued);assert.equal(s.state.announcements.length,0);
s=scenario();response=await s.context.registerPersonnel(s.req);assert.equal(response.status,200);assert.equal(s.state.announcements.length,1);assert(s.state.historySaved);assert.equal(s.state.announcements[0].approvedByName,data.approvedByName);
s=scenario({existing:false});response=await s.context.registerPersonnel(s.req);assert.equal(response.status,200);assert.equal(s.state.announcements.length,0);
console.log('Promotion announcements: safe public fields, stable retries, no false save failure, both write routes and no pending/initial notifications: PASS');


s=scenario({missingPolice:true});response=await s.context.registerPersonnel(s.req);assert.equal(response.status,200);assert(s.state.profileSaved);assert(s.state.roleAdds.some(path=>path.endsWith('/roles/'+police)));console.log('Active personnel registration ensures the mandatory Police role: PASS');

for(const method of ['registerPersonnel','changeRank']){s=scenario({nicknameDenied:true});response=await s.context[method](s.req);assert.equal(response.status,200);const body=await response.json();assert(s.state.profileSaved);assert(s.state.historySaved);assert(body.warning.includes('apodo'));assert(body.message.includes('pendiente'));assert.equal(s.state.roleDeletes.filter(p=>p.endsWith(next)).length,0);}
s=scenario({director:false,nicknameDenied:true,action:'demotion'});response=await s.context.registerPersonnel(s.req);assert(s.state.queued);
console.log('Director file/rank writes survive a forbidden nickname with an explicit warning and saved history: PASS');
