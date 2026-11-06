let evidenceRecords=[],evidenceOffset=0,evidenceHasMore=false,evidenceSequence=0,evidenceBusy=false,evidenceSearchTimer=null,evidenceRefreshTimer=null,evidenceSummary=null,evidenceOfficerTotals=[];
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
 const tbody=$('evidenceRows'),batch=document.createDocumentFragment();tbody.replaceChildren();
 for(const x of evidenceRecords){const tr=document.createElement('tr');
  for(const [label,value]of [['Fecha y hora',niceDate(x.created_at)],['Policía',x.officer_name],['Placa',x.plate],['Locker',x.locker],['Objetos incautados',x.objects_description],['Responsable H-50',x.h50]]){const td=document.createElement('td');td.dataset.label=label;td.textContent=String(value??'—');tr.append(td);}
  const td=document.createElement('td');td.dataset.label='Discord';
  if(/^\d{17,20}$/.test(x.channel_id||'')&&/^\d{17,20}$/.test(x.discord_message_id||'')){const a=document.createElement('a');a.className='evidence-link';a.href='https://discord.com/channels/1539970134469378068/'+x.channel_id+'/'+x.discord_message_id;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Abrir mensaje';td.append(a);}else td.textContent='Enlace no disponible';
  tr.append(td);batch.append(tr);
 }
 if(!evidenceRecords.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.className='muted';td.textContent=evidenceSummary?'No hay evidencias que coincidan con estos filtros.':'Sin registros cargados.';tr.append(td);batch.append(tr);}tbody.append(batch);
 $('evidenceTotalCount').textContent=evidenceSummary?.records??'—';$('evidenceOfficerCount').textContent=evidenceSummary?.officers??'—';$('evidenceMatchCount').textContent=evidenceSummary?.total??'—';
}
function renderEvidenceTotals(){const panel=$('evidenceTotals'),batch=document.createDocumentFragment();panel.replaceChildren();for(const x of evidenceOfficerTotals){const row=document.createElement('article'),copy=document.createElement('div'),name=document.createElement('strong'),plate=document.createElement('small'),button=document.createElement('button');row.className='evidence-officer-total';name.textContent=x.officer_name;plate.textContent='Placa '+(x.plate||'—')+' · '+x.total+(Number(x.total)===1?' evidencia':' evidencias');copy.append(name,plate);button.type='button';button.className='btn ghost';button.textContent='Ver historial';button.setAttribute('aria-label','Ver historial de '+x.officer_name);button.onclick=()=>{$('evidenceSearch').value='';$('evidenceOfficerFilter').value=x.discord_user_id;loadEvidenceRecords(true);$('evidenceSummary').scrollIntoView({block:'nearest'});};row.append(copy,button);batch.append(row);}if(!evidenceOfficerTotals.length){const p=document.createElement('p');p.className='muted';p.textContent=evidenceSummary?'Todavía no hay evidencias registradas.':'Totales no disponibles.';batch.append(p);}panel.append(batch);}
$('refreshEvidence').addEventListener('click',()=>{clearTimeout(evidenceSearchTimer);loadEvidenceRecords(true);});
$('moreEvidence').addEventListener('click',()=>loadEvidenceRecords(false));
$('evidenceSearch').addEventListener('input',()=>{clearTimeout(evidenceSearchTimer);evidenceSequence++;evidenceSearchTimer=setTimeout(()=>loadEvidenceRecords(true),300);});
$('evidenceOfficerFilter').addEventListener('change',()=>{clearTimeout(evidenceSearchTimer);loadEvidenceRecords(true);});
$('resetEvidenceFilters').addEventListener('click',()=>{clearTimeout(evidenceSearchTimer);$('evidenceOfficerFilter').value='';$('evidenceSearch').value='';loadEvidenceRecords(true);});
window.addEventListener('panel-session-ended',()=>{evidenceSequence++;clearTimeout(evidenceSearchTimer);clearInterval(evidenceRefreshTimer);evidenceRefreshTimer=null;evidenceBusy=false;evidenceRecords=[];evidenceSummary=null;evidenceOfficerTotals=[];evidenceOffset=0;evidenceHasMore=false;$('evidenceSearch').value='';$('evidenceOfficerFilter').replaceChildren(new Option('Todos los policías',''));$('moreEvidence').hidden=true;$('refreshEvidence').disabled=false;$('evidenceRows').removeAttribute('aria-busy');renderEvidenceRecords();renderEvidenceTotals();evidenceStatus('Inicia sesión para consultar evidencias.');});
