type Context={db:(path:string,init?:RequestInit)=>Promise<any>,json:(body:any,status?:number)=>Response,director:boolean,actorName:string,resolveAssignee:(id:string)=>Promise<string|null>};
const uuid=(s:unknown)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(s||''));
const discordId=(s:string)=>/^\d{17,20}$/.test(s);
const dossierKinds=['','rank','note','absence','sanction','movement','service','registration'];
const alertKinds=['','absence','profile','discord','task','approval','shift'];
export async function administrationRoute(req:Request,action:string,actor:string,c:Context){
 const p=new URL(req.url).searchParams,offset=Number(p.get('offset')||0);
 if(!Number.isSafeInteger(offset)||offset<0||offset>100000)return c.json({error:'Página inválida.'},400);
 const rpc=(name:string,body:any)=>c.db('rpc/'+name,{method:'POST',body:JSON.stringify(body)});
 if(action==='administrative-overview'&&req.method==='GET'){
  const kind=p.get('kind')||'';if(!alertKinds.includes(kind))return c.json({error:'Tipo de alerta inválido.'},400);
  const state=p.get('state')||'active';if(!['active','ignored'].includes(state))return c.json({error:'Estado de alerta inválido.'},400);
  return c.json({ok:true,...await rpc('police_administrative_alert_list',{p_actor:actor,p_director:c.director,p_offset:offset,p_kind:kind,p_ignored:state==='ignored'})});
 }
 if(action==='administrative-alert-ignore'&&req.method==='POST'){
  let body:any;try{body=await req.json();}catch{return c.json({error:'Alerta inválida.'},400);}
  if(typeof body.key!=='string'||! /^(absence|profile|discord|task|approval|shift):[a-z0-9-]{1,80}$/i.test(body.key)||typeof body.fingerprint!=='string'||! /^[a-f0-9]{32}$/.test(body.fingerprint)||typeof body.ignored!=='boolean')return c.json({error:'Actualiza la lista y selecciona una alerta válida.'},400);
  const result=await rpc('set_police_administrative_alert_ignored',{p_actor:actor,p_actor_name:c.actorName,p_director:c.director,p_key:body.key,p_fingerprint:body.fingerprint,p_ignore:body.ignored});
  return result?.ok?c.json({...result,message:body.ignored?'Alerta ignorada en tu cuenta. Puedes restaurarla desde Ignoradas.':'Alerta restaurada.'}):c.json({error:result?.error||'No se pudo actualizar la alerta.'},409);
 }
 if(action==='administrative-tasks'&&req.method==='GET'){
  const scope=p.get('scope')||'mine',status=p.get('status')??'open',search=(p.get('search')||'').replace(/[%_\\]/g,'').trim().slice(0,100);
  if(!['mine','team'].includes(scope)||!['','open','pending','in_progress','completed','cancelled'].includes(status))return c.json({error:'Filtro de tareas inválido.'},400);
  return c.json({ok:true,...await rpc('police_administrative_task_list',{p_actor:actor,p_director:c.director,p_scope:scope,p_status:status,p_search:search,p_offset:offset})});
 }
 if(action==='administrative-task-history'&&req.method==='GET'){
  const id=p.get('id');if(!uuid(id))return c.json({error:'Tarea inválida.'},400);
  return c.json({ok:true,versions:await c.db('police_administrative_task_versions?select=version,before_state,after_state,actor_name,created_at&task_id=eq.'+id+'&order=version.desc&limit=20')});
 }
 if(action==='personnel-dossier'&&req.method==='GET'){
  const id=p.get('discord_user_id')||'',kind=p.get('kind')||'';if(!discordId(id)||!dossierKinds.includes(kind))return c.json({error:'Expediente inválido.'},400);
  const people=await c.db('police_personnel?select=discord_user_id,full_name,plate,rank_name,unit,status&discord_user_id=eq.'+id+'&limit=1');
  if(!people?.length)return c.json({error:'La ficha ya no existe.'},404);
  return c.json({ok:true,person:people[0],...await rpc('police_personnel_dossier',{p_user:id,p_kind:kind,p_offset:offset})});
 }
 if(action==='administrative-task-save'&&req.method==='POST'){
  let body:any;try{body=await req.json();}catch{return c.json({error:'Tarea inválida.'},400);}
  const data={title:String(body.title||'').trim(),description:String(body.description||'').trim(),status:String(body.status||''),priority:String(body.priority||''),due_date:String(body.due_date||''),assigned_to:String(body.assigned_to||'').trim(),target_id:String(body.target_id||'').trim()};
  if(!uuid(body.id)||!Number.isSafeInteger(body.expected_version)||body.expected_version<0||data.title.length<3||data.title.length>160||data.description.length>2000||!['pending','in_progress','completed','cancelled'].includes(data.status)||!['normal','high','urgent'].includes(data.priority)||(data.assigned_to&&!discordId(data.assigned_to))||(data.target_id&&!discordId(data.target_id))||(data.due_date&&(!/^\d{4}-\d{2}-\d{2}$/.test(data.due_date)||!Number.isFinite(Date.parse(data.due_date))||new Date(data.due_date).toISOString().slice(0,10)!==data.due_date)))return c.json({error:'Completa título, estado, prioridad y los identificadores correctos.'},400);
  // Reject unauthorized ownership changes before looking up another account.
  const existing=body.expected_version>0?await c.db('police_administrative_tasks?select=created_by,assigned_to,assigned_name&id=eq.'+body.id+'&limit=1'):[];
  if(!c.director&&body.expected_version>0&&existing[0]?.created_by!==actor&&existing[0]?.assigned_to!==actor)return c.json({error:'No puedes modificar tareas de otros gestores.'},403);
  if(!c.director&&data.assigned_to!==(body.expected_version>0?existing[0]?.assigned_to||'':actor))return c.json({error:'Solo Directiva puede asignar o reasignar tareas a otros gestores.'},403);
  let assignedName='';
  if(data.assigned_to){
   if(existing[0]?.assigned_to===data.assigned_to)assignedName=existing[0].assigned_name;
   else{const name=await c.resolveAssignee(data.assigned_to);if(!name)return c.json({error:'El responsable debe tener acceso de gestión a la web.'},400);assignedName=name;}
  }
  if(data.target_id){const people=await c.db('police_personnel?select=discord_user_id&discord_user_id=eq.'+data.target_id+'&limit=1');if(!people?.length)return c.json({error:'No existe una ficha para el agente vinculado.'},400);}
  const result=await rpc('save_police_administrative_task',{p_id:body.id,p_expected:body.expected_version,p_data:data,p_actor:actor,p_actor_name:c.actorName,p_director:c.director,p_assigned_name:assignedName});
  return result?.ok?c.json({...result,message:result.existing?'La tarea ya estaba guardada.':'Tarea guardada. No se ha ejecutado ninguna decisión de personal.'}):c.json({error:result?.error||'No se pudo guardar la tarea.'},409);
 }
 return c.json({error:'Método no permitido.'},405);
}
