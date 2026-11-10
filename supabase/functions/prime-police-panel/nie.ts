import {NIE_CIC,NIE_POLICE} from '../_shared/nie-questions.ts';
const directors=['1539970134565982313','1539970134544748562','1539970134519578774'];
const chief='1539970134544748559',deputy='1539970134544748558',ucop='1539970134519578773';
export function canReviewNie(roles:string[],person?:any){
 if(roles.some(id=>directors.includes(id)))return true;
 if(!roles.includes(NIE_POLICE)||person?.status!=='active')return false;
 const cic=person.unit==='CIC'&&roles.includes(NIE_CIC),ucopChief=person.unit==='UCOP'&&roles.includes(ucop)&&roles.includes(chief);
 return ucopChief||(cic&&(roles.includes(chief)||roles.includes(deputy)));
}
export async function niePermission(actor:string,roles:string[],db:any){
 if(roles.some(id=>directors.includes(id)))return true;
 if(!roles.includes(NIE_POLICE)||!roles.some(id=>[chief,deputy].includes(id)))return false;
 const people=await db('police_personnel?select=status,unit&discord_user_id=eq.'+actor+'&limit=1');
 return canReviewNie(roles,people?.[0]);
}
export async function nieRoute(req:Request,action:string,actor:string,c:any){
 if(!await niePermission(actor,c.member.roles||[],c.db))return c.json({error:'Sin permiso para consultar postulaciones NIE · CIC.'},403);
 if(action==='nie-records'){
  if(req.method!=='GET')return c.json({error:'Método no permitido.'},405);
  const params=new URL(req.url).searchParams,id=params.get('id')||'',status=params.get('status')||'pending',offset=Number(params.get('offset')||0);
  if(id){
   if(!/^[a-f0-9-]{36}$/i.test(id))return c.json({error:'Referencia inválida.'},400);
   const rows=await c.db('police_nie_applications?select=*&id=eq.'+id+'&limit=1');
   return rows?.[0]?c.json({application:rows[0]}):c.json({error:'Postulación no encontrada.'},404);
  }
  if(!['pending','approved','rejected'].includes(status)||!Number.isSafeInteger(offset)||offset<0||offset>1000000)return c.json({error:'Filtros inválidos.'},400);
  const rows=await c.db('police_nie_applications?select=id,discord_user_id,discord_username,full_name,current_rank,personnel_name,personnel_plate,status,created_at,updated_at&status=eq.'+status+'&order=created_at.desc,id.desc&offset='+offset+'&limit=31');
  return c.json({records:rows.slice(0,30),next_offset:rows.length>30?offset+30:null});
 }
 if(action!=='nie-review'||req.method!=='POST')return c.json({error:'Método no permitido.'},405);
 let body:any;try{body=await req.json();}catch{return c.json({error:'Solicitud inválida.'},400);}
 const id=String(body.id||''),decision=String(body.decision||''),reason=String(body.reason||'').trim(),expected=String(body.expected_updated_at||'');
 if(!/^[a-f0-9-]{36}$/i.test(id)||!['approved','rejected'].includes(decision)||reason.length<3||reason.length>2000||!Number.isFinite(Date.parse(expected)))return c.json({error:'Revisa la decisión y su motivo.'},400);
 const rows=await c.db('police_nie_applications?select=id,discord_user_id,status,updated_at&id=eq.'+id+'&limit=1'),app=rows?.[0];
 if(!app)return c.json({error:'Postulación no encontrada.'},404);
 if(app.discord_user_id===actor)return c.json({error:'Otro responsable debe revisar tu postulación.'},403);
 if(app.status!=='pending'||app.updated_at!==expected)return c.json({error:'Esta postulación cambió o ya fue revisada. Actualiza la lista.'},409);
 const now=new Date().toISOString(),member=c.member;
 const saved=await c.db('police_nie_applications?id=eq.'+id+'&status=eq.pending&updated_at=eq.'+encodeURIComponent(expected),{method:'PATCH',body:JSON.stringify({status:decision,review_reason:reason,reviewed_at:now,updated_at:now,reviewed_by:actor,reviewed_by_name:String(member.nick||member.user?.global_name||member.user?.username||actor).slice(0,100)})});
 if(!saved?.length)return c.json({error:'Otro responsable ya revisó esta postulación. Actualiza la lista.'},409);
 return c.json({ok:true,message:'Decisión guardada. No se han asignado roles ni enviado mensajes de Discord.'});
}
