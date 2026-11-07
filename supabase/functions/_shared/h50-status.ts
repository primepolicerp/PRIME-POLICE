import {jobsDb} from '../prime-police-panel/discord-jobs.ts';
import {discordRequest} from '../prime-police-panel/discord-client.ts';
export const H50_STATUS_CHANNEL_ID='1568766177524719776';
export function h50StatusCard(people:any[]){
 const active=Array.isArray(people)?people.slice(0,2):[],count=active.length;
 const clean=(value:any,max:number)=>String(value||'').replace(/[@<>`*_~\[\]()\\]/g,'').trim().slice(0,max);
 return {content:'',embeds:[{title:count===2?'🔴 Central completa · 2/2':count===1?'🟢 Plaza disponible · 1/2':'⚪ Central libre · 0/2',description:count?'**En H-50:**\n'+active.map(person=>'• **'+(clean(person?.full_name,80)||'Policía')+'**'+(clean(person?.plate,20)?' · #'+clean(person.plate,20):'')).join('\n')+(count===1?'\n\nQueda una plaza disponible.':'\n\nLas dos plazas están ocupadas.'):'No hay nadie de H-50. Hay dos plazas disponibles.',color:count===2?15158332:count===1?5763719:9807270,footer:{text:'RH Police · Estado H-50'}}],allowed_mentions:{parse:[]}};
}
export async function syncH50Status(db=jobsDb,discord=discordRequest){
 // A lease shared by bot, web and scheduled worker prevents overlapping edits.
 // Only edit the configured message: retries cannot create duplicate messages.
 for(let pass=0;pass<3;pass++){
  const state=await db('rpc/claim_police_h50_status',{method:'POST',body:'{}'});if(!state)return;
  if(state.channel_id!==H50_STATUS_CHANNEL_ID||!/^\d{17,20}$/.test(state.message_id||'')||!state.lease||!Number.isSafeInteger(Number(state.revision)))throw Error('Invalid H50 status configuration');
  try{
   await discord('/channels/'+H50_STATUS_CHANNEL_ID+'/messages/'+state.message_id,{method:'PATCH',body:JSON.stringify(h50StatusCard(state.active))});
  }catch(error){await db('rpc/finish_police_h50_status',{method:'POST',body:JSON.stringify({p_lease:state.lease,p_revision:state.revision,p_error:'No se pudo actualizar el estado H-50 en Discord.'})});throw error;}
  const done=await db('rpc/finish_police_h50_status',{method:'POST',body:JSON.stringify({p_lease:state.lease,p_revision:state.revision,p_error:null})});
  if(!done?.accepted||!done.dirty)return;
 }
}
