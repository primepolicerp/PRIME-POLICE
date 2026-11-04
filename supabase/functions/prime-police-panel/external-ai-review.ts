import {TRANSFER_QUESTIONS} from '../_shared/transfer-questions.ts';
import {reviewWithTruthScan,TruthScanReviewError} from './truthscan-review.ts';
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
type Context={db:(path:string,init?:RequestInit)=>Promise<any>,json:(v:any,status?:number)=>Response,key:string,actor:string,applicationsOnly:boolean,provider?:'TruthScan'|'Sapling',fetcher?:typeof fetch};
export async function externalAiReview(req:Request,c:Context){
 if(!['GET','POST'].includes(req.method))return c.json({error:'Método no permitido.'},405);
 const params=new URL(req.url).searchParams,kind=params.get('kind')||'',id=params.get('id')||'';
 if(!['applications','transfers'].includes(kind)||!/^[a-f0-9-]{36}$/i.test(id))return c.json({error:'Solicitud inválida.'},400);
 if(c.applicationsOnly&&kind!=='applications')return c.json({error:'Este apartado está reservado al personal gestor.'},403);
 const table=kind==='applications'?'police_applications':'police_transfer_applications';
 const rows=await c.db(table+'?select=id,answers'+(kind==='transfers'?',reason':'')+'&id=eq.'+id+'&limit=1');
 if(!rows?.length)return c.json({error:'La solicitud ya no existe.'},404);
 const provider=c.provider||'Sapling',sourceAnswers=externalReviewAnswers(kind,rows[0]);
 const combined=sourceAnswers.filter(a=>a.text).map(a=>a.text).join('\n\n');
 const answers=provider==='TruthScan'?[{key:'combined',label:'Conjunto de respuestas',source_keys:sourceAnswers.filter(a=>a.text).map(a=>a.key),text:combined.slice(0,36000)}]:sourceAnswers,eligible=answers.filter(a=>Array.from(a.text).length>=300);
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({policy:provider==='TruthScan'?'truthscan-es-v1':'sapling-es-v1',answers}))))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const filter='?kind=eq.'+kind+'&source_id=eq.'+id+'&text_hash=eq.'+hash;
 const old=await c.db('police_external_ai_reviews'+filter+'&select=status,result&limit=1');
 const base={ok:true,configured:!!c.key,provider,eligible:eligible.length,skipped:answers.filter(a=>!eligible.includes(a)).map(a=>({key:a.key,label:a.label})),minimum_characters:300,combined:provider==='TruthScan',truncated:provider==='TruthScan'&&combined.length>36000};
 if(old?.[0]?.status==='completed')return c.json({...base,result:old[0].result,cached:true});
 if(req.method==='GET')return c.json({...base,processing:old?.[0]?.status==='processing'});
 if(!c.key)return c.json({error:'Falta conectar la clave privada del detector en el servidor.',code:'detector_not_configured'},503);
 if(!eligible.length)return c.json({...base,message:provider==='TruthScan'?'El conjunto de respuestas es demasiado breve. Se necesitan al menos 300 caracteres.':'Las respuestas son demasiado breves para este análisis. Se necesitan al menos 300 caracteres por respuesta.'});
 const reservation=await c.db('rpc/reserve_police_external_ai_review',{method:'POST',body:JSON.stringify({p_kind:kind,p_id:id,p_hash:hash,p_characters:eligible.reduce((n,a)=>n+Array.from(a.text).length,0),p_actor:c.actor})});
 if(reservation.state==='cached')return c.json({...base,result:reservation.result,cached:true});
 if(reservation.state==='quota')return c.json({error:'Se alcanzó el límite local de 40.000 caracteres del día. Podrás continuar mañana (UTC).',code:'detector_quota'},429);
 if(reservation.state!=='reserved')return c.json({error:'Ya hay un análisis en curso o un reintento reciente. Espera un minuto y consulta el resultado.',code:'detector_busy'},409);
 const save=async(status:string,result:any=null)=>c.db('police_external_ai_reviews'+filter+'&lease=eq.'+reservation.lease+'&status=eq.processing',{method:'PATCH',body:JSON.stringify({status,result,lease:null,locked_until:null,updated_at:new Date().toISOString()})});
 try{
  if(provider==='TruthScan'){
   const answer=await reviewWithTruthScan(eligible[0],c.key,c.fetcher,async provider_job_id=>{await c.db('police_external_ai_reviews'+filter+'&lease=eq.'+reservation.lease+'&status=eq.processing',{method:'PATCH',body:JSON.stringify({result:{provider_job_id}})});},old?.[0]?.result?.provider_job_id);
   const result={provider,analyzed_at:new Date().toISOString(),answers:[answer]};await save('completed',result);return c.json({...base,result,cached:false});
  }
  const response=await(c.fetcher||fetch)('https://api.sapling.ai/api/v1/aidetect',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.key},body:JSON.stringify({texts:eligible.map(a=>a.text),lang:'es',zero_retention:true,sent_scores:true}),signal:AbortSignal.timeout(25000)});
  if(!response.ok){
   let reason='';
   if(response.status===402){
    try{
     const statusResponse=await(c.fetcher||fetch)('https://api.sapling.ai/api/v1/account/status',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.key},body:'{}',signal:AbortSignal.timeout(8000)});
     if(statusResponse.ok){const state=await statusResponse.json();const reasons:Record<string,string>={key_expired:'La clave de prueba ha caducado.',subscription_expired:'Sapling indica que el acceso de API no está activo.',credits_depleted:'Sapling indica que no hay créditos disponibles.',monthly_billing_limit:'Sapling indica que se alcanzó el límite mensual.',trial_daily_limit:'Sapling indica que se agotó la cuota gratuita de hoy; se restablece a medianoche UTC.',monthly_quota_exhausted:'Sapling indica que se agotó la cuota mensual.'};reason=reasons[state.blocked_reason]||'';}
    }catch{/* Preserve the original provider failure. */}
   }
   await save('failed');return c.json({error:response.status===402?(reason||'La prueba o cuota de Sapling no permite más análisis.')+' Revisa API Settings; no se ha cambiado la decisión.':response.status===429?'Sapling ha limitado temporalmente las consultas. Reintenta más tarde.':response.status===401||response.status===403?'Sapling ha rechazado la clave. Revisa la configuración privada del servidor.':'El detector externo no pudo completar el análisis. Reintenta más tarde.',code:'detector_unavailable'},503);
  }
  const raw=await response.json();if(!Array.isArray(raw.results)||raw.results.length!==eligible.length)throw Error('Invalid detector results');
  const result={provider:'Sapling',analyzed_at:new Date().toISOString(),answers:raw.results.map((r:any,n:number)=>normalizeExternalResult(r,eligible[n]))};
  await save('completed',result);return c.json({...base,result,cached:false});
 }catch(error){
  await save('failed',error instanceof TruthScanReviewError&&error.jobId?{provider_job_id:error.jobId}:null).catch(()=>{});return c.json({error:error instanceof TruthScanReviewError?error.message:'No se pudo confirmar el resultado del detector. No se ha cambiado la solicitud.',code:'detector_unavailable'},503);
 }
}
