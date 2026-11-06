// Discord's callback API validates modals; inline responses hide validation errors.
// Never log interaction tokens, request URLs, or submitted evidence content.
export async function openEvidenceModal(i:any,data:any,request:typeof fetch=fetch):Promise<Response>{
 const ref=crypto.randomUUID().slice(0,8),started=Date.now();
 try{
  const result=await request('https://discord.com/api/v10/interactions/'+encodeURIComponent(String(i.id))+'/'+encodeURIComponent(String(i.token))+'/callback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:9,data}),signal:AbortSignal.timeout(1800)});
  if(result.ok){console.info('Evidence modal accepted',JSON.stringify({ref,status:result.status,elapsed_ms:Date.now()-started}));return new Response(null,{status:202});}
  let detail:any;try{detail=await result.json();}catch{detail={};}
  // Only Discord's validation tree is retained, never the full request/response.
  console.error('Evidence modal rejected',JSON.stringify({ref,status:result.status,code:detail.code,errors:detail.errors,elapsed_ms:Date.now()-started}));
  if(detail.code===40060)return new Response(null,{status:202});
 }catch{console.error('Evidence modal callback unavailable',JSON.stringify({ref,elapsed_ms:Date.now()-started}));
  // The callback may have succeeded despite a network error. Do not replay it.
  return new Response(null,{status:202});
 }
 return Response.json({type:4,data:{flags:64,content:'Discord no pudo abrir el formulario de evidencias. Avisa a UCOP con la referencia '+ref+'.'}});
}
