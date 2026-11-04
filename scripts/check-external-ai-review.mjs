import assert from 'node:assert/strict';
import {externalAiReview,normalizeExternalResult} from '../supabase/functions/prime-police-panel/external-ai-review.ts';
import {applicationScopeAllowed} from '../supabase/functions/prime-police-panel/application-permissions.ts';
import {reviewWithTruthScan,TruthScanReviewError} from '../supabase/functions/prime-police-panel/truthscan-review.ts';
const id='11111111-1111-4111-8111-111111111111',actor='222222222222222222',text='Durante una intervención policial debo preservar la seguridad y comunicar por radio mi ubicación. '.repeat(7);
let cached=null,status='reserved',calls=[],writes=[],providerStatus=200,providerResult={results:[{score:.87,version:'multilingual',low_confidence:false,segments:[{start:0,end:40,score:.9}]}]};
const ctx={key:'private-test-key',actor,applicationsOnly:false,json:(v,status=200)=>Response.json(v,{status}),db:async(path,init={})=>{
 if(path.startsWith('police_applications?'))return[{id,full_name:'PRIVATE_NAME',discord_user_id:actor,age_ic:25,answers:{motivation:text,detention_rights:'Respuesta breve'}}];
 if(path.startsWith('police_transfer_applications?'))return[{id,reason:text}];
 if(path.startsWith('police_external_ai_reviews?')&&!init.method)return cached?[{status:'completed',result:cached}]:[];
 if(path.startsWith('rpc/')){writes.push(JSON.parse(init.body));return{state:status,lease:'33333333-3333-4333-8333-333333333333',result:cached};}
 writes.push(JSON.parse(init.body));if(writes.at(-1).status==='completed')cached=writes.at(-1).result;return[];
},fetcher:async(url,init)=>{calls.push({url,init});return Response.json(providerResult,{status:providerStatus});}};
const req=(method='GET',kind='applications')=>new Request('https://test/?kind='+kind+'&id='+id,{method});
let result=await externalAiReview(req(),ctx);assert.equal((await result.json()).eligible,1);assert.equal(calls.length,0);
result=await externalAiReview(req('POST'),ctx);let data=await result.json();assert.equal(result.status,200);assert.equal(data.result.answers[0].score,.87);assert.equal(data.skipped.length,3);assert.equal(calls.length,1);
const sent=JSON.parse(calls[0].init.body);assert.deepEqual(sent.texts,[text.trim()]);assert.equal(sent.lang,'es');assert.equal(sent.zero_retention,true);assert.equal(calls[0].url,'https://api.sapling.ai/api/v1/aidetect');assert.equal(calls[0].init.headers.Authorization,'Bearer private-test-key');assert(!JSON.stringify(sent).includes('PRIVATE_NAME'));assert(!JSON.stringify(sent).includes(actor));assert(!JSON.stringify(data).includes('private-test-key'));
await externalAiReview(req('POST'),ctx);assert.equal(calls.length,1,'Cached results must not be billed twice');
cached=null;assert.equal((await externalAiReview(req('POST'),{...ctx,key:''})).status,503);assert.equal(calls.length,1);
for(const s of ['busy','quota']){status=s;const r=await externalAiReview(req('POST'),ctx);assert.equal(r.status,s==='quota'?429:409);assert.equal(calls.length,1);}status='reserved';
for(const code of [402,401,429,500]){providerStatus=code;const r=await externalAiReview(req('POST'),ctx);assert.equal(r.status,503);assert.equal(writes.at(-1).status,'failed');}providerStatus=200;
providerResult={results:[{score:1.5}]};assert.equal((await externalAiReview(req('POST'),ctx)).status,503);assert.equal(writes.at(-1).status,'failed');providerResult={results:[{score:.6}]};
assert.equal((await externalAiReview(req('POST','transfers'),{...ctx,applicationsOnly:true})).status,403);
const blocked=await externalAiReview(req('POST'),{...ctx,fetcher:async url=>url.endsWith('/account/status')?Response.json({api_access:false,blocked_reason:'subscription_expired',message:'MUST_NOT_EXPOSE_PROVIDER_RAW_MESSAGE'}):Response.json({msg:'Blocked'},{status:402})});
const blockedBody=await blocked.json();assert.equal(blocked.status,503);assert(blockedBody.error.includes('acceso de API no está activo'));assert(!JSON.stringify(blockedBody).includes('MUST_NOT_EXPOSE'));
assert(writes.every(w=>!('status' in w)||['processing','completed','failed'].includes(w.status)),'Detector writes must never accept or reject an application');
assert.equal((await externalAiReview(req('DELETE'),ctx)).status,405);
await externalAiReview(req('POST','transfers'),ctx);assert.equal(cached.answers[0].key,'transfer_reason');
assert(applicationScopeAllowed('external-ai-review',new URLSearchParams('kind=applications')));assert(!applicationScopeAllowed('external-ai-review',new URLSearchParams('kind=transfers')));
const normalized=normalizeExternalResult({score:.8,segments:[{start:-1,end:3,score:.8},{start:0,end:99999,score:.9},{start:0,end:3,score:.9}]},{key:'test',label:'Test',text:'Texto breve'});assert.equal(normalized.segments.length,1);assert(normalized.low_confidence);
console.log('External AI: Spanish text-only batches, private key, zero retention, validated scores/spans, saved results, quota/busy handling, provider failures and trainee scope: PASS');

const job='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';let truthCalls=[],truthPending=false,truthBalance=25000,submittedId;
const truthFetch=async(url,init)=>{
 truthCalls.push({url,init});assert.equal(init.redirect,'error');
 if(url.endsWith('/check-user-credits'))return Response.json({credits:truthBalance});
 if(url.endsWith('/detect'))return Response.json({id:job,status:'pending'});
 if(url.endsWith('/query'))return Response.json({id:job,status:truthPending?'pending':'done',result:91.18});
 throw Error('Unexpected destination');
};
const truthAnswer={key:'combined',label:'Conjunto',text,source_keys:['motivation']};
let truthResult=await reviewWithTruthScan(truthAnswer,'truth-private',truthFetch,async id=>{submittedId=id;});assert.equal(submittedId,job);assert.equal(truthResult.score,.9118);assert.equal(truthResult.segments.length,0);assert.equal(truthCalls.length,3);assert.equal(JSON.parse(truthCalls[1].init.body).text,text);assert.equal(truthCalls[0].init.headers.apikey,'truth-private');
truthCalls=[];await reviewWithTruthScan(truthAnswer,'truth-private',truthFetch,async()=>{throw Error('Must not create another job');},job);assert.equal(truthCalls.length,1);assert(truthCalls[0].url.endsWith('/query'));
truthCalls=[];truthBalance=0;await assert.rejects(()=>reviewWithTruthScan(truthAnswer,'truth-private',truthFetch),/No hay suficientes/);assert.equal(truthCalls.length,1);truthBalance=25000;
truthPending=true;await assert.rejects(()=>reviewWithTruthScan(truthAnswer,'truth-private',truthFetch,async()=>{},job,async()=>{}),e=>e instanceof TruthScanReviewError&&e.jobId===job);truthPending=false;
cached=null;truthCalls=[];writes=[];
result=await externalAiReview(req('POST'),{...ctx,provider:'TruthScan',key:'truth-private',fetcher:truthFetch});data=await result.json();assert.equal(result.status,200);assert.equal(data.provider,'TruthScan');assert.equal(data.combined,true);assert.equal(data.result.answers[0].key,'combined');assert.deepEqual(data.result.answers[0].source_keys,['motivation','detention_rights']);const truthBody=JSON.parse(truthCalls.find(c=>c.url.endsWith('/detect')).init.body);assert(truthBody.text.includes('Respuesta breve'));assert(!truthBody.text.includes('PRIVATE_NAME'));assert(!truthBody.text.includes(actor));assert(!JSON.stringify(data).includes('truth-private'));
const truthHash=writes[0].p_hash;cached=null;writes=[];await externalAiReview(req('GET'),{...ctx,provider:'Sapling'});await externalAiReview(req('POST'),{...ctx,provider:'Sapling'});assert.notEqual(writes[0].p_hash,truthHash,'Changing providers must invalidate cached results');
console.log('TruthScan: real-score normalization, text-only aggregate, credit precheck, no fabricated spans, saved job identity, retry without duplicate submissions and provider-isolated cache: PASS');
