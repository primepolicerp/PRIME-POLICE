export async function personnelRegisterList(req:Request,read:(body:any)=>Promise<any>,json:(value:any,status?:number)=>Response){
 if(req.method!=='GET')return json({error:'Método no permitido.'},405);
 const p=new URL(req.url).searchParams,status=p.get('status')||'',unit=p.get('unit')||'',sort=p.get('sort')||'plate',direction=p.get('direction')||'asc',offset=Number(p.get('offset')||0),limit=Number(p.get('limit')||25),from=p.get('plate_from')||'',to=p.get('plate_to')||'',target=p.get('discord_user_id')||'';
 if(!['','active','inactive','available','absence'].includes(status)||!['','POLICIA','UCOP','CIC'].includes(unit)||!['plate','name','rank','unit','discord','state'].includes(sort)||!['asc','desc'].includes(direction)||!Number.isSafeInteger(offset)||offset<0||offset>1000000||!Number.isSafeInteger(limit)||limit<1||limit>100||(from&&!/^\d{1,12}$/.test(from))||(to&&!/^\d{1,12}$/.test(to))||(target&&!/^\d{17,20}$/.test(target))||p.get('review'))return json({error:'Revisa los filtros y el orden del personal.'},400);
 if(from&&to&&Number(from)>Number(to))return json({error:'La placa inicial no puede ser mayor que la final.'},400);
 const body={p_status:status,p_unit:unit,p_rank:(p.get('rank')||'').slice(0,100),p_search:(p.get('search')||'').replace(/[^\p{L}\p{N}\s]/gu,'').trim().slice(0,100),p_sort:sort,p_desc:direction==='desc',p_offset:offset,p_limit:limit,p_plate_from:from?Number(from):null,p_plate_to:to?Number(to):null,p_target:target||null,p_counts:p.get('counts')==='true'};
 return json(await read(body));
}
