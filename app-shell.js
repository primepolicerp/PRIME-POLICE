function setMobileMenu(open){$('sideNav').classList.toggle('mobile-open',open);$('menuToggle').setAttribute('aria-expanded',String(open));}
$('menuToggle').addEventListener('click',()=>setMobileMenu(!$('sideNav').classList.contains('mobile-open')));
document.querySelectorAll('.workspace-tab').forEach(button=>button.addEventListener('click',()=>{setMobileMenu(false);document.querySelectorAll('.record-pager').forEach(p=>{const config=recordConfig[p.id.replace('recordPager-','')];p.hidden=config?$(config.container).closest('.hidden')!==null:false;});}));
$('toast').setAttribute('role','status');$('toast').setAttribute('aria-live','polite');
const originalToast=showToast;
showToast=message=>{originalToast(message);$('operationStatus').textContent=message;$('operationStatus').hidden=false;};
$('dismissOperationStatus').addEventListener('click',()=>{$('operationStatus').hidden=true;});
let sessionListSequence=0;
async function openSessionManager(){
 const sequence=++sessionListSequence,session=token;if(!session)return;
 $('sessionDialog').showModal();$('sessionList').textContent='Cargando sesiones…';$('sessionFeedback').textContent='';
 try{const result=await request('sessions',{method:'GET'});if(sequence!==sessionListSequence||session!==token||!$('sessionDialog').open)return;$('sessionList').replaceChildren();for(const item of result.sessions){const row=document.createElement('div');row.className='activity-row';const copy=document.createElement('div');const title=document.createElement('strong');title.textContent=item.device_label+(item.current?' · Esta sesión':'');const info=document.createElement('small');info.textContent='Última actividad: '+niceDate(item.last_seen_at);copy.append(title,info);row.append(copy);$('sessionList').append(row);}}
 catch(error){if(sequence===sessionListSequence&&session===token&&$('sessionDialog').open)$('sessionList').textContent=error.message;}
}
$('openSessionManager').addEventListener('click',openSessionManager);$('closeSessionManager').addEventListener('click',()=>$('sessionDialog').close());
$('sessionDialog').addEventListener('close',()=>{sessionListSequence++;});
$('logoutOtherSessions').addEventListener('click',async()=>{const session=token;const button=$('logoutOtherSessions');button.disabled=true;try{const result=await request('logout-others',{method:'POST'});if(session!==token)return;await openSessionManager();if(session!==token)return;$('sessionFeedback').textContent=result.message;}catch(error){if(session===token)$('sessionFeedback').textContent=error.message;}finally{if(session===token)button.disabled=false;}});
const mobileTableMedia=matchMedia('(max-width:620px)'),pendingMobileTables=new Set();let mobileTableFrame=0;
function labelMobileTables(tables=document.querySelectorAll('.table-wrap table')){
 for(const table of tables){if(!table.isConnected)continue;table.classList.add('mobile-record-table');if(!mobileTableMedia.matches)continue;const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
  for(const row of table.querySelectorAll('tbody tr'))for(const [i,cell]of [...row.children].entries())if(cell.colSpan===1&&cell.dataset.label!==(headers[i]||''))cell.dataset.label=headers[i]||'';
 }
}
function queueMobileTable(table){if(!table?.closest('.table-wrap'))return;pendingMobileTables.add(table);if(!mobileTableFrame)mobileTableFrame=requestAnimationFrame(()=>{mobileTableFrame=0;labelMobileTables(pendingMobileTables);pendingMobileTables.clear();});}
const mobileTableObserver=new MutationObserver(changes=>{
 for(const change of changes){const target=change.target.nodeType===1?change.target:change.target.parentElement;if(target?.closest('thead'))queueMobileTable(target.closest('table'));
  for(const node of change.addedNodes){if(node.nodeType!==1)continue;if(node.matches('table,tr,td,th'))queueMobileTable(node.closest('table'));for(const element of node.querySelectorAll('table,tr'))queueMobileTable(element.closest('table'));}
 }
});mobileTableObserver.observe($('appView'),{childList:true,subtree:true});labelMobileTables();
mobileTableMedia.addEventListener('change',()=>labelMobileTables());
window.addEventListener('panel-data-changed',()=>{directoryExpires=0;directoryTask=null;directorySession='';rankReadCache=null;});
window.addEventListener('panel-session-ended',()=>{
 sessionListSequence++;rankConfigSequence++;rankHistorySequence++;$('rankHistoryRows').replaceChildren();$('sessionList').replaceChildren();$('sessionFeedback').textContent='';$('logoutOtherSessions').disabled=false;directoryTask=null;directorySession='';
 for(const state of Object.values(recordPages)){state.sequence++;clearTimeout(state.timer);}
 for(const config of Object.values(recordConfig)){config.assign([]);$(config.container).replaceChildren();$(config.container).removeAttribute('aria-busy');$(config.container).inert=false;if(config.stats)for(const id of config.stats)$(id).textContent='—';}
 personnel=[];rankRoles=[];availableRoles=[];editingPersonnelId=null;dutyShifts=[];dutyPeople=[];rosterPage=null;rosterPageInfo=null;directoryExpires=0;rankReadCache=null;
 document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());closePersonnelProfile();
 $('sideNav').classList.remove('mobile-open');$('openSessionManager').hidden=true;
});
const originalShowApp=showApp;showApp=()=>{originalShowApp();$('openSessionManager').hidden=false;};
if(token)$('openSessionManager').hidden=false;
let rankReadCache=null;
const rawRequest=request;
request=async(action,options={})=>{
 const method=options.method||(['rank-config'].includes(action)?'GET':'');
 if(action==='rank-config'&&method==='GET'&&rankReadCache?.token===token&&rankReadCache.expires>Date.now())return structuredClone(rankReadCache.value);
 const session=token;const result=await rawRequest(action,options);
 if(action==='rank-config'&&method==='GET'&&session===token)rankReadCache={token,value:structuredClone(result),expires:Date.now()+30000};
 if(session===token&&options.method==='POST'&&!['login','logout','logout-others'].includes(action)&&!result.pending_approval)window.dispatchEvent(new Event('panel-data-changed'));
 return result;
};
