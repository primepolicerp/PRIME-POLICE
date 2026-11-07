import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.textContent='';}
 append(...nodes){this.children.push(...nodes);} replaceChildren(...nodes){this.children=nodes;}
 addEventListener(){} setAttribute(){}
}
const nodes=new Map(),document={createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text}),createDocumentFragment:()=>new Element('fragment')};
const $=id=>{if(!nodes.has(id))nodes.set(id,new Element('div'));return nodes.get(id);};
const source=fs.readFileSync('evidence-ui.js','utf8');
const helpers=source.slice(source.indexOf('function appendEvidenceMessageLinks'),source.indexOf('let evidenceHistorySequence'));
const render=source.slice(source.indexOf('function renderEvidenceDetail()'),source.indexOf('function renderEvidenceTotals()'));
const c=vm.createContext({document,$,niceDate:()=>'',evidenceSelectedId:'record',evidenceRecords:[]});vm.runInContext(helpers+render,c);
const member={discord_user_id:'222222222222222222',officer_name:'<img src=x onerror=alert(1)>',plate:'0200'};
const holder=new Element('div');c.appendEvidenceParticipants(holder,{participants:[member]});assert.equal(holder.children[0].tag,'a');assert.equal(holder.children[0].textContent,member.officer_name+' · #0200');assert.equal(holder.children[0].href,'discord://-/users/'+member.discord_user_id);
const old=new Element('div');c.appendEvidenceParticipants(old,{});assert.equal(old.textContent,'No registrado');
const invalid=new Element('div');c.appendEvidenceParticipants(invalid,{participants:[{discord_user_id:'javascript:bad',officer_name:'Test'}]});assert.equal(invalid.children[0].textContent,'Test');assert(!invalid.children[0].href);
c.evidenceRecords=[{id:'record',operation:'Robo a tienda',participants:[member],officer_name:'Autor',plate:'0123',locker:'0123',objects_description:'En la imagen',h50:'Central'}];c.renderEvidenceDetail();
let fields=$('evidenceDetail').children[1].children;
assert.equal(fields.find(x=>x.children[0].textContent==='Operativo').children[1].textContent,'Robo a tienda');
assert.equal(fields.find(x=>x.children[0].textContent==='Policías participantes').children[1].children[0].textContent,member.officer_name+' · #0200');
c.evidenceRecords=[{id:'record',officer_name:'Registro anterior',objects_description:'Texto completo'}];c.renderEvidenceDetail();fields=$('evidenceDetail').children[1].children;assert(!fields.some(x=>x.children[0].textContent==='Operativo'));assert(!fields.some(x=>x.children[0].textContent==='Policías participantes'));assert.equal(fields[0].children[1].textContent,'Texto completo');
c.evidenceRecords=[];c.renderEvidenceDetail();assert.equal($('evidenceDetail').children[0].textContent,'Selecciona una evidencia para consultar sus datos.');
const html=fs.readFileSync('index.html','utf8');assert(html.includes('id="evidenceDetail"'));assert(html.includes('class="evidence-inbox-records"'));
console.log('Evidence detail UI: legacy fallback, safe text and Discord links, full objects, optional operative and participants preserved: PASS');
