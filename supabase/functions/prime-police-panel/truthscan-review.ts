type Answer={key:string,label:string,text:string,source_keys?:string[]};
export class TruthScanReviewError extends Error{jobId?:string;constructor(message:string,jobId?:string){super(message);this.jobId=jobId;}}
const jobId=(id:any)=>typeof id==='string'&&/^[a-f0-9-]{36}$/i.test(id);
export async function reviewWithTruthScan(answer:Answer,key:string,fetcher:typeof fetch=fetch,onSubmitted:((id:string)=>Promise<void>)=async()=>{},existingId?:string,pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))){
 let id=jobId(existingId)?existingId:undefined;
 const call=async(path:string,body?:any)=>{
  const response=await fetcher('https://detect-text.truthscan.com/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(body?{}:{apikey:key})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new TruthScanReviewError(response.status===403||response.status===402?'TruthScan no permite este análisis: comprueba la clave y la cuota gratuita. No se han cambiado decisiones.':response.status===429?'TruthScan ha limitado las consultas. Reintenta más tarde.':'TruthScan no pudo completar el análisis. Reintenta más tarde.',id);
  return response.json();
 };
 try{
  if(!id){
   const balance=await call('check-user-credits');const words=answer.text.trim().split(/\s+/).length;
   if(typeof balance.credits!=='number'||!Number.isFinite(balance.credits)||balance.credits<words)throw new TruthScanReviewError('No hay suficientes palabras gratuitas en TruthScan para este análisis. No se ha contratado nada.');
   const submitted=await call('detect',{key,model:'xlm_ud_detector',retry_count:0,text:answer.text});
   if(!jobId(submitted.id))throw new TruthScanReviewError('TruthScan no devolvió una referencia válida.');
   id=submitted.id;await onSubmitted(id!);
  }
  const deadline=Date.now()+22000;
  for(let attempt=0;attempt<8&&Date.now()<deadline;attempt++){
   if(attempt)await pause(1000);
   const result=await call('query',{id});
   if(result.id!==id)throw new TruthScanReviewError('TruthScan devolvió una referencia distinta.',id);
   if(result.status==='done'){
    if(typeof result.result!=='number'||!Number.isFinite(result.result)||result.result<0||result.result>100)throw new TruthScanReviewError('TruthScan no devolvió una puntuación válida.',id);
    return {key:answer.key,label:answer.label,source_keys:answer.source_keys,score:result.result/100,low_confidence:answer.text.split(/\s+/).length<200,version:'xlm_ud_detector',segments:[],provider_job_id:id};
   }
   if(!['pending','processing'].includes(result.status))throw new TruthScanReviewError('TruthScan no completó este análisis.',id);
  }
  throw new TruthScanReviewError('TruthScan sigue procesando el texto. Espera un minuto y vuelve a consultar; se recuperará el mismo análisis.',id);
 }catch(error){if(error instanceof TruthScanReviewError)throw error;throw new TruthScanReviewError('No se pudo confirmar el análisis de TruthScan. Espera un minuto y reintenta.',id);}
}
