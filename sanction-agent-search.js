let sanctionSelectedAgent=null,sanctionAgentSequence=0,sanctionAgentTimer,sanctionAgentResults=[],sanctionAgentIndex=-1;
function closeSanctionAgentResults(){
 $('sanctionAgentResults').hidden=true;$('sanctionAgentSearch').setAttribute('aria-expanded','false');$('sanctionAgentSearch').removeAttribute('aria-activedescendant');sanctionAgentIndex=-1;
}
function refreshSanctionAgentSelection(){
 if(!sanctionSelectedAgent)return;
 $('sanctionDiscordId').value=sanctionSelectedAgent.discord_user_id;$('sanctionTargetName').value=sanctionSelectedAgent.full_name||'';$('sanctionPlate').value=sanctionSelectedAgent.plate||'';
}
function clearSanctionAgent(focus=false){
 sanctionAgentSequence++;clearTimeout(sanctionAgentTimer);sanctionSelectedAgent=null;sanctionAgentResults=[];closeSanctionAgentResults();$('sanctionAgentResults').replaceChildren();
 for(const id of ['sanctionDiscordId','sanctionTargetName','sanctionPlate'])$(id).value='';
 $('sanctionAgentSearch').value='';$('sanctionAgentSearch').setCustomValidity('Busca y selecciona un agente de los resultados.');$('sanctionAgentSelected').hidden=true;$('sanctionAgentFeedback').textContent='Busca por nombre, placa o usuario de Discord.';
 if(focus)$('sanctionAgentSearch').focus();
}
function selectSanctionAgent(person){
 if(person.status!=='active')return showToast('Selecciona un agente activo.');
 sanctionAgentSequence++;clearTimeout(sanctionAgentTimer);sanctionSelectedAgent={...person};refreshSanctionAgentSelection();closeSanctionAgentResults();
 $('sanctionAgentSearch').value=(person.full_name||person.discord_username)+' · Placa '+(person.plate||'—');$('sanctionAgentSearch').setCustomValidity('');
 $('sanctionAgentSelectedName').textContent=person.full_name||person.discord_username;$('sanctionAgentSelectedInfo').textContent='Placa '+(person.plate||'—')+' · '+unitLabel(person.unit)+' · '+(person.discord_username?'@'+person.discord_username:person.discord_user_id);
 $('sanctionAgentSelected').hidden=false;$('sanctionAgentFeedback').textContent='Agente seleccionado. Comprueba su nombre y placa antes de registrar la sanción.';
}
async function searchSanctionAgents(){
 const sequence=++sanctionAgentSequence,session=token,query=$('sanctionAgentSearch').value.trim();
 if(query.length<2){closeSanctionAgentResults();$('sanctionAgentFeedback').textContent='Escribe al menos dos caracteres para buscar.';return;}
 $('sanctionAgentFeedback').textContent='Buscando agentes activos…';closeSanctionAgentResults();
 try{
  const result=await request('records',{method:'GET',query:{kind:'personnel',status:'active',directory:'true',search:query,limit:8,counts:'false'}});
  if(sequence!==sanctionAgentSequence||session!==token)return;
  sanctionAgentResults=(result.records||[]).filter(person=>person.status==='active');const box=$('sanctionAgentResults');box.replaceChildren();
  if(!sanctionAgentResults.length){$('sanctionAgentFeedback').textContent='No hay agentes activos que coincidan. Prueba con su placa o nombre.';return;}
  sanctionAgentResults.forEach((person,index)=>{const button=document.createElement('button'),name=document.createElement('strong'),info=document.createElement('span');button.type='button';button.className='sanction-agent-result';button.id='sanctionAgentOption'+index;button.setAttribute('role','option');button.setAttribute('aria-selected','false');button.tabIndex=-1;name.textContent=person.full_name||person.discord_username;info.textContent='Placa '+(person.plate||'—')+' · '+(person.rank_name||'Sin rango')+' · '+(person.discord_username?'@'+person.discord_username:person.discord_user_id);button.append(name,info);button.onpointerdown=event=>event.preventDefault();button.onclick=()=>selectSanctionAgent(person);box.append(button);});
  box.hidden=false;$('sanctionAgentSearch').setAttribute('aria-expanded','true');$('sanctionAgentFeedback').textContent=result.total>8?'Se muestran 8 coincidencias. Afina la búsqueda para encontrar al agente.':'Selecciona un resultado. También puedes usar las flechas y Enter.';
 }catch(error){if(sequence===sanctionAgentSequence)$('sanctionAgentFeedback').textContent=error.message;}
}
$('sanctionAgentSearch').addEventListener('input',()=>{
 sanctionAgentSequence++;clearTimeout(sanctionAgentTimer);sanctionSelectedAgent=null;$('sanctionDiscordId').value='';$('sanctionTargetName').value='';$('sanctionPlate').value='';$('sanctionAgentSelected').hidden=true;$('sanctionAgentSearch').setCustomValidity('Selecciona un agente de los resultados.');closeSanctionAgentResults();
 sanctionAgentTimer=setTimeout(searchSanctionAgents,300);
});
$('sanctionAgentSearch').addEventListener('keydown',event=>{
 const box=$('sanctionAgentResults');if(event.key==='Escape'){closeSanctionAgentResults();return;}
 if(event.key==='Enter'){event.preventDefault();if(!box.hidden&&sanctionAgentIndex>=0)selectSanctionAgent(sanctionAgentResults[sanctionAgentIndex]);return;}
 if(!box.hidden&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();sanctionAgentIndex=Math.max(0,Math.min(sanctionAgentResults.length-1,sanctionAgentIndex+(event.key==='ArrowDown'?1:-1)));[...box.children].forEach((button,index)=>{button.classList.toggle('is-active',index===sanctionAgentIndex);button.setAttribute('aria-selected',String(index===sanctionAgentIndex));});const option=box.children[sanctionAgentIndex];$('sanctionAgentSearch').setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});}
});
$('changeSanctionAgent').onclick=()=>clearSanctionAgent(true);
$('sanctionForm').addEventListener('reset',()=>queueMicrotask(()=>clearSanctionAgent()));
document.addEventListener('click',event=>{if(!event.target.closest('#sanctionAgentPicker'))closeSanctionAgentResults();});
window.addEventListener('panel-session-ended',()=>clearSanctionAgent());
clearSanctionAgent();
