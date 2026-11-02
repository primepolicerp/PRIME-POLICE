export async function jobsDb(path:string,init:RequestInit={}){
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 const r=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/'+path,{...init,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation',...init.headers},signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('Notification storage '+r.status);return r.status===204?null:r.json();
}
export async function deliverClaimedNotice(job:any,deliver:(kind:string,payload:any)=>Promise<string>,db=jobsDb){
 let error='';try{error=await deliver(job.kind,job.payload);}catch{error='No se pudo contactar con Discord.';}
 const superseded=error==='__superseded__',sent=!error,status=superseded?'superseded':sent?'sent':job.attempts>=5?'failed':'pending';
 await db('police_discord_jobs?id=eq.'+job.id+'&lease=eq.'+job.lease+'&status=eq.processing',{method:'PATCH',body:JSON.stringify({status,lease:null,locked_until:null,last_error:superseded?'Existe una decisión posterior; no se envía el resultado antiguo.':error||null,...(sent?{sent_at:new Date().toISOString()}:{next_attempt_at:new Date(Date.now()+Math.min(3600,60*2**job.attempts)*1000).toISOString()})})});
 return sent||superseded?'':'Cambio guardado. El aviso de Discord '+(status==='failed'?'necesita revisión en Sincronización.':'está en cola para reintento automático.');
}
export async function durableNotice(kind:string,payload:any,deliver:()=>Promise<string>,db=jobsDb){
 let job:any;
 try{
  const rows=await db('police_discord_jobs?on_conflict=event_key',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({event_key:kind+':'+payload.eventId,kind,payload})});
  job=rows?.[0];if(!job){const old=await db('police_discord_jobs?select=*&event_key=eq.'+encodeURIComponent(kind+':'+payload.eventId)+'&limit=1');job=old?.[0];}
  if(['sent','superseded'].includes(job?.status))return '';
  if(job?.status==='failed')return 'Cambio guardado. El aviso de Discord necesita revisión en Sincronización.';
  if(!job)return 'Cambio guardado. Comprueba el aviso de Discord en Sincronización.';
  const claimed=await db('rpc/claim_police_discord_job',{method:'POST',body:JSON.stringify({p_id:job.id})});
  if(!claimed)return 'Cambio guardado. El aviso de Discord está en cola para reintento automático.';
  return await deliverClaimedNotice(claimed,()=>deliver(),db);
 }catch(error){console.error('Durable notice:',String(error));
  // Once persisted, keep the lease/retry path; never repeat an uncertain send here.
  if(job)return 'Cambio guardado. El aviso de Discord está en cola para reintento automático.';
  const result=await deliver();return result||'Cambio guardado y aviso enviado; no se pudo registrar su seguimiento de sincronización.';
 }
}
