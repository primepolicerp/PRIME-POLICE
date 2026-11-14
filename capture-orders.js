let captureOrders=[],capturePersonnel=[],captureCanManage=false,captureFilter='active',captureSearchTimer;
const captureStatusLabel={active:'Activa',captured:'Cumplida',cancelled:'Anulada'};
function captureEl(id){return document.getElementById(id);}
function captureText(tag,value,cls){const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=value??'—';return el;}
function renderCaptureOrders(){
 const body=captureEl('captureOrdersRows');body.replaceChildren();
 const q=captureEl('captureOrdersSearch').value.trim().toLocaleLowerCase('es');
 const rows=captureOrders.filter(o=>(captureFilter==='all'||o.status===captureFilter)&&[o.full_name,o.plate,o.last_rank,o.issued_by_name].join(' ').toLocaleLowerCase('es').includes(q));
 captureEl('captureOrdersCount').textContent=rows.length+' '+(rows.length===1?'orden visible':'órdenes visibles');
 if(!rows.length){const tr=document.createElement('tr'),td=captureText('td',q?'No hay órdenes que coincidan.':'No hay órdenes en esta categoría.','muted');td.colSpan=7;tr.append(td);body.append(tr);return;}
 for(const order of rows){
  const tr=document.createElement('tr');
  for(const [label,value] of [['Placa',order.plate],['Agente',order.full_name],['Último rango',order.last_rank],['Fecha abandono',order.desertion_date],['Estado',captureStatusLabel[order.status]],['Emitida por',order.issued_by_name]]){const td=captureText('td',value||'—');td.dataset.label=label;tr.append(td);}
  const actions=captureText('td','','');actions.dataset.label='Acciones';const group=captureText('div','','personnel-actions');
  if(captureCanManage&&order.status==='active'){
   const done=captureText('button','Registrar captura','btn accept');done.type='button';done.addEventListener('click',async()=>{const notes=prompt('Observaciones de la captura (opcional):','');if(notes===null)return;done.disabled=true;try{const r=await request('capture-orders',{method:'POST',body:{operation:'capture',id:order.id,notes}});showToast(r.message);await loadCaptureOrders();}catch(e){showToast(e.message);done.disabled=false;}});group.append(done);
   const cancel=captureText('button','Anular orden','btn reject');cancel.type='button';cancel.addEventListener('click',async()=>{if(!confirm('¿Anular la orden de '+order.full_name+'? Quedará guardada en el historial.'))return;cancel.disabled=true;try{const r=await request('capture-orders',{method:'POST',body:{operation:'cancel',id:order.id}});showToast(r.message);await loadCaptureOrders();}catch(e){showToast(e.message);cancel.disabled=false;}});group.append(cancel);
  }else if(order.status==='captured'){group.append(captureText('span','Registrada por '+(order.captured_by_name||'—'),'muted'));}
  else if(order.status==='cancelled'){group.append(captureText('span','Anulada por '+(order.cancelled_by_name||'—'),'muted'));}
  actions.append(group);tr.append(actions);body.append(tr);
 }
}
function renderCaptureStats(){
 const counts={active:0,captured:0,cancelled:0};captureOrders.forEach(o=>{if(counts[o.status]!==undefined)counts[o.status]++;});
 captureEl('captureActiveCount').textContent=counts.active;captureEl('captureDoneCount').textContent=counts.captured;captureEl('captureCancelledCount').textContent=counts.cancelled;
}
async function loadCaptureOrders(){
 const feedback=captureEl('captureOrdersFeedback');feedback.textContent='Consultando órdenes…';
 try{
  const result=await request('capture-orders',{method:'GET'});captureOrders=result.orders||[];capturePersonnel=result.personnel||[];captureCanManage=Boolean(result.can_manage);
  const select=captureEl('captureAgent');select.replaceChildren(new Option('Selecciona un agente de la plantilla',''));
  capturePersonnel.forEach(p=>select.add(new Option((p.full_name||'Sin nombre')+' · Placa '+(p.plate||'—')+' · '+(p.rank_name||'Sin rango'),p.discord_user_id)));
  captureEl('captureCreatePanel').classList.toggle('hidden',!captureCanManage);
  captureEl('captureReadOnlyNotice').classList.toggle('hidden',captureCanManage);
  renderCaptureStats();renderCaptureOrders();feedback.textContent='';
 }catch(error){feedback.textContent=error.message||'No se pudieron cargar las órdenes.';}
}
captureEl('captureOrdersForm').addEventListener('submit',async event=>{
 event.preventDefault();const button=captureEl('captureCreateButton');button.disabled=true;button.textContent='Registrando…';
 try{const result=await request('capture-orders',{method:'POST',body:{operation:'create',discord_user_id:captureEl('captureAgent').value,desertion_date:captureEl('captureDate').value,notes:captureEl('captureNotes').value}});showToast(result.message||'Orden registrada.');captureEl('captureOrdersForm').reset();await loadCaptureOrders();}
 catch(error){showToast(error.message||'No se pudo registrar la orden.');}
 finally{button.disabled=false;button.textContent='Emitir orden administrativa';}
});
captureEl('captureOrdersSearch').addEventListener('input',()=>{clearTimeout(captureSearchTimer);captureSearchTimer=setTimeout(renderCaptureOrders,180);});
captureEl('captureOrdersRefresh').addEventListener('click',loadCaptureOrders);
document.querySelectorAll('[data-capture-filter]').forEach(button=>button.addEventListener('click',()=>{captureFilter=button.dataset.captureFilter;document.querySelectorAll('[data-capture-filter]').forEach(b=>b.classList.toggle('active',b===button));renderCaptureOrders();}));
document.querySelectorAll('.workspace-tab').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.view==='capture-orders')loadCaptureOrders();}));
window.addEventListener('panel-session-ended',()=>{captureOrders=[];capturePersonnel=[];captureCanManage=false;captureEl('captureOrdersRows').replaceChildren();captureEl('captureOrdersView').classList.add('hidden');});
