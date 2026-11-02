type Context={db:(path:string,init?:RequestInit)=>Promise<any>,json:(body:any,status?:number)=>Response};
export async function personnelCareer(req:Request,c:Context){
 if(req.method!=='GET')return c.json({error:'Método no permitido.'},405);
 const p=new URL(req.url).searchParams,target=p.get('discord_user_id')||'',offset=Number(p.get('offset')||0);
 if(!/^\d{17,20}$/.test(target)||!Number.isSafeInteger(offset)||offset<0)return c.json({error:'Agente o página inválidos.'},400);
 const rows=await c.db('police_personnel?select=discord_user_id,full_name,plate,rank_name,rank_role_id,status,unit,created_at,last_rank_change_at&discord_user_id=eq.'+target+'&limit=1');
 if(!rows?.length)return c.json({error:'La ficha de personal ya no existe.'},404);
 const [stats,history]=await Promise.all([
  c.db('rpc/police_personnel_career_summary',{method:'POST',body:JSON.stringify({p_user:target})}),
  c.db('police_rank_history?select=id,action_type,previous_rank_name,new_rank_name,new_role_id,reason,changed_by_name,changed_by_discord_id,created_at&discord_user_id=eq.'+target+'&order=created_at.desc,id.desc&limit=21&offset='+offset),
 ]);
 const person=rows[0],since=Date.parse(person.last_rank_change_at||'');
 return c.json({ok:true,person,stats,days_in_rank:Number.isFinite(since)?Math.max(0,Math.floor((Date.now()-since)/86400000)):null,history:history.slice(0,20),offset,next_offset:history.length>20?offset+20:null});
}
