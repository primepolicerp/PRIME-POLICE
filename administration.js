const administrativeStatusLabels={pending:'Pendiente',in_progress:'En curso',completed:'Completada',cancelled:'Cancelada'};
const administrativePriorityLabels={normal:'Normal',high:'Alta',urgent:'Urgente'};
const administrativeAlertLabels={absence:'Fin de ausencia',profile:'Ficha incompleta',discord:'Aviso de Discord',task:'Tarea vencida',approval:'Revisión pendiente',shift:'Bitácora prolongada'};
const dossierKindLabels={rank:'Rango',note:'Observación',absence:'Ausencia',sanction:'Sanción',movement:'Baja / reingreso',service:'Servicio',registration:'Alta de ficha'};
const dossierActionLabels={promotion:'Ascenso',demotion:'Descenso',assignment:'Asignación',created:'Registrada',edited:'Editada',archived:'Archivada',departure:'Baja',reentry:'Reingreso',open:'En servicio',closed:'Cerrada',active:'Activa',approved:'Aprobada',pending:'Pendiente',failed:'No aplicada',rejected:'Rechazada',cancelled:'Cancelada'};
let administrationTab='tasks',administrationSequence=0,administrationSearchTimer,administrationSummary=null,taskOffset=0,alertOffset=0,taskEditing=null,taskBusy=false,taskHistorySequence=0;
let dossierPerson=null,dossierOffset=0,dossierSequence=0;
function administrativeText(tag,text,className){const node=document.createElement(tag);node.textContent=text??'';if(className)node.className=className;return node;}
function administrativeDate(value){return value?new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z')):'Sin fecha límite';}
function administrativePager(id,total,offset,next,onPage){
 const box=$(id);box.replaceChildren();box.append(administrativeText('span',total?'Mostrando '+(offset+1)+'–'+Math.min(offset+25,total)+' de '+total:'Sin registros','muted'));
 for(const [label,value,disabled]of [['Anterior',Math.max(0,offset-25),offset===0],['Siguiente',next,next===null]]){const b=administrativeText('button',label,'btn');b.type='button';b.disabled=disabled;b.onclick=()=>onPage(value);box.append(b);}
}
function updateAdministrationSummary(summary){
 administrationSummary=summary||null;const ready=Boolean(token&&!restrictedToApplications);
 $('openAdministrativeAlerts').hidden=!ready;$('administrativeAlertCount').textContent=summary?String(summary.alert_total??0):'—';
 const count=$('administrationNavCount');count.hidden=!summary;count.textContent=summary?String(summary.alert_total??0):'';
 const metrics=$('administrationMetrics');metrics.replaceChildren();
 for(const [label,value]of [['Mis tareas abiertas',summary?.tasks?.mine],['Tareas del equipo',summary?.tasks?.open],['Tareas vencidas',summary?.tasks?.overdue],['Alertas activas',summary?.alert_total]]){const box=administrativeText('div','', 'admin-metric');box.append(administrativeText('span',label),administrativeText('strong',value??'—'));metrics.append(box);}
}
function administrationDashboardCard(summary){return '<section class="panel admin-dashboard-card"><div><span class="dashboard-kicker">ORGANIZACIÓN Y SEGUIMIENTO</span><h3>Trabajo del equipo</h3><p>'+dashboardNumber(summary?.tasks?.mine)+' tareas a tu cargo · '+dashboardNumber(summary?.tasks?.overdue)+' vencidas · '+dashboardNumber(summary?.alert_total)+' alertas internas</p></div><button class="btn" type="button" data-dashboard-view="administration">Abrir tareas y alertas</button></section>';}
function selectAdministrationTab(tab){
 administrationTab=tab;$('administrationTasksPanel').hidden=tab!=='tasks';$('administrationAlertsPanel').hidden=tab!=='alerts';
 for(const [id,selected]of [['administrationTasksTab',tab==='tasks'],['administrationAlertsTab',tab==='alerts']]){$(id).classList.toggle('primary',selected);$(id).setAttribute('aria-pressed',String(selected));}
}
function openAdministration(tab='tasks'){administrationTab=tab;document.querySelector('[data-view="administration"]').click();}
async function administrativeProfile(id){
 const session=token;try{const result=await request('records',{method:'GET',query:{kind:'personnel',discord_user_id:id,limit:1,counts:'false'}});if(session!==token)return;if(result.records?.[0])openPersonnelProfile(result.records[0]);else showToast('La ficha de personal ya no existe.');}catch(error){showToast(error.message);}
}
function renderAdministrativeTasks(tasks){
 const box=$('administrativeTaskList');box.replaceChildren();
 if(!tasks.length){profileEmpty(box,'No hay tareas con estos filtros. Puedes crear una nueva o consultar Todo el equipo.');return;}
 for(const task of tasks){
  const row=administrativeText('article','', 'admin-task-card'),head=administrativeText('div','', 'admin-card-head'),title=administrativeText('h3',task.title),state=administrativeText('span',administrativeStatusLabels[task.status]||task.status,'admin-state '+task.status);head.append(title,state);row.append(head);
  const priority=administrativeText('span','Prioridad '+administrativePriorityLabels[task.priority],'admin-priority '+task.priority);row.append(priority);
  if(task.description)row.append(administrativeText('p',task.description,'admin-task-description'));
  const meta=administrativeText('div','', 'admin-task-meta'),overdue=['pending','in_progress'].includes(task.status)&&task.due_date&&task.due_date<new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'});
  meta.append(administrativeText('span','Responsable: '+(task.assigned_name||'Sin asignar')),administrativeText('span',administrativeDate(task.due_date)+(overdue?' · Vencida':''),overdue?'admin-overdue':''),administrativeText('small','Creada por '+task.created_by_name+' · '+niceDate(task.created_at)));row.append(meta);
  const actions=administrativeText('div','', 'personnel-actions'),open=administrativeText('button',task.can_edit?'Gestionar tarea':'Ver tarea','btn');open.type='button';open.onclick=()=>openAdministrativeTask(task);actions.append(open);
  if(task.target_id){const person=administrativeText('button','Ver agente vinculado','btn ghost');person.type='button';person.onclick=()=>administrativeProfile(task.target_id);actions.append(person);}row.append(actions);box.append(row);
 }
}
function renderAdministrativeAlerts(alerts){
 const box=$('administrativeAlertList');box.replaceChildren();if(!alerts.length){profileEmpty(box,$('administrativeAlertState').value==='ignored'?'No hay alertas ignoradas con este filtro.':'No hay alertas activas con este filtro.');return;}
 for(const alert of alerts){const card=administrativeText('article','', 'admin-alert-card '+alert.severity),head=administrativeText('div','', 'admin-card-head');head.append(administrativeText('h3',alert.title),administrativeText('span',administrativeAlertLabels[alert.kind]||'Aviso','admin-state'));card.append(head,administrativeText('p',alert.detail));const open=administrativeText('button','Revisar','btn');open.type='button';open.onclick=()=>{
  if(alert.target_id&&alert.destination==='personnel'){administrativeProfile(alert.target_id);return;}
  if(alert.destination==='sync'){openSyncCenter();return;}
  if(alert.destination==='tasks'){$('administrativeTaskScope').value='team';$('administrativeTaskStatus').value='open';$('administrativeTaskSearch').value=alert.title;taskOffset=0;selectAdministrationTab('tasks');loadAdministration();return;}
  const view=alert.destination==='shifts'?'shifts':'dashboard';if(view==='shifts'){shiftTab='open';shiftOffset=0;$('shiftSearch').value=alert.title;}
  document.querySelector('[data-view="'+view+'"]').click();
 };const actions=administrativeText('div','','personnel-actions'),ignore=administrativeText('button',alert.ignored?'Restaurar alerta':'Ignorar alerta','btn ghost');ignore.type='button';ignore.disabled=!alert.fingerprint;ignore.onclick=async()=>{
  const session=token;ignore.disabled=true;open.disabled=true;
  try{const result=await request('administrative-alert-ignore',{method:'POST',body:{key:alert.key,fingerprint:alert.fingerprint,ignored:!alert.ignored}});if(session!==token)return;showToast(result.message);alertOffset=0;await loadAdministration();}
  catch(error){if(session===token){showToast(error.message);ignore.disabled=false;open.disabled=false;}}
 };actions.append(open,ignore);card.append(actions);box.append(card);}
}
async function loadAdministration(){
 const sequence=++administrationSequence,session=token,tab=administrationTab,box=$(tab==='tasks'?'administrativeTaskList':'administrativeAlertList');
 $('administrationFeedback').textContent='Actualizando tareas y alertas…';box.setAttribute('aria-busy','true');box.inert=true;$('refreshAdministration').disabled=true;
 try{
  const overview=request('administrative-overview',{method:'GET',query:{offset:alertOffset,kind:$('administrativeAlertKind').value,state:$('administrativeAlertState').value}});
  const tasks=tab==='tasks'?request('administrative-tasks',{method:'GET',query:{offset:taskOffset,scope:$('administrativeTaskScope').value,status:$('administrativeTaskStatus').value,search:$('administrativeTaskSearch').value}}):Promise.resolve(null);
  const [summary,result]=await Promise.all([overview,tasks]);if(sequence!==administrationSequence||session!==token)return;
  updateAdministrationSummary(summary);$('administrativeAlertState').options[1].textContent='Ignoradas'+(Number(summary.ignored_total)?' ('+summary.ignored_total+')':'');$('administrationFeedback').textContent='Actualizado: '+niceDate(summary.generated_at||new Date().toISOString());
  if(result){renderAdministrativeTasks(result.tasks||[]);administrativePager('administrativeTaskPager',result.total,taskOffset,result.next_offset??null,offset=>{taskOffset=offset;loadAdministration();});}
  renderAdministrativeAlerts(summary.alerts||[]);administrativePager('administrativeAlertPager',summary.total,alertOffset,summary.next_offset??null,offset=>{alertOffset=offset;loadAdministration();});
 }catch(error){if(sequence===administrationSequence&&session===token){$('administrationFeedback').textContent=error.message+' Pulsa Actualizar para reintentar.';box.replaceChildren();}}
 finally{if(sequence===administrationSequence){box.removeAttribute('aria-busy');box.inert=false;$('refreshAdministration').disabled=false;}}
}
function openAdministrativeTask(task=null){
 if(!task&&!$('accountCard').dataset.userId){showToast('Espera a que cargue tu cuenta de Discord o pulsa Reintentar perfil.');return;}
 taskHistorySequence++;taskEditing=task?{...task}:{id:crypto.randomUUID(),version:0,assigned_to:$('accountCard').dataset.userId||'',can_edit:true};const editable=taskEditing.can_edit!==false;
 $('administrativeTaskForm').reset();$('administrativeTaskHistory').open=false;$('administrativeTaskHistory').hidden=!task;$('administrativeTaskVersions').replaceChildren();$('administrativeTaskFeedback').textContent='';
 $('administrativeTaskTitle').textContent=task?'Tarea del equipo':'Nueva tarea';$('administrativeTaskPolicy').textContent=canAuthorizePromotions?'Puedes asignar un responsable y registrar el seguimiento.':'Puedes gestionar tus tareas. Directiva puede reasignarlas al equipo.';
 const fields={administrativeTaskName:task?.title||'',administrativeTaskDescription:task?.description||'',administrativeTaskState:task?.status||'pending',administrativeTaskPriority:task?.priority||'normal',administrativeTaskDue:task?.due_date||'',administrativeTaskAssignee:taskEditing.assigned_to||'',administrativeTaskTarget:task?.target_id||''};
 for(const [id,value]of Object.entries(fields)){$(id).value=value;$(id).disabled=!editable;}
 $('administrativeTaskAssignee').readOnly=!canAuthorizePromotions;$('administrativeTaskSave').hidden=!editable;$('administrativeTaskSave').disabled=false;$('administrativeTaskDialog').showModal();
}
async function loadAdministrativeTaskHistory(){
 if(!taskEditing?.version)return;const sequence=++taskHistorySequence,session=token,id=taskEditing.id,box=$('administrativeTaskVersions');box.textContent='Consultando cambios…';
 try{const data=await request('administrative-task-history',{method:'GET',query:{id}});if(sequence!==taskHistorySequence||session!==token)return;box.replaceChildren();
  for(const version of data.versions||[]){const row=administrativeText('article','', 'task-version'),before=version.before_state,after=version.after_state,labels={title:'Título',description:'Indicaciones',status:'Estado',priority:'Prioridad',due_date:'Fecha límite',assigned_name:'Responsable',target_id:'Agente vinculado'};row.append(administrativeText('strong','Versión '+version.version+' · '+version.actor_name),administrativeText('small',niceDate(version.created_at),'muted'));
   if(!before)row.append(administrativeText('p','Creación de la tarea.'));else for(const [key,label]of Object.entries(labels))if(before[key]!==after[key]){const display=v=>key==='status'?administrativeStatusLabels[v]||v:key==='priority'?administrativePriorityLabels[v]||v:v||'Sin dato';row.append(administrativeText('p',label+': '+display(before[key])+' → '+display(after[key])));}box.append(row);
  }if(!data.versions?.length)profileEmpty(box,'Sin cambios registrados.');
 }catch(error){if(sequence===taskHistorySequence)box.textContent=error.message;}
}
$('administrativeTaskForm').addEventListener('submit',async event=>{
 event.preventDefault();const session=token;if(taskBusy||!taskEditing||taskEditing.can_edit===false)return;taskBusy=true;$('administrativeTaskSave').disabled=true;$('administrativeTaskFeedback').textContent='Guardando tarea…';
 const body={id:taskEditing.id,expected_version:taskEditing.version,title:$('administrativeTaskName').value,description:$('administrativeTaskDescription').value,status:$('administrativeTaskState').value,priority:$('administrativeTaskPriority').value,due_date:$('administrativeTaskDue').value,assigned_to:$('administrativeTaskAssignee').value,target_id:$('administrativeTaskTarget').value};
 try{const result=await request('administrative-task-save',{method:'POST',body});if(session!==token)return;taskEditing=result.task;$('administrativeTaskDialog').close();showToast(result.message);if(!$('administrationView').classList.contains('hidden'))await loadAdministration();}
 catch(error){if(session===token)$('administrativeTaskFeedback').textContent=error.message;}
 finally{if(session===token){taskBusy=false;$('administrativeTaskSave').disabled=false;}}
});
async function openPersonnelDossier(person){if(!person)return;dossierPerson={...person};dossierOffset=0;$('personnelDossierKind').value='';$('personnelDossierTitle').textContent=person.full_name;$('personnelDossierIdentity').textContent='Placa '+person.plate;$('personnelDossierDialog').showModal();await loadPersonnelDossier();}
async function loadPersonnelDossier(){
 if(!dossierPerson)return;const sequence=++dossierSequence,session=token,id=dossierPerson.discord_user_id,box=$('personnelDossierEvents');box.replaceChildren();$('personnelDossierPager').replaceChildren();$('personnelDossierFeedback').textContent='Consultando el expediente…';$('personnelDossierRefresh').disabled=true;
 try{const data=await request('personnel-dossier',{method:'GET',query:{discord_user_id:id,kind:$('personnelDossierKind').value,offset:dossierOffset}});if(sequence!==dossierSequence||session!==token)return;
  $('personnelDossierTitle').textContent=data.person.full_name;$('personnelDossierIdentity').textContent='Placa '+data.person.plate+' · '+(data.person.rank_name||'Sin rango')+' · '+(data.person.status==='active'?'Activo':'Baja');$('personnelDossierCounts').replaceChildren();
  for(const [kind,count]of Object.entries(data.counts||{}))$('personnelDossierCounts').append(administrativeText('span',(dossierKindLabels[kind]||kind)+': '+count));
  for(const entry of data.events||[]){const card=administrativeText('article','', 'dossier-event '+entry.kind),head=administrativeText('div','', 'admin-card-head');head.append(administrativeText('span',dossierKindLabels[entry.kind]||entry.kind,'admin-state'),administrativeText('time',niceDate(entry.occurred_at)));card.append(head,administrativeText('h3',entry.title),administrativeText('small',dossierActionLabels[entry.action]||entry.action,'muted'),administrativeText('p',entry.detail),administrativeText('small','Registrado por: '+(entry.actor||'Responsable no registrado'),'muted'));box.append(card);}
  if(!data.events?.length)profileEmpty(box,'No hay actividad documentada con este filtro.');$('personnelDossierFeedback').textContent='Registros internos · Acceso de gestión';administrativePager('personnelDossierPager',data.total,dossierOffset,data.next_offset??null,offset=>{dossierOffset=offset;loadPersonnelDossier();});
 }catch(error){if(sequence===dossierSequence&&session===token)$('personnelDossierFeedback').textContent=error.message;}
 finally{if(sequence===dossierSequence)$('personnelDossierRefresh').disabled=false;}
}
document.querySelectorAll('.workspace-tab').forEach(button=>button.addEventListener('click',()=>{const visible=button.dataset.view==='administration';$('administrationView').classList.toggle('hidden',!visible);if(visible){selectAdministrationTab(administrationTab);loadAdministration();}else{administrationSequence++;clearTimeout(administrationSearchTimer);}}));
$('openAdministrativeAlerts').onclick=()=>openAdministration('alerts');$('administrationTasksTab').onclick=()=>{selectAdministrationTab('tasks');loadAdministration();};$('administrationAlertsTab').onclick=()=>{selectAdministrationTab('alerts');loadAdministration();};$('refreshAdministration').onclick=loadAdministration;$('createAdministrativeTask').onclick=()=>openAdministrativeTask();
for(const id of ['administrativeTaskScope','administrativeTaskStatus'])$(id).onchange=()=>{taskOffset=0;loadAdministration();};for(const id of ['administrativeAlertKind','administrativeAlertState'])$(id).onchange=()=>{alertOffset=0;loadAdministration();};$('administrativeTaskSearch').oninput=()=>{administrationSequence++;clearTimeout(administrationSearchTimer);administrationSearchTimer=setTimeout(()=>{taskOffset=0;loadAdministration();},350);};
for(const id of ['administrativeTaskClose','administrativeTaskCancel'])$(id).onclick=()=>{if(!taskBusy)$('administrativeTaskDialog').close();};$('administrativeTaskDialog').addEventListener('cancel',event=>{if(taskBusy)event.preventDefault();});$('administrativeTaskDialog').addEventListener('close',()=>{taskHistorySequence++;if(!taskBusy)taskEditing=null;});$('administrativeTaskHistory').addEventListener('toggle',()=>{if($('administrativeTaskHistory').open)loadAdministrativeTaskHistory();});
$('profileDossierButton').onclick=()=>{if(profilePerson&&!profileSaving)openPersonnelDossier(profilePerson);};$('personnelDossierClose').onclick=()=>{$('personnelDossierDialog').close();};$('personnelDossierKind').onchange=()=>{dossierOffset=0;loadPersonnelDossier();};$('personnelDossierRefresh').onclick=loadPersonnelDossier;$('personnelDossierDialog').addEventListener('close',()=>{dossierSequence++;dossierPerson=null;$('personnelDossierEvents').replaceChildren();});
window.addEventListener('panel-account-ready',()=>{updateAdministrationSummary(administrationSummary);$('administrativeTaskScope').value=canAuthorizePromotions?'team':'mine';});
window.addEventListener('panel-session-ended',()=>{administrationSequence++;dossierSequence++;taskHistorySequence++;clearTimeout(administrationSearchTimer);taskBusy=false;taskEditing=null;dossierPerson=null;taskOffset=0;alertOffset=0;administrationTab='tasks';$('administrativeAlertState').value='active';$('administrativeAlertKind').value='';updateAdministrationSummary(null);$('administrativeTaskDialog').close();$('personnelDossierDialog').close();for(const id of ['administrativeTaskList','administrativeAlertList','administrativeTaskVersions','personnelDossierEvents'])$(id).replaceChildren();$('administrationView').classList.add('hidden');});
