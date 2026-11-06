let evidenceRecords=[],evidenceOffset=0,evidenceHasMore=false;
async function loadEvidenceRecords(reset=false){
 if(reset){evidenceRecords=[];evidenceOffset=0;}
 const body=document.getElementById('evidenceRows'),summary=document.getElementById('evidenceSummary');
 summary.textContent='Cargando evidencias…';
 try{
  const data=await request('evidence-records',{method:'GET',query:{offset:evidenceOffset}});
  evidenceRecords.push(...(data.records||[]));evidenceOffset+=data.records.length;evidenceHasMore=!!data.has_more;
  document.getElementById('moreEvidence').hidden=!evidenceHasMore;
  renderEvidenceRecords();
 }catch(e){summary.textContent='No se pudieron consultar las evidencias: '+e.message;body.replaceChildren();}
}
function renderEvidenceRecords(){
 const q=document.getElementById('evidenceSearch').value.toLocaleLowerCase('es');
 const filtered=evidenceRecords.filter(x=>[x.officer_name,x.plate,x.objects_description,x.locker,x.h50].some(v=>String(v||'').toLocaleLowerCase('es').includes(q)));
 const tbody=document.getElementById('evidenceRows');tbody.replaceChildren();
 for(const x of filtered){
  const tr=document.createElement('tr');
  for(const v of [new Date(x.created_at).toLocaleString('es-ES'),x.officer_name,x.plate,x.locker,x.objects_description,x.h50]){
   const td=document.createElement('td');td.textContent=String(v||'—');tr.append(td);
  }
  const td=document.createElement('td');
  if(/^\d{15,22}$/.test(x.channel_id||'')&&/^\d{15,22}$/.test(x.discord_message_id||'')){
   const a=document.createElement('a');a.href='https://discord.com/channels/1539970134469378068/'+x.channel_id+'/'+x.discord_message_id;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Ver evidencia';td.append(a);
  }else td.textContent='—';
  tr.append(td);tbody.append(tr);
 }
 const totals=new Map();
 for(const x of evidenceRecords){const key=x.discord_user_id;const v=totals.get(key)||{name:x.officer_name,plate:x.plate,count:0};v.count++;totals.set(key,v);}
 const panel=document.getElementById('evidenceTotals');panel.replaceChildren();
 for(const x of [...totals.values()].sort((a,b)=>b.count-a.count)){
  const p=document.createElement('p');p.textContent=x.name+' · #'+(x.plate||'—')+' — '+x.count+' evidencia(s)';panel.append(p);
 }
 document.getElementById('evidenceSummary').textContent=evidenceRecords.length+' registros cargados · '+totals.size+' policías'+(evidenceHasMore?' · Hay más registros':'');
 if(!filtered.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.textContent='No hay evidencias para mostrar.';tr.append(td);tbody.append(tr);}
}
document.getElementById('refreshEvidence').addEventListener('click',()=>loadEvidenceRecords(true));
document.getElementById('moreEvidence').addEventListener('click',()=>loadEvidenceRecords(false));
document.getElementById('evidenceSearch').addEventListener('input',renderEvidenceRecords);
