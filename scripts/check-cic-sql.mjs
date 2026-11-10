import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 await db.exec(fs.readFileSync('supabase/migrations/20261110164504_cic_investigation_workspace.sql','utf8'));
 const write=async(action,payload,director=false)=>(await db.query('select police_cic_write($1,$2,$3,$4,$5) r',[action,payload,'111111111111111111','Investigador de prueba',director])).rows[0].r;
 const read=async(kind='band',id=null,entry='note',offset=0,q='')=>(await db.query('select police_cic_read($1,$2,$3,$4,$5,$6) r',[kind,'',q,id,entry,offset])).rows[0].r;
 let c=(await write('create',{kind:'band',title:'Banda de prueba',assignee_name:'Investigador #0001',summary:'Indicios pendientes'})).case;
 assert.equal(c.version,1);assert.equal((await read()).total,1);
 assert.equal((await read('person')).total,0);
 const b={id:c.id,version:1};
 assert.equal((await write('close',b)).code,'forbidden');
 await assert.rejects(()=>write('entry',{...b,kind:'evidence',title:'Fotografía',source_url:'https://example.org/photo.png'}));
 assert.equal((await read('band',c.id,'activity')).total,1,'Rejected writes have no audit effects');
 let r=await write('entry',{...b,kind:'vehicle',title:'Matrícula ZZ-123',details:'Observación pendiente',certainty:'pending'});assert(r.ok);c=r.case;
 assert.equal((await write('edit',{...b,title:'Cambio atrasado',assignee_name:'Investigador'})).code,'conflict');
 assert.equal((await read('band',null,'note',0,'ZZ-123')).total,1);
 r=await write('review',{id:c.id,version:c.version});assert.equal(r.case.status,'review');c=r.case;
 r=await write('close',{id:c.id,version:c.version},true);assert.equal(r.case.status,'closed');c=r.case;
 assert.equal((await write('entry',{id:c.id,version:c.version,kind:'note',title:'No permitido'})).code,'closed');
 r=await write('reopen',{id:c.id,version:c.version},true);assert.equal(r.case.status,'open');c=r.case;
 for(let i=0;i<55;i++){r=await write('entry',{id:c.id,version:c.version,kind:'note',title:'Anotación '+i,details:'Datos de prueba'});c=r.case;}
 let page=await read('band',c.id);assert.equal(page.records.length,50);assert.equal(page.total,55);assert.equal(page.next_offset,50);assert.equal((await read('band',c.id,'note',50)).records.length,5);assert.equal(page.counts.vehicle,1);
 await db.exec('set role anon');await assert.rejects(()=>read());await assert.rejects(()=>db.query('select * from police_cic_entries'));await assert.rejects(()=>write('close',{id:c.id,version:c.version},true));await db.exec('reset role;set role service_role');assert.equal((await read()).total,1);
 await assert.rejects(()=>db.exec('delete from police_cic_events'));
 console.log('CIC SQL: isolated categories, private access, optimistic changes, atomic audit, director-only closure/reopen, preserved history, search and full pagination PASS');
}finally{await db.close();}
