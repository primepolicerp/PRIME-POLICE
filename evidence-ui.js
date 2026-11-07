let evidenceRecords=[],evidenceOffset=0,evidenceHasMore=false,evidenceSequence=0,evidenceBusy=false,evidenceSearchTimer=null,evidenceRefreshTimer=null,evidenceSummary=null,evidenceOfficerTotals=[],evidenceSelectedId=null;
function appendEvidenceMessageLinks(container,record,label='Abrir mensaje'){
 if(!/^\d{17,20}$/.test(record.channel_id||'')||!/^\d{17,20}$/.test(record.discord_message_id||''))return false;
 const path='1539970134469378068/'+record.channel_id+'/'+record.discord_message_id,group=document.createElement('span'),app=document.createElement('a'),web=document.createElement('a');group.className='evidence-message-links';app.className='evidence-link';app.href='discord://-/channels/'+path;app.textContent=label;app.title='Abrir este mensaje en la aplicación de Discord';web.className='evidence-link evidence-web-link';web.href='https://discord.com/channels/'+path;web.target='_blank';web.rel='noopener noreferrer';web.textContent='Ver en web';group.append(app,web);container.append(group);return true;
}
function appendEvidenceParticipants(container,record){
 const participants=Array.isArray(record.participants)?record.participants:[];
 if(!participants.length){container.textContent='No registrado';return;}
 for(const [index,person]of participants.entries()){
  if(index)container.append(document.createTextNode(', '));
  const name=String(person.officer_name||person.discord_username||person.discord_user_id||'Policía');
  if(!/^\d{17,20}$/.test(person.discord_user_id||'')){container.append(document.createTextNode(name));continue;}
  const link=document.createElement('a');link.className='evidence-link';link.href='discord://-/users/'+person.discord_user_id;link.textContent=name+(person.plate?' · #'+person.plate:'');container.append(link);
 }
}
function appendEvidenceH50(container,record){
 if(!/^\d{17,20}$/.test(record.h50_discord_user_id||'')){container.textContent=record.h50||'—';return;}
 const link=document.createElement('a');link.href='discord://-/users/'+record.h50_discord_user_id;link.className='evidence-link evidence-user-mention';link.textContent='@'+String(record.h50_discord_username||record.h50||record.h50_discord_user_id).replace(/^@/,'');link.title=(record.h50||'Responsable H-50')+' · ID '+record.h50_discord_user_id;container.append(link);
}
let evidenceHistorySequence=0,evidenceHistoryOfficer=null,evidenceHistoryOffset=0,evidenceHistoryIds=new Set();
function evidenceHistoryDialog(){
 let dialog=$('evidenceHistoryDialog');if(dialog)return dialog;
 dialog=document.createElement('dialog');dialog.id='evidenceHistoryDialog';dialog.className='evidence-history-dialog';dialog.setAttribute('aria-labelledby','evidenceHistoryTitle');
 dialog.innerHTML='<header class="evidence-history-head"><div><h2 id="evidenceHistoryTitle">Historial de evidencias</h2><p id="evidenceHistoryOfficer"></p></div><button id="closeEvidenceHistory" class="btn ghost" type="button" aria-label="Cerrar historial">×</button></header><div class="evidence-history-body"><p id="evidenceHistoryStatus" role="status" aria-live="polite"></p><div id="evidenceHistoryRecords"></div><button id="moreEvidenceHistory" class="btn" type="button" hidden>Cargar más evidencias</button></div>';
 document.body.append(dialog);$('closeEvidenceHistory').addEventListener('click',()=>dialog.close());$('moreEvidenceHistory').addEventListener('click',()=>loadEvidenceHistory(false));
 dialog.addEventListener('close',()=>{evidenceHistorySequence++;evidenceHistoryOfficer=null;$('evidenceHistoryRecords').replaceChildren();});
 return dialog;
}
function openEvidenceHistory(officer){
 if(!token||restrictedToApplications)return;
 const dialog=evidenceHistoryDialog();evidenceHistoryOfficer=officer;evidenceHistoryOffset=0;evidenceHistoryIds=new Set();
 $('evidenceHistoryOfficer').textContent=officer.officer_name+' · Placa '+(officer.plate||'—');$('evidenceHistoryRecords').replaceChildren();$('moreEvidenceHistory').hidden=true;
 if(!dialog.open)dialog.showModal();loadEvidenceHistory(true);
}
async function loadEvidenceHistory(reset){
 const officer=evidenceHistoryOfficer,session=token;if(!officer||!session||restrictedToApplications)return;
 const sequence=++evidenceHistorySequence,button=$('moreEvidenceHistory');button.disabled=true;$('evidenceHistoryStatus').textContent='Cargando historial…';
 try{
  const data=await request('evidence-records',{method:'GET',query:{discord_user_id:officer.discord_user_id,search:'',offset:reset?0:evidenceHistoryOffset,limit:50}});
  if(sequence!==evidenceHistorySequence||session!==token||!$('evidenceHistoryDialog').open)return;
  if(!Array.isArray(data.records))throw Error('No se recibió el historial esperado.');
  const batch=document.createDocumentFragment();
  for(const record of data.records){
   if(record.discord_user_id!==officer.discord_user_id||evidenceHistoryIds.has(record.id))continue;evidenceHistoryIds.add(record.id);
   const card=document.createElement('article'),head=document.createElement('div'),date=document.createElement('strong'),fields=document.createElement('dl');card.className='evidence-history-record';head.className='evidence-history-record-head';date.textContent=niceDate(record.created_at);head.append(date);
   appendEvidenceMessageLinks(head,record,'Abrir en Discord');
   for(const [label,value]of [['Operativo',record.operation||'No registrado'],['Policías participantes',null],['Locker',record.locker],['Responsable H-50',record.h50],['Objetos incautados',record.objects_description]]){const group=document.createElement('div'),term=document.createElement('dt'),description=document.createElement('dd');term.textContent=label;if(label==='Policías participantes')appendEvidenceParticipants(description,record);else if(label==='Responsable H-50')appendEvidenceH50(description,record);else description.textContent=String(value||'—');group.append(term,description);fields.append(group);}
   card.append(head,fields);batch.append(card);
  }
  $('evidenceHistoryRecords').append(batch);evidenceHistoryOffset=data.next_offset??0;button.hidden=!data.has_more;
  $('evidenceHistoryStatus').textContent=evidenceHistoryIds.size?'Mostrando '+evidenceHistoryIds.size+' de '+data.total+' evidencias.':'Este policía todavía no tiene evidencias registradas.';
 }catch(error){if(sequence===evidenceHistorySequence&&session===token)$('evidenceHistoryStatus').textContent='No se pudo cargar el historial: '+error.message;}
 finally{if(sequence===evidenceHistorySequence&&session===token)button.disabled=false;}
}
window.addEventListener('panel-session-ended',()=>{evidenceHistorySequence++;evidenceHistoryOfficer=null;evidenceHistoryIds.clear();const dialog=$('evidenceHistoryDialog');if(dialog?.open)dialog.close();});
function evidenceQuery(){return{search:$('evidenceSearch').value.trim(),discord_user_id:$('evidenceOfficerFilter').value};}
function evidenceStatus(text){$('evidenceSummary').textContent=text;}
async function loadEvidenceRecords(reset=false){
 if(!token||restrictedToApplications)return;
 if(evidenceBusy&&!reset)return;
 const sequence=++evidenceSequence,session=token,query=evidenceQuery(),offset=reset?0:evidenceOffset;
 evidenceBusy=true;$('refreshEvidence').disabled=true;$('moreEvidence').disabled=true;$('evidenceRows').setAttribute('aria-busy','true');evidenceStatus('Consultando evidencias…');
 try{
  const data=await request('evidence-records',{method:'GET',query:{...query,offset,limit:50}});
  if(sequence!==evidenceSequence||session!==token)return;
  if(!Array.isArray(data.records)||!Array.isArray(data.officer_totals)||!data.summary)throw Error('La API no devolvió el registro de evidencias esperado. Actualiza la web y vuelve a intentarlo.');
  const seen=new Set((reset?[]:evidenceRecords).map(x=>x.id)),fresh=data.records.filter(x=>!seen.has(x.id)&&seen.add(x.id));
  evidenceRecords=reset?fresh:[...evidenceRecords,...fresh];evidenceOffset=data.next_offset??0;evidenceHasMore=Boolean(data.has_more);evidenceSummary={...data.summary,total:data.total};evidenceOfficerTotals=data.officer_totals;
  renderEvidenceOfficerOptions(query.discord_user_id);renderEvidenceRecords();renderEvidenceTotals();
  evidenceStatus('Mostrando '+evidenceRecords.length+' de '+data.total+' evidencias'+(query.discord_user_id?' · Historial individual':'')+' · '+new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'}));
  $('moreEvidence').hidden=!evidenceHasMore;
  if(!evidenceRefreshTimer)evidenceRefreshTimer=setInterval(()=>{if(token&&!document.hidden&&!$('evidenceView').classList.contains('hidden')&&!evidenceBusy&&evidenceRecords.length<=50)loadEvidenceRecords(true);},60000);
 }catch(error){if(sequence!==evidenceSequence||session!==token)return;evidenceStatus('No se pudieron consultar las evidencias: '+error.message);if(reset){evidenceRecords=[];evidenceSummary=null;evidenceOfficerTotals=[];renderEvidenceRecords();renderEvidenceTotals();$('moreEvidence').hidden=true;}}
 finally{if(sequence===evidenceSequence&&session===token){evidenceBusy=false;$('refreshEvidence').disabled=false;$('moreEvidence').disabled=false;$('evidenceRows').removeAttribute('aria-busy');}}
}
function renderEvidenceOfficerOptions(selected){const select=$('evidenceOfficerFilter');select.replaceChildren(new Option('Todos los policías',''));for(const officer of evidenceOfficerTotals)select.add(new Option(officer.officer_name+' · #'+(officer.plate||'—')+' · '+officer.total,officer.discord_user_id));if(selected&&!evidenceOfficerTotals.some(x=>x.discord_user_id===selected))select.add(new Option('Policía seleccionado',selected));select.value=selected;}
function renderEvidenceRecords(){
 const list=$('evidenceRows'),batch=document.createDocumentFragment(),focused=list.contains(document.activeElement)?document.activeElement.dataset.evidenceId:null;list.replaceChildren();
 if(!evidenceRecords.some(x=>String(x.id)===evidenceSelectedId))evidenceSelectedId=evidenceRecords.length?String(evidenceRecords[0].id):null;
 for(const x of evidenceRecords){
  const button=document.createElement('button'),head=document.createElement('span'),person=document.createElement('span'),name=document.createElement('strong'),plate=document.createElement('span'),date=document.createElement('time'),summary=document.createElement('span');
  button.type='button';button.className='evidence-inbox-record';button.dataset.evidenceId=String(x.id);button.setAttribute('aria-pressed',String(String(x.id)===evidenceSelectedId));button.setAttribute('aria-controls','evidenceDetail');
  head.className='evidence-inbox-record-head';person.className='evidence-inbox-person';name.textContent=x.officer_name||'Policía';plate.className='evidence-inbox-plate';plate.textContent='Placa '+(x.plate||'—');date.dateTime=x.created_at||'';date.textContent=niceDate(x.created_at);person.append(name,plate);head.append(person,date);
  summary.className='evidence-inbox-excerpt';const text=String(x.objects_description||'Sin descripción').replace(/\s+/g,' ').trim();summary.textContent=text.length>140?text.slice(0,137)+'…':text;
  button.append(head,summary);button.addEventListener('click',()=>{
   evidenceSelectedId=String(x.id);for(const item of list.querySelectorAll('[data-evidence-id]'))item.setAttribute('aria-pressed',String(item.dataset.evidenceId===evidenceSelectedId));renderEvidenceDetail();
   if(window.matchMedia('(max-width: 820px)').matches)$('evidenceDetail').scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  });batch.append(button);
 }
 if(!evidenceRecords.length){const empty=document.createElement('p');empty.className='evidence-inbox-empty';empty.textContent=evidenceSummary?'No hay evidencias que coincidan con estos filtros.':'Sin registros cargados.';batch.append(empty);}list.append(batch);
 if(focused)Array.from(list.querySelectorAll('[data-evidence-id]')).find(item=>item.dataset.evidenceId===focused)?.focus({preventScroll:true});
 renderEvidenceDetail();
 $('evidenceTotalCount').textContent=evidenceSummary?.records??'—';$('evidenceOfficerCount').textContent=evidenceSummary?.officers??'—';$('evidenceMatchCount').textContent=evidenceSummary?.total??'—';
}
function renderEvidenceDetail(){
 const panel=$('evidenceDetail'),record=evidenceRecords.find(x=>String(x.id)===evidenceSelectedId);panel.replaceChildren();
 if(!record){const empty=document.createElement('p');empty.className='muted';empty.textContent='Selecciona una evidencia para consultar sus datos.';panel.append(empty);return;}
 const heading=document.createElement('header'),kicker=document.createElement('span'),title=document.createElement('h3'),meta=document.createElement('p'),fields=document.createElement('dl'),actions=document.createElement('div');
 heading.className='evidence-detail-heading';kicker.className='evidence-detail-kicker';kicker.textContent='Detalle del registro';title.id='evidenceDetailTitle';title.textContent=record.officer_name||'Policía';meta.textContent='Placa '+(record.plate||'—')+' · '+niceDate(record.created_at);heading.append(kicker,title,meta);fields.className='evidence-detail-fields';
 const field=(label,value,append)=>{const group=document.createElement('div'),term=document.createElement('dt'),description=document.createElement('dd');term.textContent=label;if(append)append(description,record);else description.textContent=String(value||'—');group.append(term,description);fields.append(group);};
 field('Objetos incautados',record.objects_description);field('Locker',record.locker);field('Responsable H-50',record.h50,appendEvidenceH50);
 if(String(record.operation||'').trim())field('Operativo',record.operation);
 if(Array.isArray(record.participants)&&record.participants.length)field('Policías participantes',null,appendEvidenceParticipants);
 actions.className='evidence-detail-actions';if(!appendEvidenceMessageLinks(actions,record,'Abrir en Discord')){const unavailable=document.createElement('span');unavailable.className='muted';unavailable.textContent='Enlace de Discord no disponible';actions.append(unavailable);}
 const history=document.createElement('button');history.type='button';history.className='btn ghost';history.textContent='Historial del policía';history.addEventListener('click',()=>openEvidenceHistory(record));actions.append(history);panel.append(heading,fields,actions);
}
function renderEvidenceTotals(){const panel=$('evidenceTotals'),batch=document.createDocumentFragment();panel.replaceChildren();for(const x of evidenceOfficerTotals){const row=document.createElement('article'),copy=document.createElement('div'),name=document.createElement('strong'),plate=document.createElement('small'),button=document.createElement('button');row.className='evidence-officer-total';name.textContent=x.officer_name;plate.textContent='Placa '+(x.plate||'—')+' · '+x.total+(Number(x.total)===1?' evidencia':' evidencias');copy.append(name,plate);button.type='button';button.className='btn ghost';button.textContent='Ver historial';button.setAttribute('aria-label','Ver historial de '+x.officer_name);button.onclick=()=>openEvidenceHistory(x);row.append(copy,button);batch.append(row);}if(!evidenceOfficerTotals.length){const p=document.createElement('p');p.className='muted';p.textContent=evidenceSummary?'Todavía no hay evidencias registradas.':'Totales no disponibles.';batch.append(p);}panel.append(batch);}
$('refreshEvidence').addEventListener('click',()=>{clearTimeout(evidenceSearchTimer);loadEvidenceRecords(true);});
$('moreEvidence').addEventListener('click',()=>loadEvidenceRecords(false));
$('evidenceSearch').addEventListener('input',()=>{clearTimeout(evidenceSearchTimer);evidenceSequence++;evidenceSearchTimer=setTimeout(()=>loadEvidenceRecords(true),300);});
$('evidenceOfficerFilter').addEventListener('change',()=>{clearTimeout(evidenceSearchTimer);loadEvidenceRecords(true);});
$('resetEvidenceFilters').addEventListener('click',()=>{clearTimeout(evidenceSearchTimer);$('evidenceOfficerFilter').value='';$('evidenceSearch').value='';loadEvidenceRecords(true);});
window.addEventListener('panel-session-ended',()=>{evidenceSequence++;clearTimeout(evidenceSearchTimer);clearInterval(evidenceRefreshTimer);evidenceRefreshTimer=null;evidenceBusy=false;evidenceRecords=[];evidenceSummary=null;evidenceOfficerTotals=[];evidenceOffset=0;evidenceHasMore=false;$('evidenceSearch').value='';$('evidenceOfficerFilter').replaceChildren(new Option('Todos los policías',''));$('moreEvidence').hidden=true;$('refreshEvidence').disabled=false;$('evidenceRows').removeAttribute('aria-busy');renderEvidenceRecords();renderEvidenceTotals();evidenceStatus('Inicia sesión para consultar evidencias.');});
