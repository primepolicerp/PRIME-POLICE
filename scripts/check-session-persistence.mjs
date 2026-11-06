import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('app.js','utf8');
const helpers=source.slice(source.indexOf('const TOKEN_KEY'),source.indexOf('let applications'));
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
const key='primePolicePanelSession',local=storage();
function openTab(session=storage(),persistent=local){const context=vm.createContext({localStorage:persistent,sessionStorage:session});vm.runInContext(helpers,context);return {context,session,read:()=>vm.runInContext('token',context),run:code=>vm.runInContext(code,context)};}
const first=openTab();assert.equal(first.read(),'');first.run("savePanelSession('test-session')");
const reopened=openTab();assert.equal(reopened.read(),'test-session','Closing the tab must not lose the session');
reopened.run('clearPanelSession()');assert.equal(openTab().read(),'','Logout must clear persistent sessions');
const legacy=storage();legacy.setItem(key,'legacy-session');assert.equal(openTab(legacy).read(),'legacy-session');assert.equal(legacy.getItem(key),null);assert.equal(openTab().read(),'legacy-session','Existing tab sessions must migrate without a new login');
const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
const fallback=openTab(storage(),blocked);fallback.run("savePanelSession('fallback-session')");assert.equal(openTab(fallback.session,blocked).read(),'fallback-session');fallback.run('clearPanelSession()');assert.equal(fallback.session.getItem(key),null);
assert.equal(openTab(blocked,blocked).read(),'','Unavailable storage must not crash startup');
assert(source.includes('savePanelSession(token)'));assert(source.includes('clearPanelSession();'));assert(!source.includes('sessionStorage.setItem(TOKEN_KEY, token)'));
console.log('Session persistence: reopened tabs, explicit logout, existing-session migration and unavailable-storage fallback: PASS');
