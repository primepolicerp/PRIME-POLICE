export const VETO_CHANNEL='1539970136683847855';
type VetoNotice={id:string,kind:string,userId:string,name:string,reason:string,actorName:string,actorId:string,timestamp:string};
const safe=(v:string,max=180)=>String(v||'Sin indicar').replace(/[<>]/g,'').replace(/([\\`*_~|\[\]()#])/g,'\\$1').slice(0,max);
export function vetoCard(data:VetoNotice){
 if(!/^\d{17,20}$/.test(data.userId)||!/^\d{17,20}$/.test(data.actorId)||!/^[0-9a-f-]{36}$/i.test(data.id))throw Error('Invalid veto notice');
 const origin=({applications:'Postulación',transfers:'Traslado',intakes:'Nuevo ingreso'} as Record<string,string>)[data.kind];if(!origin)throw Error('Invalid veto origin');
 return{nonce:('v'+data.kind[0]+data.id.replace(/-/g,'')).slice(0,25),enforce_nonce:true,allowed_mentions:{parse:[]},embeds:[{title:'🚫 PRIME POLICE · Veto registrado',color:0xc65e6e,description:'Esta persona tiene restringidas las nuevas solicitudes mientras conserve el rol Vetado.',fields:[{name:'Persona vetada',value:'<@'+data.userId+'>\n'+safe(data.name),inline:false},{name:'Discord ID',value:data.userId,inline:true},{name:'Origen',value:origin,inline:true},{name:'Rol aplicado',value:'Vetado',inline:true},{name:'Motivo',value:safe(data.reason,900),inline:false},{name:'Aplicado por',value:safe(data.actorName)+' · ID '+data.actorId,inline:false}],timestamp:data.timestamp,footer:{text:'PRIME POLICE · Control de reclutamiento'}}]};
}
export async function announceRecruitmentVeto(data:VetoNotice,send:(path:string,init?:RequestInit)=>Promise<any>){
 try{const signal=AbortSignal.timeout(6000),channel=await send('/channels/'+VETO_CHANNEL,{signal});if(channel.guild_id!=='1539970134469378068'||![0,5].includes(channel.type))throw Error('Invalid veto channel');await send('/channels/'+VETO_CHANNEL+'/messages',{method:'POST',body:JSON.stringify(vetoCard(data)),signal});return '';}catch{ return 'El veto y el rol están guardados, pero no se pudo publicar en el canal de vetados. Revisa los permisos del bot; no repitas el veto.';}
}
