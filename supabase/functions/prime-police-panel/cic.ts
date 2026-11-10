export const CIC_ROLE='1539970134519578772';
export const CIC_DIRECTORS=['1539970134565982313','1539970134544748562','1539970134519578774'];
export function cicPermissions(roles:string[],trainees:string[]=['1564308664557506691']){
 const director=roles.some(r=>CIC_DIRECTORS.includes(r));
 return {director,allowed:director||(roles.includes(CIC_ROLE)&&!roles.some(r=>trainees.includes(r)))};
}
const KINDS=['band','person','point','request','bracelet'],ENTRIES=['note','person','point','vehicle','evidence'];
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const text=(v:unknown,max:number,min=0)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max;
const discordMessage=(v:string)=>/^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/channels\/1539970134469378068\/[0-9]{17,20}\/[0-9]{17,20}$/.test(v);
type Context={db:(path:string,init?:RequestInit)=>Promise<any>,json:(v:unknown,status?:number)=>Response,actor:string,actorName:string,allowed:boolean,director:boolean};
export async function cicRoute(req:Request,action:string,c:Context){
 if(!c.allowed)return c.json({error:'Investigación está reservada a CIC sin pasantes y a Directiva.',code:'cic_scope'},403);
 if(action==='cic-records'&&req.method==='GET'){
  const p=new URL(req.url).searchParams,kind=p.get('kind')||'band',status=p.get('status')||'',search=(p.get('q')||'').trim(),id=p.get('id'),entry=p.get('entry_kind')||'note',raw=p.get('offset')||'0',offset=Number(raw);
  if(!KINDS.includes(kind)||!['','open','review','closed'].includes(status)||search.length>100||(id&&!uuid(id))||![...ENTRIES,'activity'].includes(entry)||!/^\d+$/.test(raw)||!Number.isSafeInteger(offset)||offset>100000)return c.json({error:'Filtros de investigación inválidos.'},400);
  const result=await c.db('rpc/police_cic_read',{method:'POST',body:JSON.stringify({p_kind:kind,p_status:status,p_search:search,p_id:id,p_entry_kind:entry,p_offset:offset})});
  return c.json(result,result.ok?200:404);
 }
 if(action!=='cic-save'||req.method!=='POST')return c.json({error:'Método no permitido.'},405);
 let b:any;try{b=await req.json();}catch{return c.json({error:'Formulario inválido.'},400);}
 const op=String(b?.operation||'');
 if(!['create','edit','entry','review','close','reopen'].includes(op))return c.json({error:'Operación inválida.'},400);
 if(['close','reopen'].includes(op)&&!c.director)return c.json({error:'Solo Directiva puede cerrar o reabrir expedientes.'},403);
 const payload:any={};
 if(op!=='create'){
  if(!uuid(b.id)||!Number.isSafeInteger(b.version)||b.version<1)return c.json({error:'Actualiza el expediente antes de guardar.'},400);
  payload.id=b.id;payload.version=b.version;
 }
 if(op==='create'||op==='edit'){
  if(!text(b.title,120,3)||!text(b.assignee_name,120,3)||!text(b.summary??'',6000)||!text(b.next_action??'',2000)||!text(b.location??'',200)||(op==='create'&&!KINDS.includes(b.kind)))return c.json({error:'Completa nombre y responsable; revisa la longitud de los textos.'},400);
  for(const k of ['title','assignee_name','summary','next_action','location'])payload[k]=String(b[k]||'').trim();
  if(op==='create')payload.kind=b.kind;
 }
 if(op==='entry'){
  if(!ENTRIES.includes(b.kind)||!text(b.title,200,3)||!text(b.details??'',6000)||!['pending','observed','confirmed'].includes(b.certainty||'pending')||!text(b.source_url??'',500))return c.json({error:'Completa el título y los datos de la anotación.'},400);
  const link=String(b.source_url||'').trim();
  if((b.kind==='evidence'&&!discordMessage(link))||(link&&!discordMessage(link)))return c.json({error:'Usa el enlace al mensaje de Discord de este servidor. Las fotografías permanecen en Discord.'},400);
  Object.assign(payload,{kind:b.kind,title:b.title.trim(),details:String(b.details||'').trim(),certainty:b.certainty||'pending',source_url:link});
 }
 const result=await c.db('rpc/police_cic_write',{method:'POST',body:JSON.stringify({p_action:op,p_payload:payload,p_actor:c.actor,p_name:c.actorName,p_director:c.director})});
 if(!result.ok)return c.json({error:({conflict:'El expediente cambió. Actualiza antes de volver a guardar.',closed:'El expediente está cerrado.',forbidden:'Solo Directiva puede realizar esta acción.',not_found:'El expediente no existe.',invalid_state:'El estado del expediente ha cambiado.'} as Record<string,string>)[result.code]||'No se pudo guardar el cambio.',code:result.code},result.code==='forbidden'?403:result.code==='not_found'?404:409);
 return c.json(result);
}
