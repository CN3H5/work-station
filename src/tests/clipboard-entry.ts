import { app, clipboard } from 'electron';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { rejectLinks } from '../main/data-root';
const base = process.env.WORKSTATION_TEST_BASE ?? '';
const id = process.env.WORKSTATION_TEST_ID ?? '';
if (!/^[0-9a-f-]{36}$/.test(id) || path.resolve(base) !== path.resolve('.test-runs',id) || fs.readFileSync(path.join(base,'.test-owned'),'utf8') !== id) throw new Error('INVALID_TEST_ROOT');
rejectLinks(base);
fs.mkdirSync(path.join(base,'data'));
app.setPath('userData',path.join(base,'data'));
app.setPath('sessionData',path.join(base,'data'));
type Result = { status: string; generation: number; sequence: number };
const adapter = require(path.resolve('native/build/clipboard.node')) as { copySecret: (value: string) => Result; clearIfUnchanged: (generation: number) => Result };
const peer = path.resolve('native/build/clipboard-peer.exe');
const results: Array<{ name: string; status: string; detail?: string }> = [];
async function check(name: string, action: () => void | Promise<void>): Promise<void> {
  try { await action(); results.push({name,status:'passed'}); console.log('PASS',name); }
  catch(error) { results.push({name,status:'failed',detail:String(error)}); console.error('FAIL',name,String(error)); }
}
void app.whenReady().then(async () => {
  const fictional = 'FICTIONAL-WORKSTATION-CLIPBOARD';
  const copyFictional = async (text: string): Promise<Result> => {
    for (let attempt = 0; attempt < 5; attempt++) { const result = adapter.copySecret(text); if (result.status !== 'busy') return result; await new Promise(resolve => setTimeout(resolve, 100)); }
    throw new Error('CLIPBOARD_BUSY_AFTER_5_ATTEMPTS');
  };
  const clearFictional = async (generation: number): Promise<Result> => {
    for (let attempt = 0; attempt < 5; attempt++) { const result = adapter.clearIfUnchanged(generation); if (result.status !== 'busy') return result; await new Promise(resolve => setTimeout(resolve, 100)); }
    throw new Error('CLIPBOARD_BUSY_AFTER_5_ATTEMPTS');
  };
  await check('native Node-API module loads in Electron and clears unchanged copy', async () => {
    const copy = await copyFictional(fictional); assert.equal(copy.status,'copied'); assert.ok(copy.sequence > 0);
    assert.equal(await clipboard.readText(),fictional); const cleared = await clearFictional(copy.generation); assert.equal(cleared.status,'cleared'); assert.equal(await clipboard.readText(),'');
  });
  await check('another process copying identical text is preserved', async () => {
    const copy = await copyFictional(fictional); assert.equal(copy.status,'copied');
    const child = spawn(peer,[],{windowsHide:true});
    const exit = await new Promise(resolve => child.once('exit',resolve)); assert.equal(exit,0);
    assert.equal((await clearFictional(copy.generation)).status,'replaced'); assert.equal(await clipboard.readText(),fictional);
  });
  await check('old timer cannot clear a newer copy', async () => {
    const first=await copyFictional(fictional); const second=await copyFictional('FICTIONAL-NEW-COPY');
    assert.equal(adapter.clearIfUnchanged(first.generation).status,'stale'); assert.equal(await clipboard.readText(),'FICTIONAL-NEW-COPY');
    assert.equal((await clearFictional(second.generation)).status,'cleared');
  });
  await check('busy clipboard returns busy without claiming success; bounded retry clears', async () => {
    const copy=await copyFictional(fictional);
    const child=spawn(peer,['hold'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    await new Promise<void>((resolve,reject) => { child.stdout.once('data',()=>resolve()); child.once('error',reject); child.once('exit',code=>{if(code)reject(new Error('PEER_LOCK_FAILED'));}); });
    assert.equal(adapter.clearIfUnchanged(copy.generation).status,'busy');
    await new Promise(resolve=>child.once('exit',resolve));
    assert.equal((await clearFictional(copy.generation)).status,'cleared');
  });
  await check('invalid inputs are rejected', () => {
    assert.throws(()=>adapter.copySecret(''),/INVALID_SECRET/);
    for (const value of [NaN,Infinity,-1,1.5]) assert.throws(()=>adapter.clearIfUnchanged(value),/INVALID_GENERATION/);
  });
  fs.writeFileSync(path.join(base,'report.json'),JSON.stringify({createdAt:new Date().toISOString(),runtime:process.versions,fixture:'fictional strings only',results},null,2));
  app.exit(results.some(x=>x.status==='failed')?1:0);
}).catch(error=>{console.error(error);app.exit(1);});
