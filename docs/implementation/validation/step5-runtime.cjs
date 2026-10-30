// Run with Electron from the workspace root, using a fresh owned WORKSTATION_ACCEPT_BASE.
const {app,nativeTheme,screen}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {startApplication}=require(path.resolve('dist/main/application.js'));
const base=process.env.WORKSTATION_ACCEPT_BASE;
if(!base||path.dirname(base)!==path.resolve('.test-runs')||fs.readFileSync(path.join(base,'.test-owned'),'utf8')!==path.basename(base))throw Error('INVALID_TEST_ROOT');
const results=[];const delay=ms=>new Promise(r=>setTimeout(r,ms));let slow=false;let sha;
function report(){fs.writeFileSync(path.join(base,'acceptance.json'),JSON.stringify({status:results.some(x=>x.status!=='passed')?'failed':'passed',createdAt:new Date().toISOString(),sourceSha256:sha,environment:{os:require('node:os').version(),displayScale:screen.getPrimaryDisplay().scaleFactor,workArea:screen.getPrimaryDisplay().workAreaSize},method:'Actual Electron APIs and Chromium input events; not native Windows operator evidence',results,limits:['Controlled 11-second async storage fault barrier, not physical slow disk.','Renderer zoom is not Windows display scaling. CSS media override emulates OS motion preference, not an OS settings change.','No tray menu or physical lock-screen input.']},null,2));}
async function check(name,fn){try{await fn();results.push({name,status:'passed'});console.log('PASS',name);}catch(e){results.push({name,status:'failed',detail:String(e)});console.error('FAIL',name,e);}}
void(async()=>{
sha=process.env.WORKSTATION_ACCEPT_SHA;if(!/^[a-f0-9]{64}$/.test(sha??''))throw Error('INVALID_SOURCE_HASH');
const running=await startApplication({root:path.join(base,'data'),mode:'test',storeOptions:{fault:async stage=>{if(slow&&stage==='new')await delay(11000);}}});if(!running)throw Error('NO_INSTANCE');
assert.equal(app.getPath('userData'),path.join(base,'data'));assert.equal(app.getPath('sessionData'),path.join(base,'data/runtime'));const win=running.window,wc=win.webContents;const js=s=>wc.executeJavaScript('{'+s+'}');await delay(500);
await js('document.querySelector("dialog")?.close()');await delay(100);
win.show();win.focus();wc.focus();await delay(200);
await check('nine pages reachable using Chromium Tab and Enter',async()=>{
 await js('document.querySelector("[data-target=home]").focus()');
 for(const key of ['home','notes','ddl','memos','vault','schedule','appearance','data','settings']){
 wc.sendInputEvent({type:'keyDown',keyCode:'Return'});wc.sendInputEvent({type:'char',keyCode:'\r'});wc.sendInputEvent({type:'keyUp',keyCode:'Return'});await delay(100);console.log('NAV',key,await js('({target:document.activeElement.dataset.target,key:document.activeElement.tagName})'));
 assert.equal(await js('document.querySelector("[aria-current=page]").dataset.target'),key);
 wc.sendInputEvent({type:'keyDown',keyCode:'Tab'});wc.sendInputEvent({type:'keyUp',keyCode:'Tab'});await delay(20);
 }
});
await check('candidate draft survives page switches and settings reload',async()=>{
 await js(`document.querySelector('[data-target=settings]').click();const h=document.querySelector('input[aria-label="未来快速记录快捷键候选"]');h.value='Ctrl+Alt+N';h.dispatchEvent(new Event('input'));document.querySelector('[data-target=home]').click();document.querySelector('[data-target=settings]').click();Array.from(document.querySelectorAll('button')).find(b=>b.textContent.startsWith('重新读取并核对')).click()`);
 await delay(100);await js('document.querySelector("dialog")?.close("no")');assert.equal(await js('document.querySelector("input[aria-label=未来快速记录快捷键候选]").value'),'Ctrl+Alt+N');
});
await check('theme system preference follows nativeTheme updates',async()=>{
 nativeTheme.themeSource='dark';await delay(150);assert.equal(await js('document.documentElement.dataset.theme'),'dark');nativeTheme.themeSource='light';await delay(150);assert.equal(await js('document.documentElement.dataset.theme'),'light');nativeTheme.themeSource='system';
});
await check('100 125 150 percent fonts and 100 125 150 200 renderer zoom fit navigation',async()=>{
 await js(`document.querySelector('[data-target=appearance]').click()`);
 for(const font of [1,1.25,1.5])for(const zoom of [1,1.25,1.5,2]){
  wc.setZoomFactor(zoom);await js(`const c=document.querySelector('[data-page=appearance] select:nth-of-type(1)');const selects=document.querySelectorAll('[data-page=appearance] select');selects[1].value='${font}';selects[1].dispatchEvent(new Event('change'))`);await delay(40);
  assert.equal(await js('getComputedStyle(document.documentElement).fontSize'),`${16*font}px`);
  assert.equal(await js('document.querySelectorAll("[data-target]").length'),9);
  assert.equal(await js('document.documentElement.scrollWidth<=innerWidth+1'),true);
 }
 wc.setZoomFactor(1);
});
await check('long Chinese error remains focusable and wraps',async()=>{
 await js(`const e=document.querySelector('#error');e.textContent='虚构的长中文错误信息'.repeat(100);e.focus()`);
 assert.equal(await js('document.activeElement.id'),'error');assert.equal(await js('document.documentElement.scrollWidth<=innerWidth+1'),true);
 await js(`document.querySelector('#error').textContent=''`);
});
await check('system reduced motion media updates without persisting system state',async()=>{
 await js(`const c=document.querySelectorAll('[data-page=appearance] select')[2];c.value='false';c.dispatchEvent(new Event('change'))`);
 wc.debugger.attach('1.3');try{
  for(const value of ['reduce','no-preference']){await wc.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value}]});await delay(80);assert.equal(await js('document.documentElement.dataset.motion'),String(value==='reduce'));}
  assert.equal((await js('window.workStation.desktop({action:"settings"})')).data.reduceMotion,false);
 }finally{wc.debugger.detach();}
});
await check('small viewport retains scroll access without horizontal overflow',async()=>{
 win.setMinimumSize(400,400);win.setSize(640,480);await delay(100);assert.equal(await js('document.documentElement.scrollWidth<=innerWidth+1'),true);assert.equal(await js('document.querySelectorAll("[data-target]").length'),9);win.setSize(1080,740);
});
await check('reduce motion explicit preference applies',async()=>{await js(`const c=document.querySelectorAll('[data-page=appearance] select')[2];c.value='true';c.dispatchEvent(new Event('change'))`);assert.equal(await js('document.documentElement.dataset.motion'),'true');});
// Genuine quit IPC -> main flush request -> renderer settings save -> delayed store transaction.
await js(`document.querySelector('[data-target=settings]').click()`);slow=true;
const before=Date.now();app.once('will-quit',()=>{try{const doc=JSON.parse(fs.readFileSync(path.join(base,'data/ordinary/current.json'),'utf8'));assert.equal(doc.payload.business.preferences.hotkey,'Ctrl+Alt+N');assert.ok(Date.now()-before>=11000);results.push({name:'quit waits beyond ten seconds and commits actual draft',status:'passed',elapsedMs:Date.now()-before});}catch(e){results.push({name:'quit waits beyond ten seconds and commits actual draft',status:'failed',detail:String(e)});}report();if(results.some(x=>x.status!=='passed'))process.exitCode=1;});
await js('window.workStation.desktop({action:"quit"})');await delay(10500);
await check('at ten seconds window stays visible and renderer reports saving',async()=>{assert.equal(win.isVisible(),true);assert.match(await js('document.querySelector("#desktop-state").textContent'),/保存中/);});
})().catch(e=>{results.push({name:'runner',status:'failed',detail:String(e)});report();app.exit(1);});
