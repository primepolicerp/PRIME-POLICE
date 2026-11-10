let bonusKind='weekly',bonusOffset=0,bonusTotal=0,bonusRecords=[],bonusSequence=0,bonusHistorySequence=0,bonusSelected=null,bonusSaving=false,bonusCanManage=false,bonusHistoryOffset=null,bonusSearchTimer,bonusAgentSequence=0,bonusRankOptions=[];
const bonusLabels={weekly:'Bono semanal',monthly:'Bono mensual',special:'Bono especial',promotion:'Bono por ascenso'},bonusStates={pending:'Pendiente',paid:'Pagado',excluded:'No corresponde'};
function bonusMoney(amount){return new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(Number(amount||0))+' RP$';}
function bonusToday(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),part=name=>parts.find(p=>p.type===name).value;return part('year')+'-'+part('month')+'-'+part('day');}
function bonusPeriod(){
 const raw=bonusKind==='monthly'?$('bonusMonth').value+'-01':$('bonusDate').value;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return null;const date=new Date(raw+'T00:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==raw)return null;
 if(bonusKind==='weekly')date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
 return date.toISOString().slice(0,10);
}
function bonusPeriodText(kind,period){
 const date=new Date(period+'T12:00:00Z'),fmt=d=>d.toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 if(kind==='weekly'){const end=new Date(date);end.setUTCDate(end.getUTCDate()+6);return 'Semana del '+fmt(date)+' al '+fmt(end);}
 return kind==='monthly'?date.toLocaleDateString('es-ES',{month:'long',year:'numeric',timeZone:'UTC'}):(kind==='promotion'?'Ascenso':'Especial')+' · '+fmt(date);
}
function bonusElement(tag,text,className){const el=document.createElement(tag);if(text!=null)el.textContent=text;if(className)el.className=className;return el;}
function bonusClear(){bonusRecords=[];bonusTotal=0;$('bonusTable').replaceChildren();$('bonusSummary').replaceChildren();$('bonusPrevious').disabled=true;$('bonusNext').disabled=true;$('bonusPage').textContent='';}
async function loadBonuses(reset=false){
 if(!token||restrictedToApplications)return;if(reset){bonusOffset=0;clearBonusSelection();}const sequence=++bonusSequence,session=token,period=bonusPeriod();bonusClear();
 if(!period){$('bonusNotice').textContent='Selecciona un período válido.';return;}
 $('bonusPeriodLabel').textContent=bonusPeriodText(bonusKind,period);$('bonusNotice').textContent='Consultando agentes y bonos…';$('bonusRefresh').disabled=true;
 try{const result=await request('bonus-records',{method:'GET',query:{kind:bonusKind,period,search:$('bonusSearch').value.trim(),offset:bonusOffset,archived:String($('bonusArchived').checked)}});if(session!==token||sequence!==bonusSequence)return;
 bonusRecords=result.records||[];bonusTotal=Number(result.total)||0;bonusCanManage=Boolean(result.can_manage);bonusRankOptions=result.ranks||[];$('bonusAccess').textContent=bonusCanManage?'Edición autorizada':'Solo consulta · Gestión';
 const summary=result.summary||{};for(const [label,value,cls]of [['Agentes del período',summary.agents,''],['Pagados',summary.paid,'paid'],['Pendientes',summary.pending,'pending'],['Total pagado',bonusMoney(summary.paid_amount),'paid']]){const card=bonusElement('div',null,'bonus-metric '+cls);card.append(bonusElement('small',label),bonusElement('strong',String(value??0)));$('bonusSummary').append(card);}
 renderBonuses();$('bonusPrevious').disabled=bonusOffset===0;$('bonusNext').disabled=bonusOffset+30>=bonusTotal;$('bonusPage').textContent=bonusTotal?(bonusOffset+1)+'–'+Math.min(bonusOffset+30,bonusTotal)+' de '+bonusTotal:'0 agentes';$('bonusNotice').textContent=bonusRecords.length?'Los agentes sin registro figuran pendientes. '+(summary.excluded||0)+' marcados como «No corresponde».':'No hay agentes para estos filtros.';
 }catch(error){if(session===token&&sequence===bonusSequence)$('bonusNotice').textContent=error.message;}
 finally{if(session===token&&sequence===bonusSequence)$('bonusRefresh').disabled=false;}
}
function renderBonuses(){
 if(!bonusRecords.length)return;const table=bonusElement('table'),head=bonusElement('thead'),header=bonusElement('tr');
 for(const text of ['Agente','Rango actual','Importe','Estado','Fecha de entrega','Acción']){const th=bonusElement('th',text);th.scope='col';header.append(th);}head.append(header);table.append(head);const body=bonusElement('tbody');
 for(const record of bonusRecords){const tr=bonusElement('tr'),agent=bonusElement('td',null,'bonus-agent');agent.dataset.label='Agente';agent.append(bonusElement('strong',record.full_name),bonusElement('small','#'+(record.plate||'—')+' · '+unitLabel(record.unit)+(record.personnel_status==='inactive'?' · Baja':'')));tr.append(agent);
 for(const [label,value]of [['Rango actual',(record.rank_name||'Sin rango')+(record.promoted_rank?' · Bono por ascenso: '+record.promoted_rank:'')],['Importe',record.id?bonusMoney(record.amount):'Sin asignar']]){const td=bonusElement('td',value);td.dataset.label=label;tr.append(td);}
 const state=bonusElement('td');state.dataset.label='Estado';state.append(bonusElement('span',bonusStates[record.status]||'Pendiente','bonus-pill '+record.status));tr.append(state);
 const updated=bonusElement('td',record.delivered_on||'Sin entrega registrada');updated.dataset.label='Fecha de entrega';tr.append(updated);
 const cell=bonusElement('td'),button=bonusElement('button',bonusCanManage?'Seleccionar':'Consultar','btn');cell.dataset.label='Acción';button.type='button';button.setAttribute('aria-label',(bonusCanManage?'Seleccionar':'Consultar')+' bono de '+record.full_name);button.onclick=()=>openBonus(record);cell.append(button);tr.append(cell);body.append(tr);}
 table.append(body);$('bonusTable').append(table);
}
function openBonus(record){
 if(bonusSaving)return;bonusHistorySequence++;bonusSelected={...record,kind:bonusKind,period:bonusPeriod()};bonusHistoryOffset=null;$('bonusDetailTitle').textContent=record.full_name;$('bonusIdentity').textContent='#'+(record.plate||'—')+' · '+(record.rank_name||'Sin rango');$('bonusDetailPeriod').textContent=bonusLabels[bonusKind]+' · '+bonusPeriodText(bonusKind,bonusSelected.period);
 $('bonusAmount').value=record.amount??'';$('bonusDelivered').value=record.delivered_on||bonusToday();$('bonusPromotedRankLabel').hidden=bonusKind!=='promotion';$('bonusPromotedRank').required=bonusKind==='promotion';$('bonusPromotedRank').replaceChildren(new Option('Selecciona un rango',''));for(const rank of bonusRankOptions)$('bonusPromotedRank').add(new Option(rank.role_name,rank.role_name));if(record.promoted_rank&&!bonusRankOptions.some(r=>r.role_name===record.promoted_rank))$('bonusPromotedRank').add(new Option(record.promoted_rank,record.promoted_rank));$('bonusPromotedRank').value=record.promoted_rank||'';$('bonusAgentNotice').textContent=bonusCanManage?'Agente seleccionado. Completa los detalles de la entrega.':'Solo consulta. Esta cuenta no tiene permiso para registrar bonos.';$('bonusStatus').value=record.status||'pending';$('bonusReason').value=record.reason||'';$('bonusFields').disabled=!bonusCanManage;$('bonusSave').hidden=false;$('bonusSave').disabled=!bonusCanManage;$('bonusSaveNotice').textContent=record.updated_by_name?'Último cambio: '+record.updated_by_name:'';$('bonusHistory').replaceChildren();$('bonusMoreHistory').hidden=true;$('bonusHistoryNotice').textContent=record.id?'Consultando historial…':'Todavía no hay cambios registrados.';$('bonusEditor').hidden=false;$('bonusEditor').scrollIntoView({behavior:'smooth',block:'start'});if(bonusCanManage)$('bonusAmount').focus({preventScroll:true});if(record.id)loadBonusHistory(0);
}
async function loadBonusHistory(offset=0){
 const record=bonusSelected,sequence=++bonusHistorySequence,session=token;if(!record?.id)return;$('bonusMoreHistory').disabled=true;
 try{const result=await request('bonus-history',{method:'GET',query:{id:record.id,offset}});if(session!==token||sequence!==bonusHistorySequence||bonusSelected!==record||$('bonusEditor').hidden)return;
 if(offset===0)$('bonusHistory').replaceChildren();for(const change of result.records||[]){const item=bonusElement('article'),after=change.after_record||{},before=change.before_record;item.append(bonusElement('strong',(before?'Actualización':'Registro inicial')+' · '+(bonusStates[after.status]||after.status)+' · '+bonusMoney(after.amount)),bonusElement('p',(after.delivered_on?'Entrega: '+after.delivered_on+' · ':'')+(after.promoted_rank?'Ascenso: '+after.promoted_rank+' · ':'')+(after.reason||'')),bonusElement('small',(change.actor_name||'Responsable')+' · '+niceDate(change.created_at)));if(before)item.append(bonusElement('p','Antes: '+(bonusStates[before.status]||before.status)+' · '+bonusMoney(before.amount)+' · '+(before.reason||'')));$('bonusHistory').append(item);}
 bonusHistoryOffset=result.next_offset;$('bonusMoreHistory').hidden=bonusHistoryOffset==null;$('bonusHistoryNotice').textContent=$('bonusHistory').children.length?'Historial conservado con responsable y fecha.':'Sin cambios registrados.';
 }catch(error){if(session===token&&sequence===bonusHistorySequence)$('bonusHistoryNotice').textContent=error.message;}
 finally{if(session===token&&sequence===bonusHistorySequence)$('bonusMoreHistory').disabled=false;}
}
$('bonusForm').addEventListener('submit',async event=>{
 event.preventDefault();if(!bonusSelected||bonusSaving||!bonusCanManage)return;const record=bonusSelected,session=token,amount=parseBonusAmount($('bonusAmount').value),status=$('bonusStatus').value,reason=$('bonusReason').value.trim();
 if(!Number.isFinite(amount)||amount<0||amount>9999999999.99){$('bonusSaveNotice').textContent='Escribe un importe válido, por ejemplo 50.000 o 50.000,50.';return;}
 if(status==='paid'&&!$('bonusDelivered').value){$('bonusSaveNotice').textContent='Selecciona la fecha de entrega.';return;}
 if(status==='paid'&&amount<=0){$('bonusSaveNotice').textContent='Indica un importe mayor que cero para registrar el pago.';return;}
 bonusSaving=true;$('bonusSave').disabled=true;$('bonusFields').disabled=true;$('bonusSaveNotice').textContent='Guardando…';
 try{const result=await request('bonus-save',{method:'POST',body:{discord_user_id:record.discord_user_id,kind:record.kind,period:record.period,amount,status,reason,expected_version:record.version,delivered_on:$('bonusDelivered').value||null,promoted_rank:record.kind==='promotion'?$('bonusPromotedRank').value:''}});if(session!==token)return;showToast(result.message);bonusSelected=null;bonusHistorySequence++;clearBonusSelection();await loadBonuses();}
 catch(error){if(session===token)$('bonusSaveNotice').textContent=error.message+' Actualiza el listado antes de volver a guardar.';}
 finally{if(session===token){bonusSaving=false;$('bonusSave').disabled=!bonusSelected;$('bonusFields').disabled=!bonusCanManage||!bonusSelected;}}
});
function closeBonus(){if(bonusSaving)return;clearBonusSelection();}
$('bonusClose').onclick=closeBonus;$('bonusEditor').addEventListener('cancel',event=>{if(bonusSaving)event.preventDefault();else clearBonusSelection();});
$('bonusMoreHistory').onclick=()=>{if(bonusHistoryOffset!=null)loadBonusHistory(bonusHistoryOffset);};
$('bonusRefresh').onclick=()=>loadBonuses();$('bonusPrevious').onclick=()=>{bonusOffset=Math.max(0,bonusOffset-30);loadBonuses();};$('bonusNext').onclick=()=>{if(bonusOffset+30<bonusTotal){bonusOffset+=30;loadBonuses();}};
for(const id of ['bonusDate','bonusMonth','bonusArchived'])$(id).onchange=()=>loadBonuses(true);
$('bonusSearch').oninput=()=>{clearTimeout(bonusSearchTimer);bonusSequence++;bonusClear();bonusSearchTimer=setTimeout(()=>loadBonuses(true),300);};
document.querySelectorAll('[data-bonus-kind]').forEach(button=>button.onclick=()=>{bonusKind=button.dataset.bonusKind;document.querySelectorAll('[data-bonus-kind]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});$('bonusMonthLabel').hidden=bonusKind!=='monthly';$('bonusDateLabel').hidden=bonusKind==='monthly';$('bonusDateLabel').firstChild.textContent=bonusKind==='promotion'?'Fecha del ascenso':bonusKind==='special'?'Fecha del bono especial':'Semana que contiene';loadBonuses(true);});
document.querySelectorAll('.workspace-tab').forEach(button=>button.addEventListener('click',()=>{$('bonusesView').classList.toggle('hidden',button.dataset.view!=='bonuses');if(button.dataset.view==='bonuses')loadBonuses(true);}));
window.addEventListener('panel-session-ended',()=>{bonusSequence++;bonusHistorySequence++;clearTimeout(bonusSearchTimer);bonusSelected=null;bonusSaving=false;bonusCanManage=false;bonusClear();clearBonusSelection();$('bonusForm').reset();$('bonusHistory').replaceChildren();for(const id of ['bonusNotice','bonusSaveNotice','bonusHistoryNotice','bonusIdentity','bonusDetailPeriod','bonusAccess','bonusPeriodLabel'])$(id).textContent='';$('bonusDetailTitle').textContent='Bono del agente';$('bonusesView').classList.add('hidden');$('bonusSave').disabled=false;$('bonusRefresh').disabled=false;});
$('bonusDate').value=bonusToday();$('bonusMonth').value=bonusToday().slice(0,7);

function parseBonusAmount(value){
 let raw=String(value??'').trim().replace(/RP\$|\$/gi,'').replace(/\s/g,'');
 if(!/^\d+(?:[.,]\d+)*$/.test(raw))return NaN;
 if(/^\d{1,3}([.,])\d{3}(?:\1\d{3})*$/.test(raw))return Number(raw.replace(/[.,]/g,''));
 const last=Math.max(raw.lastIndexOf('.'),raw.lastIndexOf(','));
 if(last>=0){const decimals=raw.slice(last+1),whole=raw.slice(0,last);if(decimals.length>2||!decimals.length)return NaN;const sep=raw[last];if(whole.includes(sep)||!/^\d+$|^\d{1,3}(?:[.,]\d{3})+$/.test(whole))return NaN;raw=whole.replace(/[.,]/g,'')+'.'+decimals;}
 return Number(raw);
}
function clearBonusSelection(){
 bonusAgentSequence++;$('bonusFindAgent').disabled=false;bonusSelected=null;bonusHistorySequence++;$('bonusForm').reset();$('bonusFields').disabled=true;$('bonusSave').disabled=true;$('bonusDetailTitle').textContent='Registrar bono';$('bonusIdentity').textContent='';$('bonusDetailPeriod').textContent='';$('bonusSaveNotice').textContent='';$('bonusHistory').replaceChildren();$('bonusHistoryNotice').textContent='Selecciona un agente para consultar su historial.';$('bonusMoreHistory').hidden=true;$('bonusAgentNotice').textContent='Busca un agente o pulsa Seleccionar en el listado inferior.';$('bonusAgentResults').replaceChildren();
}
$('bonusAgentSearchForm').addEventListener('submit',async event=>{
 event.preventDefault();if(!token||bonusSaving)return;const sequence=++bonusAgentSequence,session=token,kind=bonusKind,period=bonusPeriod();if(!period)return;
 let search=$('bonusAgentSearch').value.trim().replace(/^#/,'');if(/^\d{1,4}$/.test(search))search=search.padStart(4,'0');
 $('bonusFindAgent').disabled=true;$('bonusAgentNotice').textContent='Buscando en la plantilla…';$('bonusAgentResults').replaceChildren();
 try{const result=await request('bonus-records',{method:'GET',query:{kind,period,search,offset:0,archived:'false'}});if(sequence!==bonusAgentSequence||session!==token||kind!==bonusKind||period!==bonusPeriod())return;
 bonusCanManage=Boolean(result.can_manage);bonusRankOptions=result.ranks||[];const records=result.records||[],exact=records.find(r=>r.plate===search);if(exact||records.length===1){openBonus(exact||records[0]);return;}
 $('bonusAgentNotice').textContent=records.length?'Selecciona al agente. Si no aparece, escribe su nombre completo o placa.':'No se encontró un agente activo con esos datos.';
 for(const record of records){const button=bonusElement('button','#'+record.plate+' · '+record.full_name+' · '+record.rank_name,'btn');button.type='button';button.onclick=()=>{openBonus(record);$('bonusAgentResults').replaceChildren();};$('bonusAgentResults').append(button);}
 }catch(error){if(sequence===bonusAgentSequence&&session===token)$('bonusAgentNotice').textContent=error.message;}
 finally{if(sequence===bonusAgentSequence&&session===token)$('bonusFindAgent').disabled=false;}
});
window.addEventListener('panel-session-ended',()=>{bonusAgentSequence++;$('bonusAgentSearchForm').reset();$('bonusFindAgent').disabled=false;bonusRankOptions=[];});
