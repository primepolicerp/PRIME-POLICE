import {deliverPrivateNotice} from '../prime-police-panel/private-notices.ts';
import {jobsDb,deliverClaimedNotice} from '../prime-police-panel/discord-jobs.ts';
import {deliverPromotion} from '../prime-police-panel/promotion-announcements.ts';
import {deliverDeparture} from '../prime-police-panel/departure-announcements.ts';
import {discordRequest} from '../prime-police-panel/discord-client.ts';
const digest=async(value:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');
Deno.serve(async req=>{
 const secret=Deno.env.get('POLICE_NOTIFICATIONS_KEY')||'';
 if(req.method!=='POST'||!secret||await digest(req.headers.get('authorization')||'')!==await digest('Bearer '+secret))return Response.json({error:'Unauthorized'},{status:403});
 try{
  let processed=0;const deadline=Date.now()+40000;
  while(processed<3&&Date.now()<deadline){
   const job=await jobsDb('rpc/claim_police_discord_job',{method:'POST',body:'{}'});if(!job)break;
   const send=async(path:string,init:RequestInit={})=>{
    if(init.method==='POST'&&path.endsWith('/messages')){
     const body=JSON.parse(String(init.body)),messages=await discordRequest(path+'?limit=100',{signal:init.signal});
     const existing=messages.find((m:any)=>m.author?.id==='1540484542354428025'&&String(m.nonce||'')===String(body.nonce));if(existing)return existing;
    }
    return discordRequest(path,init);
   };
   await deliverClaimedNotice(job,(kind,payload)=>kind==='promotion'?deliverPromotion(payload,send):kind==='departure'?deliverDeparture(payload,send):kind==='dm'?deliverPrivateNotice(payload,send):Promise.resolve('Tipo de aviso no reconocido.'));
   processed++;
  }
  return Response.json({ok:true,processed});
 }catch(error){console.error('Notification worker:',String(error));return Response.json({error:'Notification processing failed'},{status:503});}
});
