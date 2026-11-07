// Guild member reads share a Discord rate-limit bucket. Do not fan them out.
// Keep only in-flight reads; role changes must be checked again on the next interaction.
export function createDiscordMemberReader(deps={fetch:(...args:Parameters<typeof fetch>)=>fetch(...args),sleep:(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms)),now:()=>Date.now()}){
 let tail=Promise.resolve(),nextAt=0;
 const pending=new Map<string,Promise<any>>();
 return function read(path:string,token:string):Promise<any>{
  if(pending.has(path))return pending.get(path)!;
  const job=tail.then(async()=>{
   const deadline=deps.now()+30000;
   for(let attempt=0;attempt<4;attempt++){
    const wait=nextAt-deps.now();
    if(Math.max(nextAt,deps.now())>=deadline)throw Object.assign(Error('Discord member read temporarily limited'),{status:429});
    if(wait>0)await deps.sleep(wait);
    const response=await deps.fetch('https://discord.com/api/v10'+path,{headers:{Authorization:'Bot '+token},signal:AbortSignal.timeout(10000)});
    const body=await response.json().catch(()=>null);
    if(response.headers.get('x-ratelimit-remaining')==='0'){
     const reset=Number(response.headers.get('x-ratelimit-reset-after'));
     if(Number.isFinite(reset)&&reset>0)nextAt=Math.max(nextAt,deps.now()+Math.ceil(reset*1000)+50);
    }
    if(response.ok)return body;
    if(response.status===429){
     const raw=Number(body?.retry_after??response.headers.get('retry-after')??1),delay=Number.isFinite(raw)&&raw>0?raw:1;
     nextAt=Math.max(nextAt,deps.now()+Math.ceil(delay*1000)+50);
     if(attempt<3&&nextAt<deadline)continue;
    }
    throw Object.assign(Error('Discord member read '+response.status),{status:response.status});
   }
   throw Object.assign(Error('Discord member read temporarily limited'),{status:429});
  });
  tail=job.then(()=>{},()=>{});
  const result=job.finally(()=>pending.delete(path));pending.set(path,result);return result;
 };
}
export const readDiscordMember=createDiscordMemberReader();
