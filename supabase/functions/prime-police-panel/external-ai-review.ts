import {TRANSFER_QUESTIONS} from '../_shared/transfer-questions.ts';
const applicationFields={motivation:'Motivación',detention_rights:'Responsabilidad y órdenes',scene_resolution:'Mala praxis',roleplay_response:'Situaciones policiales'};
export function externalReviewAnswers(kind:string,row:any){
 const fields=kind==='applications'?applicationFields:row.answers?.questionnaire_version===1?Object.fromEntries(TRANSFER_QUESTIONS.map(q=>[q.key,q.title])):{transfer_reason:'Motivo del traslado'};
 return Object.entries(fields).map(([key,label])=>({key,label,text:String(row.answers?.[key]||(key==='transfer_reason'?row.reason:'')||'').trim().slice(0,4000)}));
}
const probability=(v:any)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1;
export function normalizeExternalResult(raw:any,answer:{key:string,label:string,text:string}){
 if(!probability(raw?.score))throw Error('Invalid detector score');
 const length=Array.from(answer.text).length;
 const segments=(Array.isArray(raw.segments)?raw.segments:[]).filter((s:any)=>Number.isInteger(s.start)&&Number.isInteger(s.end)&&s.start>=0&&s.end>s.start&&s.end<=length&&probability(s.score)).slice(0,30).map((s:any)=>({start:s.start,end:s.end,score:s.score}));
 return {key:answer.key,label:answer.label,score:raw.score,low_confidence:raw.low_confidence===true||length<500,version:typeof raw.version==='string'?raw.version.slice(0,80):null,segments};
}
type Context={db:(path:string,init?:RequestInit)=>Promise<any>,json:(v:any,status?:number)=>Response,key:string,actor:string,applicationsOnly:boolean,fetcher?:typeof fetch};
export async function externalAiReview(req:Request,c:Context){
 if(!['GET','POST'].includes(req.method))return c.json({error:'Método no permitido.'},405);
 const params=new URL(req.url).searchParams,kind=params.get('kind')||'',id=params.get('id')||'';
 if(!['applications','transfers'].includes(kind)||!/^[a-f0-9-]{36}$/i.test(id))return c.json({error:'Solicitud inválida.'},400);
 if(c.applicationsOnly&&kind!=='applications')return c.json({error:'Este apartado está reservado al personal gestor.'},403);
 const table=kind==='applications'?'police_applications':'police_transfer_applications';
 const rows=await c.db(table+'?select=id,answers'+(kind==='transfers'?',reason':'')+'&id=eq.'+id+'&limit=1');
 if(!rows?.length)return c.json({error:'La solicitud ya no existe.'},404);
 const answers=externalReviewAnswers(kind,rows[0]),eligible=answers.filter(a=>Array.from(a.text).length>=300);
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({policy:'sapling-es-v1',answers}))))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const filter='?kind=eq.'+kind+'&source_id=eq.'+id+'&text_hash=eq.'+hash;
 const old=await c.db('police_external_ai_reviews'+filter+'&select=status,result&limit=1');
 const base={ok:true,configured:!!c.key,provider:'Sapling',eligible:eligible.length,skipped:answers.filter(a=>!eligible.includes(a)).map(a=>({key:a.key,label:a.label})),minimum_characters:300};
 if(old?.[0]?.status==='completed')return c.json({...base,result:old[0].result,cached:true});
 if(req.method==='GET')return c.json({...base,processing:old?.[0]?.status==='processing'});
 if(!c.key)return c.json({error:'Falta conectar la clave privada de Sapling en el servidor.',code:'detector_not_configured'},503);
 if(!eligible.length)return c.json({...base,message:'Las respuestas son demasiado breves para este análisis. Se necesitan al menos 300 caracteres por respuesta.'});
 const reservation=await c.db('rpc/reserve_police_external_ai_review',{method:'POST',body:JSON.stringify({p_kind:kind,p_id:id,p_hash:hash,p_characters:eligible.reduce((n,a)=>n+Array.from(a.text).length,0),p_actor:c.actor})});
 if(reservation.state==='cached')return c.json({...base,result:reservation.result,cached:true});
 if(reservation.state==='quota')return c.json({error:'Se alcanzó el límite local de 40.000 caracteres del día. Podrás continuar mañana (UTC).',code:'detector_quota'},429);
 if(reservation.state!=='reserved')return c.json({error:'Ya hay un análisis en curso o un reintento reciente. Espera un minuto y consulta el resultado.',code:'detector_busy'},409);
 const save=async(status:string,result:any=null)=>c.db('police_external_ai_reviews'+filter+'&lease=eq.'+reservation.lease+'&status=eq.processing',{method:'PATCH',body:JSON.stringify({status,result,lease:null,locked_until:null,updated_at:new Date().toISOString()})});
 try{
  const response=await(c.fetcher||fetch)('https://api.sapling.ai/api/v1/aidetect',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.key},body:JSON.stringify({texts:eligible.map(a=>a.text),lang:'es',zero_retention:true,sent_scores:true}),signal:AbortSignal.timeout(25000)});
  if(!response.ok){await save('failed');return c.json({error:response.status===402?'La prueba o cuota de Sapling no permite más análisis. Revisa API Settings; no se ha cambiado la decisión.':response.status===429?'Sapling ha limitado temporalmente las consultas. Reintenta más tarde.':response.status===401||response.status===403?'Sapling ha rechazado la clave. Revisa la configuración privada del servidor.':'El detector externo no pudo completar el análisis. Reintenta más tarde.',code:'detector_unavailable'},503);}
  const raw=await response.json();if(!Array.isArray(raw.results)||raw.results.length!==eligible.length)throw Error('Invalid detector results');
  const result={provider:'Sapling',analyzed_at:new Date().toISOString(),answers:raw.results.map((r:any,n:number)=>normalizeExternalResult(r,eligible[n]))};
  await save('completed',result);return c.json({...base,result,cached:false});
 }catch{
  await save('failed').catch(()=>{});return c.json({error:'No se pudo confirmar el resultado del detector. No se ha cambiado la solicitud.',code:'detector_unavailable'},503);
 }
}
