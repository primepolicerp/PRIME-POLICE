import {REAL_RANKS,realRank,rankedNickname,shouldAssignUcopBranch} from '../_shared/real-ranks.ts';
import {writeAudit} from './audit-events.ts';
import {announceDeparture} from './departure-announcements.ts';
import {DEPARTURE_ROLES,departureRoleChoice,hasPersonnelRestriction} from '../_shared/departure-roles.ts';
export const DEPARTURE_TYPES:Record<string,string>={pkt:'PKT',ck:'Muerte (CK)',despido:'Despido',corrupcion:'Corrupción',renuncia:'Renuncia',jubilacion:'Jubilación',transferencia:'Transferencia',inactividad:'Inactividad',otro:'Otro'};
const POLICE='1539970134482092038',UCOP='1539970134519578773',CIC='1539970134519578772';
const managed=new Set<string>([POLICE,UCOP,CIC,...REAL_RANKS.map(r=>r.id),...Object.values(DEPARTURE_ROLES).map(r=>r.id)]);
const blocked=(1n<<1n)|(1n<<2n)|(1n<<3n)|(1n<<4n)|(1n<<5n)|(1n<<28n)|(1n<<29n)|(1n<<40n);
type Context={db:(path:string,init?:RequestInit)=>Promise<any>,discord:(path:string,init?:RequestInit)=>Promise<any>,json:(v:any,status?:number)=>Response,actorName:string,actorIsDirector?:boolean};
export function validatePersonnelMovement(body:any,person:any,action:string){
 const date=String(body.effective_date||''),reason=String(body.reason||'').trim();
 if(!/^[a-f0-9-]{36}$/i.test(body.operation_id||'')||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'})||reason.length<3||reason.length>2000)return 'Completa la fecha y una observación de entre 3 y 2000 caracteres.';
 if(!body.expected_updated_at||Date.parse(body.expected_updated_at)!==Date.parse(person.updated_at))return 'La ficha cambió. Actualiza Personal antes de continuar.';
 if(action==='personnel-departure')return person.status!=='active'?'El agente ya está de baja.':!Object.prototype.hasOwnProperty.call(DEPARTURE_TYPES,body.departure_type)||!['voluntary','expelled','banned'].includes(departureRoleChoice(body.departure_type,body.departure_role))?'Selecciona un motivo y uno de los tres roles de baja.':'';
 if(person.status!=='inactive')return 'El agente ya está activo.';
 if(['banned','expelled'].includes(person.departure_role))return 'El agente tiene una expulsión o veto registrado. Debe resolverse antes de permitir su reingreso.';
 if(person.departure_date&&date<person.departure_date)return 'El reingreso no puede ser anterior a la baja.';
 return !realRank(body.rank_role_id)||!['POLICIA','UCOP','CIC'].includes(body.unit)?'Selecciona rango y división para el reingreso.':'';
}
export async function changePersonnelStatus(req:Request,action:string,actor:string,c:Context){
 const body=await req.json(),target=String(body.discord_user_id||''),departure=action==='personnel-departure',kind=departure?'departure':'reentry';
 if(!/^\d{17,20}$/.test(target)||!['personnel-departure','personnel-reentry'].includes(action))return c.json({error:'Agente inválido.'},400);
 const people=await c.db('police_personnel?select=*&discord_user_id=eq.'+target+'&limit=1'),person=people?.[0];
 if(!person)return c.json({error:'La ficha ya no existe.'},404);
 if(!/^[a-f0-9-]{36}$/i.test(body.operation_id||''))return c.json({error:'Operación inválida.'},400);
 const eventPath='police_personnel_movements?select=*&id=eq.'+body.operation_id+'&limit=1';
 const previous=await c.db(eventPath);
 if(previous?.length)return previous[0].discord_user_id===target&&previous[0].kind===kind&&previous[0].actor_id===actor?c.json({ok:true,person,message:'Este movimiento ya estaba guardado.'}):c.json({error:'Esta referencia pertenece a otro movimiento.'},409);
 const invalid=validatePersonnelMovement(body,person,action);if(invalid)return c.json({error:invalid},409);
 const memberPath='/guilds/1539970134469378068/members/'+target;
 let member:any;try{member=await c.discord(memberPath);}catch(error){if(departure&&((error as any)?.status===404||String(error).includes('404')))member=null;else throw error;}
 const original:string[]=member?.roles||[],desired=new Set<string>(departure?[]:original.filter(r=>!managed.has(r))),changed:Array<[string,string]>=[];
 let automaticRoles:string[]=[],departureRolesAttempted=false;
 const sameRoles=(a:string[],b:string[])=>{const left=[...a].sort(),right=[...b].sort();return left.length===right.length&&left.every((r,i)=>r===right[i]);};
 const departureRole=departure?departureRoleChoice(body.departure_type,body.departure_role):null;
 if(departure&&((original.includes(DEPARTURE_ROLES.banned.id)&&departureRole!=='banned')||(original.includes(DEPARTURE_ROLES.expelled.id)&&!['expelled','banned'].includes(departureRole))))return c.json({error:'El agente ya tiene una restricción más grave. No se puede retirar un veto o una expulsión mediante otra baja.'},409);
 if(departure&&member){
  const selected=DEPARTURE_ROLES[departureRole as keyof typeof DEPARTURE_ROLES],live=await c.discord('/guilds/1539970134469378068/roles');
  const role=live.find((r:any)=>r.id===selected.id);
  if(!role||role.managed||(BigInt(role.permissions||'0')&blocked)!==0n)return c.json({error:'El rol de baja no existe o tiene permisos administrativos. Revisa la configuración de Discord.'},409);
  const self=await c.discord('/users/@me'),bot=await c.discord('/guilds/1539970134469378068/members/'+self.id);
  const top=Math.max(-1,...live.filter((r:any)=>(bot.roles||[]).includes(r.id)).map((r:any)=>Number(r.position)));
  for(const id of original){
   const existing=live.find((r:any)=>r.id===id);
   if(!existing)return c.json({error:'Los roles del agente cambiaron. Actualiza la ficha y vuelve a intentarlo.'},409);
   if(existing.managed){desired.add(id);automaticRoles.push(String(existing.name||id));}
   else if(id!==selected.id&&Number(existing.position)>=top)return c.json({error:'No se puede completar la baja: el rol «'+existing.name+'» está a la misma altura o por encima del bot. Sube el rol del bot antes de confirmar la baja.'},409);
  }
  if(Number(role.position)>=top)return c.json({error:'El rol de baja debe estar por debajo del rol del bot.'},409);
  desired.add(selected.id);
 }
 let restoredPreviousRank=false;
 if(!departure){
  if(hasPersonnelRestriction(original))return c.json({error:'No se puede reingresar a una persona con el rol Expulsado o Vetado.'},409);
  const rank=realRank(body.rank_role_id)!,[configured,live]=await Promise.all([c.db('police_rank_roles?select=role_id'),c.discord('/guilds/1539970134469378068/roles')]);
  const role=live.find((r:any)=>r.id===rank.id);
  if(!configured.some((r:any)=>r.role_id===rank.id)||!role||role.managed)return c.json({error:'Ese rango no existe en la escala o no es asignable.'},409);
  if((BigInt(role.permissions||'0')&blocked)!==0n){
   if(c.actorIsDirector!==true)return c.json({error:'Este rango tiene permisos elevados. Solo Directiva puede asignarlo al confirmar el reingreso.'},409);
   restoredPreviousRank=true;
  }
  desired.add(POLICE);desired.add(rank.id);if(body.unit==='CIC')desired.add(CIC);if(body.unit==='UCOP'&&shouldAssignUcopBranch([rank.id],rank.id))desired.add(UCOP);
 }
 let committing=false,result:any,warning='',notificationState:string|undefined;
 try{
  if(departure&&member){
   departureRolesAttempted=true;
   const applied=await c.discord(memberPath,{method:'PATCH',body:JSON.stringify({roles:[...desired]}),headers:{'X-Audit-Log-Reason':encodeURIComponent('PRIME POLICE: baja de personal autorizada por '+c.actorName)}});
   const confirmed=Array.isArray(applied?.roles)?applied:await c.discord(memberPath);
   if(!sameRoles(confirmed.roles||[],[...desired]))throw Error('Discord no confirmó la retirada completa de los roles.');
  }else{
   for(const role of original.filter(r=>managed.has(r)&&!desired.has(r))){await c.discord(memberPath+'/roles/'+role,{method:'DELETE'});changed.push([role,'PUT']);}
   for(const role of [...desired].filter(r=>!original.includes(r))){await c.discord(memberPath+'/roles/'+role,{method:'PUT',body:'{}'});changed.push([role,'DELETE']);}
  }
  committing=true;
  result=await c.db('rpc/change_police_personnel_status',{method:'POST',body:JSON.stringify({p_operation:body.operation_id,p_user:target,p_kind:kind,p_departure_role:departureRole,p_type:departure?body.departure_type:null,p_date:body.effective_date,p_reason:String(body.reason).trim(),p_actor:actor,p_actor_name:c.actorName,p_expected_updated_at:body.expected_updated_at,p_rank_id:departure?null:body.rank_role_id,p_rank_name:departure?null:realRank(body.rank_role_id)!.name,p_unit:departure?null:body.unit})});
  if(!result?.ok){committing=false;throw Error(result?.error||'No se pudo guardar el movimiento.');}
 }catch(error){
  if(committing){
   let saved:any[];try{saved=await c.db(eventPath);}catch{return c.json({error:'No se pudo confirmar el resultado. Actualiza la ficha antes de repetir el movimiento.'},503);}
   if(saved?.length)result={ok:true};else committing=false;
  }
  if(!result?.ok){let rollbackFailed=false;
   if(departureRolesAttempted)try{
    const current=await c.discord(memberPath);
    if(!sameRoles(current.roles||[],original)){
     const restored=await c.discord(memberPath,{method:'PATCH',body:JSON.stringify({roles:original})});
     const confirmed=Array.isArray(restored?.roles)?restored:await c.discord(memberPath);
     if(!sameRoles(confirmed.roles||[],original))rollbackFailed=true;
    }
   }catch{rollbackFailed=true;}
   for(const [role,method]of changed.reverse())try{await c.discord(memberPath+'/roles/'+role,{method,...(method==='PUT'?{body:'{}'}:{})});}catch{rollbackFailed=true;}
   console.error('Personnel status change:',String(error));return c.json({error:rollbackFailed?'No se guardó el movimiento y falta restaurar algún rol. Revisa Discord antes de reintentar.':'No se guardó el movimiento. '+(String(error).includes('Discord')?'Comprueba que el bot pueda administrar los roles del agente.':String(error).replace(/^Error: /,''))},502);
  }
 }
 if(member)try{await c.discord(memberPath,{method:'PATCH',body:JSON.stringify({nick:departure?rankedNickname(person.full_name,'',[]):rankedNickname(person.full_name,person.plate,[...desired])})});}catch{warning='Movimiento guardado; no se pudo actualizar el apodo de Discord.';}
 else warning='Baja guardada. La persona ya no está en el servidor de Discord.';
 if(automaticRoles.length)warning=[warning,'Discord conserva '+automaticRoles.length+' rol(es) automático(s) de integración; no se pueden retirar manualmente.'].filter(Boolean).join(' ');
 if(departure){const notice=await announceDeparture({eventId:body.operation_id,userId:target,name:person.full_name,plate:person.plate,rank:person.rank_name,type:DEPARTURE_TYPES[body.departure_type],role:departureRole==='none'?'Sin rol adicional':DEPARTURE_ROLES[departureRole].name,date:body.effective_date,approvedBy:c.actorName,timestamp:result.movement?.created_at||new Date().toISOString()},c.discord);notificationState=notice?'pending':'confirmed';warning=[warning,notice].filter(Boolean).join(' ');}
 await writeAudit(departure?'📉 Baja de personal':'↩️ Reingreso de personal',[{name:'Agente',value:person.full_name+' #'+person.plate},{name:'Gestor',value:c.actorName},{name:'Tipo',value:departure?DEPARTURE_TYPES[body.departure_type]:'Reingreso'},{name:'Rol de baja',value:departure?(departureRole==='none'?'Sin rol adicional':DEPARTURE_ROLES[departureRole].name):'Retirada de Baja Voluntaria'},{name:'Motivo',value:body.reason},{name:'Fecha',value:body.effective_date}]);
 if(restoredPreviousRank)await writeAudit('🔐 Rango elevado asignado por Directiva',[{name:'Agente',value:person.full_name+' #'+person.plate},{name:'Rango',value:realRank(body.rank_role_id)!.name},{name:'Autorizado por',value:c.actorName}]);
 return c.json({ok:true,person:result.person,sync:{record:'saved',roles:member?'confirmed':'not_in_server',...(notificationState?{notification:notificationState}:{})},message:departure?'Baja registrada. Se conserva la ficha y su historial.':'Reingreso registrado en la misma ficha.',warning:warning||undefined});
}
