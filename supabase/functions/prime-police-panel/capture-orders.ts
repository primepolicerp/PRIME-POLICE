import {writeAudit} from './audit-events.ts';
const UCOP_ROLES=['1539970134519578773','1539970134519578769','1539970134519578770','1539970134544748558','1539970134544748559'];
const DIRECTORS=['1539970134565982313','1539970134544748562','1539970134519578774'];
const CIC_ROLE='1539970134519578772',CIC_TRAINEE='1564308664557506691';
export function captureOrderPermissions(roles:string[]){
 const director=roles.some(id=>DIRECTORS.includes(id));
 const ucop=roles.some(id=>UCOP_ROLES.includes(id));
 const cic=roles.includes(CIC_ROLE)&&!roles.includes(CIC_TRAINEE);
 return {canView:director||ucop||cic,canManage:director||ucop};
}
type Context={db:(path:string,init?:RequestInit)=>Promise<any>,json:(v:any,status?:number)=>Response,actorName:string,roles:string[]};
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export async function captureOrdersRoute(req:Request,actor:string,c:Context){
 const permission=captureOrderPermissions(c.roles);
 if(!permission.canView)return c.json({error:'Este apartado está reservado a CIC, UCOP y Directiva.'},403);
 if(req.method==='GET'){
  const [orders,personnel]=await Promise.all([
   c.db('police_capture_orders?select=*&order=created_at.desc&limit=500'),
   c.db('police_personnel?select=discord_user_id,full_name,plate,rank_name,status&unit=in.(POLICIA,UCOP,CIC)&status=eq.active&order=plate.asc&limit=1000')
  ]);
  return c.json({ok:true,orders:orders||[],personnel:personnel||[],can_manage:permission.canManage});
 }
 if(req.method!=='POST')return c.json({error:'Método no permitido.'},405);
 if(!permission.canManage)return c.json({error:'CIC dispone de consulta. Solo UCOP y Directiva pueden gestionar órdenes.'},403);
 let body:any;try{body=await req.json();}catch{return c.json({error:'Solicitud inválida.'},400);}
 const operation=String(body.operation||'');
 if(operation==='create'){
  const target=String(body.discord_user_id||''),date=String(body.desertion_date||''),notes=String(body.notes||'').trim();
  if(!/^\d{17,20}$/.test(target)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'})||notes.length>2000)return c.json({error:'Selecciona un agente, una fecha válida y observaciones de hasta 2000 caracteres.'},400);
  const people=await c.db('police_personnel?select=discord_user_id,full_name,plate,rank_name,status&discord_user_id=eq.'+target+'&limit=1'),person=people?.[0];
  if(!person)return c.json({error:'No se encontró la ficha de ese agente en la plantilla.'},404);
  if(person.status!=='active')return c.json({error:'El agente ya figura de baja en la plantilla. Revisa su expediente antes de emitir la orden.'},409);
  const id=crypto.randomUUID();
  try{
   const inserted=await c.db('police_capture_orders',{method:'POST',body:JSON.stringify({id,discord_user_id:target,full_name:person.full_name,plate:person.plate,last_rank:person.rank_name||'',desertion_date:date,reason:'Abandono del cuerpo sin presentar la baja correspondiente',issued_by_id:actor,issued_by_name:c.actorName,status:'active',capture_notes:notes})});
   if(!inserted?.[0]?.id)return c.json({error:'No se pudo confirmar la creación de la orden.'},502);
   await writeAudit('🔎 Orden administrativa de búsqueda y captura emitida',[{name:'Agente',value:String(person.full_name)+' · Placa '+String(person.plate)},{name:'Emitida por',value:c.actorName},{name:'Fecha de abandono',value:date},{name:'Motivo',value:'Abandono sin presentar baja'}]);
   return c.json({ok:true,order:inserted[0],message:'Orden administrativa registrada.'});
  }catch(error){if(String(error).includes('23505')||String(error).includes('duplicate'))return c.json({error:'Este agente ya tiene una orden activa.'},409);throw error;}
 }
 if(operation==='capture'||operation==='cancel'){
  const id=String(body.id||'');if(!uuid(id))return c.json({error:'Orden inválida.'},400);
  const rows=await c.db('police_capture_orders?select=*&id=eq.'+id+'&limit=1'),order=rows?.[0];
  if(!order)return c.json({error:'No se encontró la orden.'},404);
  if(order.status!=='active')return c.json({error:'La orden ya no está activa. Actualiza el listado.'},409);
  const now=new Date().toISOString(),patch=operation==='capture'?{status:'captured',capture_notes:String(body.notes||'').trim().slice(0,2000),captured_by_id:actor,captured_by_name:c.actorName,captured_at:now,updated_at:now}:{status:'cancelled',cancelled_by_id:actor,cancelled_by_name:c.actorName,cancelled_at:now,updated_at:now};
  const updated=await c.db('police_capture_orders?id=eq.'+id+'&status=eq.active',{method:'PATCH',body:JSON.stringify(patch)});
  if(!updated?.length)return c.json({error:'La orden cambió mientras la gestionabas. Actualiza el listado.'},409);
  await writeAudit(operation==='capture'?'✅ Orden administrativa cumplida':'⛔ Orden administrativa anulada',[{name:'Agente',value:order.full_name+' · Placa '+order.plate},{name:'Responsable',value:c.actorName},{name:'Observaciones',value:String(body.notes||'—')}]);
  return c.json({ok:true,order:updated[0],message:operation==='capture'?'Captura registrada.':'Orden anulada.'});
 }
 return c.json({error:'Operación no válida.'},400);
}
