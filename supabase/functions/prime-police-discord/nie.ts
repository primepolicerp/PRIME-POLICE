import {NIE_GUILD,NIE_CHANNEL,NIE_POLICE,nieStepQuestions} from '../_shared/nie-questions.ts';
const validId=(id:string)=>/^[a-f0-9-]{36}$/i.test(id);
export function nieModal(step:number,id:string,c:any){
 return c.response(9,{custom_id:'prime_nie_form:'+step+':'+id,title:'NIE · CIC · Paso '+step+'/3',components:[{type:10,content:nieStepQuestions(step).map(q=>'**'+q.label+'**\n'+q.question).join('\n\n')},...nieStepQuestions(step).map(q=>({type:18,label:q.label,component:'choice' in q?{type:3,custom_id:q.key,placeholder:'Selecciona Sí o No',required:true,min_values:1,max_values:1,options:[{label:'Sí',value:'yes'},{label:'No',value:'no'}]}:c.input(q.key,'Escribe tu respuesta.',true,'short' in q?1:2,'short' in q?100:4000)}))]});
}
export function nieValues(i:any){
 const out:Record<string,string>={};
 const visit=(node:any)=>{if(!node||typeof node!=='object')return;if(node.custom_id){if(typeof node.value==='string')out[node.custom_id]=node.value.trim();else if(Array.isArray(node.values)&&node.values.length===1)out[node.custom_id]=String(node.values[0]);}if(node.component)visit(node.component);for(const child of node.components||[])visit(child);};
 for(const component of i.data?.components||[])visit(component);return out;
}
export async function handleNie(i:any,userId:string,username:string,c:any):Promise<Response|null>{
 const custom=String(i.data?.custom_id||'');if(!custom.startsWith('prime_nie_'))return null;
 if(i.guild_id!==NIE_GUILD||i.channel_id!==NIE_CHANNEL||!/^\d{17,20}$/.test(userId))return c.ephemeral('Abre la postulación desde el canal NIE · CIC de PRIME POLICE.');
 const roles:string[]=i.member?.roles||[];
 if(!roles.includes(NIE_POLICE)||roles.some(id=>['1539970134482092034','1564310246128619560','1569323526610092234','1539970134482092035'].includes(id)))return c.ephemeral('Necesitas el rol Policía para enviar la postulación.');
 if(i.type===3&&custom==='prime_nie_apply')return nieModal(1,crypto.randomUUID(),c);
 if(i.type===3&&custom.startsWith('prime_nie_continue:')){
  const id=custom.split(':')[1];if(!validId(id))return c.ephemeral('Este formulario ya no está disponible.');
  try{const rows=await c.db('police_nie_drafts?select=id,step&id=eq.'+id+'&discord_user_id=eq.'+userId+'&consumed_at=is.null&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&limit=1',{signal:AbortSignal.timeout(1800)});const draft=rows?.[0];return draft&&[2,3].includes(draft.step)?nieModal(draft.step,id,c):c.ephemeral('El formulario caducó o ya se envió. Si ya lo enviaste, conserva tu referencia.');}catch{return c.ephemeral('No se pudo abrir el paso. Pulsa Continuar para reintentarlo.');}
 }
 if(i.type===5&&custom.startsWith('prime_nie_form:')){
  const [,stepText,id]=custom.split(':'),step=Number(stepText),answers=nieValues(i);
  if(![1,2,3].includes(step)||!validId(id))return c.ephemeral('Paso de postulación no válido.');
  if(!nieStepQuestions(step).every(q=>typeof answers[q.key]==='string'&&answers[q.key].length>=1&&answers[q.key].length<=('short' in q?100:4000)&&(!('choice' in q)||['yes','no'].includes(answers[q.key]))))return c.ephemeral('Completa todas las preguntas de este paso.');
  c.waitUntil((async()=>{
   try{
    // Revalidate membership after opening the modal; never rely on an old roster.
    const member=await c.discord('/guilds/'+NIE_GUILD+'/members/'+userId),current=member?.roles||[];
    if(member?.user?.bot||!current.includes(NIE_POLICE)||current.some((role:string)=>['1539970134482092034','1564310246128619560','1569323526610092234','1539970134482092035'].includes(role))){await c.edit(i,{content:'Tu acceso con el rol Policía cambió. No se ha enviado una postulación nueva.',components:[],allowed_mentions:{parse:[]}});return;}
    const result=await c.db('rpc/police_nie_step',{method:'POST',body:JSON.stringify({p_user:userId,p_operation:id,p_step:step,p_answers:answers,p_username:username})});
    if(!result?.ok){await c.edit(i,{content:result?.code==='inactive'?'Necesitas una ficha activa de Policía para postular.':result?.code==='expired'?'El formulario caducó. Abre una postulación nueva.':'No se pudo confirmar el paso. Conserva tu referencia y consulta con CIC antes de repetir.',components:[],allowed_mentions:{parse:[]}});return;}
    if(result.submitted){await c.edit(i,{content:'✅ **Postulación NIE · CIC registrada.**\nEstado: pendiente de revisión.\nReferencia: `'+result.reference+'`\nConserva esta referencia para consultar con CIC. No se han asignado roles.',components:[],allowed_mentions:{parse:[]}});return;}
    await c.edit(i,{content:'🕵️ **NIE · CIC · Paso '+(result.step-1)+' de 3 completado.**\nContinúa con el siguiente paso. Dispones de una hora desde el inicio. **Todavía no has enviado la postulación.**',components:[{type:1,components:[{type:2,style:1,label:result.step===3?'Continuar al último paso':'Continuar con las preguntas',custom_id:'prime_nie_continue:'+result.draft_id}]}],allowed_mentions:{parse:[]}});
   }catch(error){const reference=String(i.id||'').slice(-8)||id.slice(0,8);console.error('nie_submission',JSON.stringify({reference,error:String(error)}));try{await c.edit(i,{content:'Error · Ref. '+reference,components:[],allowed_mentions:{parse:[]}});}catch{/* Submission may have committed; do not retry it automatically. */}}
  })());
  return c.response(5,{flags:64});
 }
 return c.ephemeral('Paso de postulación no reconocido.');
}
