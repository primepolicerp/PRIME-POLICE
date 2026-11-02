let careerPerson=null,careerOffset=0,careerNext=null,careerSequence=0,careerFocus=null;
const careerLabel={promotion:'Ascenso',demotion:'Descenso',assignment:'Asignación'};
function careerMetric(label,value){const box=document.createElement('div'),small=document.createElement('span'),strong=document.createElement('strong');box.className='career-metric';small.textContent=label;strong.textContent=String(value??'—');box.append(small,strong);return box;}
async function openPersonnelCareer(person){
 if(!person)return;careerFocus=document.activeElement;careerPerson={...person};careerOffset=0;careerNext=null;
 $('careerCurrentRank').textContent=person.rank_name||'Sin rango registrado';$('careerPage').textContent='';$('careerName').textContent=person.full_name;$('careerIdentity').textContent='Placa '+(person.plate||'—')+' · '+unitLabel(person.unit);
 $('personnelCareerDialog').showModal();await loadPersonnelCareer();
}
async function loadPersonnelCareer(){
 if(!careerPerson)return;const sequence=++careerSequence,session=token,id=careerPerson.discord_user_id;
 $('careerFeedback').textContent='Consultando expediente…';$('careerTimeline').setAttribute('aria-busy','true');
 for(const button of ['careerPrevious','careerNext','careerRefresh'])$(button).disabled=true;
 $('careerTimeline').replaceChildren();$('careerMetrics').replaceChildren();
 try{
  const data=await request('personnel-career',{method:'GET',query:{discord_user_id:id,offset:careerOffset}});
  if(sequence!==careerSequence||session!==token||careerPerson?.discord_user_id!==id)return;
  const person=data.person,stats=data.stats;careerPerson=person;careerNext=data.next_offset??null;
  $('careerName').textContent=person.full_name;$('careerCurrentRank').textContent=person.rank_name||'Sin rango registrado';
  $('careerIdentity').textContent='Placa '+(person.plate||'—')+' · '+unitLabel(person.unit)+' · '+(person.status==='active'?'Activo':'Baja');
  $('careerMetrics').append(careerMetric('Ascensos registrados',stats.promotions),careerMetric('Descensos registrados',stats.demotions),careerMetric('Días en rango actual',data.days_in_rank),careerMetric('Alta de la ficha',niceDate(person.created_at).split(',')[0]));
  const list=$('careerTimeline');
  if(!data.history.length)profileEmpty(list,'Todavía no hay movimientos de rango documentados en este expediente.');
  for(const item of data.history){
   const row=document.createElement('article'),date=document.createElement('time'),main=document.createElement('div'),head=document.createElement('div'),badge=document.createElement('span'),title=document.createElement('h3'),previous=document.createElement('p'),author=document.createElement('p'),note=document.createElement('p');
   row.className='career-entry '+item.action_type;date.dateTime=item.created_at;date.textContent=niceDate(item.created_at);main.className='career-entry-main';head.className='career-entry-head';badge.className='career-change';badge.textContent=careerLabel[item.action_type]||'Cambio de rango';title.textContent=item.new_rank_name||'Rango sin nombre';previous.className='career-previous';previous.textContent=item.previous_rank_name?'Desde '+item.previous_rank_name:'Primera asignación documentada';
   head.append(badge);
   if(item.id===stats.latest_id&&item.new_role_id===person.rank_role_id&&Date.parse(item.created_at)>=Date.parse(person.last_rank_change_at||item.created_at)-1000){const current=document.createElement('span');current.className='career-current';current.textContent='Coincide con el rango actual';head.append(current);}
   author.className='career-author';author.textContent='Registrado por '+(item.changed_by_name||item.changed_by_discord_id||'Responsable no registrado');note.className='career-note';note.textContent=item.reason||'Sin observaciones registradas';main.append(head,title,previous,author,note);row.append(date,main);list.append(row);
  }
  $('careerPage').textContent=stats.total?'Movimientos '+(careerOffset+1)+'–'+(careerOffset+data.history.length)+' de '+stats.total:'Sin movimientos';
  $('careerPrevious').disabled=careerOffset===0;$('careerNext').disabled=careerNext===null;
  $('careerFeedback').textContent='Historial documentado · Los cambios antiguos que no se registraron pueden no aparecer.';
 }catch(error){if(sequence===careerSequence){$('careerFeedback').textContent=error.message;profileEmpty($('careerTimeline'),'No se pudo consultar la trayectoria. Pulsa Actualizar para reintentar.');}}
 finally{if(sequence===careerSequence){$('careerTimeline').removeAttribute('aria-busy');$('careerRefresh').disabled=false;}}
}
$('profileCareerButton').onclick=()=>{if(profilePerson&&!profileSaving)openPersonnelCareer(profilePerson);};
$('careerClose').onclick=()=>{$('personnelCareerDialog').close();};
$('careerRefresh').onclick=loadPersonnelCareer;
$('careerPrevious').onclick=()=>{careerOffset=Math.max(0,careerOffset-20);loadPersonnelCareer();};
$('careerNext').onclick=()=>{if(careerNext!==null){careerOffset=careerNext;loadPersonnelCareer();}};
$('personnelCareerDialog').addEventListener('close',()=>{careerSequence++;careerPerson=null;$('careerTimeline').replaceChildren();if(careerFocus?.isConnected)careerFocus.focus();});
window.addEventListener('panel-session-ended',()=>{$('personnelCareerDialog').close();});
