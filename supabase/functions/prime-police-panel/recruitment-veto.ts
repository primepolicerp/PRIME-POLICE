import {RECRUITMENT_VETO_ROLE,isRecruitmentVetoed} from '../_shared/recruitment-restriction.ts';
import {announceRecruitmentVeto} from './veto-announcements.ts';
type Context={db:(path:string,init?:RequestInit)=>Promise<any>,discord:(path:string,init?:RequestInit)=>Promise<any>,json:(value:any,status?:number)=>Response,audit:(title:string,fields:any[])=>Promise<any>,actor:string,actorName:string};
export async function applyRecruitmentVeto(kind:string,body:any,record:any,c:Context){
 const table=({applications:'police_applications',transfers:'police_transfer_applications',intakes:'police_rank_requests'} as Record<string,string>)[kind],reason=String(body.reason||'').trim();
 if(!table||!['pending','rejected'].includes(record.status)||reason.length<3||reason.length>500||(body.action||body.decision)!=='reject')return c.json({error:'Indica un motivo de veto de 3 a 500 caracteres en una solicitud pendiente o rechazada.'},400);
 if(body.expected_status!==undefined&&(body.expected_status!==record.status||String(body.expected_reviewed_at||'')!==String(record.reviewed_at||'')))return c.json({error:'La solicitud cambió. Actualiza la lista antes de vetar.'},409);
 const target=String(record.discord_user_id),memberPath='/guilds/1539970134469378068/members/'+encodeURIComponent(target);
 try{
  if(!await isRecruitmentVetoed(target,c.discord))await c.discord(memberPath+'/roles/'+RECRUITMENT_VETO_ROLE,{method:'PUT',body:'{}'});
  if(!await isRecruitmentVetoed(target,c.discord))return c.json({error:'Discord no confirmó el rol Vetado. Revisa la jerarquía del bot y vuelve a intentarlo.'},502);
 }catch{return c.json({error:'No se pudo confirmar el rol Vetado. Comprueba que la persona siga en el servidor y que el bot pueda asignar ese rol.'},502);}
 if(record.vetoed_at)return c.json({ok:true,status:'rejected',message:'El veto ya estaba registrado y el rol Vetado está confirmado.'});
 const now=new Date().toISOString(),patch={status:'rejected',...(kind==='intakes'?{review_reason:reason}:{decision_reason:reason}),reviewed_at:now,reviewed_by_discord_id:c.actor,reviewed_by_name:c.actorName,vetoed_at:now,vetoed_by_discord_id:c.actor,vetoed_by_name:c.actorName};
 try{
  const saved=await c.db(table+'?id=eq.'+encodeURIComponent(record.id)+'&status=eq.'+record.status+'&vetoed_at=is.null',{method:'PATCH',body:JSON.stringify(patch)});
  if(!saved?.length)return c.json({error:'El rol Vetado quedó asignado, pero el registro cambió. Actualiza la lista y revisa la constancia antes de repetir.'},409);
 }catch{return c.json({error:'El rol Vetado está confirmado, pero falta guardar la constancia en la web. Actualiza y reintenta para completar el registro.'},502);}
 let warning='';try{await c.audit('🚫 Veto de reclutamiento',[{name:'Solicitud',value:kind+' · '+record.id},{name:'Discord ID',value:target},{name:'Aplicado por',value:c.actorName+' · '+c.actor},{name:'Motivo',value:reason}]);}catch{warning='La constancia está guardada en la solicitud; no se pudo completar el aviso de auditoría.';}
 const announcementWarning=await announceRecruitmentVeto({id:record.id,kind,userId:target,name:String(record.full_name||record.character_name||record.discord_username||target),reason,actorId:c.actor,actorName:c.actorName,timestamp:now},c.discord);warning=[warning,announcementWarning].filter(Boolean).join(' ');
 let notified=false;try{const channel=await c.discord('/users/@me/channels',{method:'POST',body:JSON.stringify({recipient_id:target})});await c.discord('/channels/'+channel.id+'/messages',{method:'POST',body:JSON.stringify({embeds:[{title:'🚫 Veto de reclutamiento · PRIME POLICE',description:'Tu solicitud ha sido rechazada con veto. No puedes presentar nuevas postulaciones, traslados ni ingresos mientras tengas el rol Vetado.\n\nMotivo: '+reason+'\n\nContacta con Directiva si necesitas una revisión.',color:0xc65e6e}],allowed_mentions:{parse:[]}})});notified=true;}catch{warning=[warning,'El rol y la constancia están guardados; no se pudo enviar el aviso por privado.'].filter(Boolean).join(' ');}
 return c.json({ok:true,status:'rejected',message:'Veto registrado. Rol Vetado confirmado; no podrá enviar nuevas solicitudes mientras lo conserve.',warning:warning||undefined,sync:{record:'saved',roles:'confirmed',notification:notified?'confirmed':'failed'}});
}
