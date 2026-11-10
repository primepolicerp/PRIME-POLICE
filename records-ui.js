const recordPages={};let directoryExpires=0,directoryTask=null,directorySession='';
const recordConfig={
 applications:{container:'candidateList',search:'search',status:()=>activeStatus==='rejected-ai'?'rejected':activeStatus,render:()=>renderApplications(),assign:rows=>{applications=rows;},stats:['countPending','countAccepted','countRejected']},
 transfers:{container:'transferList',search:'transferSearch',status:()=>activeTransferStatus,render:()=>renderTransfers(),assign:rows=>{transfers=rows;},stats:['transferPendingCount','transferAcceptedCount','transferRejectedCount']},
 intakes:{container:'rankRequestList',search:'rankRequestSearch',status:()=>activeRankRequestStatus,render:()=>renderRankRequests(),assign:rows=>{rankRequests=rows;},stats:['rankRequestPendingCount','rankRequestAcceptedCount','rankRequestRejectedCount']},
 personnel:{container:'personnelRows',search:'personnelSearch',status:()=>$('personnelStatusFilter').value,render:()=>renderPersonnel(),assign:rows=>{rosterPage=rows;}},
 sanctions:{container:'sanctionRows',search:'sanctionSearch',status:()=>$('sanctionStatusFilter').value==='all'?'':$('sanctionStatusFilter').value,render:()=>renderSanctions(),assign:rows=>{sanctions=rows;}},
 preselections:{container:'preselectionRows',search:'preselectionSearch',status:()=> 'active',render:()=>renderPreselections(),assign:rows=>{preselections=rows;}},
};
function recordState(kind){return recordPages[kind]||(recordPages[kind]={offset:0,sequence:0,timer:null});}
function activeRecordPage(kind){recordState(kind).offset=0;return loadRecordPage(kind);}
function scheduleRecordSearch(kind){const state=recordState(kind);clearTimeout(state.timer);state.sequence++;state.timer=setTimeout(()=>activeRecordPage(kind),350);}
function recordNavigation(kind,result){
 const config=recordConfig[kind],state=recordState(kind),id='recordPager-'+kind;
 let pager=$(id);if(!pager){pager=document.createElement('div');pager.id=id;pager.className='toolbar record-pager';const list=$(config.container);(list.tagName==='TBODY'?list.closest('.table-wrap')||list.closest('table'):list).after(pager);}
 pager.replaceChildren();const label=document.createElement('span');label.className='muted';label.textContent=(result.total?'Registros '+(state.offset+1)+'–'+Math.min(state.offset+25,result.total):'Sin resultados')+' · Total: '+result.total;pager.append(label);
 for(const [label,offset,disabled]of [['Anterior',Math.max(0,state.offset-25),state.offset===0],['Siguiente',result.next_offset,result.next_offset===null]]){const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=label;button.disabled=disabled;button.addEventListener('click',()=>{state.offset=offset;loadRecordPage(kind);});pager.append(button);}
}
async function loadRecordPage(kind){
 if(kind==='personnel')return loadPersonnelStream();
 const config=recordConfig[kind],state=recordState(kind),sequence=++state.sequence,session=token;
 const pager=$('recordPager-'+kind);if(pager)pager.querySelectorAll('button').forEach(b=>{b.disabled=true;});
 $(config.container).setAttribute('aria-busy','true');$(config.container).inert=true;
 try{
  const registerFilters=kind==='personnel'?personnelRegisterQuery():{};if(registerFilters===null){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=7;cell.textContent='Revisa los filtros de placas.';row.append(cell);$(config.container).replaceChildren(row);if(pager)pager.hidden=true;return;}if(pager)pager.hidden=false;
  const result=await request('records',{method:'GET',query:{kind,offset:state.offset,limit:25,status:config.status(),search:$(config.search)?.value||'',counts:kind==='personnel'||kind==='sanctions'||config.stats?'true':'false',...(kind==='applications'&&activeStatus==='rejected-ai'?{review:'ai'}:{}),...(kind==='personnel'?{rank:$('personnelRankFilter').value,...registerFilters}:{})}});
  if(sequence!==state.sequence||token!==session)return;
  if(kind==='personnel'&&result.total>0&&state.offset>=result.total){state.offset=Math.floor((result.total-1)/25)*25;return await loadRecordPage(kind);}if(kind==='personnel'&&result.total===0)state.offset=0;
  if(kind==='personnel')rosterPageInfo={counts:result.counts,total:result.total};
  config.assign(result.records||[]);const searchInput=$(config.search),searchValue=searchInput?.value;if(searchInput)searchInput.value='';try{config.render();}finally{if(searchInput)searchInput.value=searchValue;}
  if(config.stats)config.stats.forEach((id,i)=>{$(id).textContent=result.counts[['pending','accepted','rejected'][i]]||0;});
  if(kind==='personnel'){const c=result.counts;$('personnelTotalStat').textContent=(c.active||0)+(c.inactive||0);$('personnelActiveStat').textContent=c.active||0;$('personnelInactiveStat').textContent=c.inactive||0;$('personnelAbsenceStat').textContent=c.absence??'—';$('personnelCount').textContent=result.total+(result.total===1?' agente':' agentes');}
  if(kind==='sanctions'){$('sanctionTotalCount').textContent=Object.values(result.counts).reduce((a,b)=>a+b,0);$('activeSanctionCount').textContent=result.counts.active||0;$('sanctionTypeCounts').textContent+=' (esta página)';}
  if(kind==='preselections')$('preselectionTotalStat').textContent=result.total;
  recordNavigation(kind,result);
 }catch(error){if(sequence===state.sequence&&token===session)showToast(error.message);}
 finally{if(sequence===state.sequence){$(config.container).removeAttribute('aria-busy');$(config.container).inert=false;}}
}
async function loadPersonnelDirectory(){
 const session=token;if(!session||directoryExpires>Date.now())return;
 if(directoryTask&&directorySession===session)return directoryTask;
 const task=(async()=>{const all=[];let offset=0;do{
  const result=await request('records',{method:'GET',query:{kind:'personnel',directory:'true',limit:100,offset}});
  if(token!==session||directoryTask!==task)return;all.push(...result.records);const next=result.next_offset;
  if(next!==null&&(!Number.isSafeInteger(next)||next<=offset))throw Error('No se pudo completar la lista de personal. Actualiza para reintentar.');offset=next;
 }while(offset!==null);if(token===session&&directoryTask===task){personnel=all;directoryExpires=Date.now()+60000;}})();
 directoryTask=task;directorySession=session;
 try{await task;}finally{if(directoryTask===task){directoryTask=null;directorySession='';}}
}

async function loadPersonSanctions(userId){const records=[];let offset=0;do{const result=await request('records',{method:'GET',query:{kind:'sanctions',discord_user_id:userId,limit:100,offset}});records.push(...result.records);offset=result.next_offset;}while(offset!==null);return{records};}
loadApplications=()=>loadRecordPage('applications');loadTransfers=()=>loadRecordPage('transfers');
loadRankRequests=()=>loadRecordPage('intakes');loadPreselections=()=>loadRecordPage('preselections');loadSanctions=()=>loadRecordPage('sanctions');
loadPersonnel=async()=>{try{if(!$('personnelView').classList.contains('hidden'))await loadRecordPage('personnel');else{await loadPersonnelDirectory();renderPersonnel();}}catch(error){showToast(error.message);}};

// One continuous register; the server still filters and sorts before each batch.
let personnelStreamObserver=null;
function personnelStreamFooter(state,error=''){
 let footer=$('recordPager-personnel');if(!footer){footer=document.createElement('div');footer.id='recordPager-personnel';footer.className='personnel-stream-footer';$('personnelRows').closest('.table-wrap').after(footer);}
 footer.hidden=false;footer.replaceChildren();const label=document.createElement('span');label.setAttribute('role','status');label.textContent=error||('Mostrando '+(rosterPage?.length||0)+' de '+(rosterPageInfo?.total||0)+' agentes'+(state.nextOffset===null?' · Lista completa':''));footer.append(label);
 if(state.nextOffset!==null){const button=document.createElement('button');button.type='button';button.className='btn ghost';button.textContent=state.streamBusy?'Cargando…':error?'Reintentar carga':'Cargar más';button.disabled=state.streamBusy;button.onclick=()=>loadPersonnelStream(true);footer.append(button);}
 personnelStreamObserver?.disconnect();
 if(!error&&!state.streamBusy&&state.nextOffset!==null&&state.loadedSequence===state.sequence&&'IntersectionObserver'in window){personnelStreamObserver=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)&&!$('personnelView').classList.contains('hidden')&&state.loadedSequence===state.sequence)loadPersonnelStream(true);},{rootMargin:'240px'});personnelStreamObserver.observe(footer);}
}
async function loadPersonnelStream(append=false){
 const state=recordState('personnel');if(append&&(state.streamBusy||state.nextOffset===null||state.loadedSequence!==state.sequence))return;
 const filters=personnelRegisterQuery();personnelStreamObserver?.disconnect();
 const sequence=++state.sequence,session=token,offset=append?state.nextOffset:0;state.streamBusy=true;state.streamError=false;
 const rows=$('personnelRows');rows.setAttribute('aria-busy','true');
 if(!append){state.nextOffset=null;rosterPage=[];rows.replaceChildren();const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=7;cell.textContent=filters===null?'Revisa los filtros de placas.':'Consultando personal…';row.append(cell);rows.append(row);}
 if(filters===null){state.streamBusy=false;rows.removeAttribute('aria-busy');const footer=$('recordPager-personnel');if(footer)footer.hidden=true;return;}
 personnelStreamFooter(state);
 try{
  const result=await request('records',{method:'GET',query:{kind:'personnel',offset,limit:50,status:$('personnelStatusFilter').value,search:$('personnelSearch').value,counts:append&&offset>0?'false':'true',rank:$('personnelRankFilter').value,...filters}});
  if(sequence!==state.sequence||token!==session)return;
  const seen=new Set((append?rosterPage:[]).map(p=>p.discord_user_id)),fresh=(result.records||[]).filter(p=>!seen.has(p.discord_user_id)&&seen.add(p.discord_user_id));
  rosterPageInfo={counts:append&&offset>0?rosterPageInfo.counts:result.counts,total:result.total};rosterPage=append?[...rosterPage,...fresh]:fresh;
  state.nextOffset=Number.isInteger(result.next_offset)&&result.next_offset>offset?result.next_offset:null;state.loadedSequence=sequence;
  if(append&&offset>0)renderPersonnelRegisterRows(fresh,rows);else renderPersonnel();
 }catch(error){if(sequence===state.sequence&&token===session){state.streamBusy=false;state.loadedSequence=sequence;state.nextOffset=offset;personnelStreamFooter(state,error.message);state.streamError=true;}}
 finally{if(sequence===state.sequence&&token===session){state.streamBusy=false;rows.removeAttribute('aria-busy');if(!state.streamError)personnelStreamFooter(state);state.streamError=false;}}
}
window.addEventListener('panel-session-ended',()=>{personnelStreamObserver?.disconnect();const footer=$('recordPager-personnel');if(footer)footer.replaceChildren();});
const transferSearch=document.createElement('input');transferSearch.type='search';transferSearch.id='transferSearch';transferSearch.className='search';transferSearch.placeholder='Buscar nombre, usuario o procedencia…';transferSearch.setAttribute('aria-label','Buscar traslados');$('refreshTransfers').before(transferSearch);transferSearch.addEventListener('input',()=>scheduleRecordSearch('transfers'));
