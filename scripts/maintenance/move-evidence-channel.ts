// Temporary, tightly scoped maintenance handler. Deploy only with an expiring
// capability SHA-256 substituted privately; never commit the capability itself.
const SOURCE_CHANNELS=['1539970136050499672','1539970137455853693'];
const TARGET='1539970136050499671',GUILD='1539970134469378068',BOT='1540484542354428025';
const CAPABILITY_SHA256='__CAPABILITY_SHA256__',EXPIRES_AT='__EXPIRES_AT__';
const sha=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))).map(n=>n.toString(16).padStart(2,'0')).join('');
type Context={db:(path:string,init?:RequestInit)=>Promise<any>,discord:(path:string,init?:RequestInit)=>Promise<any>,download:(url:string)=>Promise<{bytes:Uint8Array,type:string}>};
const photoUrl=(url:string)=>{try{const u=new URL(url);return u.protocol==='https:'&&['cdn.discordapp.com','media.discordapp.net'].includes(u.hostname)&&!u.username&&!u.password&&/^\/(?:ephemeral-)?attachments\//.test(u.pathname);}catch{return false;}};
export async function moveEvidenceChannel(recordId:string,dryRun:boolean,c:Context){
 if(!/^[a-f0-9-]{36}$/i.test(recordId))throw Error('Invalid record');
 const rows=await c.db('police_evidence_records?select=*&id=eq.'+recordId+'&limit=1'),record=rows?.[0];
 if(!record)throw Error('Evidence not found');
 if(record.channel_id===TARGET)return {id:recordId,status:'already_moved',message_id:record.discord_message_id};
 if(!SOURCE_CHANNELS.includes(record.channel_id)||!/^\d{17,20}$/.test(record.discord_message_id||''))throw Error('Source outside allowed channels');
 const target=await c.discord('/channels/'+TARGET),sourceChannel=await c.discord('/channels/'+record.channel_id);
 if(target.guild_id!==GUILD||sourceChannel.guild_id!==GUILD||![0,5].includes(target.type)||![0,5].includes(sourceChannel.type))throw Error('Channel mismatch');
 const sourcePath='/channels/'+record.channel_id+'/messages/'+record.discord_message_id;
 const original=await c.discord(sourcePath);
 if(original.author?.id!==BOT||!Array.isArray(original.embeds)||!original.embeds.length)throw Error('Only existing bot evidence messages may be moved');
 if((original.attachments||[]).length>1||original.embeds.filter((e:any)=>e.image?.url).length>1)throw Error('Multiple images require manual review');
 let photo:any;
 const urls=[original.attachments?.[0]?.url,...original.embeds.flatMap((e:any)=>[e.image?.url,e.image?.proxy_url]),record.photo_url].filter((u:any)=>typeof u==='string'&&photoUrl(u));
 for(const url of urls){try{const candidate=await c.download(url);if(candidate.bytes.length>0&&candidate.bytes.length<=25*1024*1024&&/^image\/(png|jpeg|webp|gif)/.test(candidate.type)){photo=candidate;break;}}catch{/* Another refreshed Discord URL may still be valid. */}}
 if(!photo)throw Error('Could not preserve the original evidence image');
 if(dryRun)return {id:recordId,status:'ready',photo_bytes:photo.bytes.length};
 const nonce='evmove'+recordId.replaceAll('-','').slice(0,18);
 const recent=await c.discord('/channels/'+TARGET+'/messages?limit=100');
 let posted=recent.find((m:any)=>m.author?.id===BOT&&String(m.nonce)===nonce);
 if(!posted){
  const extension=photo.type.includes('jpeg')?'jpg':photo.type.includes('webp')?'webp':photo.type.includes('gif')?'gif':'png',filename='evidence.'+extension;
  const embeds=original.embeds.map((e:any,index:number)=>({...(e.title?{title:e.title}:{}),...(e.description?{description:e.description}:{}),...(e.url?{url:e.url}:{}),...(e.color!==undefined?{color:e.color}:{}),...(e.footer?{footer:{text:e.footer.text,...(e.footer.icon_url?{icon_url:e.footer.icon_url}:{})}}:{}),...(e.author?{author:{name:e.author.name,...(e.author.url?{url:e.author.url}:{}),...(e.author.icon_url?{icon_url:e.author.icon_url}:{})}}:{}),...(e.fields?{fields:e.fields}:{}),...(e.thumbnail?.url?{thumbnail:{url:e.thumbnail.url}}:{}),timestamp:e.timestamp||record.created_at,...(index===0||e.image?{image:{url:'attachment://'+filename}}:{})}));
  const form=new FormData();form.append('payload_json',JSON.stringify({content:original.content||'',embeds,attachments:[{id:0,filename}],allowed_mentions:{parse:[]},nonce,enforce_nonce:true}));form.append('files[0]',new Blob([photo.bytes],{type:photo.type}),filename);
  posted=await c.discord('/channels/'+TARGET+'/messages',{method:'POST',body:form});
 }
 if(!/^\d{17,20}$/.test(posted?.id||''))throw Error('Discord did not confirm the destination message');
 const confirmed=await c.discord('/channels/'+TARGET+'/messages/'+posted.id);
 if(confirmed.author?.id!==BOT||confirmed.attachments?.length!==1)throw Error('Destination image not confirmed');
 const targetPhoto=await c.download(confirmed.attachments[0].url);
 if(await sha(targetPhoto.bytes)!==await sha(photo.bytes))throw Error('Destination image differs from the source');
 const changed=await c.db('police_evidence_records?id=eq.'+recordId+'&channel_id=eq.'+record.channel_id+'&discord_message_id=eq.'+record.discord_message_id,{method:'PATCH',body:JSON.stringify({channel_id:TARGET,discord_message_id:posted.id})});
 if(changed?.length!==1)throw Error('Could not confirm the web link update; original message retained');
 // Keep both references in the audit trail before deleting any old bot message.
 await c.db('police_audit_events',{method:'POST',body:JSON.stringify({action:'Evidencia trasladada al canal de archivo',fields:[{name:'Registro',value:recordId},{name:'Origen',value:record.channel_id+'/'+record.discord_message_id},{name:'Destino',value:TARGET+'/'+posted.id},{name:'Fecha original',value:record.created_at},{name:'Autorización',value:'Traslado de evidencias solicitado por el propietario en ChatGPT'}]})});
 await c.discord(sourcePath,{method:'DELETE'});
 return {id:recordId,status:'moved',message_id:posted.id};
}
if(typeof Deno!=='undefined')Deno.serve(async req=>{
 const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
 if(req.method!=='POST'||!/^\w{64}$/.test(CAPABILITY_SHA256)||!Number.isFinite(Date.parse(EXPIRES_AT))||Date.now()>Date.parse(EXPIRES_AT)||await sha(new TextEncoder().encode(token))!==CAPABILITY_SHA256)return new Response(null,{status:403});
 const body=await req.json().catch(()=>null);if(!body||!body.id||typeof body.dry_run!=='boolean')return new Response(null,{status:400});
 const base=Deno.env.get('SUPABASE_URL')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',bot=Deno.env.get('DISCORD_BOT_TOKEN')||'';
 const requestJson=async(url:string,init:RequestInit)=>{for(let attempt=0;attempt<3;attempt++){const r=await fetch(url,{...init,signal:AbortSignal.timeout(15000)});if(r.status===429&&attempt<2){const limit=await r.json().catch(()=>({}));await new Promise(resolve=>setTimeout(resolve,Math.min(10000,Math.max(500,Number(limit.retry_after||1)*1000))));continue;}if(!r.ok)throw Error('Upstream status '+r.status);return r.status===204?null:r.json();}throw Error('Rate limit');};
 const c:Context={db:(path,init={})=>requestJson(base+'/rest/v1/'+path,{...init,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',Prefer:'return=representation'}}),discord:(path,init={})=>requestJson('https://discord.com/api/v10'+path,{...init,headers:{Authorization:'Bot '+bot,...(init.body instanceof FormData?{}:{'Content-Type':'application/json'})}}),download:async url=>{if(!photoUrl(url))throw Error('Invalid photo host');const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok||Number(r.headers.get('Content-Length')||0)>25*1024*1024)throw Error('Image unavailable');return {bytes:new Uint8Array(await r.arrayBuffer()),type:r.headers.get('Content-Type')||''};}};
 try{return Response.json(await moveEvidenceChannel(body.id,body.dry_run,c));}catch(error){return Response.json({id:body.id,error:String(error)},{status:502});}
});
