import assert from 'node:assert/strict';
import {personnelCareer} from '../supabase/functions/prime-police-panel/personnel-career.ts';
import {applicationScopeAllowed} from '../supabase/functions/prime-police-panel/application-permissions.ts';
const id='222222222222222222',calls=[],person={discord_user_id:id,full_name:'Agente de prueba',plate:'0123',rank_name:'Raso',last_rank_change_at:'2026-01-01T00:00:00Z'};
const c={json:(body,status=200)=>Response.json(body,{status}),db:async(path,init)=>{
 calls.push({path,init});if(path.startsWith('police_personnel?'))return[person];
 if(path.startsWith('rpc/')){assert.equal(JSON.parse(init.body).p_user,id);return{total:51,promotions:40,demotions:2,assignments:9,latest_id:'latest'};}
 assert(path.includes('discord_user_id=eq.'+id));assert(path.includes('limit=21&offset=20'));return Array.from({length:21},(_,n)=>({id:String(n),new_rank_name:'Rango de prueba'}));
}};
let response=await personnelCareer(new Request('https://test?discord_user_id='+id+'&offset=20'),c);assert.equal(response.status,200);let body=await response.json();assert.equal(body.history.length,20);assert.equal(body.next_offset,40);assert.equal(body.stats.total,51);assert.equal(body.stats.promotions,40);assert(body.days_in_rank>=0);
for(const query of ['discord_user_id=bad','discord_user_id='+id+'&offset=-1','discord_user_id='+id+'&offset=1.5'])assert.equal((await personnelCareer(new Request('https://test?'+query),c)).status,400);
assert.equal((await personnelCareer(new Request('https://test?discord_user_id='+id,{method:'POST'}),c)).status,405);
assert.equal((await personnelCareer(new Request('https://test?discord_user_id='+id),{...c,db:async()=>[]})).status,404);
assert(!applicationScopeAllowed('personnel-career',new URLSearchParams()));
await assert.rejects(()=>personnelCareer(new Request('https://test?discord_user_id='+id),{...c,db:async path=>path.startsWith('police_personnel?')?[person]:Promise.reject(Error('Database unavailable'))}));
console.log('Personnel career: private scoped reads, all-record statistics, bounded pagination, validated IDs/offsets and explicit data failures: PASS');
