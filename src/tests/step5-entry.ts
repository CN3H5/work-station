import {app,dialog,BrowserWindow,powerMonitor} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {startApplication} from '../main/application';
import {prepareDataRoot,rejectLinks} from '../main/data-root';
import {OrdinaryStore} from '../main/ordinary-store';
import {hash} from '../main/ordinary-model';
const base=process.env.WORKSTATION_TEST_BASE??'',id=process.env.WORKSTATION_TEST_ID??'',suite=process.env.WORKSTATION_TEST_SUITE??'';
if(path.resolve(base)!==path.resolve('.test-runs',id)||!/^[-a-f0-9]{36}$/.test(id)||fs.readFileSync(path.join(base,'.test-owned'),'utf8')!==id)throw Error('INVALID_TEST_ROOT');rejectLinks(base);
const root=path.join(base,'data');
// Configure all Chromium roots synchronously before fixture seeding can yield.
prepareDataRoot(root);fs.mkdirSync(path.join(root,'runtime'),{recursive:true});app.setPath('userData',root);app.setPath('sessionData',path.join(root,'runtime'));app.setPath('logs',path.join(root,'runtime/logs'));
const results:{name:string;status:'passed'|'failed';detail?:string}[]=[];
const delay=(ms:number):Promise<void>=>new Promise(r=>setTimeout(r,ms));
const until=async(fn:()=>Promise<boolean>):Promise<void>=>{for(let i=0;i<100;i++){if(await fn())return;await delay(30);}throw Error('CONDITION_TIMEOUT');};
async function check(name:string,fn:()=>Promise<void>):Promise<void>{try{await fn();results.push({name,status:'passed'});console.log('PASS',name);}catch(e){results.push({name,status:'failed',detail:String(e)});console.error('FAIL',name,e);}}
const responses:number[]=[];const shown:string[]=[];
// Dialog responses are injected for automation only; native operator evidence is separate.
Object.defineProperty(dialog,'showMessageBox',{value:async(...args:unknown[])=>{const option=args.find(x=>x&&typeof x==='object'&&'message' in x) as {message:string};shown.push(option.message);return {response:responses.shift()??1,checkboxChecked:false};}});
void(async()=>{
 if(suite==='step5-recovery'||suite==='step5-future'){
  const seed=new OrdinaryStore(root);await seed.open();await seed.savePreference({baseRevision:0,clientMutationId:randomUUID(),privacyNotification:false});
  const filename=path.join(root,'ordinary/current.json');const doc=JSON.parse(fs.readFileSync(filename,'utf8'));fs.writeFileSync(filename,suite==='step5-future'?JSON.stringify({...doc,schemaVersion:99}):'{fictional corruption');
  fs.writeFileSync(path.join(root,'runtime/ui-state.json'),'{bad prompt flags');
 }
 let breakSnapshots=false;let day=1;
 const running=await startApplication({root,mode:'test',testTrayFailure:suite==='step5-tray-failure',storeOptions:{now:()=>new Date(`2026-11-${String(day).padStart(2,'0')}T00:00:00.000Z`),snapshotFault:()=>{if(breakSnapshots)throw Error('fictional snapshot failure');}}});if(!running)throw Error('NO_INSTANCE');
 const win=running.window,wc=win.webContents;
 const js=<T=unknown>(s:string):Promise<T>=>wc.executeJavaScript('{'+s+'}');
 const desktop=async(action:string):Promise<any>=>js(`window.workStation.desktop(${action})`);
 await delay(300);await js('document.querySelector("dialog")?.close()');await delay(100);
 await js('window.__desktopEvents=[];window.__unsubscribe=window.workStation.onDesktopEvent(e=>window.__desktopEvents.push(e));void 0');
 if(suite==='step5-tray-failure'){
  await check('tray failure leaves a visible recoverable window',async()=>{assert.match((await desktop('{action:"settings"}')).data.trayError,/托盘创建失败/);win.close();await delay(100);assert.equal(win.isVisible(),true);assert.equal(shown.at(-1),'无法进入托盘');});
  await check('tray failure still permits local navigation and settings',async()=>{await js('document.querySelector("[data-target=settings]").click()');assert.equal(await js('document.querySelector("h1").textContent'),'设置');assert.equal((await desktop('{action:"settings"}')).data.readOnly,false);});
 }else if(suite==='step5-recovery'||suite==='step5-future'){
  const original=fs.readFileSync(path.join(root,'ordinary/current.json'),'utf8');
  await check('recovery UI disables settings but retains navigation and candidates',async()=>{
   assert.equal((await desktop('{action:"settings"}')).data.readOnly,true);await js('document.querySelector("[data-target=appearance]").click()');assert.equal(await js('Array.from(document.querySelectorAll("[data-page=appearance] select")).every(x=>x.disabled)'),true);
   await js('document.querySelector("[data-target=data]").click();document.querySelector("#snapshots-refresh").click()');await until(()=>js('document.querySelectorAll("#snapshots li").length>0'));assert.match(await js('document.querySelector("#storage-warning").textContent'),/只读恢复/);
  });
  await check('ordinary writes and autostart remain rejected without changing damaged bytes',async()=>{assert.equal((await desktop('{action:"save",key:"mode",value:"dark",baseRevision:0,clientMutationId:crypto.randomUUID()}')).ok,false);assert.equal((await desktop('{action:"launch",value:true}')).ok,false);assert.equal(fs.readFileSync(path.join(root,'ordinary/current.json'),'utf8'),original);});
  await check('prompt corruption resets only UI flags and guide can be seen again',async()=>{assert.equal((await desktop('{action:"settings"}')).data.closeSeen,false);assert.equal(fs.readFileSync(path.join(root,'ordinary/current.json'),'utf8'),original);assert.equal(fs.existsSync(path.join(root,'ordinary/previous.json')),true);});
  await check(suite==='step5-future'?'future schema cannot be downgraded by restore':'verified previous can restore corrupted ordinary data',async()=>{const list:any=await js('window.workStation.storage({action:"snapshots"})');const candidate=list.data.find((x:any)=>x.valid);assert.ok(candidate);const state:any=await js('window.workStation.storage({action:"state"})');const restored:any=await js(`window.workStation.storage({action:'restore',id:'${candidate.id}',baseRevision:${state.revision},confirmed:true})`);assert.equal(restored.ok,suite!=='step5-future');if(suite==='step5-future')assert.equal(fs.readFileSync(path.join(root,'ordinary/current.json'),'utf8'),original);else{await until(async()=>!(await desktop('{action:"settings"}')).data.readOnly);assert.equal((await desktop('{action:"reminderState"}')).data.readOnly,false);}});
 }else{
  await check('reminder query exposes only controlled status',async()=>{const r=await desktop('{action:"reminderState"}');assert.deepEqual(Object.keys(r.data).sort(),['paused','readOnly','revision','scheduler']);assert.equal(r.data.scheduler,'not-implemented');assert.equal(r.data.paused,false);});
  await check('first close cancellation stays visible without marking seen',async()=>{responses.push(0);win.close();await delay(100);assert.equal(win.isVisible(),true);assert.equal((await desktop('{action:"settings"}')).data.closeSeen,false);});
  await check('confirmed close flushes and hides into a live tray',async()=>{responses.push(1);win.close();await until(async()=>!win.isVisible());assert.ok(running.inspectDesktop?.().tray&&!running.inspectDesktop().tray!.isDestroyed());assert.equal((await desktop('{action:"settings"}')).data.closeSeen,true);assert.equal(BrowserWindow.getAllWindows().length,1);});
  await check('actual tray double-click handler restores minimized same window',async()=>{win.minimize();running.inspectDesktop!().tray!.emit('double-click');await until(async()=>win.isVisible()&&!win.isMinimized());assert.equal(BrowserWindow.getAllWindows().length,1);});
  await check('tray menu pause and resume synchronize renderer and revision',async()=>{for(const paused of [true,false]){const item=running.inspectDesktop!().menu!.items[1]!;item.click(item,win,{} as Electron.KeyboardEvent);await until(async()=>(await desktop('{action:"reminderState"}')).data.paused===paused);await until(()=>js(`document.querySelector('[data-page=settings] select').value==='${paused}'`));assert.match(running.inspectDesktop!().menu!.items[1]!.label,paused?/恢复/:/暂停/);}});
  await check('lock contract covers minimize hide and synthetic screen-lock without claiming vault lock',async()=>{win.hide();win.show();powerMonitor.emit('lock-screen');const events:any[]=await js('window.__desktopEvents');for(const reason of ['hide','minimize','screen-lock'])assert.ok(events.some(e=>e.kind==='lock-request'&&e.reason===reason));assert.ok(events.filter(e=>e.kind==='lock-request').every(e=>Number.isSafeInteger(e.sequence)));});
  await check('unsubscribe removes callback without exposing arbitrary IPC',async()=>{const before=await js<number>('window.__desktopEvents.length');await js('window.__unsubscribe()');powerMonitor.emit('lock-screen');await delay(50);assert.equal(await js('window.__desktopEvents.length'),before);});
  await check('dirty settings conflict cannot be cleared by a passive refresh',async()=>{
   await js(`document.querySelector('[data-target=settings]').click();const h=document.querySelector('input[aria-label="未来快速记录快捷键候选"]');h.value='Ctrl+Alt+N';h.dispatchEvent(new Event('input'))`);
   const r=await desktop('{action:"settings"}');assert.equal((await desktop(`{action:'save',key:'mode',value:'dark',baseRevision:${r.revision},clientMutationId:crypto.randomUUID()}`)).ok,true);
   await delay(100);await js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='保存设置 / 重试').click()`);await until(()=>js('document.querySelector("#error").textContent.includes("冲突")'));
   assert.equal((await desktop('{action:"settings"}')).data.hotkey,'');
   await js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.startsWith('重新读取并核对')).click()`);await until(()=>js('Boolean(document.querySelector("dialog"))'));await js(`Array.from(document.querySelector('dialog').querySelectorAll('button')).at(-1).click()`);await until(()=>js('document.querySelector("#desktop-state").textContent.includes("已核对")'));
   await js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='保存设置 / 重试').click()`);await until(async()=>(await desktop('{action:"settings"}')).data.hotkey==='Ctrl+Alt+N');assert.equal(await js('document.querySelector("#error").textContent'),'');
  });
  await check('committed settings expose snapshot failure and retry clears warning',async()=>{
   day=2;breakSnapshots=true;const r=await desktop('{action:"settings"}');const saved=await desktop(`{action:'save',key:'fontScale',value:1.25,baseRevision:${r.revision},clientMutationId:crypto.randomUUID()}`);assert.equal(saved.ok,true);
   await until(()=>js('document.querySelector("#storage-warning").textContent.includes("快照未生成")'));
   breakSnapshots=false;await js('document.querySelector("#snapshot-retry").click()');await until(()=>js('!document.querySelector("#storage-warning").textContent.includes("快照未生成")'));
  });

 }
 const {sourceHash}=await import(require('node:url').pathToFileURL(path.resolve('scripts/source-hash.mjs')).href);
 fs.writeFileSync(path.join(base,'report.json'),JSON.stringify({createdAt:new Date().toISOString(),sourceSha256:await sourceHash(),suite,results,limits:['Menu handlers invoked programmatically; dialog responses injected for automation.','Synthetic screen-lock exercises the event contract only; no vault or physical lock test.']},null,2));
 win.destroy();running.inspectDesktop?.().tray?.destroy();app.exit(results.some(r=>r.status!=='passed')?1:0);
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(base,'fatal.txt'),String(e));app.exit(1);});
