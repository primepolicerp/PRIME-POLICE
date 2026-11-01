import {discordRequest} from './discord-client.ts';
import {realRank,sameRankTrack} from '../_shared/real-ranks.ts';

export const PROMOTION_CHANNEL='1539970135731871760';
const GUILD='1539970134469378068';
type Promotion={eventId:string;userId:string;name:string;plate:string;previousRank:string;newRank:string;approvedById:string;approvedByName:string;timestamp:string};
const safe=(value:string)=>String(value).replace(/[\r\n\t]/g,' ').replace(/[<>]/g,'').replace(/([\\`*_~|\[\]()#])/g,'\\$1').slice(0,180);
export function isRealPromotion(previous:unknown,next:unknown){return Boolean(sameRankTrack(previous,next)&&realRank(next)!.order>realRank(previous)!.order);}
export function promotionCard(data:Promotion){
 if(!/^\d{17,20}$/.test(data.userId)||!/^\d{17,20}$/.test(data.approvedById))throw Error('Invalid promotion member');
 return {content:'<@'+data.userId+'>',nonce:('p'+data.eventId.replace(/[^a-z0-9]/gi,'')).slice(0,25),enforce_nonce:true,allowed_mentions:{parse:[],users:[data.userId]},embeds:[{
  title:'🎖️ PRIME POLICE · Nuevo ascenso',color:0x4d98c9,
  description:'Un nuevo paso en tu trayectoria policial. ¡Enhorabuena por el ascenso!',
  fields:[{name:'Agente ascendido',value:safe(data.name)+' · Placa **'+safe(data.plate)+'**',inline:false},{name:'Rango anterior',value:safe(data.previousRank),inline:true},{name:'Nuevo rango',value:safe(data.newRank),inline:true},{name:'Aprobado por',value:safe(data.approvedByName),inline:false}],
  timestamp:data.timestamp,footer:{text:'PRIME POLICE · Reconocimiento de ascensos'}
 }]};
}
export async function announcePromotion(data:Promotion,send=discordRequest){
 try{
  const signal=AbortSignal.timeout(6000);
  const channel=await send('/channels/'+PROMOTION_CHANNEL,{method:'GET',signal});if(channel.guild_id!==GUILD||![0,5].includes(channel.type))throw Error('Invalid promotion channel');
  const body=JSON.stringify(promotionCard(data));
  // Reuse the nonce on an uncertain POST result so Discord can return the first message.
  for(let attempt=0;attempt<2;attempt++){
   try{await send('/channels/'+PROMOTION_CHANNEL+'/messages',{method:'POST',body,signal});return '';}
   catch(error){const status=Number((error as any)?.status||0);if(signal.aborted||attempt===1||[400,401,403,404].includes(status))throw error;}
  }
 }catch(error){console.error('Promotion announcement failed:',String(error));}
 return 'El ascenso se aplicó, pero no se pudo confirmar su anuncio en Discord. No repitas el ascenso; revisa el canal y los permisos del bot.';
}
