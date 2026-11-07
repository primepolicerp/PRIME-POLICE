type Context={db:(path:string,init?:RequestInit)=>Promise<any>,json:(body:any,status?:number)=>Response,canManage:boolean};
export async function h50Route(req:Request,action:string,actor:string,c:Context):Promise<Response>{
 if(action==='h50-records'){
  if(req.method!=='GET')return c.json({error:'Método no permitido.'},405);
  const p=new URL(req.url).searchParams,from=new Date(p.get('from')||''),to=new Date(p.get('to')||''),search=(p.get('search')||'').trim(),user=p.get('discord_user_id')||null,state=p.get('state')||'open',offset=Number(p.get('offset')||0);
  if(!Number.isFinite(from.getTime())||!Number.isFinite(to.getTime())||from>=to||to.getTime()-from.getTime()>366*86400000||search.length>100||(user&&!/^\d{17,20}$/.test(user))||!['open','history'].includes(state)||!Number.isSafeInteger(offset)||offset<0||offset>1000000)return c.json({error:'Revisa las fechas y filtros de H-50.'},400);
  const result=await c.db('rpc/police_h50_register',{method:'POST',body:JSON.stringify({p_from:from.toISOString(),p_to:to.toISOString(),p_search:search,p_user:user,p_state:state,p_offset:offset})});
  if(!result||!Array.isArray(result.records)||!Array.isArray(result.officers)||!result.summary||!Number.isFinite(Number(result.total)))throw Error('Invalid H50 register');
  return c.json({ok:true,...result});
 }
 if(req.method!=='POST')return c.json({error:'Método no permitido.'},405);
 if(!c.canManage)return c.json({error:'Solo Directiva y gestión UCOP autorizada pueden ajustar turnos H-50.'},403);
 let b:any;try{b=await req.json();}catch{return c.json({error:'Solicitud inválida.'},400);}
 const start=new Date(b.started_at||''),end=new Date(b.ended_at||''),expected=new Date(b.expected_started_at||''),reason=String(b.reason||'').trim();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.id||'')||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||!Number.isFinite(expected.getTime())||end<start||end.getTime()>Date.now()+60000||reason.length<3||reason.length>500)return c.json({error:'Revisa las horas y escribe un motivo de al menos 3 caracteres.'},400);
 const result=await c.db('rpc/police_h50_admin_close',{method:'POST',body:JSON.stringify({p_id:b.id,p_started:start.toISOString(),p_ended:end.toISOString(),p_expected:expected.toISOString(),p_actor:actor,p_reason:reason})});
 if(!result?.ok)return c.json({error:result?.code==='not_found'?'El registro H-50 no existe.':'El turno H-50 cambió o ya está cerrado. Actualiza la lista.'},result?.code==='not_found'?404:409);
 return c.json(result);
}
