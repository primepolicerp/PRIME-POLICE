export const H50_CHANNEL_ID='1539970136302288948';
export const h50Panel={embeds:[{title:'🎙️ PRIME POLICE · Horas de H-50',description:'Registra tu tiempo cuando estés a cargo de **central**.\n\n🟢 **Entrar en H-50** al comenzar.\n🔴 **Salir de H-50** al terminar.\n\n**Máximo 2 personas en central a la vez.**\n\nTus horas aparecerán en la web, en **Horas H-50**.',color:6593023,footer:{text:'RH Police · Control de central'}}],components:[{type:1,components:[{type:2,style:3,label:'Entrar en H-50',custom_id:'prime_h50_start'},{type:2,style:4,label:'Salir de H-50',custom_id:'prime_h50_end'}]}],allowed_mentions:{parse:[]}};
type Context={db:(path:string,init?:RequestInit)=>Promise<any>,discord:(path:string)=>Promise<any>,response:(type:number,data:any)=>Response,ephemeral:(content:string)=>Response,reply:(i:any,content:string)=>Promise<void>,waitUntil:(task:Promise<any>)=>void};
export function handleH50(i:any,userId:string,c:Context):Response|null{
 const custom=String(i.data?.custom_id||'');if(!['prime_h50_start','prime_h50_end'].includes(custom))return null;
 if(i.type!==3||i.guild_id!=='1539970134469378068'||String(i.channel_id||'')!==H50_CHANNEL_ID||!/^\d{17,20}$/.test(userId))return c.ephemeral('Usa el panel de Horas H-50 en el canal de central del servidor.');
 const start=custom==='prime_h50_start';
 c.waitUntil((async()=>{try{
  if(start){const member=await c.discord('/guilds/1539970134469378068/members/'+userId),roles=member.roles||[];if(member.user?.bot||!roles.includes('1539970134482092038')||roles.includes('1539970134482092034')||roles.includes('1564310246128619560')){await c.reply(i,'Necesitas el rol Policía activo, sin expulsión ni veto, para entrar en H-50.');return;}}
  const result=await c.db('rpc/police_h50_event',{method:'POST',body:JSON.stringify({p_user:userId,p_start:start})});
  if(result?.code==='capacity_full'){await c.reply(i,'Ya hay 2 personas en H-50. Espera a que una registre su salida para poder entrar.');return;}
  if(!result?.ok){await c.reply(i,'No se pudo registrar H-50. Comprueba que tu ficha policial esté activa.');return;}
  if(start){await c.reply(i,result.already_open?'Ya tienes un turno H-50 abierto. Pulsa Salir de H-50 cuando termines.':'🟢 Entrada en H-50 registrada. Tu tiempo en central está contando.');return;}
  if(result.no_open){await c.reply(i,'No tienes ningún turno H-50 abierto.');return;}
  const minutes=Math.floor(Math.max(0,Number(result.seconds)||0)/60);await c.reply(i,'🔴 Salida de H-50 registrada: '+Math.floor(minutes/60)+' h '+minutes%60+' min. Puedes consultar tus horas en la web.');
 }catch(error){console.error('H50 interaction:',String(error));await c.reply(i,'No se pudo confirmar el registro H-50. Revisa el apartado Horas H-50 de la web antes de repetir.');}})());
 return c.response(5,{flags:64});
}
