import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('app.js','utf8');
const requestSource=source.slice(source.indexOf('async function performApiRequest('),source.indexOf('let accountProfileSequence='));
for(const status of [400,401,403,409,429,500,502,503,504]){
 let calls=0,logouts=0;
 const context=vm.createContext({token:'session',API_BASE:'https://test',URLSearchParams,AbortSignal,Event,window:{dispatchEvent(){}},showLogin(){logouts++;},fetch:async()=>{calls++;return{ok:false,status,headers:new Headers({'X-Request-ID':'ab458bf2-1c70-4719-9684-f4a29aab01f3'}),json:async()=>({error:'Supabase: migraciones, SQL, DISCORD_BOT_TOKEN. Sin permiso autorizado.'})};}});
 vm.runInContext(requestSource,context);
 await assert.rejects(()=>context.performApiRequest('approve',{},'POST','session'),error=>{
  assert.equal(error.message,'Error · Ref. ab458bf2');
  return true;
 });
 assert.equal(calls,1,'Write requests must never be retried');
 assert.equal(logouts,[401,403].includes(status)?1:0,'Existing session handling must be preserved');
}
const context=vm.createContext({token:'session',API_BASE:'https://test',URLSearchParams,AbortSignal,fetch:async()=>({ok:true,json:async()=>({ok:true}),headers:new Headers()}),window:{dispatchEvent(){}}});
vm.runInContext(requestSource,context);assert.deepEqual(await context.performApiRequest('data',{},'GET','session'),{ok:true});
console.log('Private error notices: technical details hidden for all HTTP errors, reference preserved, no write retry, session handling and successful responses preserved: PASS');
