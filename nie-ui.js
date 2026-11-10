let nieRecords=[],nieOffset=0,nieNext=null,nieStatus='pending',nieSequence=0,nieDetailSequence=0,nieApplication=null,nieSaving=false;
const nieStatusLabels={pending:'Pendiente',approved:'Aprobada',rejected:'Rechazada'};
const nieQuestionLabels=[['full_name','1. Nombre IC'],['current_rank','2. Rango actual'],['motivation','3. ¿Por qué quisieras formar parte de la NIE?'],['experience','4. ¿Qué experiencia has tenido en roles de Asuntos Internos o investigación?'],['kidnapping','5. Si te secuestran y piden información de la policía o de un agente, ¿qué harías?'],['restraints','6. ¿Cómo colocarías unos grilletes?'],['priority_crimes','7. ¿Qué delitos consideras más importantes para la NIE? ¿Por qué?'],['seizure','8. ¿Cómo prepararías una incautación? Antes, durante y después.'],['confidentiality','9. Un superior ajeno a la NIE pide información de un caso. ¿Qué harías?'],['evidence_integrity','10. ¿Cómo evitarías perder o contaminar evidencias durante un operativo?'],['terms','11. ¿Aceptas los términos de la NIE y las consecuencias de incumplirlos?']];
function updateNieAccess(){
 $('nieNav').classList.toggle('hidden',!canReviewNieWeb||restrictedToApplications);
 if(!canReviewNieWeb){nieSequence++;nieDetailSequence++;nieRecords=[];nieApplication=null;$('nieList').replaceChildren();$('nieAnswers').replaceChildren();$('nieDetailTitle').textContent='Postulación NIE · CIC';$('nieDetailStatus').textContent='';$('nieDialog').close();$('nieView').classList.add('hidden');}
}
async function loadNie(reset=false){
 if(!token||!canReviewNieWeb)return;if(reset)nieOffset=0;
 const sequence=++nieSequence,session=token;$('nieNotice').textContent='Consultando postulaciones…';$('nieRefresh').disabled=true;
 try{const result=await request('nie-records',{method:'GET',query:{status:nieStatus,offset:nieOffset}});if(sequence!==nieSequence||session!==token)return;
  nieRecords=result.records||[];nieNext=result.next_offset;const list=$('nieList');list.replaceChildren();
  for(const app of nieRecords){const card=document.createElement('article'),name=document.createElement('h3'),info=document.createElement('p'),date=document.createElement('small'),button=document.createElement('button');card.className='card';name.textContent=app.full_name;info.textContent=app.current_rank+(app.personnel_plate?' · #'+app.personnel_plate:'')+' · '+app.discord_username;date.textContent=niceDate(app.created_at)+' · '+nieStatusLabels[app.status];button.className='btn primary';button.type='button';button.textContent='Ver respuestas';button.onclick=()=>openNie(app.id);card.append(name,info,date,document.createElement('br'),button);list.append(card);}
  if(!nieRecords.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No hay postulaciones en este estado.';list.append(empty);}
  $('niePrevious').disabled=nieOffset===0;$('nieNext').disabled=nieNext==null;$('niePage').textContent='Página '+(Math.floor(nieOffset/30)+1);$('nieNotice').textContent='Acceso privado · Directiva, jefes de ramas y subjefes de CIC. Las decisiones no asignan roles.';
 }catch(error){if(sequence===nieSequence&&session===token){nieRecords=[];$('nieList').replaceChildren();$('nieNotice').textContent=error.message;}}
 finally{if(sequence===nieSequence&&session===token)$('nieRefresh').disabled=false;}
}
async function openNie(id){
 if(nieSaving)return;const sequence=++nieDetailSequence,session=token;nieApplication=null;$('nieAnswers').replaceChildren();$('nieReviewForm').hidden=true;$('nieDetailStatus').textContent='Cargando respuestas…';$('nieDialog').showModal();
 try{const result=await request('nie-records',{method:'GET',query:{id}});if(sequence!==nieDetailSequence||session!==token||!canReviewNieWeb||!$('nieDialog').open)return;
  const app=result.application;nieApplication=app;$('nieDetailTitle').textContent='Postulación de '+app.full_name;$('nieDetailStatus').textContent=nieStatusLabels[app.status]+' · '+niceDate(app.created_at)+' · Ref. '+app.id;
  const identity=document.createElement('p');identity.textContent='Cuenta: '+app.discord_username+' · ID '+app.discord_user_id+' · Identificación al enviar: '+app.personnel_name+(app.personnel_plate?' · #'+app.personnel_plate:'')+' · '+(app.personnel_rank||'Sin rango');$('nieAnswers').append(identity);
  for(const [key,label]of nieQuestionLabels){const block=document.createElement('section'),title=document.createElement('h3'),answer=document.createElement('p');title.textContent=label;const value=app.answers?.[key];answer.textContent=key==='terms'?(value==='yes'?'Sí':value==='no'?'No':'Sin respuesta'):(value||'Sin respuesta');answer.style.whiteSpace='pre-wrap';block.append(title,answer);$('nieAnswers').append(block);}
  if(app.status!=='pending'){const review=document.createElement('p');review.textContent='Revisada por '+(app.reviewed_by_name||app.reviewed_by)+' · '+niceDate(app.reviewed_at)+' · '+(app.review_reason||'');$('nieAnswers').append(review);}
  $('nieReviewForm').reset();$('nieReviewFeedback').textContent='';$('nieReviewForm').hidden=app.status!=='pending'||app.discord_user_id===$('accountCard').dataset.userId;
 }catch(error){if(sequence===nieDetailSequence&&session===token)$('nieDetailStatus').textContent=error.message;}
}
$('nieReviewForm').addEventListener('submit',async event=>{
 event.preventDefault();if(!nieApplication||nieSaving||!canReviewNieWeb)return;const app=nieApplication,session=token,decision=$('nieDecision').value,reason=$('nieReason').value.trim();
 if(!confirm('¿Guardar la postulación de '+app.full_name+' como '+nieStatusLabels[decision]+'? No se asignarán roles.'))return;
 nieSaving=true;$('nieSaveReview').disabled=true;$('nieReviewFeedback').textContent='Guardando…';
 try{const result=await request('nie-review',{method:'POST',body:{id:app.id,decision,reason,expected_updated_at:app.updated_at}});if(session!==token)return;showToast(result.message);$('nieDialog').close();nieApplication=null;await loadNie();}
 catch(error){if(session===token)$('nieReviewFeedback').textContent=error.message;}
 finally{if(session===token){nieSaving=false;$('nieSaveReview').disabled=false;}}
});
$('nieClose').onclick=()=>{if(!nieSaving){nieDetailSequence++;nieApplication=null;$('nieDialog').close();}};
$('nieDialog').addEventListener('cancel',event=>{if(nieSaving)event.preventDefault();else{nieDetailSequence++;nieApplication=null;}});
$('nieRefresh').onclick=()=>loadNie();$('nieFilter').onchange=()=>{nieStatus=$('nieFilter').value;loadNie(true);};
$('niePrevious').onclick=()=>{nieOffset=Math.max(0,nieOffset-30);loadNie();};$('nieNext').onclick=()=>{if(nieNext!=null){nieOffset=nieNext;loadNie();}};
window.addEventListener('panel-account-ready',updateNieAccess);
window.addEventListener('panel-session-ended',()=>{nieSequence++;nieDetailSequence++;nieApplication=null;nieRecords=[];nieOffset=0;nieNext=null;nieSaving=false;nieStatus='pending';$('nieFilter').value='pending';$('nieAnswers').replaceChildren();$('nieList').replaceChildren();$('nieDetailTitle').textContent='Postulación NIE · CIC';$('nieDetailStatus').textContent='';$('nieNotice').textContent='';$('niePage').textContent='';$('nieReviewForm').reset();$('nieReviewFeedback').textContent='';$('nieDialog').close();$('nieNav').classList.add('hidden');$('nieView').classList.add('hidden');$('nieRefresh').disabled=false;$('nieSaveReview').disabled=false;});
