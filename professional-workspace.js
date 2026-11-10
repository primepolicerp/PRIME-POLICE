let globalSearchSequence=0,globalSearchTimer,accessSequence=0,syncSequence=0;
function configureWorkspaceRole(){
 const heading=$('pendingChangesPanel').querySelector('h3'),copy=$('pendingChangesPanel').querySelector('.dashboard-section-head p');
 heading.textContent=canAuthorizePromotions?'Decisiones de Directiva':'Mis propuestas';
 copy.textContent=canAuthorizePromotions?'Comprueba la propuesta y confirma su aplicación. Descartarla no cambia el expediente.':'Consulta las propuestas que has enviado y la decisión de Directiva.';
}
function openGlobalSearch(){if(cicOnly){document.querySelector('[data-view="cic"]').click();$('pc-search').focus();return;}$('globalSearchDialog').showModal();$('globalSearchInput').focus();}
async function runGlobalSearch(){
 const sequence=++globalSearchSequence,session=token,q=$('globalSearchInput').value.trim(),box=$('globalSearchResults');
 box.replaceChildren();if(q.length<2){box.textContent='Escribe al menos dos caracteres para buscar por nombre, placa o Discord.';return;}
 box.textContent='Buscando…';
 try{const result=await request('workspace-search',{method:'GET',query:{q}});if(sequence!==globalSearchSequence||session!==token)return;box.replaceChildren();
  if(!result.results?.length){box.textContent='No se encontraron resultados.';return;}
  const labels={personnel:'Personal',applications:'Postulación',transfers:'Traslado',intakes:'Nuevo ingreso'};
  for(const item of result.results){const button=document.createElement('button'),name=document.createElement('strong'),meta=document.createElement('span');button.type='button';button.className='global-result';name.textContent=item.full_name||item.character_name||item.discord_username;meta.textContent=labels[item.kind]+' · '+(item.plate?'Placa '+item.plate+' · ':'')+(item.rank_name||({pending:'Pendiente',accepted:'Aceptada',rejected:'Rechazada',active:'Activo',inactive:'Baja'}[item.status]||item.status));button.append(name,meta);button.onclick=()=>{
   $('globalSearchDialog').close();
   if(item.kind==='personnel'){document.querySelector('[data-view="personnel"]').click();openPersonnelProfile(item);return;}
   const map={applications:['applications','search'],transfers:['transfers','transferSearch'],intakes:['rank-requests','rankRequestSearch']},[view,input]=map[item.kind];
   if(item.kind==='applications')activeStatus=item.status;if(item.kind==='transfers')activeTransferStatus=item.status;if(item.kind==='intakes')activeRankRequestStatus=item.status;
   recordState(item.kind).offset=0;$(input).value=item.discord_user_id;document.querySelector('[data-view="'+view+'"]').click();
  };box.append(button);}
 }catch(error){if(sequence===globalSearchSequence)box.textContent=error.message;}
}
async function openSyncCenter(){
 if(!$('syncCenterDialog').open)$('syncCenterDialog').showModal();const sequence=++syncSequence,session=token,box=$('syncJobList');box.textContent='Consultando avisos…';
 try{const result=await request('sync-jobs',{method:'GET'});if(sequence!==syncSequence||session!==token)return;box.replaceChildren();
  if(!result.jobs.length){box.textContent='Todavía no hay avisos registrados. Los próximos ascensos y bajas aparecerán aquí.';return;}
  for(const job of result.jobs){const row=document.createElement('article'),head=document.createElement('strong'),state=document.createElement('span'),meta=document.createElement('p');row.className='sync-job';head.textContent=(job.kind==='promotion'?'Ascenso':job.kind==='departure'?'Baja':job.kind==='weekly_report'?'Informe semanal':job.kind==='shift_reminder'?'Recordatorio de bitácora':'Resultado privado')+' · '+(job.name||'Agente')+(job.plate?' #'+job.plate:'');state.className='sync-state '+job.status;state.textContent={pending:'En cola',processing:'Enviando',sent:'Enviado',failed:'Necesita revisión',superseded:job.kind==='shift_reminder'?'Ya no corresponde enviar':'Sustituido por otra decisión'}[job.status];meta.textContent=niceDate(job.created_at)+' · '+job.attempts+' intentos';row.append(head,state,meta);
   if(job.last_error){const error=document.createElement('p');error.className='muted';error.textContent=job.last_error;row.append(error);}
   if(['pending','failed'].includes(job.status)){const retry=document.createElement('button');retry.type='button';retry.className='btn ghost';retry.textContent='Reintentar solo el aviso';retry.onclick=async()=>{retry.disabled=true;try{const r=await request('sync-retry',{method:'POST',body:{id:job.id}});showToast(r.message);await openSyncCenter();}catch(e){showToast(e.message);retry.disabled=false;}};row.append(retry);}box.append(row);
  }
 }catch(error){if(sequence===syncSequence)box.textContent=error.message;}
}
async function loadProfileAccess(person){
 const sequence=++accessSequence,id=person.discord_user_id;$('profileAccessStatus').textContent='Comprobando Policía y rama en Discord…';$('profileAccessSync').disabled=true;
 try{const data=await request('personnel-access',{method:'GET',query:{discord_user_id:id}});if(sequence!==accessSequence||profilePerson?.discord_user_id!==id)return;
  $('profileAccessStatus').textContent=!data.active?'Ficha de baja: utiliza Reingresar.':data.restricted?'Existe un rol de baja en Discord. Revisa el expediente antes de restaurar acceso.':(data.police?'✓ Policía confirmado':'⚠ Falta Policía')+' · '+(data.branch?'✓ Rama correcta':'⚠ Revisar rama')+(data.director?' · Directiva asignada':'');
  $('profileAccessSync').textContent=canAuthorizePromotions?'Sincronizar Policía y rama':'Solicitar sincronización';$('profileAccessSync').disabled=!data.active||data.restricted||data.police&&data.branch;
 }catch(error){if(sequence===accessSequence)$('profileAccessStatus').textContent=error.message;}
}
function showOperationOutcome(result){
 const box=$('operationOutcome');box.replaceChildren();
 const entries=result.pending_approval?[['approval','Pendiente de Directiva']]:[['saved','Guardado en la web']];
 if(result.sync?.roles==='confirmed')entries.push(['confirmed','Roles confirmados en Discord']);
 if(result.warning||result.sync?.notification==='pending')entries.push(['attention',/cola|aviso/i.test(result.warning)?'Aviso de Discord pendiente':'Revisar observaciones']);
 else if(result.sync?.notification==='confirmed')entries.push(['confirmed','Aviso de Discord enviado']);
 for(const [kind,text]of entries){const badge=document.createElement('span');badge.className='operation-chip '+kind;badge.textContent=text;box.append(badge);}box.hidden=false;
}
$('openGlobalSearch').onclick=openGlobalSearch;$('globalSearchClose').onclick=()=>{$('globalSearchDialog').close();};
$('globalSearchInput').addEventListener('input',()=>{globalSearchSequence++;clearTimeout(globalSearchTimer);globalSearchTimer=setTimeout(runGlobalSearch,300);});
$('globalSearchDialog').addEventListener('close',()=>{globalSearchSequence++;});
$('syncCenterClose').onclick=()=>{$('syncCenterDialog').close();syncSequence++;};$('syncCenterRefresh').onclick=openSyncCenter;
$('openSyncCenter').onclick=openSyncCenter;
$('profileAccessSync').onclick=async()=>{if(!profilePerson)return;const person={...profilePerson},button=$('profileAccessSync');button.disabled=true;try{const r=await request('personnel-role-sync',{method:'POST',body:{discord_user_id:person.discord_user_id,expected_updated_at:person.updated_at}});showToast(r.message);if(!r.pending_approval)await loadProfileAccess(person);}catch(error){showToast(error.message);button.disabled=false;}};
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&token){event.preventDefault();openGlobalSearch();}});
window.addEventListener('panel-session-ended',()=>{globalSearchSequence++;accessSequence++;syncSequence++;$('globalSearchInput').value='';$('globalSearchResults').replaceChildren();$('syncJobList').replaceChildren();$('operationOutcome').hidden=true;});
const workspaceRequest=request;request=async(action,options={})=>{const write=options.method==='POST'&&!['login','logout','logout-others','application-review-save'].includes(action);try{const result=await workspaceRequest(action,options);if(write)showOperationOutcome(result);return result;}catch(error){if(write){const badge=document.createElement('span');badge.className='operation-chip attention';badge.textContent='Comprueba el resultado antes de repetir la operación';$('operationOutcome').replaceChildren(badge);$('operationOutcome').hidden=false;}throw error;}};
const workspaceAccountProfile=loadAccountProfile;loadAccountProfile=async()=>{await workspaceAccountProfile();$('openGlobalSearch').hidden=!token||cicOnly;$('openSyncCenter').hidden=restrictedToApplications||cicOnly||!token;configureWorkspaceRole();};
window.addEventListener('panel-account-ready',()=>{$('openGlobalSearch').hidden=!token||cicOnly;$('openSyncCenter').hidden=restrictedToApplications||cicOnly||!token;configureWorkspaceRole();});

document.querySelectorAll('.workspace-tab').forEach(button=>button.addEventListener('click',()=>window.scrollTo({top:0,behavior:'instant'})));
