let profilePerson=null,profileSequence=0,profileSaving=false,profileEditingNote=null,profileNoteId='',profileFocus=null;
let profileNoteOffset=0,profileHistoryOffset=0,profileNoteNext=null,profileHistoryNext=null;
const profileDrafts=new Map();
const profileText=(id,value)=>{$(id).textContent=value===null||value===undefined||value===''?'—':String(value);};
function profileEmpty(container,text){container.replaceChildren();const p=document.createElement('p');p.className='profile-empty';p.textContent=text;container.append(p);}
function restoreProfileDraft(){
 const draft=profileDrafts.get(profilePerson?.discord_user_id);profileEditingNote=draft?.edit||null;profileNoteId=draft?.id||crypto.randomUUID();
 $('profileNoteText').value=draft?.content||'';$('saveProfileNote').textContent=profileEditingNote?'Guardar observación':'Añadir observación';$('cancelProfileNoteEdit').hidden=!profileEditingNote;
}
function resetProfileNote(){if(profilePerson)profileDrafts.delete(profilePerson.discord_user_id);profileEditingNote=null;profileNoteId=crypto.randomUUID();$('profileNoteText').value='';$('saveProfileNote').textContent='Añadir observación';$('cancelProfileNoteEdit').hidden=true;}
function beforeClosePersonnelFile(){
 if(profileSaving)return false;
 profileSequence++;profilePerson=null;profileEditingNote=null;$('profileNoteText').value='';
 for(const id of ['profileNotes','profileHistory','profileAbsences','profileSanctions'])$(id).replaceChildren();
 if(profileFocus?.isConnected)profileFocus.focus();return true;
}
async function loadPersonnelFile(person,refresh=false){
 if(profileSaving&&!refresh)return;
 const sequence=++profileSequence,session=token;
 if(!refresh){profileFocus=document.activeElement;profileNoteOffset=0;profileHistoryOffset=0;profileNoteNext=null;profileHistoryNext=null;$('profileNoteFeedback').textContent='';$('profileNotesPager').hidden=true;$('profileHistoryPager').hidden=true;}
 profilePerson={...person};if(!refresh)profileMovementOffset=0;updatePersonnelStatusButton(person,true);const modal=$('personnelProfileModal');modal.classList.remove('hidden');document.body.style.overflow='hidden';
 if(!refresh){$('profileClose').focus();for(const details of modal.querySelectorAll('.profile-body details'))details.open=false;modal.querySelector('.personnel-file-actions').open=false;selectPersonnelFileTab('summary');accessSequence++;$('profileAccessStatus').textContent='Abre este apartado para comprobar los roles actuales.';$('profileAccessSync').disabled=true;profileEmpty($('profileMovements'),'Abre este apartado para consultar los movimientos.');restoreProfileDraft();modal.querySelector('.profile-body').scrollTop=0;}
 const sections=['summary',...[...modal.querySelectorAll('[data-profile-section][open]')].map(el=>el.dataset.profileSection)];
 $('profileAvatar').textContent=(person.full_name||'PP').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
 profileText('profileName',person.full_name||'Ficha policial');profileText('profileDiscord',(person.discord_username?'@'+person.discord_username+' · ':'')+'ID '+person.discord_user_id);
 for(const [id,value] of [['profileIc',person.full_name],['profileOoc',person.name_ooc],['profilePlate',person.plate],['profileRank',person.rank_name],['profileUnit',unitLabel(person.unit)],['profileUpdated',niceDate(person.updated_at)],['profileJoined',niceDate(person.created_at)]])profileText(id,value);
 for(const id of ['profileWarnings','profileStrikes','profileWeeklyHours','profileWeeklyShifts','profileAbsenceCount','profileDaysInRank','profileLastService'])profileText(id,null);
 profileText('profileStatus',person.status==='active'?'Activo':'Inactivo');profileText('profileDuty','Consultando servicio…');$('profileDuty').classList.remove('is-on-duty');
 $('profileNotesPolicy').textContent=canAuthorizePromotions?'Las observaciones se guardan directamente. Se conserva el historial de cambios.':'Las observaciones se enviarán a Pendientes para que Directiva las apruebe.';
 $('profileReadFeedback').textContent='Actualizando ficha…';$('saveProfileNote').disabled=true;for(const id of ['profileEditButton','profileSanctionButton','profileAbsenceButton'])$(id).disabled=true;
 $('profileNotesCount').textContent='';for(const id of ['profileNotesPrevious','profileNotesNext','profileHistoryPrevious','profileHistoryNext'])$(id).disabled=true;
 for(const [section,id]of [['notes','profileNotes'],['history','profileHistory'],['absences','profileAbsences'],['sanctions','profileSanctions']])if(sections.includes(section)||!refresh)profileEmpty($(id),sections.includes(section)?'Cargando…':'Abre este apartado para consultarlo.');
 try{
  const data=await request('personnel-profile',{method:'GET',query:{discord_user_id:person.discord_user_id,sections:sections.join(','),note_offset:profileNoteOffset,history_offset:profileHistoryOffset,movement_offset:profileMovementOffset}});
  if(sequence!==profileSequence||token!==session)return;
  profilePerson=data.person;const p=data.person,summary=data.summary,failed=new Set(data.failed_sections||[]);
  for(const [id,value] of [['profileName',p.full_name],['profileIc',p.full_name],['profileOoc',p.name_ooc||p.discord_username],['profilePlate',p.plate],['profileRank',p.rank_name],['profileUnit',unitLabel(p.unit)],['profileUpdated',niceDate(p.updated_at)],['profileJoined',niceDate(p.created_at)]])profileText(id,value);
  const available=p.status!=='active'?'Baja':summary?.on_absence?'Ausencia vigente':'Activo';profileText('profileStatus',available);
  if(summary){const seconds=Number(summary.week_seconds)||0;profileText('profileWeeklyHours',Math.floor(seconds/3600)+'h '+Math.floor(seconds%3600/60)+'m');
   for(const [id,value] of [['profileWarnings',summary.warnings],['profileStrikes',summary.strikes],['profileWeeklyShifts',summary.shifts_week],['profileAbsenceCount',summary.absence_count],['profileDaysInRank',summary.days_in_rank===null||summary.days_in_rank===undefined?'Sin fecha':summary.days_in_rank+' días'],['profileLastService',summary.last_service?niceDate(summary.last_service):'Sin turnos registrados']])profileText(id,value);
   profileText('profileDuty',summary.on_duty?'● En servicio':'● Fuera de servicio');$('profileDuty').classList.toggle('is-on-duty',Boolean(summary.on_duty));
  }else profileText('profileDuty','Servicio no disponible');
  updatePersonnelStatusButton(p,false);if(sections.includes('movements'))renderPersonnelMovements(data.movements||[],data.movement_next_offset,failed.has('movements'));
  if(sections.includes('notes'))renderProfileNotes(data.notes||[],failed.has('notes'));if(sections.includes('history'))renderProfileHistory(data.history||[],failed.has('history'));
  if(sections.includes('sanctions'))renderProfileSanctions(data.sanctions||[],failed.has('sanctions'));if(sections.includes('absences'))renderProfileAbsences(data.absences||[],failed.has('absences'));
  profileNoteNext=data.note_next_offset;profileHistoryNext=data.history_next_offset;
  $('profileNotesPrevious').disabled=profileNoteOffset===0;$('profileNotesNext').disabled=profileNoteNext===null;
  $('profileHistoryPrevious').disabled=profileHistoryOffset===0;$('profileHistoryNext').disabled=profileHistoryNext===null;
  $('profileNotesPager').hidden=profileNoteOffset===0&&profileNoteNext===null;$('profileHistoryPager').hidden=profileHistoryOffset===0&&profileHistoryNext===null;
  profileText('profileNotesCount',summary?summary.notes_count+(Number(summary.notes_count)===1?' observación':' observaciones'):'');
  $('profileReadFeedback').textContent=failed.size?'Algunas secciones no se pudieron cargar. Pulsa Actualizar ficha para reintentar.':'Ficha actualizada';
  $('saveProfileNote').disabled=false;$('profileEditButton').disabled=false;$('profileSanctionButton').disabled=p.status!=='active';$('profileAbsenceButton').disabled=false;
 }catch(error){if(sequence!==profileSequence||token!==session)return;$('profileReadFeedback').textContent=error.message;for(const id of ['profileNotes','profileHistory','profileAbsences','profileSanctions'])profileEmpty($(id),'No se pudo cargar esta sección. Actualiza la ficha.');}
}
function renderProfileNotes(notes,failed){
 const box=$('profileNotes');if(failed||!notes.length){profileEmpty(box,failed?'No se pudieron cargar las observaciones.':'Todavía no hay observaciones de este agente.');return;}box.replaceChildren();
 for(const note of notes){const row=document.createElement('article'),content=document.createElement('p'),meta=document.createElement('small'),actions=document.createElement('div');row.className='personnel-note';content.className='personnel-note-content';content.textContent=note.content;
  meta.textContent='Añadida por '+note.created_by_name+' · '+niceDate(note.created_at)+(note.version>1?' · Editada por '+note.updated_by_name+' · '+niceDate(note.updated_at):'');
  const edit=document.createElement('button'),archive=document.createElement('button');edit.type=archive.type='button';edit.className='btn ghost';archive.className='btn ghost';edit.textContent='Editar';archive.textContent='Archivar';
  edit.addEventListener('click',()=>{if(profileSaving)return;profileEditingNote={note_id:note.id,expected_version:note.version};profileNoteId=note.id;$('profileNoteText').value=note.content;$('saveProfileNote').textContent='Guardar observación';$('cancelProfileNoteEdit').hidden=false;$('profileNoteText').dispatchEvent(new Event('input'));$('profileNoteText').focus();});
  archive.addEventListener('click',()=>{if(!profileSaving&&confirm('¿Archivar esta observación? Se conservará su historial.'))saveProfileObservation('archive',note);});
  actions.className='personnel-note-actions';actions.append(edit,archive);row.append(content,meta,actions);box.append(row);
 }
}
function profileRecord(title,text,date){const row=document.createElement('article'),heading=document.createElement('strong'),copy=document.createElement('p'),time=document.createElement('small');row.className='profile-record';heading.textContent=title;copy.textContent=text;time.textContent=date;row.append(heading,copy,time);return row;}
function renderProfileHistory(items,failed){const box=$('profileHistory');if(failed||!items.length){profileEmpty(box,failed?'No se pudo cargar el historial.':'No hay movimientos de rango registrados.');return;}box.replaceChildren();for(const item of items)box.append(profileRecord((item.previous_rank_name||'Ingreso')+' → '+item.new_rank_name,item.reason||'Sin observaciones',(item.changed_by_name||'Gestión')+' · '+niceDate(item.created_at)));}
function renderProfileSanctions(items,failed){const box=$('profileSanctions');if(failed||!items.length){profileEmpty(box,failed?'No se pudo cargar el expediente.':'Este agente no tiene sanciones registradas.');return;}box.replaceChildren();for(const item of items)box.append(profileRecord((item.action_type==='warning'?'Amonestación':'Strike')+' '+item.level+' · '+(item.active?'Activa':item.status),item.reason,(item.issuer_name||'Gestión')+' · '+niceDate(item.created_at)));}
function renderProfileAbsences(items,failed){const box=$('profileAbsences');if(failed||!items.length){profileEmpty(box,failed?'No se pudieron cargar las ausencias.':'No hay ausencias registradas.');return;}box.replaceChildren();const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'});for(const item of items)box.append(profileRecord(absenceDateText(item.start_date)+' → '+absenceDateText(item.end_date)+' · '+absencePhase(item,today),item.reason,''));}
async function saveProfileObservation(operation,note=null){
 if(!profilePerson||profileSaving)return;const person={...profilePerson},content=$('profileNoteText').value.trim(),id=person.discord_user_id;
 if(operation!=='archive'&&(!content||content.length>2000)){$('profileNoteFeedback').textContent='Escribe una observación de 1 a 2000 caracteres.';return;}
 const body={discord_user_id:id,note_id:note?.id||profileNoteId,...(operation!=='add'?{expected_version:note?.version||profileEditingNote?.expected_version}:{}),...(operation!=='archive'?{content}:{})};
 profileSaving=true;for(const control of ['saveProfileNote','profileNoteText','cancelProfileNoteEdit','profileClose','profileRefresh'])$(control).disabled=true;$('profileNotes').querySelectorAll('button').forEach(button=>button.disabled=true);$('profileNoteFeedback').textContent='Guardando…';
 try{
  const result=await request('personnel-note-'+operation,{method:'POST',body});if(profilePerson?.discord_user_id!==id)return;
  if(operation!=='archive')resetProfileNote();await loadPersonnelFile(person,true);$('profileNoteFeedback').textContent=result.message;showToast(result.message);
 }catch(error){if(profilePerson?.discord_user_id===id)$('profileNoteFeedback').textContent=error.message;}
 finally{profileSaving=false;for(const control of ['profileNoteText','cancelProfileNoteEdit','profileClose','profileRefresh'])$(control).disabled=false;if(profilePerson?.discord_user_id===id){$('saveProfileNote').disabled=false;$('profileNotes').querySelectorAll('button').forEach(button=>button.disabled=false);}}
}
$('profileNoteText').addEventListener('input',()=>{if(profilePerson)profileDrafts.set(profilePerson.discord_user_id,{content:$('profileNoteText').value,edit:profileEditingNote,id:profileNoteId});});
$('profileNoteForm').addEventListener('submit',event=>{event.preventDefault();saveProfileObservation(profileEditingNote?'edit':'add');});
$('cancelProfileNoteEdit').addEventListener('click',()=>{if(!profileSaving)resetProfileNote();});
$('profileRefresh').addEventListener('click',()=>{if(profilePerson&&!profileSaving){loadPersonnelFile(profilePerson,true);if($('profileAccessDetails').open)loadProfileAccess(profilePerson);}});
let profileSectionTimer=null;
for(const details of document.querySelectorAll('[data-profile-section]'))details.addEventListener('toggle',()=>{if(details.open&&profilePerson&&!profileSaving){clearTimeout(profileSectionTimer);profileSectionTimer=setTimeout(()=>{if(profilePerson&&!profileSaving)loadPersonnelFile(profilePerson,true);},0);}});
$('profileAccessDetails').addEventListener('toggle',()=>{if($('profileAccessDetails').open&&profilePerson)loadProfileAccess(profilePerson);});
for(const [button,type,direction]of [['profileNotesNext','note',1],['profileNotesPrevious','note',-1],['profileHistoryNext','history',1],['profileHistoryPrevious','history',-1]])$(button).addEventListener('click',()=>{if(!profilePerson||profileSaving)return;if(type==='note')profileNoteOffset=direction===1?profileNoteNext:Math.max(0,profileNoteOffset-25);else profileHistoryOffset=direction===1?profileHistoryNext:Math.max(0,profileHistoryOffset-20);loadPersonnelFile(profilePerson,true);});
$('profileEditButton').addEventListener('click',()=>{if(!profilePerson||profileSaving)return;const person={...profilePerson};closePersonnelProfile();document.querySelector('[data-view="personnel"]').click();openPersonnelForm(person);});
$('profileSanctionButton').addEventListener('click',()=>{if(!profilePerson||profileSaving)return;const person={...profilePerson};if(person.status!=='active')return showToast('El agente debe estar activo.');closePersonnelProfile();document.querySelector('[data-view="sanctions"]').click();selectSanctionAgent(person);$('sanctionReason').focus();});
$('profileAbsenceButton').addEventListener('click',()=>{if(!profilePerson||profileSaving)return;const person={...profilePerson};closePersonnelProfile();document.querySelector('[data-view="absences"]').click();selectedAbsenceAgent=person;absenceOffset=0;$('absenceFilter').value='';$('absenceSearch').value='';$('absenceSelectedLabel').textContent='Historial · '+person.full_name+' · Placa '+person.plate;$('clearAbsenceAgent').hidden=false;showAbsenceMode('requests');loadAbsences();});
document.addEventListener('keydown',event=>{if(document.querySelector('dialog[open]')||event.key!=='Tab'||$('personnelProfileModal').classList.contains('hidden'))return;const controls=[...$('personnelProfileModal').querySelectorAll('button:not([disabled]),input,textarea,summary')].filter(el=>el.getClientRects().length);const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});
window.addEventListener('panel-session-ended',()=>{profileSaving=false;for(const control of ['profileNoteText','cancelProfileNoteEdit','profileClose','profileRefresh'])$(control).disabled=false;profileDrafts.clear();beforeClosePersonnelFile();$('personnelProfileModal').classList.add('hidden');document.body.style.overflow='';});

const personnelFileTabs=[['summary','Resumen'],['notes','Notas'],['activity','Actividad'],['history','Historial']];
function selectPersonnelFileTab(key,focus=false){
 if(profileSaving)return;
 for(const [name]of personnelFileTabs){const selected=name===key,button=$('personnelFileTab-'+name),panel=$('personnelFilePanel-'+name);button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;panel.hidden=!selected;for(const details of panel.querySelectorAll('details'))details.open=selected&&details.dataset.fileAutoOpen==='true';if(selected&&focus)button.focus();}
 $('personnelProfileModal').querySelector('.profile-body').scrollTop=0;
}
function setupPersonnelFileTabs(){
 const modal=$('personnelProfileModal'),body=modal.querySelector('.profile-body'),nav=document.createElement('nav');nav.className='personnel-file-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Secciones de la ficha');
 const groups={summary:['.profile-metrics','#profileIdentityDetails','#profileDepartureInfo'],notes:['#profileNotesDetails'],activity:['#profileSanctionsDetails','#profileAbsencesDetails','.profile-last-service'],history:['.dossier-intro','#profileMovementsDetails','#profileAccessDetails','#profileHistoryDetails']};
 for(const [key,label]of personnelFileTabs){const button=document.createElement('button'),panel=document.createElement('section');button.type='button';button.id='personnelFileTab-'+key;button.textContent=label;button.setAttribute('role','tab');button.setAttribute('aria-controls','personnelFilePanel-'+key);button.onclick=()=>selectPersonnelFileTab(key);button.onkeydown=event=>{const i=personnelFileTabs.findIndex(([name])=>name===key);const target=event.key==='ArrowRight'?(i+1)%4:event.key==='ArrowLeft'?(i+3)%4:event.key==='Home'?0:event.key==='End'?3:null;if(target!==null){event.preventDefault();selectPersonnelFileTab(personnelFileTabs[target][0],true);}};nav.append(button);panel.id='personnelFilePanel-'+key;panel.className='personnel-file-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.tabIndex=0;
  for(const selector of groups[key]){const node=body.querySelector(selector);if(node){if(node.tagName==='DETAILS'&&['notes','activity'].includes(key))node.dataset.fileAutoOpen='true';panel.append(node);}}body.querySelector('.profile-read-feedback').before(panel);
 }
 const metrics=$('personnelFilePanel-summary').querySelector('.profile-metrics'),activityMetrics=document.createElement('div');activityMetrics.className='profile-metrics profile-activity-metrics';activityMetrics.append(metrics.children[1],metrics.children[2]);$('personnelFilePanel-activity').prepend(activityMetrics);
 modal.querySelector('.profile-head').after(nav);body.querySelector('.profile-columns').remove();
 const footer=modal.querySelector('.profile-footer'),menu=document.createElement('details'),summary=document.createElement('summary'),actions=document.createElement('div');menu.className='personnel-file-actions';summary.textContent='Más acciones';actions.className='personnel-file-action-list';for(const id of ['profileAbsenceButton','profileSanctionButton','profileStatusButton'])actions.append($(id));menu.append(summary,actions);footer.prepend(menu);selectPersonnelFileTab('summary');
}
setupPersonnelFileTabs();
