let h50Records=[],h50State='open',h50Offset=0,h50Next=null,h50User='',h50Sequence=0,h50Timer=null,h50SearchTimer=null;
function h50Period(){
 const from=shiftDayStart($('h50From').value),to=shiftDayStart(shiftMoveDay($('h50To').value,1));
 if(!Number.isFinite(from.getTime())||!Number.isFinite(to.getTime())||from>=to||to-from>366*86400000)throw Error('Selecciona un período válido de hasta un año.');return{from:from.toISOString(),to:to.toISOString()};
}
async function loadH50(reset=false){
 if(!token||restrictedToApplications)return;
 if(reset)h50Offset=0;const sequence=++h50Sequence,session=token;
 $('h50Notice').textContent='Consultando horas de H-50…';$('h50Content').setAttribute('aria-busy','true');$('refreshH50').disabled=true;
 try{
  const data=await request('h50-records',{method:'GET',query:{...h50Period(),search:$('h50Search').value.trim(),discord_user_id:h50User,state:h50State,offset:h50Offset}});
  if(sequence!==h50Sequence||session!==token)return;
  if(!Array.isArray(data.records)||!Array.isArray(data.officers)||!data.summary)throw Error('No se recibió el registro H-50 esperado.');
  h50Records=data.records;h50Next=data.next_offset;renderH50(data);
  $('h50Notice').textContent='Hora del servidor · Europa/París. Horas H-50 independientes del servicio policial.';
  if(!h50Timer)h50Timer=setInterval(()=>{if(token&&!document.hidden&&!$('h50View').classList.contains('hidden')&&!$('refreshH50').disabled)loadH50();},60000);
 }catch(error){if(sequence===h50Sequence&&session===token){h50Records=[];$('h50Content').replaceChildren();$('h50Summary').replaceChildren();$('h50Totals').replaceChildren();$('h50Pager').replaceChildren();$('h50Notice').textContent='No se pudo cargar H-50: '+error.message;}}
 finally{if(sequence===h50Sequence&&session===token){$('refreshH50').disabled=false;$('h50Content').removeAttribute('aria-busy');}}
}
function renderH50(data){
 const summary=$('h50Summary');summary.replaceChildren();
 for(const [label,value]of [['En central',data.summary.open],['Horas del período',shiftHours(data.summary.seconds)],['Turnos H-50',data.summary.shifts],['Policías',data.summary.officers]]){const card=document.createElement('div'),number=document.createElement('strong'),caption=document.createElement('span');card.className='shift-metric';number.textContent=String(value);caption.textContent=label;card.append(number,caption);summary.append(card);}
 const content=$('h50Content');content.innerHTML='<div class="shift-register-heading"><div><span class="shift-kicker">CENTRAL · H-50</span><h3>'+(h50State==='open'?'Personal en central':'Historial H-50')+'</h3></div><span>'+Number(data.total)+' registros</span></div><div class="table-wrap"><table class="shift-record-table mobile-record-table"><thead><tr><th>Policía</th><th>Entrada</th><th>Salida</th><th>Tiempo total</th><th>Cierre</th><th>Gestión</th></tr></thead><tbody></tbody></table></div>';
 const rows=content.querySelector('tbody');
 for(const record of h50Records){const row=document.createElement('tr');for(const [label,value]of [['Policía',(record.full_name||'Policía')+' · #'+(record.plate||'—')],['Entrada',shiftTime(record.started_at)],['Salida',record.ended_at?shiftTime(record.ended_at):'En central'],['Tiempo total',duration(record.started_at,record.ended_at)],['Cierre',record.close_reason||(record.ended_at?'Salida registrada':'Pendiente de salida')]]){const cell=document.createElement('td');cell.dataset.label=label;cell.textContent=String(value);row.append(cell);}
  const actions=document.createElement('td');actions.dataset.label='Gestión';if(!record.ended_at&&(canAuthorizePromotions||canManageShiftsDirect)){const button=document.createElement('button');button.className='btn shift-close-btn';button.type='button';button.textContent='Ajustar y cerrar';button.onclick=()=>openShiftAdmin({...record,h50:true},'close');actions.append(button);}else actions.textContent='—';row.append(actions);rows.append(row);
 }
 if(!h50Records.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=6;cell.className='shift-empty';cell.textContent=h50State==='open'?'No hay turnos H-50 abiertos con estos filtros.':'No hay turnos H-50 cerrados con estos filtros.';row.append(cell);rows.append(row);}
 const totals=$('h50Totals');totals.replaceChildren();for(const person of data.officers){const row=document.createElement('article'),copy=document.createElement('div'),name=document.createElement('strong'),hours=document.createElement('small'),button=document.createElement('button');row.className='evidence-officer-total';name.textContent=person.full_name+' · #'+(person.plate||'—');hours.textContent=shiftHours(person.seconds)+' · '+person.shifts+' turnos';copy.append(name,hours);button.type='button';button.className='btn ghost';button.textContent='Ver historial';button.setAttribute('aria-label','Historial H-50 de '+person.full_name);button.onclick=()=>{h50User=person.discord_user_id;h50State='history';$('h50Search').value='';$('h50Person').textContent='Historial de '+person.full_name+' · #'+(person.plate||'—');setH50Tab();loadH50(true);};row.append(copy,button);totals.append(row);}
 if(!data.officers.length)totals.textContent='Sin horas H-50 registradas en este período.';
 const pager=$('h50Pager');pager.replaceChildren();const label=document.createElement('span');label.textContent='Página '+(Math.floor(h50Offset/50)+1);pager.append(label);for(const [text,next,disabled]of [['Anterior',Math.max(0,h50Offset-50),h50Offset===0],['Siguiente',h50Next,h50Next==null]]){const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=text;button.disabled=disabled;button.onclick=()=>{h50Offset=next;loadH50();};pager.append(button);}
}
function setH50Tab(){document.querySelectorAll('[data-h50-state]').forEach(button=>{const active=button.dataset.h50State===h50State;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});}
$('h50From').value=shiftMoveDay(shiftDayKey(Date.now()),-7);$('h50To').value=shiftDayKey(Date.now());
document.querySelectorAll('[data-h50-state]').forEach(button=>button.onclick=()=>{h50State=button.dataset.h50State;setH50Tab();loadH50(true);});
$('refreshH50').onclick=()=>{clearTimeout(h50SearchTimer);loadH50();};
$('h50Search').addEventListener('input',()=>{clearTimeout(h50SearchTimer);h50Sequence++;h50SearchTimer=setTimeout(()=>loadH50(true),300);});
['h50From','h50To'].forEach(id=>$(id).addEventListener('change',()=>loadH50(true)));
$('resetH50').onclick=()=>{clearTimeout(h50SearchTimer);h50User='';$('h50Search').value='';$('h50Person').textContent='';loadH50(true);};
window.addEventListener('panel-session-ended',()=>{h50Sequence++;clearTimeout(h50SearchTimer);clearInterval(h50Timer);h50Timer=null;h50Records=[];h50User='';h50Offset=0;h50Next=null;h50State='open';setH50Tab();for(const id of ['h50Content','h50Summary','h50Totals','h50Pager'])$(id).replaceChildren();$('h50Person').textContent='';$('h50Search').value='';$('h50Notice').textContent='Inicia sesión para consultar H-50.';$('refreshH50').disabled=false;});
