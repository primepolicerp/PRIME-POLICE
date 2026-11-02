import {DEPARTURE_ROLES,hasPersonnelRestriction} from '../_shared/departure-roles.ts';
import {shouldAssignUcopBranch} from '../_shared/real-ranks.ts';
import {writeAudit} from './audit-events.ts';
const POLICE='1539970134482092038',UCOP='1539970134519578773',CIC='1539970134519578772';
export function expectedPersonnelAccess(person:any,roles:string[]){
 const wanted=person.unit==='CIC'?CIC:person.unit==='UCOP'&&shouldAssignUcopBranch(roles,person.rank_role_id)?UCOP:null;
 return{wanted,police:roles.includes(POLICE),branch:(!wanted||roles.includes(wanted))&&[UCOP,CIC].every(r=>r===wanted||!roles.includes(r)),restricted:hasPersonnelRestriction(roles)||roles.includes(DEPARTURE_ROLES.voluntary.id)};
}
export async function personnelAccess(req:Request,actor:string,c:any){
 const write=req.method==='POST',body=write?await req.json():{},target=String(write?body.discord_user_id:new URL(req.url).searchParams.get('discord_user_id')||'');
 if(!/^\d{17,20}$/.test(target))return c.json({error:'Agente inválido.'},400);
 const people=await c.db('police_personnel?select=*&discord_user_id=eq.'+target+'&limit=1'),person=people?.[0];if(!person)return c.json({error:'La ficha ya no existe.'},404);
 const path='/guilds/1539970134469378068/members/'+target,member=await c.discord(path),roles:string[]=member.roles||[],state=expectedPersonnelAccess(person,roles);
 if(!write)return c.json({ok:true,...state,active:person.status==='active',director:roles.some(r=>['1539970134565982313','1539970134544748562','1539970134519578774'].includes(r))});
 if(person.status!=='active'||state.restricted)return c.json({error:'La ficha debe estar activa y sin expulsión o veto. Usa Reingresar para resolver una baja.'},409);
 if(String(body.expected_updated_at)!==String(person.updated_at))return c.json({error:'La ficha cambió. Actualiza antes de sincronizar los roles.'},409);
 const added:string[]=[],removed:string[]=[];
 try{
  for(const id of [POLICE,...(state.wanted?[state.wanted]:[])])if(!roles.includes(id)){await c.discord(path+'/roles/'+id,{method:'PUT',body:'{}'});added.push(id);}
  for(const id of [UCOP,CIC])if(id!==state.wanted&&roles.includes(id)){await c.discord(path+'/roles/'+id,{method:'DELETE'});removed.push(id);}
 }catch(error){for(const id of removed)await c.discord(path+'/roles/'+id,{method:'PUT',body:'{}'});for(const id of added)await c.discord(path+'/roles/'+id,{method:'DELETE'});throw error;}
 await writeAudit('🛡️ Roles base del personal sincronizados',[{name:'Agente',value:person.full_name+' #'+person.plate},{name:'Gestor',value:actor},{name:'Rama',value:person.unit}]);
 return c.json({ok:true,message:'Policía y rama sincronizados. Se conservan el rango y los roles de Directiva existentes.',sync:{record:'unchanged',roles:'confirmed'}});
}
