function promotionCandidates(people,ranks,now=Date.now()){
 return people.filter(p=>p.status==='active').flatMap(person=>{
  const index=ranks.findIndex(r=>r.role_id===person.rank_role_id),current=ranks[index];if(!current)return[];
  const next=ranks.slice(index+1).find(r=>!r.rank_track||!current.rank_track||r.rank_track===current.rank_track);if(!next)return[];
  const start=Date.parse(person.last_rank_change_at||person.created_at||''),known=Number.isFinite(start),days=known?Math.max(0,Math.floor((now-start)/86400000)):null,required=Math.max(0,Number(current.minimum_days)||0),remaining=known?Math.max(0,required-days):null;
  return[{person,current,next,days,required,remaining,progress:known?(required?Math.min(100,Math.floor(days/required*100)):100):null,state:!known?'unknown':remaining?'waiting':'eligible'}];
 });
}
function showPromotionTab(tab){
 for(const [key,id]of [['promotions','rankPromotionsTab'],['history','rankHistoryTab'],['requests','rankRequestsTab']])$(id).classList.toggle('hidden',key!==tab);
 for(const button of document.querySelectorAll('[data-rank-tab]')){const selected=button.dataset.rankTab===tab;button.classList.toggle('active',selected);button.classList.remove('primary');button.setAttribute('aria-pressed',String(selected));}
}
function openManualPromotion(){showPromotionTab('promotions');$('manualPromotionPanel').open=true;$('manualPromotionPanel').scrollIntoView({behavior:'smooth',block:'start'});$('rankPlateSearch').focus({preventScroll:true});}
function renderEligiblePromotions(){
 const box=$('rankEligibleList');if(!box)return;const all=promotionCandidates(personnel,rankRoles),query=$('promotionSearch').value.trim().toLocaleLowerCase('es'),unit=$('promotionUnit').value,state=$('promotionState').value,order=$('promotionOrder').value,descending=$('promotionDirection').value==='desc';
 const visible=all.filter(x=>(!unit||(x.person.unit||'POLICIA')===unit)&&(!state||x.state===state)&&[x.person.full_name,x.person.discord_username,x.person.plate].join(' ').toLocaleLowerCase('es').includes(query));
 const cmp=(a,b)=>{let n=0;if(order==='name')n=String(a.person.full_name||'').localeCompare(String(b.person.full_name||''),'es');else if(order==='plate')n=String(a.person.plate||'').localeCompare(String(b.person.plate||''),'es',{numeric:true});else{const av=a[order],bv=b[order];if(av===null||bv===null)return av===bv?0:av===null?1:-1;n=av-bv;}return (descending?-n:n)||String(a.person.plate||'').localeCompare(String(b.person.plate||''),'es',{numeric:true});};visible.sort(cmp);
 $('rankEligibleCount').textContent=all.filter(x=>x.state==='eligible').length+' cumplen el plazo · '+visible.length+' de '+all.length+' agentes con siguiente rango';box.replaceChildren();
 if(!visible.length){profileEmpty(box,all.length?'No hay agentes que coincidan con los filtros.':'No hay agentes activos con un siguiente rango configurado.');return;}
 const table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody'),heading=document.createElement('tr');table.className='promotion-table';
 for(const label of ['Placa','Agente','Rango actual','Siguiente rango','Días en rango','Mínimo','Progreso','Acción']){const th=document.createElement('th');th.textContent=label;heading.append(th);}head.append(heading);table.append(head,body);
 for(const item of visible){const row=document.createElement('tr');row.dataset.promotionPerson=item.person.discord_user_id;const cell=(label,value)=>{const td=document.createElement('td');td.dataset.label=label;if(value!==undefined)td.textContent=value;row.append(td);return td;};
  cell('Placa',item.person.plate||'—');const identity=cell('Agente'),name=document.createElement('button'),branch=document.createElement('small');name.type='button';name.className='promotion-agent';name.textContent=item.person.full_name||item.person.discord_username||'Agente';name.onclick=()=>openPersonnelProfile(item.person);branch.textContent=unitLabel(item.person.unit);identity.append(name,branch);
  cell('Rango actual',item.current.role_name);cell('Siguiente rango',item.next.role_name);cell('Días en rango',item.days===null?'Sin fecha':item.days+' días');cell('Mínimo',item.required+' días');
  const progress=cell('Progreso'),meter=document.createElement('progress'),label=document.createElement('span');meter.max=100;meter.value=item.progress||0;meter.setAttribute('aria-label','Tiempo mínimo cumplido por '+name.textContent);label.textContent=item.progress===null?'Por revisar':item.progress+' %';progress.className='promotion-progress';progress.append(meter,label);
  const action=cell('Acción'),button=document.createElement('button');button.type='button';button.className='btn '+(item.state==='eligible'?'promotion-ready':'ghost');button.textContent=item.state==='eligible'?'Preparar ascenso':item.state==='unknown'?'Revisar fecha':'Faltan '+item.remaining+' días';button.disabled=item.state==='waiting';button.onclick=()=>{if(item.state==='unknown'){openPersonnelProfile(item.person);return;}selectRankPerson(item.person);$('rankAction').value='promotion';renderRankTargetOptions();$('rankTarget').value=item.next.role_id;$('rankEffectiveDate').value=rankToday();openManualPromotion();$('rankReason').focus({preventScroll:true});};action.append(button);body.append(row);
 }box.append(table);
}
const promotionRenderTargets=renderRankTargetOptions;renderRankTargetOptions=function(){promotionRenderTargets();$('promotionDestination').disabled=!personnel.some(p=>p.status==='active'&&p.discord_user_id===$('rankMember').value);};
$('rankPlateSearch').addEventListener('input',()=>{$('rankMember').value='';$('rankSelectedOfficer').textContent='Busca la placa para confirmar al agente.';renderRankTargetOptions();});
$('openManualPromotion').onclick=openManualPromotion;
for(const id of ['promotionUnit','promotionState','promotionOrder','promotionDirection'])$(id).addEventListener('change',renderEligiblePromotions);
$('promotionSearch').addEventListener('input',renderEligiblePromotions);
for(const button of document.querySelectorAll('[data-rank-tab]'))button.addEventListener('click',()=>{showPromotionTab(button.dataset.rankTab);if(button.dataset.rankTab==='requests')loadRankAuthorizations();});
window.addEventListener('panel-session-ended',()=>{$('manualPromotionPanel').open=false;$('rankChangeForm').reset();$('rankMember').value='';$('promotionDestination').disabled=true;for(const id of ['promotionSearch','promotionUnit','promotionState'])$(id).value='';$('promotionOrder').value='remaining';$('promotionDirection').value='asc';$('rankEligibleList').replaceChildren();showPromotionTab('promotions');});
showPromotionTab('promotions');
