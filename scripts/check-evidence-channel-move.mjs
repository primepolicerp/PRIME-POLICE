import assert from 'node:assert/strict';
import {moveEvidenceChannel} from './maintenance/move-evidence-channel.ts';
const source='1539970136050499672',target='1539970136050499671',guild='1539970134469378068',bot='1540484542354428025',old='111111111111111111',newId='222222222222222222',recordId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
function scenario(options={}){
 const record={id:recordId,channel_id:source,discord_message_id:old,created_at:'2026-11-06T10:00:00Z',officer_name:'Original',participants:[]},calls=[];
 const image=new Uint8Array([1,2,3]),original={author:{id:options.human?'333333333333333333':bot},content:'H50: <@444444444444444444>',embeds:[{title:'Original evidence',fields:[{name:'Autor',value:'Original'}],image:{url:'https://cdn.discordapp.com/attachments/123/456/photo.png'}}]};
 const c={db:async(path,init)=>{calls.push({path,init});if(!init)return[{...record}];if(init.method==='PATCH'){const patch=JSON.parse(init.body);assert.deepEqual(patch,{channel_id:target,discord_message_id:newId});Object.assign(record,patch);return[{...record}];}if(path==='police_audit_events'){if(options.auditFail)throw Error('Audit unavailable');return[];}throw Error(path);},discord:async(path,init)=>{
 calls.push({path,init});if(path==='/channels/'+source||path==='/channels/'+target)return{guild_id:guild,type:0};
 if(path.endsWith('/messages?limit=100'))return[];
 if(path.endsWith('/messages/'+old)&&!init)return original;
 if(init?.method==='POST'){const payload=JSON.parse(init.body.get('payload_json'));assert.deepEqual(payload.allowed_mentions,{parse:[]});assert.equal(payload.embeds[0].timestamp,record.created_at);assert.equal(payload.embeds[0].fields[0].value,'Original');assert(payload.embeds[0].image.url.startsWith('attachment://'));return{id:newId};}
 if(path.endsWith('/messages/'+newId))return{author:{id:bot},attachments:[{url:'https://cdn.discordapp.com/attachments/123/999/copy.png'}]};
 if(init?.method==='DELETE'){assert.equal(record.channel_id,target);assert(calls.some(c=>c.path==='police_audit_events'));return null;}throw Error(path);
 },download:async url=>({bytes:options.mismatch&&url.includes('copy.png')?new Uint8Array([9]):image,type:'image/png'})};return{c,calls,record};
}
let t=scenario();assert.equal((await moveEvidenceChannel(recordId,true,t.c)).status,'ready');assert(!t.calls.some(c=>c.init));
t=scenario();assert.equal((await moveEvidenceChannel(recordId,false,t.c)).status,'moved');assert.equal(t.record.created_at,'2026-11-06T10:00:00Z');assert.equal(t.record.officer_name,'Original');assert.deepEqual(t.record.participants,[]);assert(t.calls.some(c=>c.init?.method==='DELETE'));const count=t.calls.length;assert.equal((await moveEvidenceChannel(recordId,false,t.c)).status,'already_moved');assert.equal(t.calls.length,count+1);
t=scenario({mismatch:true});await assert.rejects(()=>moveEvidenceChannel(recordId,false,t.c),/differs/);assert(!t.calls.some(c=>c.init?.method==='PATCH'||c.init?.method==='DELETE'));
t=scenario({human:true});await assert.rejects(()=>moveEvidenceChannel(recordId,false,t.c),/Only existing bot/);assert(!t.calls.some(c=>c.init));
t=scenario({auditFail:true});await assert.rejects(()=>moveEvidenceChannel(recordId,false,t.c),/Audit/);assert(!t.calls.some(c=>c.init?.method==='DELETE'));
console.log('Evidence channel move: dry-run is read-only, original metadata/date preserved, image hash checked, links and audit before old-message deletion, already-moved idempotency and human messages protected: PASS');
