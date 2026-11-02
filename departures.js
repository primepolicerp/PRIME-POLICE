let departuresOffset=0,departuresNext=null,departuresSequence=0,departuresSearchTimer;
function departureCell(row,label,value){const cell=document.createElement('td');cell.dataset.label=label;cell.textContent=value||'—';row.append(cell);return cell;}
function renderDepartures(records){
 const rows=$('departuresRows');rows.replaceChildren();
 if(!records.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=7;cell.className='muted';cell.textContent=$('departuresSearch').value.trim()?'No hay bajas que coincidan con la búsqueda.':'Todavía no hay agentes de baja registrados.';row.append(cell);rows.append(row);return;}
 for(const person of records){
  const row=document.createElement('tr');departureCell(row,'Placa',person.plate);
  const identity=departureCell(row,'Agente / Discord',person.full_name),user=document.createElement('small');user.className='muted';user.textContent=(person.discord_username?'@'+person.discord_username+' · ':'')+'ID '+person.discord_user_id;identity.append(user);
  departureCell(row,'Último rango',person.rank_name);departureCell(row,'Fecha de baja',person.departure_date?new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(person.departure_date+'T00:00:00Z')):'Sin fecha registrada');
  const reason=departureCell(row,'Motivo / estado',departureLabels[person.departure_type]||'Baja registrada'),role=document.createElement('small');role.className='muted';role.textContent=departureRoleLabels[person.departure_role]||'Rol de baja no documentado';reason.append(role);
  departureCell(row,'Registrada por',person.departure_by_name||'Responsable no registrado');
  const actions=departureCell(row,'Acciones',''),group=document.createElement('div');actions.replaceChildren();group.className='personnel-actions';
  const profile=document.createElement('button');profile.type='button';profile.className='btn';profile.textContent='Ver ficha';profile.onclick=()=>openPersonnelProfile(person);group.append(profile);
  if(!['expelled','banned'].includes(person.departure_role)){const reentry=document.createElement('button');reentry.type='button';reentry.className='btn accept';reentry.textContent='Reingresar';reentry.onclick=()=>openPersonnelStatus(person);group.append(reentry);}
  else{const note=document.createElement('small');note.className='muted';note.textContent='Reingreso restringido';group.append(note);}
  actions.append(group);rows.append(row);
 }
}
async function loadDepartures(){
 const sequence=++departuresSequence,session=token,rows=$('departuresRows'),pager=$('departuresPager');
 rows.setAttribute('aria-busy','true');rows.inert=true;$('departuresFeedback').textContent='Consultando bajas…';pager.querySelectorAll('button').forEach(b=>b.disabled=true);
 try{
  const result=await request('records',{method:'GET',query:{kind:'personnel',status:'inactive',search:$('departuresSearch').value.trim(),offset:departuresOffset,limit:25,counts:'false'}});
  if(sequence!==departuresSequence||session!==token)return;
  departuresNext=result.next_offset??null;renderDepartures((result.records||[]).filter(p=>p.status==='inactive'));
  $('departuresCount').textContent=result.total+' '+(result.total===1?'agente de baja':'agentes de baja');$('departuresFeedback').textContent='';pager.replaceChildren();
  const info=document.createElement('span');info.className='muted';info.textContent=result.total?'Mostrando '+(departuresOffset+1)+'–'+Math.min(departuresOffset+25,result.total)+' de '+result.total:'Sin resultados';pager.append(info);
  for(const [label,offset,disabled]of [['Anterior',Math.max(0,departuresOffset-25),departuresOffset===0],['Siguiente',departuresNext,departuresNext===null]]){const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=label;button.disabled=disabled;button.onclick=()=>{departuresOffset=offset;loadDepartures();};pager.append(button);}
 }catch(error){if(sequence===departuresSequence&&session===token){rows.replaceChildren();pager.replaceChildren();$('departuresCount').textContent='Bajas no disponibles';$('departuresFeedback').textContent=error.message+' Pulsa Actualizar bajas para reintentar.';}}
 finally{if(sequence===departuresSequence){rows.removeAttribute('aria-busy');rows.inert=false;}}
}
document.querySelectorAll('.workspace-tab').forEach(button=>button.addEventListener('click',()=>{
 const visible=button.dataset.view==='departures';$('departuresView').classList.toggle('hidden',!visible);
 if(visible){departuresOffset=0;loadDepartures();}else{departuresSequence++;clearTimeout(departuresSearchTimer);}
}));
$('refreshDepartures').onclick=()=>loadDepartures();
$('departuresSearch').addEventListener('input',()=>{departuresSequence++;clearTimeout(departuresSearchTimer);departuresSearchTimer=setTimeout(()=>{departuresOffset=0;loadDepartures();},350);});
$('showPersonnelDepartures').onclick=()=>document.querySelector('[data-view="departures"]').click();
window.addEventListener('panel-data-changed',()=>{if(!$('departuresView').classList.contains('hidden'))loadDepartures();});
window.addEventListener('panel-session-ended',()=>{departuresSequence++;clearTimeout(departuresSearchTimer);departuresOffset=0;departuresNext=null;$('departuresSearch').value='';$('departuresRows').replaceChildren();$('departuresPager').replaceChildren();$('departuresView').classList.add('hidden');});
