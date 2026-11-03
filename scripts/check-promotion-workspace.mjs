import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({Date});vm.runInContext(fs.readFileSync('promotions-workspace.js','utf8').split('function showPromotionTab')[0],context);
const now=Date.parse('2026-11-03T12:00:00Z'),ranks=[{role_id:'p1',rank_track:'police',minimum_days:7},{role_id:'u1',rank_track:'ucop',minimum_days:3},{role_id:'p2',rank_track:'police',minimum_days:10},{role_id:'u2',rank_track:'ucop',minimum_days:0}];
const p=(id,rank,date,status='active')=>({discord_user_id:id,rank_role_id:rank,last_rank_change_at:date,status});
const rows=context.promotionCandidates([p('a','p1','2026-10-27T12:00:00Z'),p('b','p1','2026-11-01T12:00:00Z'),p('c','u1','2026-10-01'),p('d','p1',''),p('e','p1','2026-10-01','inactive'),p('f','u2','2026-10-01')],ranks,now);
assert.equal(rows.length,4);assert.equal(rows[0].next.role_id,'p2');assert.equal(rows[0].state,'eligible');assert.equal(rows[0].progress,100);assert.equal(rows[1].remaining,5);assert.equal(rows[1].progress,28);assert.equal(rows[2].next.role_id,'u2');assert.equal(rows[3].state,'unknown');assert.equal(rows[3].progress,null);
console.log('Promotion workspace: real track progression, exact day boundary, remaining days, capped progress, unknown dates, inactive and terminal ranks: PASS');
