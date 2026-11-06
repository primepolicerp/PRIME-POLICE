export async function evidenceRecords(req:Request,read:(body:any)=>Promise<any>,json:(body:any,status?:number)=>Response){
 if(req.method!=='GET')return json({error:'Método no permitido.'},405);
 const p=new URL(req.url).searchParams,offset=Number(p.get('offset')||0),limit=Number(p.get('limit')||50),target=p.get('discord_user_id')||'',search=(p.get('search')||'').trim();
 if(!Number.isSafeInteger(offset)||offset<0||offset>1000000||!Number.isSafeInteger(limit)||limit<1||limit>100||(target&&!/^\d{17,20}$/.test(target))||search.length>100)return json({error:'Filtros de evidencias inválidos.'},400);
 const result=await read({p_search:search,p_user:target||null,p_offset:offset,p_limit:limit});
 if(!result||!Array.isArray(result.records)||!Array.isArray(result.officer_totals))throw Error('La consulta de evidencias no devolvió un registro válido.');
 return json(result);
}
