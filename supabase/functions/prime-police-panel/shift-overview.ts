export async function shiftOverview(req:Request,read:(body:any)=>Promise<any>,json:(body:any,status?:number)=>Response){
 if(req.method!=='GET')return json({error:'Método no permitido.'},405);
 const p=new URL(req.url).searchParams,from=new Date(p.get('from')||''),to=new Date(p.get('to')||''),search=(p.get('search')||'').trim(),unit=p.get('unit')||null,user=p.get('discord_user_id')||null;
 if(!Number.isFinite(from.getTime())||!Number.isFinite(to.getTime())||from>=to||to.getTime()-from.getTime()>366*86400000||search.length>100||(unit&&!['POLICIA','UCOP','CIC'].includes(unit))||(user&&!/^\d{17,20}$/.test(user)))return json({error:'Filtros de bitácoras inválidos.'},400);
 const overview=await read({p_from:from.toISOString(),p_to:to.toISOString(),p_search:search,p_unit:unit,p_user:user});
 if(!overview||!Array.isArray(overview.days)||!['total','open','completed','incomplete','officers','service_seconds'].every(key=>Number.isFinite(Number(overview[key]))))throw Error('Invalid shift overview');
 return json({ok:true,overview});
}
