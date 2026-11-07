const GUILD='1539970134469378068',POLICE='1539970134482092038',EXPELLED='1539970134482092034',VETO='1564310246128619560';
type Option={label:string,value:string,description?:string,default?:boolean};
type Context={db:(path:string,init?:RequestInit)=>Promise<any>,discord:(path:string,init?:RequestInit)=>Promise<any>,response:(type:number,data:any)=>Response,ephemeral:(text:string)=>Response,reply:(i:any,payload:any)=>Promise<void>,waitUntil:(task:Promise<any>)=>void,openModal?:(i:any,data:any)=>Promise<Response>};
const valid=(id:any)=>typeof id==='string'&&/^\d{17,20}$/.test(id);
const nodes=(i:any)=>(i.message?.components||[]).flatMap((row:any)=>row.components||[]);
function selectedTeam(i:any,h50:string):Option[]{
 const embed=i.message?.embeds?.[0];
 if(embed?.title==='Policías añadidos'){
  const options=Array.from(String(embed.description||'').matchAll(/\[([^\]\r\n]{1,100})\]\(https:\/\/discord\.com\/users\/(\d{17,20})\)/g),m=>({label:m[1],value:m[2]}));
  if(options.length>25||new Set(options.map(p=>p.value)).size!==options.length)throw Error('Invalid participant selection');
  return options;
 }
 const menu=nodes(i).find((node:any)=>String(node.custom_id||'').startsWith('prime_evidence_team:'+h50+':'));
 const options=menu?.options||[];
 if(!Array.isArray(options)||options.length>25||options.some((p:any)=>!valid(p.value)))throw Error('Invalid participant selection');
 return options.map((p:any)=>({label:String(p.label).slice(0,100),value:p.value,description:String(p.description||'').slice(0,100)}));
}
const h50Label=(i:any)=>String(i.message?.embeds?.[0]?.fields?.find((f:any)=>f.name==='H-50')?.value||'Responsable seleccionado').slice(0,100);
function participantActions(h50:string,count:number){return {type:1,components:[{type:2,style:1,label:count?'Añadir otro':'Buscar policía',custom_id:'prime_evidence_find_people:'+h50},...(count?[{type:2,style:3,label:'Continuar',custom_id:'prime_evidence_ready:'+h50},{type:2,style:2,label:'Corregir lista',custom_id:'prime_evidence_edit_team:'+h50}]:[{type:2,style:2,label:'Ver plantilla',custom_id:'prime_evidence_people:'+h50+':0'}])]};}
function teamEmbed(h50Name:string,team:Option[]){return {title:'Policías añadidos',description:team.length?team.map(p=>'['+p.label.replace(/[\[\]\\()<>*_`@]/g,' ').slice(0,100)+'](https://discord.com/users/'+p.value+')').join('\n'):'Todavía no has añadido a nadie.',fields:[{name:'H-50',value:h50Name.replace(/@/g,'＠').slice(0,100)}]};}
async function renderParticipants(i:any,userId:string,c:Context,h50:string,name:string,offset:number,team:Option[],query=''){
 const members=new Map<string,Promise<any>>();
 const member=(id:string)=>{if(!members.has(id))members.set(id,c.discord('/guilds/'+GUILD+'/members/'+id).catch(error=>{if((error as any)?.status===404)return null;throw error;}));return members.get(id)!;};
 const eligible=async(id:string)=>{const m=await member(id),roles=m?.roles||[];return m&&!m.user?.bot&&roles.includes(POLICE)&&!roles.includes(EXPELLED)&&!roles.includes(VETO);};
 if(!await eligible(userId))throw Error('Actor no longer police');
 const authors=await c.db('police_personnel?select=discord_user_id&discord_user_id=eq.'+userId+'&status=eq.active&limit=1');
 if(!authors?.length)throw Error('Actor no longer active');
 const page=offset<0?[]:query?await c.db('rpc/police_evidence_h50_search',{method:'POST',body:JSON.stringify({p_search:query})}):await c.db('police_personnel?select=discord_user_id,full_name,plate,discord_username&status=eq.active&order=full_name.asc,discord_user_id.asc&limit=26&offset='+offset);
 if(!Array.isArray(page))throw Error('Invalid roster');
 const selected=team.length?await c.db('police_personnel?select=discord_user_id,full_name,plate,discord_username&discord_user_id=in.('+team.map(p=>p.value).join(',')+')&status=eq.active&limit=25'):[];
 const candidates=[...new Map([...page.slice(0,25),...selected].filter(p=>valid(p.discord_user_id)).map(p=>[p.discord_user_id,p])).values()] as any[];
 // Keep concurrency small; fail closed if Discord cannot confirm current roles.
 const allowed=new Set<string>();let cursor=0;
 await Promise.all(Array.from({length:Math.min(4,candidates.length)},async()=>{while(cursor<candidates.length){const person=candidates[cursor++];if(await eligible(person.discord_user_id))allowed.add(person.discord_user_id);}}));
 const option=(p:any):Option=>({label:(String(p.full_name)+' · #'+String(p.plate||'Sin placa')).slice(0,100),value:p.discord_user_id,description:('@'+String(p.discord_username||'Sin usuario')).slice(0,100)});
 const selectedById=new Map(selected.filter((p:any)=>allowed.has(p.discord_user_id)).map((p:any)=>[p.discord_user_id,p]));
 team=team.filter(p=>selectedById.has(p.value)).map(p=>option(selectedById.get(p.value)));
 const ids=new Set(team.map(p=>p.value)),options=page.slice(0,25).filter((p:any)=>allowed.has(p.discord_user_id)).map((p:any)=>({...option(p),default:ids.has(p.discord_user_id)}));
 const components:any[]=[];
 if(query&&options.length<=3){for(const p of options)components.push({type:1,components:[{type:2,style:1,label:p.label.slice(0,80),custom_id:'prime_evidence_add:'+h50+':'+p.value,disabled:ids.has(p.value)}]});}
 else if(options.length)components.push({type:1,components:[{type:3,custom_id:'prime_evidence_pick:'+h50+':'+offset,placeholder:'Selecciona a quienes participaron',min_values:0,max_values:options.length,options}]});
 components.push(participantActions(h50,team.length));
 if(!query&&offset>=0)components.push({type:1,components:[{type:2,style:2,label:'Anterior',custom_id:'prime_evidence_people:'+h50+':'+Math.max(0,offset-25),disabled:offset===0},{type:2,style:2,label:'Siguiente',custom_id:'prime_evidence_people:'+h50+':'+(offset+25),disabled:page.length<=25}]});
 await c.reply(i,{content:offset<0?'✅ Lista actualizada. Añade a otro policía o pulsa **Continuar**.':query&&options.length<=3?(options.length?'Pulsa el nombre del policía para añadirlo.':'No hay coincidencias. Prueba otro nombre o placa.'):'Selecciona a los policías que participaron.',embeds:[teamEmbed(name,team)],components,allowed_mentions:{parse:[]}});
}
export function startParticipantPicker(i:any,userId:string,c:Context,h50:string,name:string){
 return c.response(7,{content:'**¿Quiénes participaron en el operativo?**\nBusca por nombre o placa, añade a los policías y pulsa **Continuar**.',embeds:[{title:'Equipo del operativo',fields:[{name:'H-50',value:name.replace(/@/g,'＠').slice(0,100)},{name:'Participantes seleccionados',value:'Ninguno todavía'}]}],components:[participantActions(h50,0)],allowed_mentions:{parse:[]}});
}
export function handleParticipantPicker(i:any,userId:string,c:Context,form:(person:any,options:Option[])=>any):Response|Promise<Response>|null{
 const custom=String(i.data?.custom_id||'');
 if(!/^prime_evidence_(people|pick|team|ready|find_people|people_search|add|edit_team):/.test(custom))return null;
 const search=custom.match(/^prime_evidence_people_search:(\d{17,20}):(\d{1,2})$/);
 if(i.type===5&&search){
  const team=selectedTeam(i,search[1]);if(team.length!==Number(search[2]))return c.ephemeral('No se pudo recuperar tu equipo. Vuelve a abrir la búsqueda desde la lista de participantes.');
  const field=(i.data?.components||[]).map((row:any)=>row.component||row.components?.[0]).find((node:any)=>node?.custom_id==='participant_query');
  const query=String(field?.value||'').replace(/[\u200B-\u200D\u2060\uFEFF]/g,'').replace(/^@/,'').trim();if(!query||query.length>100)return c.ephemeral('Escribe un nombre o una placa.');
  c.waitUntil(renderParticipants(i,userId,c,search[1],h50Label(i),0,team,query).catch(async error=>{console.error('Evidence participant search:',String(error));await c.reply(i,{content:'No se pudo buscar. Pulsa Buscar nombre o placa para intentarlo otra vez.'});}));return c.response(6,{});
 }
 if(i.type!==3)return c.ephemeral('Vuelve a abrir la lista de policías.');
 const edit=custom.match(/^prime_evidence_edit_team:(\d{17,20})$/);
 if(edit){const team=selectedTeam(i,edit[1]);if(!team.length)return c.ephemeral('No hay policías añadidos.');return c.response(7,{content:'Desmarca los policías que quieras quitar.',embeds:[teamEmbed(h50Label(i),team)],components:[{type:1,components:[{type:3,custom_id:'prime_evidence_team:'+edit[1]+':0',placeholder:'Desmarca para quitar',min_values:0,max_values:team.length,options:team.map(p=>({...p,default:true}))}]},participantActions(edit[1],team.length)],allowed_mentions:{parse:[]}});}
 const add=custom.match(/^prime_evidence_add:(\d{17,20}):(\d{17,20})$/);
 if(add){const button=nodes(i).find((node:any)=>node.type===2&&node.custom_id===custom&&!node.disabled);if(!button)return c.ephemeral('Vuelve a buscar al policía.');const team=selectedTeam(i,add[1]);if(!team.some(p=>p.value===add[2]))team.push({label:String(button.label),value:add[2]});if(team.length>25)return c.ephemeral('El máximo es de 25 participantes.');c.waitUntil(renderParticipants(i,userId,c,add[1],h50Label(i),-1,team).catch(async error=>{console.error('Evidence participant add:',String(error));await c.reply(i,{content:'No se pudo añadir. Vuelve a buscar al policía.'});}));return c.response(6,{});}
 const find=custom.match(/^prime_evidence_find_people:(\d{17,20})$/);
 if(find){const team=selectedTeam(i,find[1]),modal={custom_id:'prime_evidence_people_search:'+find[1]+':'+team.length,title:'Buscar policías participantes',components:[{type:18,label:'Nombre o placa',description:'Puedes escribir parte del nombre, su usuario o la placa.',component:{type:4,custom_id:'participant_query',style:1,required:true,min_length:1,max_length:100,placeholder:'Ej.: Pedro o 0002'}}]};return c.openModal?c.openModal(i,modal):c.response(9,modal);}
 const ready=custom.match(/^prime_evidence_ready:(\d{17,20})$/);
 if(ready){const team=selectedTeam(i,ready[1]);if(!team.length)return c.ephemeral('Selecciona al menos un policía participante.');const modal=form({discord_user_id:ready[1],selectionLabel:h50Label(i)},team);return c.openModal?c.openModal(i,modal):c.response(9,modal);}
 const parsed=custom.match(/^prime_evidence_(people|pick|team):(\d{17,20}):(\d{1,6})$/);
 if(!parsed||Number(parsed[3])%25!==0)return c.ephemeral('Página no válida. Vuelve a abrir la lista de policías.');
 const [,kind,h50,page]=parsed;let team=selectedTeam(i,h50);
 if(kind!=='people'){
  const menu=nodes(i).find((node:any)=>node.custom_id===custom),values=i.data?.values;
  if(!menu||!Array.isArray(values)||values.length>25||new Set(values).size!==values.length||values.some((id:any)=>!valid(id)||!menu.options?.some((p:any)=>p.value===id)))return c.ephemeral('Selección no válida. Actualiza la lista de policías.');
  const picks=menu.options.filter((p:any)=>values.includes(p.value)).map((p:any)=>({label:p.label,value:p.value,description:p.description}));
  team=kind==='team'?picks:[...team.filter(p=>!menu.options.some((o:any)=>o.value===p.value)),...picks];
  if(team.length>25)return c.ephemeral('El máximo es de 25 participantes. Retira alguno del equipo antes de añadir más.');
 }
 c.waitUntil(renderParticipants(i,userId,c,h50,h50Label(i),kind==='people'?Number(page):-1,team).catch(async error=>{console.error('Evidence police picker:',String(error));await c.reply(i,{content:'No se pudo consultar la plantilla. Vuelve a Registrar evidencia.',components:[],embeds:[]});}));
 return c.response(6,{});
}
