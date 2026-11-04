import assert from 'node:assert/strict';
import {preparePlate} from '../supabase/functions/prime-police-panel/plates.ts';
const body={operation_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',discord_user_id:'1565376503393550557',full_name:'Agente de prueba',plate:'0175',approved_by_name:'Entrevistador',interview_confirmed:true},calls=[];
const request=b=>new Request('https://test/?panel=preselection-admit',{method:'POST',body:JSON.stringify(b)}),db=async(path,init)=>{calls.push({path,body:JSON.parse(init.body)});return{ok:true,plate:'0175'};},authorize=async()=> '111111111111111111';
for(const action of ['preselection-admit','transfer-admit'])for(const auto_plate of [false,true]){
 const result=await preparePlate(request({...body,auto_plate}),action,db,authorize);assert(result instanceof Request);const forwarded=await result.json();assert.equal(forwarded.plate,'0175');assert.equal(forwarded.steam_username,undefined);assert.equal(calls.at(-1).body.p_manual,auto_plate?null:'0175');assert.equal(forwarded.approved_by_name,'Entrevistador');
}
for(const patch of [{approved_by_name:''},{interview_confirmed:false},{full_name:''}]){const before=calls.length,result=await preparePlate(request({...body,...patch}), 'preselection-admit',db,authorize);assert.equal(result.status,400);assert.equal(calls.length,before);}
assert.equal((await preparePlate(request(body),'preselection-admit',db,async()=>null)).status,403);
const result=await preparePlate(request({...body,record_action:'update'}),'personnel-register',db,authorize);assert(result instanceof Request);
console.log('Admission fields: preselection/transfer manual and automatic plates accept absent Steam; interviewer, interview confirmation, name and authorization remain required: PASS');
