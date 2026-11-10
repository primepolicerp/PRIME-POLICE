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

for(const [payload,status,expected] of [[{public_error:'plate_in_use',plate:'0203'},409,'La placa 0203 ya está asignada. Elige otra.'],[{public_error:'personnel_exists'},409,'Esta persona ya tiene una ficha. Revísala en Personal.'],[{public_error:'plate_in_use',plate:'<script>SECRET</script>'},409,'Esta placa ya está asignada. Elige otra.'],[{public_error:'Supabase secret',error:'SQL password'},409,'Error'],[{public_error:'plate_in_use',plate:'0203'},500,'Error']]){
 const ctx=vm.createContext({token:'session',API_BASE:'https://test',URLSearchParams,AbortSignal,fetch:async()=>({ok:false,status,headers:new Headers({'X-Request-ID':'0830bea5-test'}),json:async()=>payload}),window:{dispatchEvent(){}}});
 vm.runInContext(requestSource,ctx);await assert.rejects(()=>ctx.performApiRequest('preselection-admit',{},'POST','session'),e=>{assert.equal(e.message,expected+' · Ref. 0830bea5');return true;});
}
console.log('Safe admission errors: curated business reasons with references; technical messages and untrusted plate text stay hidden: PASS');
for(const payload of [null,[],true,'upstream unavailable',{public_error:{toString:'invalid'}}]){
 let logouts=0;const ctx=vm.createContext({token:'session',API_BASE:'https://test',URLSearchParams,AbortSignal,showLogin(){logouts++;},fetch:async()=>({ok:false,status:401,headers:new Headers({'X-Request-ID':'0830bea5-test'}),json:async()=>payload}),window:{dispatchEvent(){}}});
 vm.runInContext(requestSource,ctx);await assert.rejects(()=>ctx.performApiRequest('me',{},'POST','session'),e=>{assert.equal(e.message,'Error · Ref. 0830bea5');return true;});assert.equal(logouts,1);
}
console.log('Malformed API responses: null/array/text payloads preserve safe references and session expiry: PASS');

for(const payload of [null,[],'unexpected success']){
 let calls=0;const ctx=vm.createContext({token:'session',API_BASE:'https://test',URLSearchParams,AbortSignal,fetch:async()=>{calls++;return{ok:true,status:200,headers:new Headers({'X-Request-ID':'0830bea5-test'}),json:async()=>payload};},window:{dispatchEvent(){}}});
 vm.runInContext(requestSource,ctx);await assert.rejects(()=>ctx.performApiRequest('save',{},'POST','session'),/Error · Ref. 0830bea5/);assert.equal(calls,1);
}
console.log('Malformed successful responses: never appear as successful empty saves and never retry a write: PASS');
