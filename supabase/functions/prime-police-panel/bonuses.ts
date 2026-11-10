export function canManageBonuses(roles:string[]){return roles.some(id=>['1539970134565982313','1539970134544748562','1539970134519578774'].includes(id));}
export function validBonusPeriod(kind:string,period:string){
 if(!['weekly','monthly','special'].includes(kind)||!/^\d{4}-\d{2}-\d{2}$/.test(period)||period<'2020-01-01'||period>'2100-12-31')return false;
 const date=new Date(period+'T00:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===period&&(kind!=='weekly'||date.getUTCDay()===1)&&(kind!=='monthly'||date.getUTCDate()===1);
}
export async function bonusRoute(req:Request,action:string,actor:string,c:any){
 if(action==='bonus-records'){
  if(req.method!=='GET')return c.json({error:'Método no permitido.'},405);
  const q=new URL(req.url).searchParams,kind=q.get('kind')||'',period=q.get('period')||'',search=(q.get('search')||'').trim(),offset=Number(q.get('offset')||0),archived=q.get('archived')||'false';
  if(!validBonusPeriod(kind,period)||search.length>100||!Number.isSafeInteger(offset)||offset<0||offset>1000000||!['true','false'].includes(archived))return c.json({error:'Revisa el período.'},400);
  const result=await c.db('rpc/police_bonus_register',{method:'POST',body:JSON.stringify({p_kind:kind,p_period:period,p_search:search,p_offset:offset,p_archived:archived==='true'})});
  return c.json({...result,can_manage:c.canManage});
 }
 if(action==='bonus-history'){
  if(req.method!=='GET')return c.json({error:'Método no permitido.'},405);
  const q=new URL(req.url).searchParams,id=q.get('id')||'',offset=Number(q.get('offset')||0);
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)||!Number.isSafeInteger(offset)||offset<0||offset>1000000)return c.json({error:'Referencia inválida.'},400);
  const rows=await c.db('police_bonus_history?select=id,before_record,after_record,actor_name,created_at&bonus_id=eq.'+id+'&order=id.desc&offset='+offset+'&limit=21');
  return c.json({records:rows.slice(0,20),next_offset:rows.length>20?offset+20:null});
 }
 if(action!=='bonus-save'||req.method!=='POST')return c.json({error:'Método no permitido.'},405);
 if(!c.canManage)return c.json({error:'Solo Directiva puede registrar bonos.'},403);
 let b:any;try{b=await req.json();}catch{return c.json({error:'Solicitud inválida.'},400);}
 const user=String(b.discord_user_id||''),kind=String(b.kind||''),period=String(b.period||''),reason=String(b.reason||'').trim(),amount=b.amount,expected=b.expected_version;
 if(!/^\d{17,20}$/.test(user)||!validBonusPeriod(kind,period)||typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>9999999999.99||Math.abs(amount*100-Math.round(amount*100))>0.0001||!['pending','paid','excluded'].includes(b.status)||(b.status==='paid'&&amount<=0)||reason.length<3||reason.length>1000||!Number.isSafeInteger(expected)||expected<0)return c.json({error:'Revisa el importe, estado y motivo.'},400);
 const result=await c.db('rpc/police_bonus_save',{method:'POST',body:JSON.stringify({p_user:user,p_kind:kind,p_period:period,p_amount:amount,p_status:b.status,p_reason:reason,p_expected:expected,p_actor:actor,p_actor_name:c.actorName.slice(0,100)})});
 if(!result?.ok)return c.json({error:result?.code==='conflict'?'El bono cambió. Actualiza antes de guardar.':'No se pudo registrar el bono.'},result?.code==='conflict'?409:400);
 return c.json({ok:true,message:'Bono registrado.',record:result.record});
}
