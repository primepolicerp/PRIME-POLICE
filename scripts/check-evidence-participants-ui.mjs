import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.textContent='';}
 append(...nodes){this.children.push(...nodes);} replaceChildren(...nodes){this.children=nodes;}
}
const nodes=new Map(),document={createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text}),createDocumentFragment:()=>new Element('fragment')};
const $=id=>{if(!nodes.has(id))nodes.set(id,new Element('div'));return nodes.get(id);};
const source=fs.readFileSync('evidence-ui.js','utf8');
const helpers=source.slice(source.indexOf('function appendEvidenceMessageLinks'),source.indexOf('let evidenceHistorySequence'));
const render=source.slice(source.indexOf('function renderEvidenceRecords()'),source.indexOf('function renderEvidenceTotals()'));
const c=vm.createContext({document,$,niceDate:()=>'',evidenceSummary:{records:1,officers:1,total:1},evidenceRecords:[]});vm.runInContext(helpers+render,c);
const member={discord_user_id:'222222222222222222',officer_name:'<img src=x onerror=alert(1)>',plate:'0200'};
const holder=new Element('div');c.appendEvidenceParticipants(holder,{participants:[member]});assert.equal(holder.children[0].tag,'a');assert.equal(holder.children[0].textContent,member.officer_name+' · #0200');assert.equal(holder.children[0].href,'discord://-/users/'+member.discord_user_id);
const old=new Element('div');c.appendEvidenceParticipants(old,{});assert.equal(old.textContent,'No registrado');
const invalid=new Element('div');c.appendEvidenceParticipants(invalid,{participants:[{discord_user_id:'javascript:bad',officer_name:'Test'}]});assert.equal(invalid.children[0].textContent,'Test');assert(!invalid.children[0].href);
c.evidenceRecords=[{operation:'Robo a tienda',participants:[member],officer_name:'Autor',plate:'0123',locker:'0123',objects_description:'En la imagen',h50:'Central'}];c.renderEvidenceRecords();
const row=$('evidenceRows').children[0].children[0];assert.equal(row.children.length,9);assert.equal(row.children[3].textContent,'Robo a tienda');assert.equal(row.children[4].children[0].textContent,member.officer_name+' · #0200');
c.evidenceRecords=[];c.renderEvidenceRecords();assert.equal($('evidenceRows').children[0].children[0].children[0].colSpan,9);
const html=fs.readFileSync('index.html','utf8');assert(html.includes('<th>Operativo</th><th>Policías participantes</th>'));
console.log('Evidence participants UI: legacy fallback, safe text and Discord links, nine-column records, operative and participants rendered: PASS');
