const GUILD='1539970134469378068',POLICE='1539970134482092038',EXPELLED='1539970134482092034',VETO='1564310246128619560';
const BOT_ID='1540484542354428025';
export const EVIDENCE_TEST_CHANNEL_ID='1539970137455853693';
type Context={db:(path:string,init?:RequestInit)=>Promise<any>,discord:(path:string,init?:RequestInit)=>Promise<any>,response:(type:number,data:any)=>Response,ephemeral:(text:string)=>Response,reply:(i:any,payload:any)=>Promise<void>,waitUntil:(task:Promise<any>)=>void,openModal?:(i:any,data:any)=>Promise<Response>};
const text=(value:any)=>String(value??'').replace(/[\u200B-\u200D\u2060\uFEFF]/g,'').trim();
const input=(id:string,placeholder:string,max:number,style=1)=>({type:4,custom_id:id,style,placeholder,min_length:1,max_length:max,required:true});
function component(i:any,id:string){let result:any;const visit=(node:any)=>{if(!node||typeof node!=='object')return;if(node.custom_id===id)result=node;if(node.component)visit(node.component);for(const child of node.components||[])visit(child);};for(const node of i.data?.components||[])visit(node);return result;}
function selectedId(i:any){const values=component(i,'evidence_h50_user')?.values;return Array.isArray(values)&&values.length===1&&/^\d{17,20}$/.test(values[0])?String(values[0]):'';}
function permitted(roles:string[]){return roles.includes(POLICE)&&!roles.includes(EXPELLED)&&!roles.includes(VETO);}
function label(person:any){return text(person.full_name)+' · #'+(text(person.plate)||'Sin placa');}
export function evidenceSearchModal(){return {custom_id:'prime_evidence_h50_search',title:'Buscar responsable H-50',components:[{type:18,label:'Nombre, usuario de Discord o placa',description:'Busca a un policía de la plantilla activa.',component:input('evidence_h50_query','Ej.: Pedro, PEDRITO o 0002',100)}]};}
export function evidenceForm(person:any){return {custom_id:'prime_evidence_submit',title:'Registrar evidencia · PRIME POLICE',components:[
 {type:10,content:'📷 Para pegar una captura: envíala en este canal mencionando a **RH Police** antes de enviar este formulario. También puedes adjuntarla abajo. La fotografía es obligatoria.'},
 {type:18,label:'Locker de evidencias',component:input('evidence_locker','Ej.: 29 o EVIDENCIAS',100)},
 {type:18,label:'Objetos incautados',component:input('evidence_objects','Cantidad, nombre y calibre de los objetos',1500,2)},
 {type:18,label:'Responsable H-50',description:'Policía seleccionado de la plantilla. Para cambiarlo, vuelve a la lista.',component:{type:3,custom_id:'evidence_h50_user',min_values:1,max_values:1,required:true,options:[{label:(text(person.selectionLabel)||label(person)).slice(0,100),value:person.discord_user_id,default:true}]}},
 {type:18,label:'Fotografía de la evidencia',description:'Si ya pegaste y enviaste la captura mencionando a RH Police, no la adjuntes otra vez.',component:{type:19,custom_id:'evidence_photo',file_types:['image'],min_values:0,max_values:1,required:false}}
 ]};}
function photoError(photo:any){
 if(!photo||!['image/png','image/jpeg','image/webp','image/gif'].includes(String(photo.content_type||'').toLowerCase())||!Number.isSafeInteger(photo.size)||photo.size<=0)return 'Debes adjuntar una fotografía válida y no vacía: PNG, JPG, WEBP o GIF.';
 try{const url=new URL(photo.url);if(url.protocol!=='https:'||!['cdn.discordapp.com','media.discordapp.net'].includes(url.hostname)||!/^\/(?:ephemeral-)?attachments\//.test(url.pathname)||url.username||url.password)throw Error();}catch{return 'La fotografía debe ser un archivo de Discord.';}
 return null;
}
export function recentPastedPhoto(messages:any[],userId:string,now=Date.now()){
 const source=messages.find(message=>String(message.author?.id)===userId&&!message.author?.bot&&String(message.channel_id)===EVIDENCE_TEST_CHANNEL_ID&&message.mentions?.some((user:any)=>String(user.id)===BOT_ID)&&Array.isArray(message.attachments)&&message.attachments.length&&Number.isFinite(Date.parse(message.timestamp))&&now-Date.parse(message.timestamp)>=0&&now-Date.parse(message.timestamp)<=600000);
 if(!source||!/^\d{17,20}$/.test(String(source.id)))return {error:'Falta la foto: pega la captura en este canal, menciona a RH Police y envíala. Después vuelve a Registrar evidencia. También puedes adjuntarla en el formulario.'};
 if(source.attachments.length!==1)return {error:'Envía una sola fotografía por mensaje para que el bot identifique la evidencia correcta.'};
 const error=photoError(source.attachments[0]);return error?{error}:{photo:source.attachments[0],sourceId:String(source.id)};
}
export function evidenceSubmission(i:any){
 const locker=text(component(i,'evidence_locker')?.value),objects=text(component(i,'evidence_objects')?.value),h50Id=selectedId(i),files=component(i,'evidence_photo')?.values;
 if(!locker||!objects)return {error:'Completa el locker y los objetos incautados. No se aceptan campos vacíos ni solo espacios.'};
 if(locker.length>100||objects.length>1500)return {error:'El locker admite 100 caracteres y los objetos 1500.'};
 if(!h50Id)return {error:'Selecciona un responsable H-50 de la plantilla. Si abriste el formulario anterior, ciérralo y vuelve a Registrar evidencia.'};
 if(files!==undefined&&(!Array.isArray(files)||files.length>1))return {error:'Adjunta una sola fotografía válida.'};
 const photo=files?.length===1?i.data?.resolved?.attachments?.[files[0]]:null;
 if(files?.length===1){if(!photo||String(photo.id)!==String(files[0]))return {error:'El archivo adjunto no es válido.'};const error=photoError(photo);if(error)return {error};}
 return {locker,objects,h50Id,photo};
}
async function saveEvidence(i:any,userId:string,c:Context){
 const data=evidenceSubmission(i);if(data.error){await c.reply(i,{content:data.error});return;}
 const member=await c.discord('/guilds/'+GUILD+'/members/'+userId);if(!permitted(member.roles||[])){await c.reply(i,{content:'Debes tener el rol Policía activo y no estar expulsado ni vetado.'});return;}
 const personPath=(id:string)=>'police_personnel?select=discord_user_id,full_name,plate&discord_user_id=eq.'+id+'&status=eq.active&limit=1';
 const [authors,responsibles]=await Promise.all([c.db(personPath(userId)),c.db(personPath(data.h50Id!))]);const author=authors?.[0],responsible=responsibles?.[0];
 if(!author){await c.reply(i,{content:'No tienes ficha policial activa. Contacta con UCOP.'});return;}
 if(!responsible||!text(responsible.full_name)){await c.reply(i,{content:'El H-50 seleccionado ya no está en la plantilla activa. Vuelve a buscar al responsable antes de registrar la evidencia.'});return;}
 const h50Member=await c.discord('/guilds/'+GUILD+'/members/'+data.h50Id);
 if(h50Member.user?.bot||!permitted(h50Member.roles||[])){await c.reply(i,{content:'El responsable H-50 debe ser un policía activo del servidor, sin expulsión ni veto. Selecciona otro responsable de la plantilla.'});return;}
 let photo=data.photo,sourceId:string|null=null;
 if(!photo){const source=recentPastedPhoto(await c.discord('/channels/'+EVIDENCE_TEST_CHANNEL_ID+'/messages?limit=100'),userId);if(source.error){await c.reply(i,{content:source.error});return;}photo=source.photo;sourceId=source.sourceId!;
  const used=await c.db('police_evidence_records?select=id&photo_message_id=eq.'+sourceId+'&limit=1');if(used?.length){await c.reply(i,{content:'Esa captura ya tiene una evidencia registrada. Pega una captura nueva o adjunta la fotografía correcta.'});return;}}
 const h50=label(responsible),clean=(value:any)=>String(value??'').replace(/@/g,'＠').replace(/`/g,"'").slice(0,1500);
 const message=await c.discord('/channels/'+EVIDENCE_TEST_CHANNEL_ID+'/messages',{method:'POST',body:JSON.stringify({allowed_mentions:{parse:[]},embeds:[{title:'🔬 Evidencia policial · PRIME POLICE',color:3447003,fields:[{name:'Policía',value:clean(label(author)),inline:false},{name:'Locker',value:clean(data.locker),inline:true},{name:'H-50',value:clean(h50),inline:true},{name:'Objetos incautados',value:clean(data.objects),inline:false}],image:{url:photo.url},footer:{text:'Registro automático RH Police · Prueba'}}]})});
 try{await c.db('police_evidence_records',{method:'POST',body:JSON.stringify({discord_user_id:userId,officer_name:author.full_name,plate:author.plate||'',locker:data.locker,objects_description:data.objects,h50,photo_message_id:sourceId,discord_message_id:String(message.id),channel_id:EVIDENCE_TEST_CHANNEL_ID})});}
 catch{await c.reply(i,{content:'La evidencia se publicó en Discord, pero falló el registro web. Avisa a UCOP con este mensaje: '+String(message.id)});return;}
 await c.reply(i,{content:'✅ Evidencia registrada en Discord y en la web. H-50: '+clean(h50)+'. Mensaje: '+String(message.id)});
}
export async function handleEvidenceInteraction(i:any,userId:string,c:Context):Promise<Response|null>{
 const custom=String(i.data?.custom_id||'');if(!['prime_evidence_open','prime_evidence_h50_find','prime_evidence_h50_search','prime_evidence_h50_select','prime_evidence_submit'].includes(custom)&&!custom.startsWith('prime_evidence_h50_page:'))return null;
 if(i.guild_id!==GUILD||!/^\d{17,20}$/.test(userId)||!permitted(i.member?.roles||[]))return c.ephemeral('Debes registrar evidencias desde el servidor con el rol Policía activo.');
 if(i.type===3&&custom==='prime_evidence_h50_find')return c.openModal?c.openModal(i,evidenceSearchModal()):c.response(9,evidenceSearchModal());
 if(i.type===3&&(custom==='prime_evidence_open'||custom.startsWith('prime_evidence_h50_page:'))){
  const raw=custom==='prime_evidence_open'?'0':custom.split(':')[1];
  if(!/^\d{1,6}$/.test(raw)||Number(raw)%25!==0)return c.ephemeral('Página no válida. Vuelve a Registrar evidencia.');
  const offset=Number(raw);
  c.waitUntil((async()=>{try{
   const authors=await c.db('police_personnel?select=discord_user_id&discord_user_id=eq.'+userId+'&status=eq.active&limit=1');
   if(!authors?.length){await c.reply(i,{content:'Necesitas una ficha policial activa para registrar evidencias.'});return;}
   const matches=await c.db('police_personnel?select=discord_user_id,full_name,plate,discord_username&status=eq.active&order=full_name.asc,discord_user_id.asc&offset='+offset+'&limit=26');
   const rows=matches.slice(0,25),buttons=[{type:2,style:2,label:'Anterior',custom_id:'prime_evidence_h50_page:'+Math.max(0,offset-25),disabled:offset===0},{type:2,style:2,label:'Siguiente',custom_id:'prime_evidence_h50_page:'+(offset+25),disabled:matches.length<=25},{type:2,style:1,label:'Buscar nombre o placa',custom_id:'prime_evidence_h50_find'}];
   const components:any[]=[];
   if(rows.length)components.push({type:1,components:[{type:3,custom_id:'prime_evidence_h50_select',placeholder:'Selecciona al responsable H-50',min_values:1,max_values:1,options:rows.map((person:any)=>({label:label(person).slice(0,100),value:person.discord_user_id,description:('@'+(person.discord_username||'Sin usuario Discord')).slice(0,100)}))}]});
   components.push({type:1,components:buttons});
   await c.reply(i,{content:rows.length?'**Responsable H-50 · Plantilla policial activa**\nNombre y placa · Página '+(offset/25+1)+'. Usa Siguiente para ver el resto o busca por nombre, usuario o placa.':'No hay agentes en esta página. Vuelve a Anterior o busca por nombre o placa.',components,allowed_mentions:{parse:[]}});
  }catch(error){console.error('Evidence roster list failed:',String(error));await c.reply(i,{content:'No se pudo cargar la plantilla. Vuelve a Registrar evidencia.'});}})());
  return custom==='prime_evidence_open'?c.response(5,{flags:64}):c.response(6,{});
 }
 if(i.type===3&&custom==='prime_evidence_h50_select'){
  const values=i.data?.values,id=Array.isArray(values)&&values.length===1?String(values[0]):'';
  const option=(i.message?.components||[]).flatMap((row:any)=>row.components||[]).filter((node:any)=>node.custom_id===custom).flatMap((node:any)=>node.options||[]).find((item:any)=>item.value===id);
  if(!/^\d{17,20}$/.test(id)||!option)return c.ephemeral('Selecciona un H-50 válido o vuelve a buscar.');
  const form=evidenceForm({discord_user_id:id,selectionLabel:text(option.label)});return c.openModal?c.openModal(i,form):c.response(9,form);
 }
 if(i.type===5&&custom==='prime_evidence_h50_search'){
  const query=text(component(i,'evidence_h50_query')?.value);if(!query||query.length>100)return c.ephemeral('Escribe un nombre, usuario o placa para buscar al H-50.');
  c.waitUntil((async()=>{try{const member=await c.discord('/guilds/'+GUILD+'/members/'+userId);if(!permitted(member.roles||[])){await c.reply(i,{content:'Tu cuenta ya no tiene el rol Policía autorizado.'});return;}
   const authors=await c.db('police_personnel?select=discord_user_id&discord_user_id=eq.'+userId+'&status=eq.active&limit=1');if(!authors?.length){await c.reply(i,{content:'Necesitas una ficha policial activa para registrar evidencias.'});return;}
   const matches=await c.db('rpc/police_evidence_h50_search',{method:'POST',body:JSON.stringify({p_search:query.replace(/^@/, '').trim()})}),again={type:1,components:[{type:2,style:2,label:'Cambiar búsqueda',custom_id:'prime_evidence_h50_find'},{type:2,style:2,label:'Ver toda la plantilla',custom_id:'prime_evidence_open'}]};
   if(!matches.length||matches.length>25){await c.reply(i,{content:matches.length?'Hay demasiados resultados. Escribe un nombre o placa más preciso.':'No se encontró ningún policía activo con ese nombre, usuario o placa.',components:[again],allowed_mentions:{parse:[]}});return;}
   await c.reply(i,{content:'Selecciona al responsable H-50 de la plantilla. Después completa la evidencia y adjunta la fotografía.',components:[{type:1,components:[{type:3,custom_id:'prime_evidence_h50_select',placeholder:'Seleccionar responsable H-50',min_values:1,max_values:1,options:matches.map((person:any)=>({label:label(person).slice(0,100),value:person.discord_user_id,description:('@'+(person.discord_username||'Sin usuario Discord')).slice(0,100)}))}]},again],allowed_mentions:{parse:[]}});
  }catch(error){console.error('Evidence H50 search failed:',String(error));await c.reply(i,{content:'No se pudo consultar la plantilla. Vuelve a buscar en unos instantes.'});}})());return c.response(5,{flags:64});
 }
 if(i.type===5&&custom==='prime_evidence_submit'){
  const validation=evidenceSubmission(i);if(validation.error)return c.ephemeral(validation.error);
  c.waitUntil(saveEvidence(i,userId,c).catch(async error=>{console.error('Evidence save failed:',String(error));await c.reply(i,{content:'No se pudo confirmar la evidencia. Revisa el canal y la web antes de repetir o contacta con UCOP.'});}));return c.response(5,{flags:64});
 }
 return c.ephemeral('Formulario de evidencias no compatible. Vuelve a Registrar evidencia.');
}
