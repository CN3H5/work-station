import { app, BrowserWindow, session, net } from 'electron';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startApplication } from '../main/application';
import { rejectLinks, productionRoot } from '../main/data-root';
const base = process.env.WORKSTATION_TEST_BASE ?? '';
const id = process.env.WORKSTATION_TEST_ID ?? '';
if (!/^[0-9a-f-]{36}$/.test(id) || path.resolve(base) !== path.resolve('.test-runs', id) || fs.readFileSync(path.join(base, '.test-owned'), 'utf8') !== id) throw new Error('INVALID_TEST_ROOT');
rejectLinks(base);
const root = path.join(base, 'data');
if (root === productionRoot(process.env.LOCALAPPDATA)) throw new Error('FORMAL_ROOT_FORBIDDEN');
const results: Array<{ name: string; status: 'passed' | 'failed'; detail?: string }> = [];
async function check(name: string, action: () => Promise<void> | void): Promise<void> {
  try { await action(); results.push({ name, status: 'passed' }); console.log('PASS', name); }
  catch (error) { results.push({ name, status: 'failed', detail: String(error) }); console.error('FAIL', name, String(error)); }
}
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
void (async () => {
  const running = await startApplication({ root, mode: 'test' });
  if (!running) return;
  const win = running.window;
  const wc = win.webContents;
  await delay(500);
  await check('production document and local resources load', async () => {
    assert.equal(wc.getURL(), 'app://workstation/index.html');
    assert.match(await wc.executeJavaScript('document.querySelector("#status").textContent'), /本地连接正常/);
    assert.equal(await wc.executeJavaScript('document.querySelector("header img").naturalWidth > 0'), true);
  });
  await check('normal health IPC returns DTO without paths', async () => {
    const value = await wc.executeJavaScript('window.workStation.getHealth({})');
    assert.equal(value.ok, true); assert.equal(value.data.version, '1.0.0'); assert.deepEqual(Object.keys(value.data).sort(), ['mode', 'product', 'stage', 'version']);
  });
  await check('malformed arguments rejected by actual IPC', async () => {
    for (const expression of ['null', '[]', '"x"', '{extra:1}', 'JSON.parse(\'{"__proto__":1}\')', '{constructor:"x"}']) {
      const value = await wc.executeJavaScript(`window.workStation.getHealth(${expression})`);
      assert.equal(value.code, 'VALIDATION');
    }
  });
  await check('renderer cannot access Node filesystem or generic IPC', async () => {
    const value = await wc.executeJavaScript('({require:typeof require, process:typeof process, bridge:Object.keys(window.workStation)})');
    assert.equal(value.require, 'undefined'); assert.equal(value.process, 'undefined'); assert.deepEqual(value.bridge, ['getHealth']);
  });
  await check('untrusted window cannot call health capability', async () => {
    const rogue = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true, nodeIntegration: false } });
    try { await rogue.loadURL('app://workstation/index.html'); const response = await rogue.webContents.executeJavaScript('window.workStation.getHealth({})'); assert.equal(response.code, 'UNAUTHORIZED'); }
    finally { rogue.destroy(); }
  });
  await check('window.open is denied', async () => {
    const count = BrowserWindow.getAllWindows().length;
    assert.equal(await wc.executeJavaScript('window.open("https://example.invalid/") === null'), true);
    await delay(150); assert.equal(BrowserWindow.getAllWindows().length, count);
  });
  await check('external top frame navigation is denied', async () => {
    await wc.executeJavaScript('window.location.href="https://example.invalid/"; true');
    await delay(200); assert.equal(wc.getURL(), running.documentURL);
  });
  await check('production devtools remain disabled even through main API', async () => {
    wc.openDevTools(); await delay(150); assert.equal(wc.isDevToolsOpened(), false);
  });
  await check('resource protocol rejects unknown paths and traversal', async () => {
    for (const url of ['app://workstation/owner.json', 'app://workstation/%2e%2e/owner.json', 'app://workstation/C:/Windows/win.ini', 'app://workstation/index.html?x']) { const response = await net.fetch(url); assert.equal(response.status, 404); }
  });
  await check('CSP blocks inline script and network fetch', async () => {
    assert.equal(await wc.executeJavaScript('new Promise(resolve=>{const s=document.createElement("script");s.textContent="window.__inlineRan=true";document.body.append(s);setTimeout(()=>resolve(window.__inlineRan===undefined),50)})'), true);
    assert.equal(await wc.executeJavaScript('fetch("https://example.invalid/").then(()=>false,()=>true)'), true);
  });
  await check('permission requests reject notifications and location', async () => {
    assert.equal(await wc.executeJavaScript('Notification.requestPermission()'), 'denied');
    assert.equal(await wc.executeJavaScript('new Promise(resolve=>navigator.geolocation.getCurrentPosition(()=>resolve(false),error=>resolve(error.code===1),{timeout:2000}))'), true);
  });
  await check('second process wakes original and exits', async () => {
    win.minimize();
    const child = spawn(process.execPath, [__filename, '--fictional-path=C:/forbidden'], { env: process.env, stdio: 'ignore' });
    const code = await new Promise<number | null>((resolve, reject) => { const timeout = setTimeout(() => { child.kill(); reject(new Error('SECOND_INSTANCE_TIMEOUT')); }, 12000); child.once('exit', value => { clearTimeout(timeout); resolve(value); }); });
    await delay(300); assert.equal(code, 0); assert.equal(running.secondInstances(), 1); assert.equal(win.isMinimized(), false); assert.equal(BrowserWindow.getAllWindows().length, 1);
  });
  await check('renderer resources work with Chromium offline emulation', async () => {
    session.defaultSession.enableNetworkEmulation({ offline: true });
    await wc.reload(); await delay(500);
    assert.match(await wc.executeJavaScript('document.querySelector("#status").textContent'), /本地连接正常/);
    session.defaultSession.disableNetworkEmulation();
  });
  await check('all Chromium data paths stay in this test root', () => {
    assert.equal(app.getPath('userData'), root); assert.equal(app.getPath('sessionData'), path.join(root, 'runtime'));
    assert.equal(fs.existsSync(path.join(root, 'owner.json')), true);
  });
  fs.writeFileSync(path.join(base, 'report.json'), JSON.stringify({ createdAt: new Date().toISOString(), runtime: process.versions, platform: process.platform, rootKind: 'isolated-test', results }, null, 2));
  win.destroy(); app.exit(results.some(result => result.status === 'failed') ? 1 : 0);
})().catch(error => { console.error(error); app.exit(1); });
