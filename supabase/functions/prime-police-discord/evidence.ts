import {startParticipantPicker,handleParticipantPicker} from './evidence-participants.ts';
const GUILD='1539970134469378068',POLICE='1539970134482092038',EXPELLED='1539970134482092034',VETO='1564310246128619560';
const BOT_ID='1540484542354428025';
export const EVIDENCE_PANEL_CHANNEL_ID='1539970136050499672';
export const EVIDENCE_CHANNEL_ID='1539970136050499671';
type Context={db:(path:string,init?:RequestInit)=>Promise<any>,discord:(path:string,init?:RequestInit)=>Promise<any>,response:(type:number,data:any)=>Response,ephemeral:(text:string)=>Response,reply:(i:any,payload:any)=>Promise<void>,waitUntil:(task:Promise<any>)=>void,openModal?:(i:any,data:any)=>Promise<Response>};
const text=(value:any)=>String(value??'').replace(/[\u200B-\u200D\u2060\uFEFF]/g,'').trim();
const input=(id:string,placeholder:string,max:number,style=1)=>({type:4,custom_id:id,style,placeholder,min_length:1,max_length:max,required:true});
function component(i:any,id:string){let result:any;const visit=(node:any)=>{if(!node||typeof node!=='object')return;if(node.custom_id===id)result=node;if(node.component)visit(node.component);for(const child of node.components||[])visit(child);};for(const node of i.data?.components||[])visit(node);return result;}
function selectedId(i:any){return String(i.data?.custom_id||'').match(/^prime_evidence_submit:(\d{17,20})$/)?.[1]||'';}
function permitted(roles:string[]){return roles.includes(POLICE)&&!roles.includes(EXPELLED)&&!roles.includes(VETO);}
function label(person:any){return text(person.full_name)+' · #'+(text(person.plate)||'Sin placa');}
export function evidenceSearchModal(){return {custom_id:'prime_evidence_h50_search',title:'Buscar responsable H-50',components:[{type:18,label:'Nombre o placa del policía',description:'Escribe el nombre completo, una parte o la placa. Pulsa Enviar para ver las coincidencias.',component:input('evidence_h50_query','Ej.: Pedro, Martinez o 0002',100)}]};}
export function evidenceForm(person:any,participants:any[]){if(!participants.length||participants.length>25)throw Error('Select 1–25 police participants before opening the form');return {custom_id:'prime_evidence_submit:'+person.discord_user_id,title:'Registrar evidencia · PRIME POLICE',components:[
 {type:18,label:'📌 Operativo',description:('H-50: '+(text(person.selectionLabel)||label(person))).slice(0,100),component:input('evidence_operation','Ej.: Robo a tienda, secuestro o control de tránsito',100)},
 {type:18,label:'🛡️ Policías participantes',description:'Selecciona a los policías involucrados, incluyéndote si participaste. Máximo 25.',component:{type:3,custom_id:'evidence_participants',placeholder:'Policías seleccionados del operativo',min_values:1,max_values:participants.length,required:true,options:participants.map(p=>({...p,default:true}))}},
 {type:18,label:'🔒 Locker',description:'Indica el número de tu placa.',component:input('evidence_locker','Ej.: 0123',100)},
 {type:18,label:'📦 Objetos incautados',component:input('evidence_objects','Describe los objetos o indica: En la imagen',1500,2)},
 {type:18,label:'📷 Fotografía de la evidencia',description:'Adjunta la foto o envíala antes al canal del formulario mencionando a RH Police (máximo 10 minutos).',component:{type:19,custom_id:'evidence_photo',file_types:['image'],min_values:0,max_values:1,required:false}}
 ]};}
function photoError(photo:any){
 if(!photo||!['image/png','image/jpeg','image/webp','image/gif'].includes(String(photo.content_type||'').toLowerCase())||!Number.isSafeInteger(photo.size)||photo.size<=0)return 'Debes adjuntar una fotografía válida y no vacía: PNG, JPG, WEBP o GIF.';
 try{const url=new URL(photo.url);if(url.protocol!=='https:'||!['cdn.discordapp.com','media.discordapp.net'].includes(url.hostname)||!/^\/(?:ephemeral-)?attachments\//.test(url.pathname)||url.username||url.password)throw Error();}catch{return 'La fotografía debe ser un archivo de Discord.';}
 return null;
}
export function recentPastedPhoto(messages:any[],userId:string,now=Date.now()){
 const source=messages.find(message=>String(message.author?.id)===userId&&!message.author?.bot&&String(message.channel_id)===EVIDENCE_PANEL_CHANNEL_ID&&message.mentions?.some((user:any)=>String(user.id)===BOT_ID)&&Array.isArray(message.attachments)&&message.attachments.length&&Number.isFinite(Date.parse(message.timestamp))&&now-Date.parse(message.timestamp)>=0&&now-Date.parse(message.timestamp)<=600000);
 if(!source||!/^\d{17,20}$/.test(String(source.id)))return {error:'Falta la foto: pega la captura en este canal, menciona a RH Police y envíala. Después vuelve a Registrar evidencia. También puedes adjuntarla en el formulario.'};
 if(source.attachments.length!==1)return {error:'Envía una sola fotografía por mensaje para que el bot identifique la evidencia correcta.'};
 const error=photoError(source.attachments[0]);return error?{error}:{photo:source.attachments[0],sourceId:String(source.id)};
}
export function evidenceSubmission(i:any){
 const operation=text(component(i,'evidence_operation')?.value),participantIds=component(i,'evidence_participants')?.values;
 const locker=text(component(i,'evidence_locker')?.value),objects=text(component(i,'evidence_objects')?.value),h50Id=selectedId(i),files=component(i,'evidence_photo')?.values;
 if(!operation||operation.length>100)return {error:'Indica el operativo (máximo 100 caracteres). Si el formulario es antiguo, vuelve a abrirlo.'};
 if(!Array.isArray(participantIds)||participantIds.length<1||participantIds.length>25||participantIds.some(id=>typeof id!=='string'||!/^\d{17,20}$/.test(id))||new Set(participantIds).size!==participantIds.length)return {error:'Selecciona entre 1 y 25 policías participantes distintos.'};
 if(!locker||!objects)return {error:'Completa el locker y los objetos incautados. No se aceptan campos vacíos ni solo espacios.'};
 if(locker.length>100||objects.length>1500)return {error:'El locker admite 100 caracteres y los objetos 1500.'};
 if(!h50Id)return {error:'Selecciona un responsable H-50 de la plantilla. Si abriste el formulario anterior, ciérralo y vuelve a Registrar evidencia.'};
 if(files!==undefined&&(!Array.isArray(files)||files.length>1))return {error:'Adjunta una sola fotografía válida.'};
 const photo=files?.length===1?i.data?.resolved?.attachments?.[files[0]]:null;
 if(files?.length===1){if(!photo||String(photo.id)!==String(files[0]))return {error:'El archivo adjunto no es válido.'};const error=photoError(photo);if(error)return {error};}
 return {operation,participantIds:participantIds as string[],locker,objects,h50Id,photo};
}
async function saveEvidence(i:any,userId:string,c:Context){
 const data=evidenceSubmission(i);if(data.error){await c.reply(i,{content:data.error});return;}
 const member=await c.discord('/guilds/'+GUILD+'/members/'+userId);if(!permitted(member.roles||[])){await c.reply(i,{content:'Debes tener el rol Policía activo y no estar expulsado ni vetado.'});return;}
 const personPath=(id:string)=>'police_personnel?select=discord_user_id,full_name,plate,discord_username&discord_user_id=eq.'+id+'&status=eq.active&limit=1';
 const [authors,responsibles]=await Promise.all([c.db(personPath(userId)),c.db(personPath(data.h50Id!))]);const author=authors?.[0],responsible=responsibles?.[0];
 if(!author){await c.reply(i,{content:'No tienes ficha policial activa. Contacta con UCOP.'});return;}
 if(!responsible||!text(responsible.full_name)){await c.reply(i,{content:'El H-50 seleccionado ya no está en la plantilla activa. Vuelve a buscar al responsable antes de registrar la evidencia.'});return;}
 const h50Member=await c.discord('/guilds/'+GUILD+'/members/'+data.h50Id);
 if(h50Member.user?.bot||!permitted(h50Member.roles||[])){await c.reply(i,{content:'El responsable H-50 debe ser un policía activo del servidor, sin expulsión ni veto. Selecciona otro responsable de la plantilla.'});return;}
 const participantRows=await c.db('police_personnel?select=discord_user_id,full_name,plate,discord_username&discord_user_id=in.('+data.participantIds!.join(',')+')&status=eq.active&limit=25');
 const participants:any[]=[];
 for(const id of data.participantIds!){
  const person=participantRows?.find((row:any)=>row.discord_user_id===id);
  if(!person||!text(person.full_name)){await c.reply(i,{content:'Uno de los participantes ya no tiene ficha activa. Actualiza la selección antes de registrar.'});return;}
  let participantMember:any;
  try{participantMember=await c.discord('/guilds/'+GUILD+'/members/'+id);}catch(error){if((error as any)?.status!==404)throw error;await c.reply(i,{content:'Uno de los participantes ya no está en el servidor. Actualiza la selección.'});return;}
  if(participantMember.user?.bot||!permitted(participantMember.roles||[])){await c.reply(i,{content:'Todos los participantes deben ser policías activos, sin expulsión ni veto.'});return;}
  participants.push({discord_user_id:id,officer_name:person.full_name,plate:person.plate||'',discord_username:person.discord_username||participantMember.user?.username||''});
 }
 let photo=data.photo,sourceId:string|null=null;
 if(!photo){const source=recentPastedPhoto(await c.discord('/channels/'+EVIDENCE_PANEL_CHANNEL_ID+'/messages?limit=100'),userId);if(source.error){await c.reply(i,{content:source.error});return;}photo=source.photo;sourceId=source.sourceId!;
  const used=await c.db('police_evidence_records?select=id&photo_message_id=eq.'+sourceId+'&limit=1');if(used?.length){await c.reply(i,{content:'Esa captura ya tiene una evidencia registrada. Pega una captura nueva o adjunta la fotografía correcta.'});return;}}
 const h50=label(responsible),clean=(value:any)=>String(value??'').replace(/@/g,'＠').replace(/`/g,"'").slice(0,1500);
 const message=await c.discord('/channels/'+EVIDENCE_CHANNEL_ID+'/messages',{method:'POST',body:JSON.stringify({content:'📋 H-50: <@'+data.h50Id+'>',allowed_mentions:{parse:[],users:[data.h50Id]},embeds:[{title:'🔬 Evidencia policial · PRIME POLICE',color:3447003,fields:[{name:'📌 Operativo',value:clean(data.operation),inline:false},{name:'🛡️ Policías',value:participants.map(p=>'<@'+p.discord_user_id+'>').join(', '),inline:false},{name:'🔒 Locker',value:clean(data.locker),inline:true},{name:'📦 Objetos incautados',value:clean(data.objects).slice(0,1024),inline:false},...(data.objects!.length>1024?[{name:'Objetos incautados (continuación)',value:clean(data.objects).slice(1024),inline:false}]:[]),{name:'📋 H-50',value:'<@'+data.h50Id+'> · '+clean(h50),inline:false},{name:'Registrado por',value:clean(label(author)),inline:false}],image:{url:photo.url},footer:{text:'Registro automático RH Police'}}]})});
 try{await c.db('police_evidence_records',{method:'POST',body:JSON.stringify({operation:data.operation,participants,discord_user_id:userId,officer_name:author.full_name,plate:author.plate||'',locker:data.locker,objects_description:data.objects,h50,h50_discord_user_id:data.h50Id,h50_discord_username:responsible.discord_username||h50Member.user?.username||'',photo_message_id:sourceId,discord_message_id:String(message.id),channel_id:EVIDENCE_CHANNEL_ID})});}
 catch{await c.reply(i,{content:'La evidencia se publicó en Discord, pero falló el registro web. Avisa a UCOP con este mensaje: '+String(message.id)});return;}
 await c.reply(i,{content:'✅ Evidencia registrada en Discord y en la web. H-50: '+clean(h50)+'. Mensaje: '+String(message.id)});
}
export async function handleEvidenceInteraction(i:any,userId:string,c:Context):Promise<Response|null>{
 const custom=String(i.data?.custom_id||'');if(!/^prime_evidence_submit:\d{17,20}$/.test(custom)&&!['prime_evidence_open','prime_evidence_h50_find','prime_evidence_h50_search','prime_evidence_h50_select','prime_evidence_submit'].includes(custom)&&!/^prime_evidence_(people|pick|team|ready):/.test(custom)&&!custom.startsWith('prime_evidence_h50_page:')&&!custom.startsWith('prime_evidence_h50_select:')&&!custom.startsWith('prime_evidence_h50_group:'))return null;
 if(i.guild_id!==GUILD||!/^\d{17,20}$/.test(userId)||!permitted(i.member?.roles||[]))return c.ephemeral('Debes registrar evidencias desde el servidor con el rol Policía activo.');
 const participantPicker=handleParticipantPicker(i,userId,c,evidenceForm);if(participantPicker)return participantPicker;
 if(i.type===3&&['prime_evidence_open','prime_evidence_h50_find'].includes(custom))return c.openModal?c.openModal(i,evidenceSearchModal()):c.response(9,evidenceSearchModal());
 if(i.type===3&&custom.startsWith('prime_evidence_h50_page:')){
  if(!/^prime_evidence_h50_page:\d{1,6}$/.test(custom))return c.ephemeral('Vuelve a abrir la plantilla.');
  return c.response(7,{content:'**Responsable H-50 · Plantilla por iniciales**\nElige la inicial del nombre del policía. La lista se consulta al abrir cada grupo.',components:[{type:1,components:[['AF','A–F'],['GL','G–L'],['MR','M–R'],['SZ','S–Z / Otros']].map(([group,title])=>({type:2,style:2,label:title,custom_id:'prime_evidence_h50_group:'+group+':0'}))},{type:1,components:[{type:2,style:1,label:'Buscar nombre o placa',custom_id:'prime_evidence_h50_find'}]}],allowed_mentions:{parse:[]}});
 }
 if(i.type===3&&custom.startsWith('prime_evidence_h50_group:')){
  const parts=custom.match(/^prime_evidence_h50_group:(AF|GL|MR|SZ):(\d{1,6})$/);if(!parts||Number(parts[2])%25!==0)return c.ephemeral('Grupo o página no válido. Vuelve a abrir la plantilla.');
  const group=parts[1],offset=Number(parts[2]);
  c.waitUntil((async()=>{try{
   const authors=await c.db('police_personnel?select=discord_user_id&discord_user_id=eq.'+userId+'&status=eq.active&limit=1');
   if(!authors?.length){await c.reply(i,{content:'Necesitas una ficha policial activa para registrar evidencias.'});return;}
   const data=await c.db('rpc/police_evidence_h50_initials',{method:'POST',body:JSON.stringify({p_group:group,p_offset:offset})});
   if(!Array.isArray(data.records))throw Error('Invalid initials result');
   const rows=data.records,components:any[]=[];
   if(rows.length)components.push({type:1,components:[{type:3,custom_id:'prime_evidence_h50_select',placeholder:'Seleccionar policía · Nombre y placa',min_values:1,max_values:1,options:rows.map((person:any)=>({label:label(person).slice(0,100),value:person.discord_user_id,description:('@'+(person.discord_username||'Sin usuario Discord')).slice(0,100)}))}]});
   const title={AF:'A–F',GL:'G–L',MR:'M–R',SZ:'S–Z / Otros'}[group];
   components.push({type:1,components:[{type:2,style:2,label:'Anterior',custom_id:'prime_evidence_h50_group:'+group+':'+Math.max(0,offset-25),disabled:offset===0},{type:2,style:2,label:'Siguiente',custom_id:'prime_evidence_h50_group:'+group+':'+(offset+25),disabled:!data.has_more},{type:2,style:2,label:'Cambiar inicial',custom_id:'prime_evidence_h50_page:0'},{type:2,style:1,label:'Buscar nombre o placa',custom_id:'prime_evidence_h50_find'}]});
   await c.reply(i,{content:'**Responsable H-50 · '+title+'**\n'+data.total+' policías activos en este grupo.'+(rows.length?' Mostrando '+(offset+1)+' a '+(offset+rows.length)+'.':' No hay agentes en esta página.'),components,allowed_mentions:{parse:[]}});
  }catch(error){console.error('Evidence initials failed:',String(error));await c.reply(i,{content:'No se pudo cargar el grupo. Pulsa Cambiar inicial y vuelve a intentarlo.'});}})());return c.response(6,{});
 }
 if(i.type===3&&(custom==='prime_evidence_h50_select'||/^prime_evidence_h50_select:\d{1,6}$/.test(custom))){
  const values=i.data?.values,id=Array.isArray(values)&&values.length===1?String(values[0]):'';
  const option=(i.message?.components||[]).flatMap((row:any)=>row.components||[]).filter((node:any)=>node.custom_id===custom).flatMap((node:any)=>node.options||[]).find((item:any)=>item.value===id);
  if(!/^\d{17,20}$/.test(id)||!option)return c.ephemeral('Selecciona un H-50 válido o vuelve a buscar.');
  return startParticipantPicker(i,userId,c,id,text(option.label));
 }
 if(i.type===5&&custom==='prime_evidence_h50_search'){
  const query=text(component(i,'evidence_h50_query')?.value).replace(/^@/, '').trim();if(!query||query.length>100)return c.ephemeral('Escribe el usuario después de @, su nombre o su placa para buscar al H-50.');
  c.waitUntil((async()=>{try{const member=await c.discord('/guilds/'+GUILD+'/members/'+userId);if(!permitted(member.roles||[])){await c.reply(i,{content:'Tu cuenta ya no tiene el rol Policía autorizado.'});return;}
   const authors=await c.db('police_personnel?select=discord_user_id&discord_user_id=eq.'+userId+'&status=eq.active&limit=1');if(!authors?.length){await c.reply(i,{content:'Necesitas una ficha policial activa para registrar evidencias.'});return;}
   const matches=await c.db('rpc/police_evidence_h50_search',{method:'POST',body:JSON.stringify({p_search:query})}),again={type:1,components:[{type:2,style:2,label:'Cambiar búsqueda',custom_id:'prime_evidence_h50_find'},{type:2,style:2,label:'Buscar en plantilla',custom_id:'prime_evidence_h50_page:0'}]};
   if(!matches.length||matches.length>25){await c.reply(i,{content:matches.length?'Hay demasiados resultados. Escribe un nombre o placa más preciso.':'No se encontró ningún policía activo con ese nombre, usuario o placa.',components:[again],allowed_mentions:{parse:[]}});return;}
   await c.reply(i,{content:'**Coincidencias en la plantilla policial activa: '+matches.length+'**\nElige al responsable H-50 por su nombre y placa. Después indica el operativo, los policías participantes y la evidencia. Adjunta la foto o envíala antes al canal del formulario mencionando a RH Police (máximo 10 minutos).',components:[{type:1,components:[{type:3,custom_id:'prime_evidence_h50_select',placeholder:'Elegir entre las coincidencias',min_values:1,max_values:1,options:matches.map((person:any)=>({label:label(person).slice(0,100),value:person.discord_user_id,description:('@'+(person.discord_username||'Sin usuario Discord')).slice(0,100)}))}]},again],allowed_mentions:{parse:[]}});
  }catch(error){console.error('Evidence H50 search failed:',String(error));await c.reply(i,{content:'No se pudo consultar la plantilla. Vuelve a buscar en unos instantes.'});}})());return c.response(5,{flags:64});
 }
 if(i.type===5&&(custom==='prime_evidence_submit'||/^prime_evidence_submit:\d{17,20}$/.test(custom))){
  const validation=evidenceSubmission(i);if(validation.error)return c.ephemeral(validation.error);
  c.waitUntil(saveEvidence(i,userId,c).catch(async error=>{console.error('Evidence save failed:',String(error));await c.reply(i,{content:'No se pudo confirmar la evidencia. Revisa el canal y la web antes de repetir o contacta con UCOP.'});}));return c.response(5,{flags:64});
 }
 return c.ephemeral('Formulario de evidencias no compatible. Vuelve a Registrar evidencia.');
}
