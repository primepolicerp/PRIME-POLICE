function personnelRegisterQuery(){
 const from=$('personnelPlateFrom').value.trim(),to=$('personnelPlateTo').value.trim(),feedback=$('personnelFilterFeedback');
 const error=(from&&!/^\d{1,12}$/.test(from))||(to&&!/^\d{1,12}$/.test(to))?'Escribe solo números en el intervalo de placas.':from&&to&&Number(from)>Number(to)?'La placa inicial no puede ser mayor que la final.':'';
 feedback.hidden=!error;feedback.textContent=error;if(error)return null;
 return {unit:$('personnelUnitFilter').value,plate_from:from,plate_to:to,sort:$('personnelSort').value,direction:$('personnelSortDirection').value};
}
function updatePersonnelRegisterSort(){
 const field=$('personnelSort').value,direction=$('personnelSortDirection').value;
 for(const head of document.querySelectorAll('[data-personnel-sort-header]')){const selected=head.dataset.personnelSortHeader===field;head.setAttribute('aria-sort',selected?(direction==='asc'?'ascending':'descending'):'none');head.querySelector('.personnel-sort-arrow').textContent=selected?(direction==='asc'?'↑':'↓'):'↕';}
 const labels=field==='plate'?['Menor primero','Mayor primero']:field==='rank'?['Rango menor primero','Rango mayor primero']:field==='state'?['Activos primero','Bajas primero']:['A → Z','Z → A'];
 $('personnelSortDirection').options[0].textContent=labels[0];$('personnelSortDirection').options[1].textContent=labels[1];
}
function renderPersonnelRegisterRows(people,rows){
 updatePersonnelRegisterSort();if(rosterPageInfo?.counts)$('personnelAbsenceStat').textContent=rosterPageInfo.counts.absence??'—';
 for(const person of people){
  const row=document.createElement('tr');row.dataset.personId=person.discord_user_id;
  const cell=(label,cls='')=>{const td=document.createElement('td');td.dataset.label=label;td.className=cls;row.append(td);return td;};
  cell('Placa','personnel-register-plate').textContent=person.plate||'—';
  const identity=document.createElement('div'),avatar=document.createElement('span'),name=document.createElement('button');identity.className='personnel-register-identity';avatar.className='personnel-register-avatar';avatar.setAttribute('aria-hidden','true');avatar.textContent=(person.full_name||person.discord_username||'PP').split(/\s+/).slice(0,2).map(part=>Array.from(part)[0]||'').join('').toUpperCase();name.type='button';name.className='personnel-agent-link';name.textContent=person.full_name||person.discord_username||'Agente';name.setAttribute('aria-label','Ver ficha de '+name.textContent);name.onclick=()=>openPersonnelProfile(person);identity.append(avatar,name);cell('Nombre IC','personnel-register-agent').append(identity);
  cell('Rango','personnel-register-rank').textContent=person.rank_name||'Sin rango';
  const branch=document.createElement('span');branch.className='personnel-register-branch '+(person.unit==='CIC'?'cic':person.unit==='UCOP'?'ucop':'police');branch.textContent=['UCOP','CIC'].includes(person.unit)?person.unit:'Policía';branch.title=unitLabel(person.unit);cell('Rama','personnel-register-unit').append(branch);
  cell('Discord','personnel-register-discord').textContent=person.discord_username?'@'+person.discord_username:'—';
  const state=document.createElement('span');state.className='personnel-status '+(person.status!=='active'?'is-inactive':person.on_absence?'on-absence':'is-active');state.textContent=person.status!=='active'?'Baja':person.on_absence?'Ausencia':'Activo';cell('Estado','personnel-register-state').append(state);
  const actions=document.createElement('div'),open=document.createElement('button');actions.className='personnel-register-row-actions';open.type='button';open.className='personnel-open-file';open.textContent='Ver ficha';open.onclick=()=>openPersonnelProfile(person);actions.append(open,personnelMenu(person));cell('Ficha','personnel-register-file').append(actions);rows.append(row);
 }
}
function resetPersonnelRegister(){
 for(const id of ['personnelSearch','personnelRankFilter','personnelUnitFilter','personnelPlateFrom','personnelPlateTo'])$(id).value='';$('personnelStatusFilter').value='';$('personnelSort').value='plate';$('personnelSortDirection').value='asc';$('personnelFilterFeedback').hidden=true;updatePersonnelRegisterSort();activeRecordPage('personnel');
}
for(const id of ['personnelUnitFilter','personnelSort','personnelSortDirection'])$(id).addEventListener('change',()=>{updatePersonnelRegisterSort();activeRecordPage('personnel');});
for(const id of ['personnelPlateFrom','personnelPlateTo'])$(id).addEventListener('input',()=>scheduleRecordSearch('personnel'));
document.querySelectorAll('[data-personnel-sort]').forEach(button=>button.addEventListener('click',()=>{const field=button.dataset.personnelSort;if($('personnelSort').value===field)$('personnelSortDirection').value=$('personnelSortDirection').value==='asc'?'desc':'asc';else{$('personnelSort').value=field;$('personnelSortDirection').value='asc';}updatePersonnelRegisterSort();activeRecordPage('personnel');}));
$('resetPersonnelFilters').onclick=resetPersonnelRegister;
window.addEventListener('panel-session-ended',()=>{for(const id of ['personnelSearch','personnelRankFilter','personnelUnitFilter','personnelPlateFrom','personnelPlateTo'])$(id).value='';$('personnelStatusFilter').value='';$('personnelSort').value='plate';$('personnelSortDirection').value='asc';$('personnelFilterFeedback').hidden=true;updatePersonnelRegisterSort();});
updatePersonnelRegisterSort();
