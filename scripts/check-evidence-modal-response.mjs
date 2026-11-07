import assert from 'node:assert/strict';
import {openEvidenceModal} from '../supabase/functions/prime-police-discord/evidence-modal-response.ts';
import {evidenceForm} from '../supabase/functions/prime-police-discord/evidence.ts';
const i={id:'123456789012345678',token:'private-test-token'},form=evidenceForm({discord_user_id:'222222222222222222',full_name:'Test Officer',plate:'0002'},[{label:'Test Officer',value:'222222222222222222'}]);
const logs=[],info=console.info,error=console.error;
console.info=(...a)=>logs.push(a);console.error=(...a)=>logs.push(a);
try{
 let calls=0;
 const accepted=await openEvidenceModal(i,form,async(url,init)=>{calls++;assert(url.endsWith('/callback'));assert.equal(JSON.parse(init.body).type,9);assert(init.signal);return new Response(null,{status:204});});
 assert.equal(accepted.status,202);assert.equal(await accepted.text(),'');assert.equal(calls,1);
 const rejected=await openEvidenceModal(i,form,async()=>Response.json({code:50035,errors:{data:{components:{_errors:[{code:'INVALID',message:'Invalid component'}]}}}},{status:400}));
 assert.equal((await rejected.json()).type,4);assert(JSON.stringify(logs).includes('50035'));assert(!JSON.stringify(logs).includes(i.token));
 const acknowledged=await openEvidenceModal(i,form,async()=>Response.json({code:40060},{status:400}));assert.equal(acknowledged.status,202);
 calls=0;const uncertain=await openEvidenceModal(i,form,async()=>{calls++;throw Error('network');});assert.equal(uncertain.status,202);assert.equal(calls,1);
}finally{console.info=info;console.error=error;}
console.log('Evidence modal callback: acceptance, Discord validation error, private fallback, no token logging or duplicate retries: PASS');
