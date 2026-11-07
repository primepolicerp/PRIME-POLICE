import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
const source=fs.readFileSync('supabase/functions/prime-police-discord/index.ts','utf8');
let otherFeatureCalls=0;
const context=vm.createContext({Response,Request,TextEncoder,Uint8Array,Date,JSON,Set,Map,console,RECRUITMENT_VETO_ROLE:'test-veto-role',Deno:{env:{get:()=>''},serve(){}},EdgeRuntime:{waitUntil(){throw Error('No background evidence work allowed');}},fetch(){throw Error('No network/write allowed');},handleApplicationSteps:async()=>null,handleTransferSteps:async()=>null,handleAbsenceInteraction:async()=>{otherFeatureCalls++;return Response.json({feature:'absence'});}});
vm.runInContext(stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm,'')),context);
for(const custom of ['prime_evidence_open','prime_evidence_submit:698630509143654541','prime_evidence_people_search:698630509143654541:0','prime_evidence_ready:698630509143654541']){
 const result=await context.handle({type:custom.includes('submit')||custom.includes('search')?5:3,data:{custom_id:custom}});const body=await result.json();assert.equal(body.type,4);assert.equal(body.data.flags,64);assert(body.data.content.includes('desactivado'));
}
assert((await (await context.handle({type:2,data:{name:'publicar_evidencias'}})).json()).data.content.includes('desactivado'));
assert.equal((await (await context.handle({type:1})).json()).type,1);
assert.equal((await (await context.handle({type:3,data:{custom_id:'prime_absence'}})).json()).feature,'absence');assert.equal(otherFeatureCalls,1);
assert(!source.includes('handleEvidenceInteraction'));assert(!source.includes('const evidencePanel='));
assert(fs.readFileSync('index.html','utf8').includes('id="evidenceView"'));assert(fs.readFileSync('evidence-ui.js','utf8').includes("request('evidence-records'"));
console.log('Discord evidence disabled: stale forms/commands blocked before any reads or writes, no automatic panel publication, other bot features and web history retained: PASS');
