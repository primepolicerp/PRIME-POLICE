import {deliverPrivateNotice} from '../prime-police-panel/private-notices.ts';
import {deliverShiftReminder} from '../prime-police-panel/shift-reminders.ts';
import {jobsDb,deliverClaimedNotice} from '../prime-police-panel/discord-jobs.ts';
import {deliverPromotion} from '../prime-police-panel/promotion-announcements.ts';
import {deliverDeparture} from '../prime-police-panel/departure-announcements.ts';
import {discordRequest} from '../prime-police-panel/discord-client.ts';
import {deliverWeeklyReport,weeklyReportCard,weeklyReportChannelCheck} from '../prime-police-panel/weekly-reports.ts';
const digest=async(value:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');
Deno.serve(async req=>{
 const secret=Deno.env.get('POLICE_NOTIFICATIONS_KEY')||'';
 if(req.method!=='POST'||!secret||await digest(req.headers.get('authorization')||'')!==await digest('Bearer '+secret))return Response.json({error:'Unauthorized'},{status:403});
 try{
  const body=await req.json().catch(()=>({}));
  if(body.operation==='weekly-preview'){
   const channel=await weeklyReportChannelCheck(),period=await jobsDb('rpc/police_weekly_period',{method:'POST',body:JSON.stringify({p_at:new Date().toISOString()})}),report=await jobsDb('rpc/build_police_weekly_report',{method:'POST',body:JSON.stringify({p_start:period.week_start})});
   return Response.json({ok:true,channel,period,card:weeklyReportCard(report)});
  }
  if(body.operation)return Response.json({error:'Unknown operation'},{status:400});
  // The existing two-minute scheduler also checks the weekly deadline, in local
  // time with DST. A unique week key makes this safe across concurrent runs.
  let weeklyId:any=null;try{weeklyId=await jobsDb('rpc/enqueue_due_police_weekly_report',{method:'POST',body:'{}'});}catch(error){console.error('Weekly report enqueue:',String(error));}
  try{await jobsDb('rpc/enqueue_due_police_shift_reminders',{method:'POST',body:'{}'});}catch(error){console.error('Shift reminder enqueue:',String(error));}
  let processed=0;const deadline=Date.now()+40000;
  while(processed<3&&Date.now()<deadline){
   const preferred=weeklyId;weeklyId=null;
   const job=(preferred?await jobsDb('rpc/claim_police_discord_job',{method:'POST',body:JSON.stringify({p_id:preferred})}):null)||await jobsDb('rpc/claim_police_discord_job',{method:'POST',body:'{}'});if(!job)break;
   let messageId:string|undefined;
   const send=async(path:string,init:RequestInit={})=>{
    if(init.method==='POST'&&path.endsWith('/messages')){
     const body=JSON.parse(String(init.body)),messages=await discordRequest(path+'?limit=100',{signal:init.signal});
     const existing=messages.find((m:any)=>m.author?.id==='1540484542354428025'&&String(m.nonce||'')===String(body.nonce));if(existing){messageId=existing.id;return existing;}
    }
    const result=await discordRequest(path,init);if(init.method==='POST'&&path.endsWith('/messages'))messageId=result?.id;return result;
   };
   await deliverClaimedNotice(job,(kind,payload)=>kind==='shift_reminder'?deliverShiftReminder(payload,send):kind==='weekly_report'?deliverWeeklyReport(payload,send):kind==='promotion'?deliverPromotion(payload,send):kind==='departure'?deliverDeparture(payload,send):kind==='dm'?deliverPrivateNotice(payload,send):Promise.resolve('Tipo de aviso no reconocido.'));
   if(messageId&&job.kind==='weekly_report')await jobsDb('police_discord_jobs?id=eq.'+job.id+'&status=eq.sent',{method:'PATCH',body:JSON.stringify({discord_message_id:messageId})});
   processed++;
  }
  return Response.json({ok:true,processed});
 }catch(error){console.error('Notification worker:',String(error));return Response.json({error:'Notification processing failed'},{status:503});}
});
