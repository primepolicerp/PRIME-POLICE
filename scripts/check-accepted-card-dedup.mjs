import assert from 'node:assert/strict';
import {acceptedCards,acceptedMessageUnchanged} from '../supabase/functions/prime-police-panel/public-accepted.ts';
const payload=acceptedCards([{discord_user_id:'111111111111111111',full_name:'Agente ejemplo'}],0)[0];
const old=structuredClone(payload);old.id='message';old.embeds[0].type='rich';old.embeds[0].fields=old.embeds[0].fields.map(f=>({...f,inline:false}));assert.equal(acceptedMessageUnchanged(old,payload),true,'Discord-added metadata does not trigger a redundant edit');
for(const field of ['title','description','color']){const changed=structuredClone(old);changed.embeds[0][field]=field==='color'?0:'Changed';assert.equal(acceptedMessageUnchanged(changed,payload),false,field);}
const changed=structuredClone(old);changed.embeds[0].fields[0].value='Updated next step';assert.equal(acceptedMessageUnchanged(changed,payload),false);const image=structuredClone(old);image.embeds[0].image={url:'https://example.com/test.png'};assert.equal(acceptedMessageUnchanged(image,payload),false);assert.equal(acceptedMessageUnchanged({},payload),false);
console.log('Accepted card deduplication: unchanged authored content skips edits, changed cards remain updatable and unexpected media is not ignored: PASS');
