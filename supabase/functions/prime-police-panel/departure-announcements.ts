import {durableNotice} from './discord-jobs.ts';
import {discordRequest} from './discord-client.ts';
export const DEPARTURE_CHANNEL='1566747692065890345';
type Departure={eventId:string;userId:string;name:string;plate:string;rank:string;type:string;role?:string;date:string;approvedBy:string;timestamp:string};
const safe=(value:string)=>String(value||'Sin indicar').replace(/[\r\n\t]/g,' ').replace(/[<>]/g,'').replace(/([\\`*_~|\[\]()#])/g,'\\$1').slice(0,180);
export function departureCard(data:Departure){
 if(!/^\d{17,20}$/.test(data.userId))throw Error('Invalid departure member');
 return {nonce:('b'+data.eventId.replace(/[^a-z0-9]/gi,'')).slice(0,25),enforce_nonce:true,allowed_mentions:{parse:[]},embeds:[{
  title:'📉 PRIME POLICE · Baja de personal',color:0xd65b67,
  description:'Se ha registrado la baja del agente en la base de Personal.',
  fields:[{name:'Agente',value:'<@'+data.userId+'>\n'+safe(data.name)+' · Placa **'+safe(data.plate)+'**',inline:false},
   {name:'Último rango',value:safe(data.rank),inline:true},{name:'Motivo de baja',value:safe(data.type),inline:true},
   {name:'Rol aplicado',value:safe(data.role||'Sin rol adicional'),inline:true},{name:'Fecha de baja',value:safe(data.date),inline:true},{name:'Autorizada por',value:safe(data.approvedBy),inline:false}],
  timestamp:data.timestamp,footer:{text:'PRIME POLICE · Registro de bajas'}
 }]};
}
export async function announceDeparture(data:Departure,send=discordRequest){
 if(send===discordRequest)return durableNotice('departure',data,()=>deliverDeparture(data,send));
 return deliverDeparture(data,send);
}
export async function deliverDeparture(data:Departure,send=discordRequest){
 try{
  const signal=AbortSignal.timeout(6000);
  const channel=await send('/channels/'+DEPARTURE_CHANNEL,{method:'GET',signal});
  if(channel.guild_id!=='1539970134469378068'||![0,5].includes(channel.type))throw Error('Invalid departure channel');
  const body=JSON.stringify(departureCard(data));
  for(let attempt=0;attempt<2;attempt++)try{await send('/channels/'+DEPARTURE_CHANNEL+'/messages',{method:'POST',body,signal});return '';}
   catch(error){if(signal.aborted||attempt===1||[400,401,403,404].includes(Number((error as any)?.status||0)))throw error;}
 }catch(error){console.error('Departure announcement failed:',String(error));}
 return 'La baja está guardada, pero no se pudo confirmar el aviso en Discord. No repitas la baja; revisa el canal y los permisos del bot.';
}
