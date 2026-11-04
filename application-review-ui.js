function previousRejectionsPanel(item){
 const box=document.createElement('section');
 if(Number(item.attempt_number)<=1||!Number(item.attempt_number))return box;
 box.className='detail';box.style.marginBottom='14px';
 const heading=document.createElement('strong');heading.textContent='Rechazos de intentos anteriores';box.append(heading);
 if(item.rejection_history_unavailable||!Array.isArray(item.previous_rejections)){
  const message=document.createElement('p');message.textContent='No se pudo cargar el historial. Pulsa Actualizar para reintentarlo.';box.append(message);return box;
 }
 if(!item.previous_rejections.length){const message=document.createElement('p');message.textContent='No constan rechazos anteriores en este historial.';box.append(message);return box;}
 for(const old of item.previous_rejections){
  const entry=document.createElement('div'),title=document.createElement('p'),reason=document.createElement('p'),by=document.createElement('small');
  title.textContent='Intento '+old.attempt_number+' · Rechazado';reason.textContent=old.decision_reason||'Motivo no registrado';reason.style.whiteSpace='pre-wrap';reason.style.overflowWrap='anywhere';
  by.className='muted';by.textContent=decisionCredit({...old,status:'rejected'});entry.append(title,reason,by);box.append(entry);
 }
 return box;
}
function flaggedReviewAnswer(item,question){
 const keys={'Motivación':'motivation','Responsabilidad y órdenes':'detention_rights','Mala praxis':'scene_resolution','Situaciones policiales':'roleplay_response','Experiencia policial previa':'previous_police','Experiencia en Roleplay':'roleplay_experience','Motivo del traslado':'transfer_reason','Conocimientos policiales':'police_knowledge','Rango y responsabilidades anteriores':'previous_responsibilities','Historial disciplinario':'disciplinary_history','Adaptación a la nueva institución':'adaptation','Disponibilidad y compromiso':'availability','Aportación a la institución':'contribution'};
 const key=keys[question];return key?String(item.answers?.[key]||(key==='transfer_reason'?item.reason:'')||''):'';
}
function reviewFindingRow(flag,item){
 const row=document.createElement('article');row.className='review-finding';
 const question=document.createElement('span');question.className='review-finding-question';question.textContent=flag.question;
 const title=document.createElement('strong');title.textContent=flag.title;
 const explanation=document.createElement('p');explanation.textContent=flag.detail;
 row.append(question,title,explanation);
 const answer=flaggedReviewAnswer(item,flag.question);
 if(answer){const disclosure=document.createElement('details'),summary=document.createElement('summary'),text=document.createElement('blockquote');disclosure.className='review-answer';summary.textContent='Ver respuesta señalada';text.textContent=answer;disclosure.append(summary,text);row.append(disclosure);}
 return row;
}
function automaticReviewNotice(item){
 const review=item.automatic_review,box=document.createElement('div');
 if(!review)return box;
 box.className='review-notice';
 if(review.unavailable){box.classList.add('review-notice-neutral');box.textContent='Revisión automática no disponible. Puedes revisar las respuestas manualmente o actualizar para reintentar.';return box;}
 if(!review.flags?.length){box.classList.add('review-notice-neutral');box.textContent='Sin coincidencias ni referencias explícitas a IA detectadas. Esto no confirma autoría humana.';return box;}
 const head=document.createElement('div');head.className='review-notice-head';
 const icon=document.createElement('span');icon.className='review-notice-icon';icon.textContent='!';icon.setAttribute('aria-hidden','true');
 const intro=document.createElement('div'),heading=document.createElement('strong'),description=document.createElement('p');heading.textContent='Respuestas que necesitan revisión';
 const questions=[...new Set(review.flags.map(flag=>flag.question))];description.textContent=questions.join(' · ');intro.append(heading,description);
 const badge=document.createElement('span');badge.className='review-notice-count';badge.textContent=review.flags.length+' '+(review.flags.length===1?'hallazgo':'hallazgos');head.append(icon,intro,badge);
 const disclosure=document.createElement('details');disclosure.className='review-findings';const summary=document.createElement('summary');summary.textContent='Ver hallazgos y respuestas señaladas';const findings=document.createElement('div');findings.className='review-findings-list';for(const flag of review.flags)findings.append(reviewFindingRow(flag,item));
 const note=document.createElement('p');note.className='review-notice-note';note.textContent='Estas señales no confirman uso de IA. Contrasta las respuestas en entrevista; UCOP o Directiva toman la decisión.';
 const sample=document.createElement('small');sample.className='review-sample';sample.textContent=Number.isInteger(review.compared)?'Comparación privada con '+review.compared+' solicitudes recientes.':'Comparación privada con hasta 200 solicitudes recientes.';
 disclosure.append(summary,findings,sample);box.append(head,disclosure,note);return box;
}
function applicationReviewPanel(app){
 const box=document.createElement('details');box.className='detail';box.style.marginBottom='14px';
 const title=document.createElement('summary');title.textContent='Revisión interna · IA y coincidencias';title.style.cursor='pointer';
 const body=document.createElement('div');body.style.paddingTop='12px';box.append(title,body);let loaded=false,loading=false;
 const load=async()=>{if(loaded||loading)return;loading=true;body.textContent='Revisando respuestas…';try{
  const result=await request('application-review',{method:'GET',query:{id:app.id}});body.replaceChildren();
  const notice=document.createElement('p');notice.className='muted';notice.textContent=result.notice;body.append(notice);
  if(!result.flags.length){const empty=document.createElement('p');empty.textContent='Sin referencias explícitas ni coincidencias detectadas. Esto no acredita autoría humana.';body.append(empty);}
  for(const flag of result.flags)body.append(reviewFindingRow(flag,app));
  const sample=document.createElement('small');sample.className='muted';sample.textContent='Comparación con '+result.compared+' solicitudes recientes (máximo 200). Solo visible para gestores autorizados.';body.append(sample);
  const labels={reviewed:'Revisada · sin marca de IA',suspected_ai:'Posible uso de IA',declared_ai:'Uso de IA declarado por el postulante'};
  const heading=document.createElement('h4');heading.textContent='Constancia del revisor · últimas 5';body.append(heading);
  if(!(result.reviews||[]).length){const none=document.createElement('p');none.className='muted';none.textContent='Todavía no hay una marca manual guardada.';body.append(none);}
  for(const review of result.reviews||[]){const row=document.createElement('div');row.className='detail';row.style.marginBottom='8px';const label=document.createElement('strong');label.textContent=labels[review.verdict]||'Revisión interna';const note=document.createElement('p');note.textContent=review.note;const by=document.createElement('small');by.className='muted';by.textContent='Marcada por '+review.reviewed_by_name+' · Discord ID '+review.reviewed_by_discord_id+' · '+niceDate(review.created_at);row.append(label,note,by);body.append(row);}
  const form=document.createElement('form');form.className='personnel-fields';form.style.marginTop='14px';const selectField=document.createElement('div');selectField.className='field';const selectLabel=document.createElement('label');selectLabel.textContent='Marca manual de la revisión';const select=document.createElement('select');select.required=true;select.id='reviewVerdict-'+app.id;selectLabel.htmlFor=select.id;const empty=document.createElement('option');empty.value='';empty.textContent='Selecciona el resultado manual';select.append(empty);for(const [value,text] of Object.entries(labels)){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}selectField.append(selectLabel,select);
  const noteField=document.createElement('div');noteField.className='field';const noteLabel=document.createElement('label');noteLabel.textContent='Observación o evidencia';const note=document.createElement('textarea');note.id='reviewNote-'+app.id;noteLabel.htmlFor=note.id;note.rows=3;note.required=true;note.minLength=3;note.maxLength=2000;note.placeholder='Describe qué comprobaste o qué declaró la persona…';noteField.append(noteLabel,note);
  const controls=document.createElement('div');const save=document.createElement('button');save.type='submit';save.className='btn';save.textContent='Guardar constancia interna';const feedback=document.createElement('p');feedback.className='muted';feedback.setAttribute('role','status');feedback.textContent='Guardar una marca no acepta ni rechaza la solicitud. La decisión la toma UCOP o Directiva.';controls.append(save,feedback);form.append(selectField,noteField,controls);body.append(form);
  let operationId=crypto.randomUUID(),saving=false;const changed=()=>{if(!saving)operationId=crypto.randomUUID();};select.addEventListener('change',changed);note.addEventListener('input',changed);
  form.addEventListener('submit',async event=>{event.preventDefault();if(saving||!form.reportValidity())return;saving=true;save.disabled=select.disabled=note.disabled=true;feedback.textContent='Guardando constancia…';try{const saved=await request('application-review-save',{method:'POST',body:{id:app.id,review_id:operationId,verdict:select.value,note:note.value.trim()}});feedback.textContent=saved.message||'Constancia guardada.';loaded=false;loading=false;if(activeStatus==='rejected-ai'){showToast(saved.message||'Constancia guardada.');await activeRecordPage('applications');}else await load();}catch(error){feedback.textContent=error.message;}finally{saving=false;save.disabled=select.disabled=note.disabled=false;}});loaded=true;
 }catch(error){body.textContent=error.message;const retry=document.createElement('button');retry.type='button';retry.className='btn';retry.textContent='Reintentar revisión';retry.onclick=load;body.append(retry);}finally{loading=false;}};
 box.addEventListener('toggle',()=>{if(box.open)load();});return box;
}
function externalAiReviewPanel(item,kind){
 const box=document.createElement('details');box.className='detail external-ai-panel';
 const title=document.createElement('summary');title.textContent='Detector externo de IA';
 const body=document.createElement('div');body.className='external-ai-body';box.append(title,body);let loaded=false,busy=false;
 const load=async(analyze=false)=>{
  if(busy)return;busy=true;body.textContent=analyze?'Analizando respuestas…':'Consultando análisis externo…';
  try{
   const data=await request('external-ai-review',{method:analyze?'POST':'GET',query:{kind,id:item.id},...(analyze?{body:{}}:{})});body.replaceChildren();title.textContent='Detector externo de IA · '+data.provider;
   const description=document.createElement('p');description.className='muted';description.textContent='Analiza las respuestas con un servicio externo especializado en español. La puntuación es una estimación, no un porcentaje de texto copiado ni una prueba de autoría.';body.append(description);
   if(data.result){
    const meta=document.createElement('small');meta.className='review-sample';meta.textContent=data.result.provider+' · '+niceDate(data.result.analyzed_at)+' · Resultado guardado';body.append(meta);
    for(const result of data.result.answers||[]){
     const row=document.createElement('article');row.className='review-finding';const heading=document.createElement('strong');heading.textContent=result.label;
     const score=document.createElement('span');score.className='external-ai-score';score.textContent='Estimación del detector: '+Math.round(result.score*100)+'%';
     const note=document.createElement('p');note.textContent=result.low_confidence?'Baja confianza: el texto es breve o presenta un formato menos fiable.':result.score>=.8?'El detector señala posible generación con IA. Requiere revisión humana.':result.score>=.5?'El detector encuentra algunas señales de generación con IA.':'El detector encuentra pocas señales. Esto no acredita autoría humana.';row.append(heading,score,note);
     const text=result.key==='combined'?(result.source_keys||[]).map(key=>String(item.answers?.[key]||(key==='transfer_reason'?item.reason:'')||'').trim().slice(0,4000)).filter(Boolean).join('\n\n').slice(0,36000):String(item.answers?.[result.key]||(result.key==='transfer_reason'?item.reason:'')||'').trim().slice(0,4000),characters=Array.from(text);
     const disclosure=document.createElement('details'),summary=document.createElement('summary'),answer=document.createElement('blockquote');disclosure.className='review-answer';summary.textContent=result.segments?.length?'Ver respuesta y fragmentos señalados':'Ver respuesta analizada';
     const segments=[...(result.segments||[])].sort((a,b)=>a.start-b.start);let cursor=0;
     for(const segment of segments){if(segment.start<cursor||segment.start<0||segment.end>characters.length||segment.end<=segment.start)continue;answer.append(document.createTextNode(characters.slice(cursor,segment.start).join('')));const mark=document.createElement('mark');mark.textContent=characters.slice(segment.start,segment.end).join('');mark.title='Fragmento señalado por '+data.provider+' · '+Math.round(segment.score*100)+'%';answer.append(mark);cursor=segment.end;}
     answer.append(document.createTextNode(characters.slice(cursor).join('')));disclosure.append(summary,answer);row.append(disclosure);body.append(row);
    }
   }
   if(data.truncated){const limit=document.createElement('p');limit.className='muted';limit.textContent='Por longitud, se analizarán los primeros 36.000 caracteres del conjunto de respuestas.';body.append(limit);}
   if(data.skipped?.length){const skipped=document.createElement('p');skipped.className='muted';skipped.textContent='Sin analizar por texto breve (menos de '+data.minimum_characters+' caracteres): '+data.skipped.map(x=>x.label).join(', ')+'.';body.append(skipped);}
   if(!data.configured){const pending=document.createElement('p');pending.className='muted';pending.textContent='Pendiente de conectar la clave privada del detector en el servidor.';body.append(pending);}
   else if(!data.result&&data.eligible){
    const privacy=document.createElement('p');privacy.className='muted';privacy.textContent='Se enviarán solo las respuestas a '+data.provider+', sin incluir los campos de nombre, edad o cuenta Discord. '+(data.provider==='TruthScan'?'El plan gratuito del proveedor puede conservar el texto y el resultado. La puntuación corresponde al conjunto de respuestas.':'Se solicitará al proveedor no conservar el texto.')+' No hay decisiones automáticas.';
    const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Analizar respuestas con '+data.provider;button.onclick=()=>load(true);body.append(privacy,button);
    if(data.processing){const progress=document.createElement('p');progress.className='muted';progress.textContent='Hay un análisis en curso. Espera un momento y vuelve a consultar.';body.append(progress);}
   }
   loaded=true;
  }catch(error){body.textContent=error.message;const retry=document.createElement('button');retry.type='button';retry.className='btn ghost';retry.textContent='Consultar resultado';retry.onclick=()=>load(false);body.append(retry);loaded=false;}
  finally{busy=false;}
 };
 box.addEventListener('toggle',()=>{if(box.open&&!loaded)load();});return box;
}
