function personnelMenu(person){
 const menu=document.createElement('details'),summary=document.createElement('summary'),items=document.createElement('div');menu.className='personnel-row-menu';summary.className='btn';summary.textContent='Acciones';summary.setAttribute('aria-label','Acciones de '+(person.full_name||person.plate));items.className='personnel-row-menu-items';
 const action=(label,run,danger=false)=>{const button=document.createElement('button');button.type='button';button.className='personnel-row-action'+(danger?' is-danger':'');button.textContent=label;button.onclick=()=>{menu.open=false;run();};items.append(button);};
 action('Ver ficha',()=>openPersonnelProfile(person));
 action('Editar ficha',()=>openPersonnelForm(person));
 if(person.status==='active')action('Registrar sanción',()=>{document.querySelector('[data-view="sanctions"]').click();selectSanctionAgent(person);$('sanctionReason').focus();});
 if(person.status==='active')action('Dar de baja',()=>openPersonnelStatus(person),true);
 else if(!['expelled','banned'].includes(person.departure_role))action('Reingresar',()=>openPersonnelStatus(person));
 else{const note=document.createElement('span');note.className='personnel-row-menu-note';note.textContent='Reingreso restringido por '+(person.departure_role==='banned'?'veto':'expulsión');items.append(note);}
 action('Eliminar ficha',()=>deletePersonnelRecord(person),true);
 menu.append(summary,items);menu.addEventListener('toggle',()=>{if(menu.open)document.querySelectorAll('.personnel-row-menu[open]').forEach(other=>{if(other!==menu)other.open=false;});});return menu;
}
function renderPersonnelTableRows(people,rows){
 for(const person of people){
  const row=document.createElement('tr');row.dataset.personId=person.discord_user_id;
  const cell=(label)=>{const td=document.createElement('td');td.dataset.label=label;row.append(td);return td;};
  cell('Placa').textContent=person.plate||'—';
  const nameCell=cell('Agente'),name=document.createElement('button'),user=document.createElement('small');name.type='button';name.className='personnel-agent-link';name.textContent=person.full_name||person.discord_username||'Agente';name.setAttribute('aria-label','Ver ficha de '+name.textContent);name.onclick=()=>openPersonnelProfile(person);user.className='personnel-secondary';user.textContent=person.discord_username?'@'+person.discord_username:'Discord registrado';nameCell.append(name,user);
  const rankCell=cell('Rango / rama'),rank=document.createElement('span'),unit=document.createElement('small');rank.className='personnel-rank-label';rank.textContent=person.rank_name||'Sin rango';unit.className='personnel-secondary';unit.textContent=unitLabel(person.unit);rankCell.append(rank,unit);
  const state=document.createElement('span');state.className='personnel-status '+(person.status==='active'?'is-active':'is-inactive');state.textContent=person.status==='active'?'Activo':'Baja';cell('Estado').append(state);cell('Acciones').append(personnelMenu(person));rows.append(row);
 }
}
document.addEventListener('click',event=>document.querySelectorAll('.personnel-row-menu[open]').forEach(menu=>{if(!menu.contains(event.target))menu.open=false;}));
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const menu=document.querySelector('.personnel-row-menu[open]');if(menu){event.preventDefault();menu.open=false;menu.querySelector('summary').focus();}});
document.addEventListener('focusin',event=>document.querySelectorAll('.personnel-row-menu[open]').forEach(menu=>{if(!menu.contains(event.target))menu.open=false;}));
const cleanNavigationLabels={dashboard:'Gestión diaria',administration:'Gestión diaria',shifts:'Gestión diaria',personnel:'Personal',departures:'Personal',absences:'Personal',ranks:'Personal',applications:'Reclutamiento',preselections:'Reclutamiento','rank-requests':'Reclutamiento',transfers:'Reclutamiento',sanctions:'Administración'};
function updateCleanNavigation(){
 for(const group of document.querySelectorAll('.nav-group'))group.hidden=![...group.querySelectorAll('.workspace-tab')].some(button=>!button.classList.contains('hidden'));
 $('permissionsHelp').hidden=!token;$('workspaceAccessRole').textContent=canAuthorizePromotions?'Directiva':restrictedToApplications?'Pasante UCOP':canDecideApplicationsDirect?'UCOP':'Gestión autorizada';
 const active=document.querySelector('.workspace-tab.active:not(.hidden)');if(active){const group=active.closest('.nav-group');if(group)group.open=true;$('workspaceBreadcrumb').textContent=cleanNavigationLabels[active.dataset.view]||'PRIME POLICE';}
}
function restoreCleanNavigation(){
 const user=$('accountCard').dataset.userId;if(user){try{const saved=JSON.parse(sessionStorage.getItem('primePoliceNav:'+user)||'{}');for(const group of document.querySelectorAll('.nav-group'))if(typeof saved[group.dataset.navGroup]==='boolean')group.open=saved[group.dataset.navGroup];}catch{/* Keep safe defaults when browser storage is unavailable. */}}
 updateCleanNavigation();
}
for(const group of document.querySelectorAll('.nav-group'))group.addEventListener('toggle',()=>{
 const user=$('accountCard').dataset.userId;if(!token||!user)return;try{sessionStorage.setItem('primePoliceNav:'+user,JSON.stringify(Object.fromEntries([...document.querySelectorAll('.nav-group')].map(item=>[item.dataset.navGroup,item.open]))));}catch{/* Navigation remains usable without storage. */}
});
document.querySelectorAll('.workspace-tab').forEach(button=>button.addEventListener('click',()=>{
 const group=button.closest('.nav-group');if(group)group.open=true;$('workspaceBreadcrumb').textContent=cleanNavigationLabels[button.dataset.view]||'PRIME POLICE';$('permissionsHelp').open=false;
 document.querySelectorAll('.personnel-row-menu[open]').forEach(menu=>menu.open=false);
}));
$('resetPersonnelFilters').onclick=()=>{$('personnelSearch').value='';$('personnelRankFilter').value='';$('personnelStatusFilter').value='active';activeRecordPage('personnel');};
window.addEventListener('panel-account-ready',restoreCleanNavigation);
window.addEventListener('panel-session-ended',()=>{$('permissionsHelp').open=false;$('permissionsHelp').hidden=true;$('openGlobalSearch').hidden=true;$('openSyncCenter').hidden=true;document.querySelectorAll('.personnel-row-menu[open]').forEach(menu=>menu.open=false);});
if(token)updateCleanNavigation();

const cleanNavIcons={dashboard:'activity',administration:'check',shifts:'clock',personnel:'people',departures:'arrow',absences:'calendar',ranks:'arrow',applications:'document',preselections:'check','rank-requests':'people',transfers:'arrow',sanctions:'document'};
for(const button of document.querySelectorAll('.workspace-tab')){const icon=button.querySelector(':scope > span');if(icon&&typeof dashboardIcon==='function')icon.innerHTML=dashboardIcon(cleanNavIcons[button.dataset.view]||'document');}
