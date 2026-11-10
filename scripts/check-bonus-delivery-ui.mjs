import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const s=readFileSync('bonuses-ui.js','utf8'),parse=vm.runInNewContext('('+s.slice(s.indexOf('function parseBonusAmount('),s.indexOf('function clearBonusSelection(')).trim()+')');
for(const [input,expected]of [['50000',50000],['50.000',50000],['50,000',50000],['50.000,50',50000.5],['50,000.50',50000.5],['RP$ 50.000',50000],['$ 50000',50000],['1,50',1.5],['0',0]])assert.equal(parse(input),expected,input);
for(const input of ['','abc','-100','1.1234','50.000,500','Infinity','1e5'])assert.equal(Number.isNaN(parse(input)),true,input);
const html=readFileSync('index.html','utf8');assert.ok(html.includes('id="bonusEditor"'));assert.ok(!html.includes('<dialog id="bonusDialog"'));assert.ok(html.includes('id="bonusAgentSearchForm"'));assert.ok(html.includes('data-bonus-kind="promotion"'));assert.ok(html.includes('id="bonusAmount" type="text" inputmode="decimal"'));
console.log('Bonus delivery UI: Spanish/pasted amounts, decimal precision, inline agent search form and promotion tab: PASS');
