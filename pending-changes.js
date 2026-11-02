let pendingChangeStatus='pending',pendingChangeOffset=0,pendingChangeSequence=0;
const changeLabels={'personnel-departure':'Dar de baja al agente','personnel-reentry':'Reingresar al agente','personnel-note-add':'Añadir observación a ficha','personnel-note-edit':'Editar observación de ficha','personnel-note-archive':'Archivar observación de ficha','transfer-admit':'Ingresar traslado a Personal','preselection-admit':'Ingresar preseleccionado a Personal','personnel-register':'Editar o registrar personal','personnel-delete':'Eliminar ficha de personal','rank-change':'Ascenso o descenso','rank-config-save':'Modificar escala de rangos','rank-config-import-all':'Sincronizar escala de rangos','decision':'Resolver postulación','transfer-decision':'Resolver traslado','rank-request-review':'Resolver nuevo ingreso','rank-request-edit':'Corregir datos de nuevo ingreso','sanction':'Aplicar sanción','sanction-delete':'Eliminar sanción','nickname-sync':'Sincronizar nombre y placa','shift-close':'Cerrar bitácora','shift-delete':'Eliminar bitácora','absence-review':'Revisar ausencia','absence-register':'Registrar ausencia'};
const changeFieldLabels={restore_previous_rank:"Recuperar el rango anterior documentado",departure_role:"Rol de baja en Discord",departure_type:"Motivo de baja",effective_date:"Fecha efectiva",content:"Observación",interview_confirmed:"Entrevista IC confirmada",start_date:"Primer día de ausencia",end_date:"Último día de ausencia",started_at:"Fecha y hora de entrada",ended_at:"Fecha y hora de salida",character_name:"Nombre IC",steam_username:"Usuario de Steam",approved_by_name:"Entrevista aprobada por",record_action:'Operación sobre la ficha',discord_user_id:'Usuario de Discord',full_name:'Nombre completo',name_ooc:'Nombre OOC',plate:'Placa',unit:'Rama',rank_role_id:'Rango',role_ids:'Escala de rangos',minimum_days_by_role:'Días mínimos por rango',action_type:'Tipo de movimiento',effective_date:'Fecha efectiva',reason:'Motivo',target_name:'Agente',evidence_url:'Evidencia',action:'Decisión',decision:'Decisión'};
const changeValueLabels={voluntary:'Baja Voluntaria',expelled:'Expulsado',banned:'Vetado',none:'Sin rol adicional',pkt:'PKT',ck:'Muerte (CK)',despido:'Despido',corrupcion:'Corrupción',renuncia:'Renuncia',jubilacion:'Jubilación',transferencia:'Transferencia',inactividad:'Inactividad',otro:'Otro',pending:'Pendiente',accepted:'Aceptada',rejected:'Rechazada',approved:'Aprobada',processing:'En proceso',failed:'No aplicado',active:'Activo',inactive:'Inactivo',converted:'Ingresado en Personal',POLICIA:"Sin rama · Policía",create:'Registrar nuevo agente',approve:'Aprobar',cancel:'Cancelar',update:'Editar agente',accept:'Aceptar',reject:'Rechazar',promotion:'Ascenso',demotion:'Descenso',assignment:'Asignación inicial',warning:'Warning',strike:'Strike'};
function changeValue(value,item){
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value))return niceDate(value);
 const ranks=item.before_state?.ranks||item.before_state?.available_roles||[];
 const roleName=id=>ranks.find(r=>String(r.role_id||r.id)===String(id))?.role_name||ranks.find(r=>String(r.id)===String(id))?.name||String(id);
 if(Array.isArray(value))return value.map(roleName).join(' → ');
 if(value&&typeof value==='object')return Object.entries(value).map(([key,days])=>roleName(key)+': '+days+' días').join(' · ');
 if(typeof value==='boolean')return value?'Sí':'No';
 return changeValueLabels[value]||roleName(value??'—');
}
function changePlan(item){
 if(item.action==='personnel-departure')return{title:'Dar de baja al agente',effect:'Se retirarán todos sus roles manuales, incluidos los de administración, se cerrarán sus bitácoras abiertas y se conservará la ficha. Rol de baja: '+(departureRoleLabels[item.payload?.departure_role??suggestedDepartureRole(item.payload?.departure_type)]||'Sin rol adicional')+'.',approve:'Confirmar baja',tone:'danger'};
 if(item.action==='personnel-reentry')return{title:'Reingresar al agente',effect:'Se activará la misma ficha y se asignarán el rango y la división propuestos en Discord.',approve:'Confirmar reingreso',tone:'positive'};
 const payload=item.payload||{},decision=payload.action||payload.decision;
 const kinds={decision:['postulación','la postulación','Preselección'],'transfer-decision':['traslado','la solicitud de traslado','Traslado'],'rank-request-review':['nuevo ingreso','el nuevo ingreso','Policía']};
 if(kinds[item.action]&&['accept','reject'].includes(decision)){
  const [label,subject,role]=kinds[item.action],reject=decision==='reject',correction=!reject&&payload.correct_rejection===true;
  return {title:(reject?'Rechazar ':correction?'Corregir rechazo y aceptar ':'Aceptar ')+label,effect:reject?'Se rechazará '+subject+'. El bot intentará comunicar el resultado por privado.':'Se aceptará '+subject+' y se asignará el rol '+role+'.',approve:reject?'Confirmar rechazo':'Confirmar aceptación',tone:reject?'danger':'positive'};
 }
 const movement={promotion:'Ascender al agente',demotion:'Descender al agente',assignment:'Asignar rango inicial'};
 const title=item.action==='rank-change'?(movement[payload.action_type]||'Cambiar rango del agente'):changeLabels[item.action]||'Cambio administrativo';
 const effects={'shift-delete':'Se eliminará esta bitácora del control horario.','shift-close':'Se cerrará la bitácora con la fecha y hora propuestas.','personnel-delete':'Se eliminará la ficha de Personal.','preselection-admit':'Se registrará a la persona en Personal de Policía con los datos propuestos.','transfer-admit':'Se registrará a la persona en Personal de Policía con los datos propuestos.'};
 return {title,effect:effects[item.action]||'Se aplicará el cambio que figura en esta propuesta.',approve:'Aplicar cambio',tone:['shift-delete','personnel-delete','sanction'].includes(item.action)?'danger':'normal'};
}
function changeContext(item,record){
 const context=document.createElement('details');context.className='pending-context';const summary=document.createElement('summary');summary.textContent='Ver solicitud y detalles';context.append(summary);
 const fields=document.createElement('div');fields.className='details';
 const payload=item.payload||{};
 for(const [key,value]of Object.entries(payload)){
  if(!changeFieldLabels[key]||['reason','discord_user_id'].includes(key)||(['action','decision'].includes(key)&&['decision','transfer-decision','rank-request-review'].includes(item.action)))continue;
  const previous=key==='content'?(item.before_state?.note?.content??record[key]):record[key],oldValue=previous!==undefined&&JSON.stringify(previous)!==JSON.stringify(value)?changeValue(previous,item)+' → ':'';
  fields.append(detail(changeFieldLabels[key],oldValue+changeValue(value,item)));
 }
 if(payload.correct_rejection===true)fields.append(detail('Corrección de un rechazo anterior','Sí; se propone aceptar esta solicitud'));
 const labelMap={character_name:'Nombre IC',plate:'Placa',reason:'Motivo original de la solicitud',start_date:'Inicio de ausencia',end_date:'Fin de ausencia',started_at:'Entrada',ended_at:'Salida',status:'Estado actual'};
 for(const [key,label]of Object.entries(labelMap))if(record[key]!==undefined&&record[key]!==null&&record[key]!=='')fields.append(detail(label,changeValue(record[key],item)));
 const answers=record.answers||{},answerLabels={motivation:'Motivación',detention_rights:'Responsabilidad y órdenes',scene_resolution:'Mala praxis o corrupción',roleplay_response:'Situaciones policiales',age_ic:'Edad IC',age_ooc:'Edad OOC'};
 for(const [key,label]of Object.entries(answerLabels))if(answers[key]!==undefined&&answers[key]!=='')fields.append(detail(label,String(answers[key])));
 if(!fields.childElementCount){const empty=document.createElement('p');empty.className='muted';empty.textContent='No hay más datos adjuntos a esta propuesta.';context.append(empty);}else context.append(fields);
 return context;
}
async function loadPendingChanges(){
 if(restrictedToApplications)return;
 const sequence=++pendingChangeSequence,box=$('pendingChanges');box.textContent='Cargando pendientes…';
 document.querySelectorAll('[data-change-status]').forEach(b=>b.classList.toggle('active',b.dataset.changeStatus===pendingChangeStatus));
 try{
  const [result,legacyResult]=await Promise.all([request('change-requests',{method:'GET',query:{status:pendingChangeStatus,offset:pendingChangeOffset}}),pendingChangeOffset===0?request('rank-authorizations',{method:'GET'}).catch(()=>({authorizations:[]})):Promise.resolve({authorizations:[]})]);
  if(sequence!==pendingChangeSequence)return;box.replaceChildren();
  const legacy=(legacyResult.authorizations||[]).filter(r=>pendingChangeStatus==='pending'?['pending','processing'].includes(r.status):!['pending','processing'].includes(r.status)).map(r=>({...r,legacy:true,action:'rank-change',requested_by_name:r.requested_by,payload:{full_name:r.full_name,rank_role_id:r.new_rank_name},before_state:{}}));
  const rows=[...(result.requests||[]),...legacy];
  if(!rows.length){const empty=document.createElement('div');empty.className='dashboard-inbox-empty';const icon=document.createElement('span');icon.className='dashboard-empty-check';icon.setAttribute('aria-hidden','true');icon.textContent=pendingChangeStatus==='pending'?'✓':'↗';const title=document.createElement('strong');title.textContent=pendingChangeStatus==='pending'?'Todo al día':'Sin decisiones registradas';const copy=document.createElement('p');copy.textContent=pendingChangeStatus==='pending'?'No hay propuestas pendientes de Directiva. Los nuevos cambios aparecerán aquí.':'Aquí podrás consultar las decisiones y el resultado de cada cambio.';empty.append(icon,title,copy);box.append(empty);}
  for(const item of rows){
   const plan=changePlan(item),card=document.createElement('article');card.className='candidate pending-proposal pending-'+plan.tone;
   const title=document.createElement('h3');title.textContent=plan.title;
   const state=item.before_state||{},record=state.profile||state.record||{},name=item.payload?.full_name||record.full_name||record.character_name||record.target_name||item.payload?.target_name;
   if(name)title.textContent+=' · '+name;
   const meta=document.createElement('p');meta.className='muted';meta.textContent='Propuesto por '+(item.requested_by_name||item.requested_by)+' · '+niceDate(item.requested_at);
   const status=document.createElement('span');status.className='pending-proposal-status';status.setAttribute('role','status');status.textContent=({pending:'Pendiente de revisión',processing:'Aplicando; no repetir',approved:'Propuesta aplicada',rejected:'Propuesta descartada',failed:'No aplicado; revisar motivo'})[item.status]||item.status;
   const header=document.createElement('div');header.className='pending-proposal-head';header.append(title,status);card.append(header,meta);
   const effect=document.createElement('p');effect.className='pending-effect';effect.textContent=(item.status==='pending'?'Al confirmar: ':'Cambio propuesto: ')+plan.effect;card.append(effect);
   if(item.payload?.reason){const reason=detail('Motivo propuesto por '+(item.requested_by_name||'el gestor'),String(item.payload.reason));reason.classList.add('pending-reason');card.append(reason);}
   card.append(changeContext(item,record));
   if(item.reviewed_by){const review=document.createElement('p');review.className='muted';review.textContent='Revisado por '+(item.reviewed_by_name||item.reviewed_by)+' · '+niceDate(item.reviewed_at)+(item.review_reason?' · '+item.review_reason:'');card.append(review);}
   if(item.result_message){const outcome=document.createElement('p');outcome.textContent=item.result_message;card.append(outcome);}
   if(item.status==='pending'&&result.can_approve){
    const actions=document.createElement('div');actions.className='candidate-actions';
    for(const [decision,label,cls]of [['approve',plan.approve,'btn pending-apply-'+plan.tone],['reject','Descartar propuesta','btn ghost']]){
     const button=document.createElement('button');button.className=cls;button.type='button';button.textContent=label;
     button.addEventListener('click',async()=>{const reason=prompt(decision==='approve'?'Nota de Directiva sobre esta propuesta (opcional)':'¿Por qué descartas esta propuesta? No se aplicará el cambio al registro.');if(reason===null)return;const effect=decision==='approve'?plan.effect:'Se descartará la propuesta. No se aplicará el cambio al registro.';if(!confirm(label+' · '+title.textContent+'\n\n'+effect))return;actions.querySelectorAll('button').forEach(b=>b.disabled=true);try{const r=await request(item.legacy?'rank-authorization-review':'change-request-review',{method:'POST',body:{id:item.id,decision,reason}});showToast((r.message||'Propuesta revisada.')+(r.warning||''));await loadPendingChanges();if(typeof loadDashboard==='function')loadDashboard();}catch(e){status.textContent=e.message;actions.querySelectorAll('button').forEach(b=>b.disabled=false);}});
     actions.append(button);
    }const help=document.createElement('small');help.className='pending-action-help';help.textContent='Confirmar aplica lo propuesto. Descartar conserva el registro sin cambios.';card.append(actions,help);
   }box.append(card);
  }
  const pagination=document.createElement('div');pagination.className='toolbar';for(const [label,next,disabled]of [['Anterior',Math.max(0,pendingChangeOffset-25),pendingChangeOffset===0],['Siguiente',result.next_offset,result.next_offset==null]]){const b=document.createElement('button');b.className='btn';b.type='button';b.textContent=label;b.disabled=disabled;b.addEventListener('click',()=>{pendingChangeOffset=next;loadPendingChanges();});pagination.append(b);}if(pendingChangeOffset>0||result.next_offset!=null)box.append(pagination);
 }catch(e){if(sequence===pendingChangeSequence)box.textContent=e.message;}
}
$('refreshPendingChanges').addEventListener('click',loadPendingChanges);
document.querySelectorAll('[data-change-status]').forEach(b=>b.addEventListener('click',()=>{pendingChangeStatus=b.dataset.changeStatus;pendingChangeOffset=0;loadPendingChanges();}));
window.addEventListener('pending-change-created',()=>{pendingChangeStatus='pending';pendingChangeOffset=0;loadPendingChanges();});
// The dashboard loads the inbox after account permissions have been checked.
