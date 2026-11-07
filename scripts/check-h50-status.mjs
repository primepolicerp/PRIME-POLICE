import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {h50StatusCard,syncH50Status,H50_STATUS_CHANNEL_ID} from '../supabase/functions/_shared/h50-status.ts';
for(const count of [0,1,2]){
 const people=Array.from({length:count},(_,i)=>({full_name:i?'@everyone <@123>':'Ana Central',plate:'000'+i,started_at:'2000-01-01T12:00:00Z',seconds:99999}));
 const card=h50StatusCard(people),serialized=JSON.stringify(card);assert(card.embeds[0].title.includes(count+'/2'));assert(!serialized.includes('2000-01'));assert(!serialized.includes('99999'));assert(!serialized.includes('@everyone'));assert(!serialized.includes('timestamp'));assert.deepEqual(card.allowed_mentions,{parse:[]});
}
const sendCalls=[],finish=[],states=[{channel_id:H50_STATUS_CHANNEL_ID,message_id:'111111111111111111',lease:'first',revision:3,active:[{full_name:'Ana',plate:'1'}]},{channel_id:H50_STATUS_CHANNEL_ID,message_id:'111111111111111111',lease:'second',revision:4,active:[]}];
await syncH50Status(async(path,init)=>{if(path.includes('claim'))return states.shift();const body=JSON.parse(init.body);finish.push(body);return{accepted:true,dirty:finish.length===1};},async(path,init)=>{sendCalls.push({path,init});});
assert.equal(sendCalls.length,2);assert(sendCalls.every(c=>c.init.method==='PATCH'));assert.equal(sendCalls[0].path,sendCalls[1].path);assert.equal(finish[0].p_revision,3);assert.equal(finish[1].p_revision,4);
let failure;await assert.rejects(()=>syncH50Status(async(path,init)=>{if(path.includes('claim'))return{channel_id:H50_STATUS_CHANNEL_ID,message_id:'111111111111111111',lease:'error',revision:9};failure=JSON.parse(init.body);return{};},async()=>{throw Error('Discord unavailable');}));assert(failure.p_error);assert.equal(failure.p_revision,9);
let touched=false;await syncH50Status(async()=>null,async()=>{touched=true;});assert(!touched);
const db=new PGlite();try{
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create table police_personnel(discord_user_id text,full_name text,plate text,unit text,status text);grant select on police_personnel to service_role;insert into police_personnel values('111111111111111111','Ana','0001','POLICIA','active');");
 await db.exec(fs.readFileSync('supabase/migrations/20261107222947_h50_time_control.sql','utf8'));await db.exec(fs.readFileSync('supabase/migrations/20261107232020_h50_public_status.sql','utf8'));
 const claim=async()=>(await db.query('select claim_police_h50_status() as r')).rows[0].r;
 await db.exec("set role service_role;select police_h50_event('111111111111111111',true);");assert.equal(await claim(),null,'No publication until the single message is configured');await db.exec("update police_h50_status set message_id='111111111111111111' where id=1");
 const first=await claim();assert.equal(first.active.length,1);assert.equal(first.revision,1);assert.equal(await claim(),null,'Concurrent publisher cannot claim the same message');
 await db.exec("select police_h50_event('111111111111111111',false)");
 let done=(await db.query('select finish_police_h50_status($1,$2) as r',[first.lease,first.revision])).rows[0].r;assert(done.accepted&&done.dirty,'Change during delivery remains dirty');
 const second=await claim();assert.equal(second.active.length,0);assert(second.revision>first.revision);done=(await db.query('select finish_police_h50_status($1,$2) as r',[first.lease,first.revision])).rows[0].r;assert(!done.accepted,'Old lease cannot overwrite progress');
 await db.query('select finish_police_h50_status($1,$2,$3)',[second.lease,second.revision,'Error temporal']);assert.equal(await claim(),null,'Failure is queued with a retry delay');await db.exec("update police_h50_status set next_attempt_at=now()-interval '1 second'");const retry=await claim();assert(retry);await db.query('select finish_police_h50_status($1,$2)',[retry.lease,retry.revision]);assert.equal(await claim(),null);
 await db.exec('reset role;set role anon');await assert.rejects(()=>claim());await assert.rejects(()=>db.query('select * from police_h50_status'));
 console.log('H50 public status: one edited message, no durations/pings, fresh state after concurrent changes, private singleton config, dirty triggers, leased delivery and persistent retry: PASS');
}finally{await db.close();}
