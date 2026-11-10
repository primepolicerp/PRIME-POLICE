const cicUi={kind:'band',tab:'summary',selected:null,detail:null,records:[],offset:0,next:null,detailOffset:0,detailNext:null,sequence:0,detailSequence:0,busy:false,form:null,searchTimer:null};
const cicKinds={Bandas:['band','Bandas y organizaciones','Un expediente, toda la investigación.'],Personas:['person','Personas investigadas','Identidades IC y seguimiento de personas.'],Puntos:['point','Puntos de interés','Ubicaciones y observaciones vinculadas a investigaciones.'],Solicitudes:['request','Solicitudes de investigación','Entrada, asignación y seguimiento de solicitudes.'],Grilletes:['bracelet','Control de grilletes','Colocación, seguimiento y retirada documentados.'],Guía:['guide','Guía de investigación','Organización del archivo de CIC.']};
const cicStates={open:'En investigación',review:'Revisión de Directiva',closed:'Cerrado'};
const cicTabs={summary:'Resumen',person:'Personas',point:'Puntos',vehicle:'Vehículos',evidence:'Evidencias',note:'Anotaciones',activity:'Actividad'};
const cicActions={create:'Abrió el expediente',edit:'Actualizó el expediente',entry:'Añadió un registro',review:'Remitió a Directiva',close:'Cerró el expediente',reopen:'Reabrió el expediente'};
const cicEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cicCode=c=>'CIC-'+String(c.number).padStart(3,'0');
const cicSafeLink=link=>/^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/channels\/1539970134469378068\/[0-9]{17,20}\/[0-9]{17,20}$/.test(link||'');
const cicPair=(a,b)=>'<div class="pc-row"><div>'+cicEscape(a)+'<p class="pc-muted pc-small pc-prewrap">'+cicEscape(b)+'</p></div></div>';
function cicNotice(message,error=false){$('pc-feedback').textContent=message;$('pc-feedback').classList.toggle('pc-error',error);}
function cicValidRequest(sequence,session){return token===session&&canAccessCic&&sequence===cicUi.sequence&&!$('cicView').classList.contains('hidden');}
async function loadCic(reset=false){
 if(!token||!canAccessCic||$('cicView').classList.contains('hidden'))return;
 if(cicUi.kind==='guide'){renderCicGuide();return;}
 if(reset)cicUi.offset=0;
 const seq=++cicUi.sequence,session=token;cicNotice('Cargando archivo CIC…');
 try{
  const data=await request('cic-records',{method:'GET',query:{kind:cicUi.kind,status:$('pc-state').value,q:$('pc-search').value.trim(),offset:cicUi.offset}});
  if(!cicValidRequest(seq,session))return;
  cicUi.records=data.records;cicUi.next=data.next_offset;
  const previous=cicUi.selected;cicUi.selected=data.records.find(c=>c.id===previous?.id)||data.records[0]||null;
  $('pc-listcount').textContent=data.total+' EXPEDIENTES';renderCicList();cicNotice('');
  if(cicUi.selected){if(cicUi.selected.id!==previous?.id)cicUi.tab='summary';await loadCicDetail(true);}else{$('pc-detail').innerHTML='<p class="pc-empty">No hay expedientes con estos filtros. Puedes crear el primero o cambiar la búsqueda.</p>';}
 }catch(error){if(!cicValidRequest(seq,session))return;cicNotice(error.message,true);}
}
function renderCicList(){
 $('pc-list').innerHTML=cicUi.records.map(c=>'<button class="pc-case" type="button" data-cic-case="'+c.id+'" aria-pressed="'+(c.id===cicUi.selected?.id)+'"><span class="pc-caseid">'+cicCode(c)+'</span><strong>'+cicEscape(c.title)+'</strong><span class="pc-casefoot">'+cicEscape(cicStates[c.status])+'</span></button>').join('')+'<div class="pc-pagination"><button class="pc-button" type="button" data-cic-page="prev" '+(cicUi.offset===0?'disabled':'')+'>Anterior</button><button class="pc-button" type="button" data-cic-page="next" '+(cicUi.next==null?'disabled':'')+'>Siguiente</button></div>';
}
async function loadCicDetail(reset=false){
 if(!cicUi.selected||!token||!canAccessCic)return;
 if(reset)cicUi.detailOffset=0;
 const seq=++cicUi.detailSequence,session=token,id=cicUi.selected.id,tab=cicUi.tab;
 $('pc-detail').setAttribute('aria-busy','true');
 try{
  const data=await request('cic-records',{method:'GET',query:{id,entry_kind:tab==='summary'?'note':tab,offset:cicUi.detailOffset}});
  if(seq!==cicUi.detailSequence||session!==token||id!==cicUi.selected?.id||tab!==cicUi.tab||$('cicView').classList.contains('hidden'))return;
  cicUi.detail=data;cicUi.selected=data.case;cicUi.detailNext=data.next_offset;renderCicDetail();
 }catch(error){if(seq===cicUi.detailSequence&&session===token)cicNotice(error.message,true);}
 finally{if(seq===cicUi.detailSequence)$('pc-detail').removeAttribute('aria-busy');}
}
function renderCicDetail(){
 const d=cicUi.detail,c=d.case,tab=cicUi.tab,counts=d.counts;let content='';
 if(tab==='summary')content='<h4>Objeto de la investigación</h4><p class="pc-paragraph pc-prewrap">'+cicEscape(c.summary||'Pendiente de completar.')+'</p><h4>Siguiente actuación</h4><p class="pc-paragraph pc-prewrap">'+cicEscape(c.next_action||'Pendiente de indicar.')+'</p>'+cicPair('Zona o ubicación',c.location||'Sin registrar')+cicPair('Información vinculada',(counts.person||0)+' personas · '+(counts.point||0)+' puntos · '+(counts.vehicle||0)+' vehículos · '+(counts.evidence||0)+' evidencias')+cicPair('Seguimiento', 'Alta: '+niceDate(c.created_at)+' · Última actualización: '+niceDate(c.updated_at));
 else{
  content='<h4>'+cicTabs[tab]+' · '+d.total+'</h4>';
  if(!d.records.length)content+='<p class="pc-muted">Todavía no hay registros en este apartado.</p>';
  for(const r of d.records){
   if(tab==='activity')content+=cicPair(cicActions[r.action]||r.action,r.actor_name+' · '+niceDate(r.created_at));
   else content+='<div class="pc-row"><div>'+cicEscape(r.title)+'<p class="pc-muted pc-prewrap">'+cicEscape(r.details)+'</p><p class="pc-muted pc-small">'+cicEscape(({pending:'Pendiente de contrastar',observed:'Observado',confirmed:'Contrastado'})[r.certainty])+' · '+cicEscape(r.author_name)+' · '+cicEscape(niceDate(r.created_at))+'</p>'+(cicSafeLink(r.source_url)?'<a href="'+cicEscape(r.source_url)+'" target="_blank" rel="noopener noreferrer">Abrir mensaje de Discord ↗</a>':'')+'</div></div>';
  }
  if(tab==='evidence')content+='<p class="pc-small pc-muted" style="margin-top:14px">Las fotografías permanecen en Discord. Aquí se guardan los datos y el enlace al mensaje.</p>';
  if(d.total>50)content+='<div class="pc-pagination"><button class="pc-button" type="button" data-cic-detail-page="prev" '+(cicUi.detailOffset===0?'disabled':'')+'>Anterior</button><span class="pc-small">Página '+(Math.floor(cicUi.detailOffset/50)+1)+'</span><button class="pc-button" type="button" data-cic-detail-page="next" '+(cicUi.detailNext==null?'disabled':'')+'>Siguiente</button></div>';
 }
 $('pc-detail').innerHTML='<div class="pc-dossierhead"><span class="pc-kicker">'+cicCode(c)+' · '+cicEscape(Object.values(cicKinds).find(k=>k[0]===c.kind)?.[1]||'Expediente')+'</span><h3>'+cicEscape(c.title)+'</h3><div class="pc-meta"><span class="pc-status">'+cicStates[c.status]+'</span><span>Responsable: '+cicEscape(c.assignee_name)+'</span></div></div><div class="pc-tabs" role="tablist" aria-label="Contenido del expediente">'+Object.entries(cicTabs).map(([key,label])=>'<button role="tab" type="button" id="cic-tab-'+key+'" aria-controls="cic-content" aria-selected="'+(tab===key)+'" data-cic-tab="'+key+'">'+label+'</button>').join('')+'</div><div id="cic-content" class="pc-tabcontent" role="tabpanel" aria-labelledby="cic-tab-'+tab+'">'+content+'</div><div class="pc-footer"><span class="pc-muted pc-small">Resolución y cierre: Directiva</span><div class="pc-formactions">'+(c.status!=='closed'?'<button class="pc-button" type="button" data-cic-edit>Editar</button>'+(tab!=='summary'&&tab!=='activity'?'<button class="pc-button pc-primary" type="button" data-cic-entry>+ Añadir</button>':'')+(c.status==='open'?'<button class="pc-button" type="button" data-cic-transition="review">Enviar a revisión</button>':'')+(canAuthorizePromotions?'<button class="pc-button" type="button" data-cic-transition="close">Cerrar expediente</button>':''):(canAuthorizePromotions?'<button class="pc-button" type="button" data-cic-transition="reopen">Reabrir expediente</button>':''))+'</div></div>';
}
function cicField(name,label,value='',max=120,required=false,area=false){return '<label>'+label+(area?'<textarea rows="3"':'<input type="text"')+' name="'+name+'" maxlength="'+max+'" '+(required?'required':'')+'>'+(area?cicEscape(value)+'</textarea>':'')+'</label>';}
function cicOpenForm(operation){
 const c=cicUi.detail?.case;if(operation!=='create'&&(!c||c.id!==cicUi.selected?.id))return;
 cicUi.form={operation,id:c?.id,version:c?.version,kind:operation==='entry'?cicUi.tab:cicUi.kind};
 $('cicDialogTitle').textContent=operation==='create'?'Nuevo expediente':operation==='edit'?'Editar expediente':'Añadir '+cicTabs[cicUi.tab].toLocaleLowerCase('es');
 let html='';
 if(operation==='entry')html=cicField('title','Título','',200,true)+cicField('details','Descripción','',6000,false,true)+'<label>Estado de la información<select name="certainty"><option value="pending">Pendiente de contrastar</option><option value="observed">Observado</option><option value="confirmed">Contrastado</option></select></label>'+cicField('source_url','Enlace al mensaje de Discord','',500,cicUi.tab==='evidence');
 else{html=cicField('title','Nombre o asunto','',120,true)+cicField('assignee_name','Responsable · nombre y placa','',120,true)+cicField('location','Zona o ubicación','',200)+cicField('summary',cicUi.kind==='bracelet'?'Colocación, persona IC, fecha, hora y motivo':'Objeto de la investigación','',6000,true,true)+cicField('next_action',cicUi.kind==='bracelet'?'Próxima revisión o motivo de retirada':'Siguiente actuación','',2000,false,true);}
 $('cicFormFields').innerHTML=html;
 if(operation==='edit')for(const key of ['title','assignee_name','location','summary','next_action'])$('cicForm').elements.namedItem(key).value=c[key]||'';
 if(operation==='create')$('cicForm').elements.namedItem('assignee_name').value=$('accountName').textContent||'';
 $('cicFormError').textContent='';$('cicSubmit').disabled=false;$('cicCancel').disabled=false;$('cicDialog').showModal();
}
async function cicSubmitForm(e){
 e.preventDefault();if(cicUi.busy||!cicUi.form)return;
 const form=cicUi.form,session=token,body={...form,...Object.fromEntries(new FormData($('cicForm')))};
 cicUi.busy=true;$('cicSubmit').disabled=true;$('cicCancel').disabled=true;
 try{const result=await request('cic-save',{method:'POST',body});if(session!==token)return;$('cicDialog').close();cicUi.form=null;if(form.operation==='create'){cicUi.selected=result.case;cicUi.tab='summary';$('pc-search').value='';$('pc-state').value='';await loadCic(true);}else{cicUi.selected=result.case;await loadCicDetail(true);}cicNotice('Cambio guardado en el expediente.');}
 catch(error){if(session===token)$('cicFormError').textContent=error.message;}
 finally{if(session===token){cicUi.busy=false;$('cicSubmit').disabled=false;$('cicCancel').disabled=false;}}
}
async function cicTransition(operation){
 if(cicUi.busy||!cicUi.detail?.case)return;const c=cicUi.detail.case;
 if(['close','reopen'].includes(operation)&&!confirm((operation==='close'?'Cerrar':'Reabrir')+' el expediente '+cicCode(c)+' · '+c.title+'? Se conservará todo el historial.'))return;
 cicUi.busy=true;const session=token;
 try{const result=await request('cic-save',{method:'POST',body:{operation,id:c.id,version:c.version}});if(session!==token)return;cicUi.selected=result.case;await loadCic();cicNotice('Estado del expediente actualizado.');}catch(error){if(session===token)cicNotice(error.message,true);}finally{if(session===token)cicUi.busy=false;}
}
function renderCicGuide(){
 $('pc-workspace').hidden=true;$('pc-tools').hidden=true;$('pc-new').hidden=true;$('pc-extra').hidden=false;
 $('pc-extra').innerHTML=cicPair('1. Solicitud y asignación','Registrar el motivo IC y el agente responsable. Cada expediente dispone de un código único.')+cicPair('2. Información vinculada','Separar hechos contrastados de indicios. Registrar personas, vehículos, puntos y anotaciones dentro de su expediente.')+cicPair('3. Evidencias','Guardar las fotografías en Discord y añadir el enlace al mensaje original, su descripción y su estado de contraste.')+cicPair('4. Revisión y archivo','CIC puede remitir el expediente a Directiva. Solo Directiva puede cerrarlo o reabrirlo; los cambios quedan en Actividad.');
}
function cicChangeSection(label){
 const config=cicKinds[label];if(!config)return;cicUi.sequence++;cicUi.detailSequence++;clearTimeout(cicUi.searchTimer);cicUi.kind=config[0];cicUi.selected=null;cicUi.detail=null;cicUi.tab='summary';$('pc-title').textContent=config[1];$('pc-subtitle').textContent=config[2];$('pc-search').value='';$('pc-state').value='';cicNotice('');document.querySelectorAll('#cicView [data-section]').forEach(b=>{if(b.dataset.section===label)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});$('pc-workspace').hidden=false;$('pc-tools').hidden=false;$('pc-new').hidden=false;$('pc-extra').hidden=true;loadCic(true);
}
$('pc-state').innerHTML='<option value="">Todos los estados</option><option value="open">En investigación</option><option value="review">Revisión de Directiva</option><option value="closed">Cerrado</option>';
$('cicView').addEventListener('click',event=>{const b=event.target.closest('button');if(!b||cicUi.busy)return;if(b.dataset.section)cicChangeSection(b.dataset.section);if(b.dataset.cicCase){cicUi.selected=cicUi.records.find(c=>c.id===b.dataset.cicCase);cicUi.tab='summary';renderCicList();loadCicDetail(true);}if(b.dataset.cicTab){cicUi.tab=b.dataset.cicTab;loadCicDetail(true);}if(b.hasAttribute('data-cic-edit'))cicOpenForm('edit');if(b.hasAttribute('data-cic-entry'))cicOpenForm('entry');if(b.dataset.cicTransition)cicTransition(b.dataset.cicTransition);if(b.dataset.cicPage){cicUi.offset=b.dataset.cicPage==='next'?cicUi.next:Math.max(0,cicUi.offset-50);loadCic();}if(b.dataset.cicDetailPage){cicUi.detailOffset=b.dataset.cicDetailPage==='next'?cicUi.detailNext:Math.max(0,cicUi.detailOffset-50);loadCicDetail();}});
$('cicRefresh').onclick=()=>loadCic();
$('pc-new').onclick=()=>cicOpenForm('create');$('cicForm').onsubmit=cicSubmitForm;$('cicCancel').onclick=()=>$('cicDialog').close();$('cicDialog').addEventListener('cancel',event=>{if(cicUi.busy)event.preventDefault();});
$('pc-search').addEventListener('input',()=>{cicUi.sequence++;clearTimeout(cicUi.searchTimer);cicUi.searchTimer=setTimeout(()=>loadCic(true),300);});$('pc-state').onchange=()=>loadCic(true);
document.querySelectorAll('.workspace-tab').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.view!=='cic'){cicUi.sequence++;cicUi.detailSequence++;clearTimeout(cicUi.searchTimer);$('cicDialog').close();}}));
window.addEventListener('panel-account-ready',()=>{if(cicOnly){document.querySelector('[data-view="cic"]').click();}else if(!$('cicView').classList.contains('hidden')&&!canAccessCic){document.querySelector('[data-view="dashboard"]').click();}});
window.addEventListener('panel-session-ended',()=>{cicUi.sequence++;cicUi.detailSequence++;clearTimeout(cicUi.searchTimer);Object.assign(cicUi,{selected:null,detail:null,records:[],offset:0,next:null,detailOffset:0,detailNext:null,busy:false,form:null});$('cicDialog').close();$('cicForm').reset();$('cicFormFields').replaceChildren();$('pc-list').replaceChildren();$('pc-detail').replaceChildren();$('pc-extra').replaceChildren();$('pc-search').value='';cicNotice('');$('cicView').classList.add('hidden');document.querySelector('[data-view="cic"]').classList.add('hidden');});
