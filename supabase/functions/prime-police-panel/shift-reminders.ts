import {discordRequest} from './discord-client.ts';
import {jobsDb} from './discord-jobs.ts';

export async function deliverShiftReminder(data:any,send=discordRequest,db=jobsDb){
 try{
  if(!/^[a-f0-9-]{36}$/i.test(data.shiftId||'')||!/^\d{17,20}$/.test(data.userId||''))throw Error('Invalid shift reminder');
  const stillOpen=async()=>{
   const rows=await db('police_duty_shifts?select=id,discord_user_id,started_at,ended_at&id=eq.'+data.shiftId+'&limit=1');
   const shift=rows?.[0],start=Date.parse(shift?.started_at);
   return shift&&shift.discord_user_id===data.userId&&shift.ended_at===null&&Number.isFinite(start)&&Date.now()-start>7200000?shift:null;
  };
  if(!await stillOpen())return '__superseded__';
  const signal=AbortSignal.timeout(8000);
  const channel=await send('/users/@me/channels',{method:'POST',body:JSON.stringify({recipient_id:data.userId}),signal});
  // Recheck after opening the DM, since the person may just have closed it.
  const shift=await stillOpen();if(!shift)return '__superseded__';
  const nonce='s'+[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data.shiftId)))].map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,24);
  await send('/channels/'+channel.id+'/messages',{method:'POST',signal,body:JSON.stringify({
   embeds:[{title:'⏱️ Recordatorio de bitácora abierta',description:'Tu bitácora lleva más de **2 horas abierta**. Si ya terminaste el servicio, entra en la web y ciérrala para registrar tu salida. Si sigues de servicio, puedes mantenerla abierta.',color:0xE6AD43,fields:[{name:'Inicio del servicio',value:'<t:'+Math.floor(Date.parse(shift.started_at)/1000)+':f>'}],url:'https://primepolice.link/',footer:{text:'PRIME POLICE · Control de servicio'}}],
   nonce,enforce_nonce:true,allowed_mentions:{parse:[]}
  })});return '';
 }catch(error){console.error('Shift reminder:',String(error));return 'No se pudo enviar el recordatorio de bitácora. Comprueba que la persona permita mensajes directos.';}
}
