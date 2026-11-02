import {writeAudit} from './audit-events.ts';
type Context={db:(path:string,init?:RequestInit)=>Promise<any>,json:(body:any,status?:number)=>Response,director:boolean,applicationsOnly:boolean};
export async function workspaceRoute(req:Request,action:string,actor:string,c:Context){
 if(action==='workspace-summary'&&req.method==='GET'){
  const [packed,administration]=await Promise.all([
   c.db('rpc/police_workspace_summary',{method:'POST',body:JSON.stringify({p_actor:actor,p_director:c.director})}),
   c.db('rpc/police_administrative_overview',{method:'POST',body:JSON.stringify({p_actor:actor,p_director:c.director,p_offset:0,p_kind:''})}).then(({tasks,alert_total})=>({tasks,alert_total})).catch(()=>null),
  ]);
  return c.json({ok:true,...packed,administration});
 }
 if(action==='workspace-search'&&req.method==='GET'){
  const q=(new URL(req.url).searchParams.get('q')||'').replace(/[^\p{L}\p{N}\s]/gu,'').trim().slice(0,80);
  if(q.length<2)return c.json({ok:true,results:[]});
  const groups=[
   {kind:'personnel',table:'police_personnel',select:'discord_user_id,discord_username,full_name,plate,rank_name,unit,status,updated_at',fields:['full_name','discord_username','discord_user_id','plate']},
   {kind:'applications',table:'police_available_applications',select:'id,discord_user_id,discord_username,full_name,status',fields:['full_name','discord_username','discord_user_id']},
   {kind:'transfers',table:'police_transfer_applications',select:'id,discord_user_id,discord_username,full_name,status',fields:['full_name','discord_username','discord_user_id']},
   {kind:'intakes',table:'police_rank_requests',select:'id,discord_user_id,discord_username,character_name,plate,status',fields:['character_name','discord_username','discord_user_id','plate']},
  ].filter(g=>!c.applicationsOnly||g.kind==='applications');
  const results=await Promise.all(groups.map(async g=>({kind:g.kind,rows:await c.db(g.table+'?select='+g.select+'&or=('+g.fields.map(f=>f+'.ilike.*'+encodeURIComponent(q)+'*').join(',')+')&limit=5')})));
  return c.json({ok:true,results:results.flatMap(g=>g.rows.map((row:any)=>({...row,kind:g.kind})))});
 }
 if(action==='sync-jobs'&&req.method==='GET'){
  const jobs=await c.db('police_discord_jobs?select=id,kind,status,attempts,last_error,created_at,sent_at,name:payload->>name,plate:payload->>plate&order=created_at.desc,id.desc&limit=30');
  return c.json({ok:true,jobs});
 }
 if(action==='sync-retry'&&req.method==='POST'){
  const body=await req.json();if(!/^[a-f0-9-]{36}$/i.test(body.id||''))return c.json({error:'Aviso inválido.'},400);
  const changed=await c.db('police_discord_jobs?id=eq.'+body.id+'&status=in.(pending,failed)',{method:'PATCH',body:JSON.stringify({status:'pending',attempts:0,next_attempt_at:new Date().toISOString(),last_error:null})});
  if(!changed?.length)return c.json({error:'El aviso ya se envió o está procesándose. Actualiza la lista.'},409);
  await writeAudit('↻ Reintento de aviso Discord',[{name:'Gestor',value:actor},{name:'Aviso',value:body.id}]);
  return c.json({ok:true,message:'Aviso en cola. Solo se reintentará la notificación; no se repetirá el cambio administrativo.'});
 }
 return c.json({error:'Acción no disponible.'},405);
}
