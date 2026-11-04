import {TRANSFER_QUESTIONS} from '../_shared/transfer-questions.ts';
const uuid=(v:string)=>/^[a-f0-9-]{36}$/i.test(v);
export function transferIdentityModal(input:any,response:any){return response(9,{custom_id:'prime_transfer_identity',title:'Traslado · Identificación',components:[
 {type:10,content:'🚔 **SOLICITUD DE TRASLADO POLICIAL**\nPrime Police | Departamento de Recursos Humanos\n\n**2. Edad IC y OOC**\n¿Cuántos años tienes dentro del rol (IC) y fuera del rol (OOC)?'},
 {type:18,label:'Nombre y apellido IC',description:'Escribe solo el nombre de tu personaje.',component:input('full_name','Ej. Pedro Martinez',true,1,100)},
 {type:18,label:'2. Edad IC · dentro del rol',component:input('age_ic','Solo números, ej. 25',true,1,3)},
 {type:18,label:'2. Edad OOC · fuera del rol',component:input('age_ooc','Solo números, ej. 18',true,1,3)}
]});}
export function transferQuestionsModal(id:string,step:number,input:any,response:any){
 const questions=TRANSFER_QUESTIONS.slice((step-1)*3,step*3);
 return response(9,{custom_id:'prime_transfer_answers:'+step+':'+id,title:'Traslado · Preguntas '+step+'/3',components:[
  {type:10,content:questions.map(q=>'**'+q.number+'. '+q.title+'**\n'+q.question).join('\n\n')},
  ...questions.map(q=>({type:18,label:q.number+'. '+q.title,component:input(q.key,'Escribe tu respuesta.',true)}))
 ]});
}
export async function handleTransferSteps(i:any,userId:string,username:string,c:any):Promise<Response|null>{
 const id=String(i.data?.custom_id||'');
 if(!/^prime_transfer_(identity$|continue:|answers:)/.test(id))return null;
 if(i.guild_id!=='1539970134469378068'||!/^\d{17,20}$/.test(userId))return c.ephemeral('Este formulario solo puede usarse dentro del servidor de PRIME POLICE.');
 const getDraft=async(draftId:string)=>{
  if(!uuid(draftId))return null;
  const rows=await c.db('police_transfer_drafts?select=*&id=eq.'+draftId+'&discord_user_id=eq.'+userId+'&consumed_at=is.null&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&limit=1',{signal:AbortSignal.timeout(1800)});return rows?.[0]||null;
 };
 const expired='Este formulario caducó, ya se envió o no te pertenece. Abre una nueva solicitud de traslado.';
 const continueMessage=async(draft:any)=>c.edit(i,{content:'🚔 **SOLICITUD DE TRASLADO POLICIAL**\nPrime Police | Departamento de Recursos Humanos\n\n'+(draft.step===1?'Datos personales guardados.':'Respuestas guardadas.')+' Continúa con las preguntas '+draft.step+'/3. Dispones de 60 minutos desde el inicio. **Todavía no se ha enviado la solicitud.**',components:[{type:1,components:[{type:2,style:1,label:draft.step===3?'Responder y enviar traslado':'Continuar con las preguntas',custom_id:'prime_transfer_continue:'+draft.id}]}]});
 const defer=(job:()=>Promise<void>)=>{EdgeRuntime.waitUntil(job().catch(async(error)=>{console.error('Transfer steps:',String(error));try{await c.edit(i,{content:'No se pudo confirmar este paso. Si ya completaste el envío, consulta con UCOP si quedó registrado antes de repetirlo.',components:[]});}catch{}}));return c.response(5,{flags:64});};
 if(i.type===5&&id==='prime_transfer_identity'){
  const a=c.values(i),name=String(a.full_name||'').trim();
  if(name.length<3||name.length>100||/\d|\r|\n|\|/.test(name))return c.ephemeral('Escribe solo el nombre y apellido IC. Las edades van en sus campos separados.');
  if(![a.age_ic,a.age_ooc].every(v=>/^\d{1,3}$/.test(v)&&Number(v)>=1&&Number(v)<=120))return c.ephemeral('Las edades IC y OOC deben ser números entre 1 y 120.');
  return defer(async()=>{
   const now=new Date(),draft={id:crypto.randomUUID(),discord_user_id:userId,payload:{full_name:name,age_ic:Number(a.age_ic),age_ooc:Number(a.age_ooc)},step:1,created_at:now.toISOString(),expires_at:new Date(now.getTime()+3600000).toISOString(),consumed_at:null};
   await c.db('police_transfer_drafts?on_conflict=discord_user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(draft)});await continueMessage(draft);
  });
 }
 if(i.type===3&&id.startsWith('prime_transfer_continue:')){
  try{const draft=await getDraft(id.split(':')[1]);return draft?transferQuestionsModal(draft.id,draft.step,c.input,c.response):c.ephemeral(expired);}catch{return c.ephemeral('La conexión tardó demasiado. Pulsa Continuar para reintentarlo.');}
 }
 if(i.type===5&&id.startsWith('prime_transfer_answers:')){
  const [,stepText,draftId]=id.split(':'),step=Number(stepText),a=c.values(i);
  if(![1,2,3].includes(step)||!uuid(draftId))return c.ephemeral(expired);
  const questions=TRANSFER_QUESTIONS.slice((step-1)*3,step*3);
  if(!questions.every(q=>typeof a[q.key]==='string'&&a[q.key].trim()&&a[q.key].length<=4000))return c.ephemeral('Completa todas las preguntas antes de continuar.');
  return defer(async()=>{
   const draft=await getDraft(draftId);if(!draft||draft.step!==step){await c.edit(i,{content:expired,components:[]});return;}
   const payload={...draft.payload};for(const q of questions)payload[q.key]=a[q.key].trim();
   if(step<3){
    const updated=await c.db('police_transfer_drafts?id=eq.'+draft.id+'&discord_user_id=eq.'+userId+'&step=eq.'+step+'&consumed_at=is.null',{method:'PATCH',body:JSON.stringify({payload,step:step+1})});
    if(!updated?.length){await c.edit(i,{content:'Este paso ya fue actualizado. Usa el último botón Continuar.',components:[]});return;}await continueMessage({...draft,step:step+1});
   }else{
    const result=await c.process(i,userId,username,{...payload,questionnaire_version:1,submission_id:draft.id});
    if(result?.ok)await c.db('police_transfer_drafts?id=eq.'+draft.id+'&discord_user_id=eq.'+userId,{method:'PATCH',body:JSON.stringify({consumed_at:new Date().toISOString(),payload:{}})}).catch(error=>console.error('Transfer draft cleanup:',String(error)));
   }
  });
 }
 return c.ephemeral('Paso de traslado no reconocido.');
}
