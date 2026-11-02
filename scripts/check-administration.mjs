import assert from 'node:assert/strict';
import {administrationRoute} from '../supabase/functions/prime-police-panel/administration.ts';
import {applicationScopeAllowed} from '../supabase/functions/prime-police-panel/application-permissions.ts';
const actor='111111111111111111',other='222222222222222222',id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
let calls=[],resolved=[],existing=[];
const c={json:(v,status=200)=>Response.json(v,{status}),director:false,actorName:'Identidad verificada',resolveAssignee:async id=>{resolved.push(id);return 'Responsable verificado';},db:async(path,init)=>{
 calls.push({path,body:init?.body&&JSON.parse(init.body)});
 if(path.startsWith('police_administrative_tasks?'))return existing;
 if(path.startsWith('police_personnel?'))return[{discord_user_id:other}];
 if(path==='rpc/save_police_administrative_task')return{ok:true,task:{id}};
 return{};
}};
const make=(body={})=>new Request('https://test',{method:'POST',body:JSON.stringify({id,expected_version:0,title:'Revisar expediente',description:'Comprobar información',status:'pending',priority:'high',assigned_to:actor,...body})});
let r=await administrationRoute(make({director:true,actorIsDirector:true,assigned_to:other}),'administrative-task-save',actor,c);assert.equal(r.status,403);assert.equal(resolved.length,0);assert(!calls.some(c=>c.path.startsWith('rpc/save')));
calls=[];r=await administrationRoute(make({actor_name:'Falso',p_actor:other,p_director:true}),'administrative-task-save',actor,c);assert.equal(r.status,200);let rpc=calls.find(x=>x.path==='rpc/save_police_administrative_task');assert.equal(rpc.body.p_actor,actor);assert.equal(rpc.body.p_actor_name,c.actorName);assert.equal(rpc.body.p_director,false);assert.equal(rpc.body.p_assigned_name,'Responsable verificado');assert(!('p_actor' in rpc.body.p_data));
c.director=true;calls=[];r=await administrationRoute(make({assigned_to:other,target_id:other}),'administrative-task-save',actor,c);assert.equal(r.status,200);assert(calls.some(x=>x.path.startsWith('police_personnel?')));rpc=calls.find(x=>x.path==='rpc/save_police_administrative_task');assert.equal(rpc.body.p_director,true);
c.director=false;existing=[{created_by:other,assigned_to:other,assigned_name:'Otro gestor'}];calls=[];r=await administrationRoute(make({expected_version:2,assigned_to:actor}),'administrative-task-save',actor,c);assert.equal(r.status,403);assert(!calls.some(x=>x.path.startsWith('rpc/')));
existing=[{created_by:other,assigned_to:actor,assigned_name:'Gestor actual'}];calls=[];r=await administrationRoute(make({expected_version:2}),'administrative-task-save',actor,c);assert.equal(r.status,200);
for(const body of [{due_date:'2026-02-31'},{id:'invalid'},{title:'x'},{assigned_to:'not an ID'},{expected_version:-1},{status:'approve'},{target_id:'x'}]){calls=[];r=await administrationRoute(make(body),'administrative-task-save',actor,c);assert.equal(r.status,400);assert.equal(calls.length,0);}
for(const url of ['?offset=-1','?offset=1.5','?scope=other','?status=approve']){r=await administrationRoute(new Request('https://test/'+url),'administrative-tasks',actor,c);assert.equal(r.status,400);}
calls=[];r=await administrationRoute(new Request('https://test/?scope=team&status=open&search=%25query_'),'administrative-tasks',actor,c);assert.equal(r.status,200);rpc=calls[0];assert.equal(rpc.body.p_actor,actor);assert.equal(rpc.body.p_director,false);assert.equal(rpc.body.p_search,'query');
calls=[];r=await administrationRoute(new Request('https://test/?discord_user_id='+other+'&kind=note&offset=25'),'personnel-dossier',actor,c);assert.equal(r.status,200);assert.equal(calls[1].body.p_user,other);assert.equal(calls[1].body.p_kind,'note');assert.equal(calls[1].body.p_offset,25);
for(const action of ['administrative-overview','administrative-tasks','administrative-task-history','personnel-dossier']){r=await administrationRoute(new Request('https://test',{method:'POST',body:'{}'}),action,actor,c);assert.equal(r.status,405);assert.equal(applicationScopeAllowed(action,new URLSearchParams()),false);}
assert.equal(applicationScopeAllowed('administrative-task-save',new URLSearchParams()),false);
console.log('Administration routes: trusted identities/Directiva flag, ownership checks, assignee verification, validated dates/filters, private dossier pagination, strict methods and trainee scope: PASS');
