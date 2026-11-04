import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {attachPersonnelMembership} from '../supabase/functions/prime-police-panel/personnel-membership.ts';
import {attachApplicationAdmission} from '../supabase/functions/prime-police-panel/application-admission.ts';
const registered='111111111111111111',newcomer='222222222222222222';
const rows=[{discord_user_id:registered},{discord_user_id:newcomer}];
const result=await attachPersonnelMembership(rows,async path=>{
 assert(path.includes('select=discord_user_id'));assert(!path.includes('status='),'Inactive files also prevent duplicate admission');
 assert(path.includes('in.('+registered+','+newcomer+')'));return {rows:[{discord_user_id:registered}]};
});
assert.equal(result[0].personnel_registered,true);assert.equal(result[1].personnel_registered,false);
const failed=await attachPersonnelMembership(rows,async()=>{throw Error('Unavailable');});
assert.equal(failed[0].personnel_membership_unavailable,true);assert.equal(failed[1].personnel_registered,undefined);
const element=tag=>({tag,children:[],append(child){this.children.push(child);},addEventListener(_,fn){this.click=fn;}});
let opened;
const context=vm.createContext({document:{createElement:element},openPreselectionAdmission:(...args)=>{opened=args;}});
const source=readFileSync(new URL('../preselection-ingress.js',import.meta.url),'utf8');
vm.runInContext(source.slice(source.indexOf('function appendAdmissionAction'),source.indexOf('async function openPreselectionAdmission')),context);
for(const source of ['preselection','transfer']){
 const existing=element('td');context.appendAdmissionAction(existing,result[0],source);assert.equal(existing.children[0].tag,'span');
 const fresh=element('td');context.appendAdmissionAction(fresh,result[1],source);assert.equal(fresh.children[0].tag,'button');fresh.children[0].click();assert.equal(opened[1],source);
 const unavailable=element('td');context.appendAdmissionAction(unavailable,failed[0],source);assert.equal(unavailable.children[0].tag,'span');
}
console.log('Admission buttons only for confirmed nonmembers, existing/inactive files, transfers, preselection and failed lookup: PASS');

const applicationRows=[{id:'accepted-new',status:'accepted',discord_user_id:newcomer},{id:'accepted-old',status:'accepted',discord_user_id:registered},{id:'pending',status:'pending',discord_user_id:newcomer}];
const candidate={discord_user_id:newcomer,discord_username:'Cuenta',full_name:'Morky Glook',source_application_id:'accepted-new',status:'active',updated_at:'2026-10-30T01:16:59.862+00:00'};
let reads=[];
const candidates=await attachApplicationAdmission(applicationRows,async path=>{reads.push(path);return{rows:path.startsWith('police_personnel')?[{discord_user_id:registered}]:[candidate]};});
assert.equal(reads.length,2);assert(reads[1].includes(newcomer));assert(!reads[1].includes(registered));assert.deepEqual(candidates[0].admission_candidate,candidate);assert.equal(candidates[1].personnel_registered,true);assert.equal(candidates[1].admission_candidate,undefined);assert.equal(candidates[2].admission_candidate,undefined);
for(const state of [{...candidate,status:'converted'},{...candidate,source_application_id:'different-application'}]){const result=await attachApplicationAdmission([applicationRows[0]],async path=>({rows:path.startsWith('police_personnel')?[]:[state]}));assert.equal(result[0].admission_candidate,undefined);}
const candidateFailure=await attachApplicationAdmission([applicationRows[0]],async path=>{if(path.startsWith('police_preselections'))throw Error('Unavailable');return{rows:[]};});assert.equal(candidateFailure[0].admission_lookup_unavailable,true);
context.restrictedToApplications=false;
let actions=element('div');context.appendAcceptedApplicationAdmission(actions,candidates[0]);assert.equal(actions.children[0].tag,'button');actions.children[0].click();assert.equal(opened[1],'application');assert.equal(opened[0].updated_at,candidate.updated_at);
actions=element('div');context.appendAcceptedApplicationAdmission(actions,candidates[1]);assert.equal(actions.children[0].tag,'span');
actions=element('div');context.appendAcceptedApplicationAdmission(actions,candidateFailure[0]);assert.equal(actions.children[0].tag,'span');
context.restrictedToApplications=true;actions=element('div');context.appendAcceptedApplicationAdmission(actions,candidates[0]);assert.equal(actions.children.length,0);
let unexpectedReads=0;await attachApplicationAdmission([applicationRows[2]],async()=>{unexpectedReads++;return{rows:[]};});assert.equal(unexpectedReads,0);
console.log('Accepted application ingress: active matching preselection, no existing/inactive duplicate, stale/failed lookup safeguards, reused interview form and no trainee admission action: PASS');
