import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {divisionRankName,isDivisionLeader,rankedNickname} from '../supabase/functions/_shared/real-ranks.ts';
import {validatePersonnelMovement} from '../supabase/functions/prime-police-panel/personnel-status.ts';
const chief='1539970134544748559',deputy='1539970134544748558',cic='1539970134519578772';
for(const id of [chief,deputy])for(const unit of ['UCOP','CIC']){
 assert(isDivisionLeader(id));assert(divisionRankName(id,unit).endsWith(' '+unit));
 assert(rankedNickname('Ana Ruiz','0012',[id,...(unit==='CIC'?[cic]:[])]).includes(unit));
}
assert(!isDivisionLeader(cic));
const app=readFileSync('app.js','utf8'),html=readFileSync('index.html','utf8');
const elements={rank:{value:chief},unit:{value:'POLICIA',options:[{value:'POLICIA'},{value:'CIC'},{value:'UCOP'}]}};
const ctx=vm.createContext({$:id=>elements[id]});
vm.runInContext(app.slice(app.indexOf('function divisionRoleLabel('),app.indexOf("for(const [rankId,unitId]")),ctx);
ctx.updateDivisionChoice('rank','unit');assert.equal(elements.unit.required,true);assert.equal(elements.unit.value,'');assert(elements.unit.options[0].disabled);
elements.unit.value='CIC';ctx.updateDivisionChoice('rank','unit');assert.equal(elements.unit.value,'CIC');
elements.rank.value='1539970134494421003';ctx.updateDivisionChoice('rank','unit');assert.equal(elements.unit.required,false);assert(!elements.unit.options[0].disabled);
assert(html.includes('id="rankDivision"'));
const hr=readFileSync('supabase/functions/prime-police-panel/hr.ts','utf8');
const managers=hr.match(/const MANAGER_ROLE_IDS = new Set\(\[([\s\S]*?)\]\);/)[1];
assert(managers.includes(chief)&&managers.includes(deputy));assert(!managers.includes(cic),'CIC branch alone must not grant management access');
const accessContext=vm.createContext({Request,WeakMap,console,authenticatePanelSession:async()=> 'actor',accessMember:async()=>({roles:[chief]}),requestMembers:new WeakMap()});
vm.runInContext('const MANAGER_ROLE_IDS=new Set(['+managers+']);'+stripTypeScriptTypes(hr.slice(hr.indexOf('async function authorizedUser('),hr.indexOf('const validDiscordId'))),accessContext);
for(const role of [chief,deputy]){accessContext.accessMember=async()=>({roles:[role]});assert.equal(await accessContext.authorizedUser(new Request('https://test/')),'actor');}
accessContext.accessMember=async()=>({roles:[cic]});assert.equal(await accessContext.authorizedUser(new Request('https://test/')),null);
assert(hr.includes('targetUnit')&&hr.includes('divisionRankName(targetRoleId,targetUnit)'));
const db=new PGlite();
await db.exec("create role anon;create role authenticated;create table police_personnel(id int primary key,rank_role_id text,unit text,rank_name text);insert into police_personnel values(0,'"+chief+"','UCOP','Historical name');");
const migration=readdirSync('supabase/migrations').find(x=>x.endsWith('_division_leadership_names.sql'));
await db.exec(readFileSync('supabase/migrations/'+migration,'utf8'));
assert.equal((await db.query('select rank_name from police_personnel where id=0')).rows[0].rank_name,'Historical name');
let n=0;for(const id of [chief,deputy])for(const unit of ['UCOP','CIC']){n++;await db.query('insert into police_personnel values($1,$2,$3,$4)',[n,id,unit,'Untrusted name']);assert.equal((await db.query('select rank_name from police_personnel where id=$1',[n])).rows[0].rank_name,divisionRankName(id,unit));}
await db.exec("update police_personnel set unit='CIC' where id=1");assert((await db.query('select rank_name from police_personnel where id=1')).rows[0].rank_name.endsWith('CIC'));
assert.equal((await db.query("select has_function_privilege('anon','police_personnel_division_rank_name()','EXECUTE') as allowed")).rows[0].allowed,false);
await db.close();console.log('Division leaders: CIC/UCOP selection, names, nicknames, restricted role access and atomic persistence: PASS');
