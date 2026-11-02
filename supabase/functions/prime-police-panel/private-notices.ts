import {discordRequest} from './discord-client.ts';
import {durableNotice,jobsDb} from './discord-jobs.ts';
export async function deliverPrivateNotice(data:any,send=discordRequest,db=jobsDb){
 try{
  if(!/^\d{17,20}$/.test(data.userId)||!['police_applications','police_transfer_applications'].includes(data.source?.table)||!/^[a-f0-9-]{36}$/i.test(data.source?.id||''))throw Error('Invalid private notice');
  const current=await db(data.source.table+'?select=status,reviewed_at,created_at,discord_user_id&id=eq.'+data.source.id+'&limit=1');
  if(!current?.length||current[0].status!==data.source.status||Date.parse(current[0].reviewed_at)!==Date.parse(data.source.reviewed_at))return '__superseded__';
  if(current[0].created_at){const newer=await db(data.source.table+'?select=id&discord_user_id=eq.'+data.userId+'&created_at=gt.'+encodeURIComponent(current[0].created_at)+'&limit=1');if(newer?.length)return '__superseded__';}
  const signal=AbortSignal.timeout(8000),channel=await send('/users/@me/channels',{method:'POST',body:JSON.stringify({recipient_id:data.userId}),signal});
  const nonce='d'+[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data.eventId)))].map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,24);
  await send('/channels/'+channel.id+'/messages',{method:'POST',body:JSON.stringify({...data.payload,nonce,enforce_nonce:true,allowed_mentions:{parse:[]}}),signal});return '';
 }catch(error){console.error('Private notice:',String(error));return 'No se pudo enviar el mensaje privado. Comprueba que la persona permita mensajes directos.';}
}
export function queuePrivateNotice(data:any){return durableNotice('dm',data,()=>deliverPrivateNotice(data));}
