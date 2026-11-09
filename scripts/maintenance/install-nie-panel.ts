// One-off installer. Substitute an expiring capability hash privately and retire
// the function after verification. Never put a bearer token in this file.
import {NIE_CHANNEL,NIE_GUILD,NIE_PANEL} from '../../supabase/functions/_shared/nie-questions.ts';
const BOT='1540484542354428025';
const CAPABILITY_SHA256='__CAPABILITY_SHA256__',EXPIRES_AT='__EXPIRES_AT__';
export async function installNiePanel(mode:string,messageId:string,c:any){
 if(!['publish','verify'].includes(mode))throw Error('Invalid operation');
 const channel=await c.discord('/channels/'+NIE_CHANNEL);
 if(channel.guild_id!==NIE_GUILD||![0,5].includes(channel.type))throw Error('Wrong target channel');
 const bot=await c.discord('/users/@me');if(bot.id!==BOT)throw Error('Wrong bot');
 const matches=(message:any)=>message?.author?.id===BOT&&(message.components||[]).some((r:any)=>(r.components||[]).some((b:any)=>b.custom_id==='prime_nie_apply'));
 if(mode==='verify'){
  if(!/^\d{17,20}$/.test(messageId))throw Error('Invalid message ID');
  const message=await c.discord('/channels/'+NIE_CHANNEL+'/messages/'+messageId);
  if(!matches(message))throw Error('Panel verification failed');
  return {ok:true,channel_id:NIE_CHANNEL,message_id:message.id,button:'prime_nie_apply',mentions:(message.mentions||[]).length};
 }
 const messages=await c.discord('/channels/'+NIE_CHANNEL+'/messages?limit=100');
 const found=Array.isArray(messages)?messages.find(matches):null;
 const result=await c.discord('/channels/'+NIE_CHANNEL+'/messages'+(found?'/'+found.id:''),{method:found?'PATCH':'POST',body:JSON.stringify({...NIE_PANEL,...(!found?{nonce:'prime-nie-cic-panel-v1',enforce_nonce:true}:{})})});
 if(!matches(result))throw Error('Discord did not confirm the panel');
 return {ok:true,channel_id:NIE_CHANNEL,message_id:result.id,updated:Boolean(found)};
}
const sha=async(text:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(n=>n.toString(16).padStart(2,'0')).join('');
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return new Response(null,{status:405});
 if(!/^[0-9a-f]{64}$/.test(CAPABILITY_SHA256)||!Number.isFinite(Date.parse(EXPIRES_AT))||Date.now()>=Date.parse(EXPIRES_AT))return new Response(null,{status:410});
 const bearer=req.headers.get('Authorization')||'';
 if(!bearer.startsWith('Bearer ')||await sha(bearer.slice(7))!==CAPABILITY_SHA256)return new Response(null,{status:401});
 let body:any;try{body=await req.json();}catch{return new Response(null,{status:400});}
 const bot=Deno.env.get('DISCORD_BOT_TOKEN');if(!bot)return new Response(null,{status:503});
 const c={discord:async(path:string,init:RequestInit={})=>{const response=await fetch('https://discord.com/api/v10'+path,{...init,signal:AbortSignal.timeout(15000),headers:{Authorization:'Bot '+bot,'Content-Type':'application/json'}});if(!response.ok)throw Error('Discord status '+response.status);return response.json();}};
 try{return Response.json(await installNiePanel(String(body.action||''),String(body.message_id||''),c));}catch(error){console.error('NIE panel installation:',String(error));return Response.json({ok:false,error:String(error)},{status:502});}
});
