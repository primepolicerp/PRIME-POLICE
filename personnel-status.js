const departureRoleLabels={none:'Sin rol adicional',voluntary:'Baja Voluntaria',expelled:'Expulsado',banned:'Vetado'};
function suggestedDepartureRole(type){return ['renuncia','jubilacion'].includes(type)?'voluntary':['despido','corrupcion'].includes(type)?'expelled':'none';}
const departureLabels={pkt:'PKT',ck:'Muerte (CK)',despido:'Despido',corrupcion:'Corrupción',renuncia:'Renuncia',jubilacion:'Jubilación',transferencia:'Transferencia',inactividad:'Inactividad',otro:'Otro'};
let statusPerson=null,statusBusy=false,statusOperation='',profileMovementOffset=0,profileMovementNext=null;
function updatePersonnelStatusButton(person,loading){
 const button=$('profileStatusButton');button.disabled=loading;button.textContent=person.status==='active'?'Dar de baja':'Reingresar';button.className='btn '+(person.status==='active'?'reject':'accept');
 $('profileReentryCount').textContent=String(person.reentry_count||0);
 const info=$('profileDepartureInfo');info.hidden=!person.departure_type||person.status==='active';info.replaceChildren();
 if(!info.hidden)info.append(profileRecord('Baja · '+(departureLabels[person.departure_type]||person.departure_type),(person.departure_reason||'Sin observaciones')+(person.departure_role?' · Rol: '+departureRoleLabels[person.departure_role]:''),(person.departure_by_name||'Gestión')+' · '+person.departure_date));
}
function renderPersonnelMovements(items,next,failed){
 profileMovementNext=next??null;$('profileMovementsPrevious').disabled=profileMovementOffset===0;$('profileMovementsNext').disabled=profileMovementNext===null;
 const box=$('profileMovements');if(failed||!items.length){profileEmpty(box,failed?'No se pudo cargar el historial de bajas. Actualiza la ficha.':'No hay bajas ni reingresos registrados.');return;}
 box.replaceChildren();for(const item of items){const title=item.kind==='departure'?'Baja · '+(departureLabels[item.departure_type]||'Otro'):'Reingreso · '+item.new_rank_name+' · '+unitLabel(item.unit);box.append(profileRecord(title,item.reason+(item.departure_role?' · Rol: '+departureRoleLabels[item.departure_role]:''),(item.actor_name||'Gestión')+' · Fecha efectiva: '+item.effective_date+' · Registrado: '+niceDate(item.created_at)));}
}
async function openPersonnelStatus(person){
 if(statusBusy)return;statusPerson={...person};statusOperation=crypto.randomUUID();const reentry=person.status!=='active';
 $('personnelStatusForm').reset();$('personnelRestoreRankField').hidden=true;$('personnelStatusTitle').textContent=reentry?'Reingresar al agente':'Dar de baja al agente';
 $('personnelStatusName').textContent=person.full_name+' · Placa '+person.plate;
 $('personnelStatusPolicy').textContent=(canAuthorizePromotions?'El cambio se aplicará al confirmar.':'Se enviará a Directiva para su aprobación.')+' '+(reentry?'Se conserva la misma ficha y placa. Se asignarán el rango y la división seleccionados.':'Se conserva la ficha. Se retirarán los roles policiales y se cerrarán las bitácoras abiertas.');
 $('personnelStatusDate').value=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'});$('personnelStatusDate').max=$('personnelStatusDate').value;
 $('personnelDepartureField').hidden=reentry;$('personnelDepartureType').required=!reentry;$('personnelDepartureRoleField').hidden=reentry;$('personnelDepartureRole').required=!reentry;$('personnelDepartureRole').value='none';
 $('personnelReentryFields').hidden=!reentry;$('personnelReentryRank').required=reentry;$('personnelReentryUnit').value=person.unit||'POLICIA';
 $('personnelStatusFeedback').textContent='';$('personnelStatusSave').textContent=canAuthorizePromotions?(reentry?'Confirmar reingreso':'Confirmar baja'):'Enviar a Directiva';$('personnelStatusSave').disabled=reentry;
 $('personnelStatusSave').className='btn '+(reentry?'accept':'reject');
 $('personnelStatusDialog').showModal();
 if(reentry)try{const data=await request('rank-config',{method:'GET'});if(statusPerson?.discord_user_id!==person.discord_user_id)return;const select=$('personnelReentryRank');select.replaceChildren(new Option('Selecciona un rango',''));for(const rank of data.ranks||[])select.add(new Option(rank.role_name,rank.role_id));select.value=person.rank_role_id||'';updateRestoreRankChoice();$('personnelStatusSave').disabled=false;}catch(error){$('personnelStatusFeedback').textContent=error.message;}
}
function closePersonnelStatus(){if(!statusBusy){$('personnelStatusDialog').close();statusPerson=null;}}
$('personnelStatusForm').addEventListener('submit',async event=>{
 event.preventDefault();if(!statusPerson||statusBusy)return;const person={...statusPerson},reentry=person.status!=='active';
 const body={discord_user_id:person.discord_user_id,operation_id:statusOperation,expected_updated_at:person.updated_at,effective_date:$('personnelStatusDate').value,reason:$('personnelStatusReason').value.trim(),...(reentry?{rank_role_id:$('personnelReentryRank').value,unit:$('personnelReentryUnit').value,restore_previous_rank:$('personnelRestoreRank').checked}:{departure_type:$('personnelDepartureType').value,departure_role:$('personnelDepartureRole').value})};
 if(!confirm((canAuthorizePromotions?'¿Confirmar ':'¿Enviar a Directiva ')+(reentry?'el reingreso':'la baja')+' de '+person.full_name+(reentry?'':' con el rol «'+departureRoleLabels[body.departure_role]+'»')+'?'))return;
 statusBusy=true;for(const id of ['personnelStatusSave','personnelStatusCancel','personnelStatusClose'])$(id).disabled=true;$('personnelStatusFeedback').textContent='Guardando…';
 try{const result=await request(reentry?'personnel-reentry':'personnel-departure',{method:'POST',body});showToast((result.message||'Movimiento guardado.')+(result.warning?' '+result.warning:''));$('personnelStatusDialog').close();statusPerson=null;await loadPersonnel();if(profilePerson?.discord_user_id===person.discord_user_id)await loadPersonnelFile(person,true);}
 catch(error){$('personnelStatusFeedback').textContent=error.message;}
 finally{statusBusy=false;for(const id of ['personnelStatusSave','personnelStatusCancel','personnelStatusClose'])$(id).disabled=false;}
});
$('personnelStatusCancel').onclick=closePersonnelStatus;$('personnelStatusClose').onclick=closePersonnelStatus;
$('personnelStatusDialog').addEventListener('cancel',event=>{if(statusBusy)event.preventDefault();});
$('personnelStatusDialog').addEventListener('close',()=>{if(!statusBusy)statusPerson=null;});
$('profileStatusButton').onclick=()=>{if(profilePerson&&!profileSaving)openPersonnelStatus(profilePerson);};
for(const [id,next]of [['profileMovementsPrevious',false],['profileMovementsNext',true]])$(id).onclick=()=>{if(!profilePerson||profileSaving)return;profileMovementOffset=next?profileMovementNext:Math.max(0,profileMovementOffset-20);loadPersonnelFile(profilePerson,true);};
window.addEventListener('panel-session-ended',()=>{statusBusy=false;statusPerson=null;$('personnelStatusDialog').close();});

for(const [id,status]of [['showPersonnelDepartures','inactive'],['showPersonnelActive','active']])$(id).onclick=()=>{$('personnelStatusFilter').value=status;recordPages.personnel.offset=0;loadRecordPage('personnel');};

$('personnelDepartureType').addEventListener('change',()=>{$('personnelDepartureRole').value=suggestedDepartureRole($('personnelDepartureType').value);});

function updateRestoreRankChoice(){const chosen=$('personnelReentryRank').value;const visible=statusPerson?.status==='inactive'&&chosen===statusPerson?.rank_role_id&&['1539970134544748558','1539970134544748559'].includes(chosen);$('personnelRestoreRankField').hidden=!visible;if(!visible)$('personnelRestoreRank').checked=false;}
$('personnelReentryRank').addEventListener('change',updateRestoreRankChoice);
