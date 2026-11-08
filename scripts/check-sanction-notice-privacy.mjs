import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
const source=fs.readFileSync('supabase/functions/prime-police-panel/index.ts','utf8');
const handler=source.slice(source.indexOf('async function createSanction('),source.indexOf('async function deleteSanction('));
for(const type of ['warning','strike']){
 const writes=[],messages=[];
 const evidence='https://example.org/private-evidence';
 const context=vm.createContext({Response,Request,URL,Date,JSON,console,
  authorizedUser:async()=> '111111111111111111',
  json:(data,status=200)=>Response.json(data,{status}),
  GUILD_ID:'guild',POLICE_ROLE_ID:'police',EXPELLED_ROLE_ID:'expelled',WARN_ROLE_IDS:['w1','w2','w3'],STRIKE_ROLE_IDS:['s1','s2','s3'],WARNING_CHANNEL_ID:'warnings',STRIKE_CHANNEL_ID:'strikes',
  db:async(path,init={})=>{
   const body=init.body?JSON.parse(init.body):null;if(body)writes.push(body);
   if(init.method==='POST')return [{id:'sanction',...body}];
   if(path.startsWith('police_personnel?'))return [{discord_user_id:'222222222222222222'}];
   if(path.includes('select=level'))return [];
   if(path.includes('select=action_type'))return [{action_type:type,level:1}];
   return [{id:'sanction',...body}];
  },
  discord:async(path,init={})=>{
   if(path.endsWith('/messages')){messages.push(JSON.parse(init.body));return {id:'message'};}
   return {roles:['police'],user:{username:'Example'}};
  }
 });
 vm.runInContext(stripTypeScriptTypes(handler),context);
 const response=await context.createSanction(new Request('https://example.org',{method:'POST',body:JSON.stringify({discord_user_id:'222222222222222222',action_type:type,reason:'Motivo de prueba',evidence_url:evidence,target_name:'Agente',plate:'0001'})}));
 assert.equal(response.status,200);
 assert(writes.some(x=>x.evidence_url===evidence),'Evidence remains saved for the private web history');
 assert.equal(messages.length,1);
 assert(!JSON.stringify(messages).includes(evidence));
 assert(!messages[0].embeds[0].fields.some(f=>/evidencia/i.test(f.name)));
 assert(messages[0].embeds[0].fields.some(f=>f.name==='Motivo'&&f.value==='Motivo de prueba'));
}
console.log('Warning/strike: evidence saved for web history, absent from Discord, disciplinary details preserved: PASS');
