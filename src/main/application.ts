import { app, BrowserWindow, ipcMain, Menu, protocol, session, screen, dialog } from 'electron';
import { randomUUID } from 'node:crypto';
import { OrdinaryStore } from './ordinary-store';
import { keys } from './ordinary-model';
import fs from 'node:fs';
import path from 'node:path';
import { HEALTH_CHANNEL, authorized, validHealthRequest, type HealthResult } from '../shared/contract';
import { prepareDataRoot, acquireRootLock, rejectLinks } from './data-root';
import { CSP, resourceResponse, type ResourceManifest } from './resources';
const productVersion = (JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')) as { version: string }).version;
export interface ApplicationConfig { root: string; mode: 'production' | 'development' | 'test' | 'preview'; devURL?: string; beforeWindow?: () => Promise<void> }
export interface RunningApplication { window: BrowserWindow; documentURL: string; secondInstances: () => number }
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
app.commandLine.appendSwitch('disable-spell-checking');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('lang', 'zh-CN');
export async function startApplication(config: ApplicationConfig): Promise<RunningApplication | null> {
  if (config.mode !== 'development') for (const name of ['remote-debugging-port', 'remote-debugging-pipe', 'inspect', 'inspect-brk']) app.commandLine.removeSwitch(name);
  if (config.devURL && (app.isPackaged || config.mode !== 'development' || config.devURL !== 'http://127.0.0.1:5173/')) throw new Error('INVALID_DEV_SERVER');
  app.setName('Work Station');
  app.setAppUserModelId('cn.workstation.desktop');
  prepareDataRoot(config.root);
  app.setPath('userData', config.root);
  // Lock before creating Chromium session files; second instances never write runtime data.
  if (!app.requestSingleInstanceLock()) { app.quit(); return null; }
  const releaseLock = acquireRootLock(config.root);
  app.once('will-quit', releaseLock);
  const runtime = path.join(config.root, 'runtime');
  rejectLinks(runtime);
  fs.mkdirSync(runtime, { recursive: true });
  app.setPath('sessionData', runtime);
  app.setPath('logs', path.join(runtime, 'logs'));
  let window: BrowserWindow | null = null;
  let secondCount = 0;
  app.on('second-instance', () => { secondCount++; if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.on('window-all-closed', () => app.quit());
  await app.whenReady();
  const store = new OrdinaryStore(config.root);
  await store.open();
  Menu.setApplicationMenu(null);
  const appSession = session.defaultSession;
  appSession.setSpellCheckerLanguages([]);
  appSession.setSpellCheckerEnabled(false);
  appSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  appSession.setPermissionCheckHandler(() => false);
  appSession.setDevicePermissionHandler(() => false);
  appSession.setDisplayMediaRequestHandler((_request, callback) => callback({}));
  appSession.on('will-download', event => event.preventDefault());
  const rendererRoot = path.join(__dirname, '../renderer');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../resources.json'), 'utf8')) as ResourceManifest;
  await appSession.protocol.handle('app', request => resourceResponse(request.url, request.method, rendererRoot, manifest));
  appSession.webRequest.onBeforeRequest((details, callback) => {
    const u = new URL(details.url);
    const devAllowed = config.mode === 'development' && (u.protocol === 'http:' || u.protocol === 'ws:') && u.hostname === '127.0.0.1' && u.port === '5173';
    callback({ cancel: !devAllowed && u.protocol !== 'app:' && u.protocol !== 'devtools:' });
  });
  if (config.devURL) appSession.webRequest.onHeadersReceived((details, callback) => callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [CSP.replace("connect-src 'none'", "connect-src http://127.0.0.1:5173 ws://127.0.0.1:5173")] } }));
  await config.beforeWindow?.();
  const area = screen.getPrimaryDisplay().workAreaSize;
  window = new BrowserWindow({
    title: 'Work Station', width: Math.min(1080, area.width), height: Math.min(740, area.height),
    minWidth: Math.min(960, area.width), minHeight: Math.min(640, area.height), show: false,
    backgroundColor: '#f4f5f0', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, '../preload/index.js'), nodeIntegration: false,
      contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false,
      devTools: config.mode === 'development', navigateOnDragDrop: false, spellcheck: false }
  });
  const documentURL = config.devURL ?? 'app://workstation/index.html';
  const contents = window.webContents;
  ipcMain.handle('workstation:storage', async (event, request: unknown) => {
    if (!authorized({senderId:event.sender.id,frameIsMain:event.senderFrame===contents.mainFrame,frameURL:event.senderFrame?.url??''},contents.id,documentURL))return {ok:false,code:'UNAUTHORIZED',userMessage:'此窗口没有调用权限。',retryable:false};
    try {
      if (!request || typeof request!=='object') throw new Error();
      const r=request as Record<string,unknown>;
      if(r.action==='state') {keys(r,['action']);return {ok:true,data:store.state(),revision:store.state().revision};}
      if(r.action==='savePreference') { keys(r,['action','baseRevision','clientMutationId','privacyNotification']); const {action,...input}=r;return await store.savePreference(input); }
      if(r.action==='snapshots') {keys(r,['action']);return {ok:true,data:await store.recoveryCandidates(),revision:store.state().revision};}
      if(r.action==='retrySnapshot') {keys(r,['action']);return await store.retrySnapshot();}
      if(r.action==='restore') {keys(r,['action','id','baseRevision','confirmed']); if(typeof r.id!=='string'||!Number.isSafeInteger(r.baseRevision)||r.confirmed!==true)throw new Error();return await store.restore(r.id,Number(r.baseRevision),true);}
      throw new Error();
    } catch {return {ok:false,code:'VALIDATION',userMessage:'请求参数无效。',retryable:false};}
  });
  let closing=false; let waiting=false;
  const flushBeforeClose=async ():Promise<void>=>{
    if(waiting)return;waiting=true;
    const token=randomUUID();
    const ok=await new Promise<boolean>(resolve=>{const timeout=setTimeout(()=>{ipcMain.removeListener('workstation:flushed',listener);resolve(false);},10000);const listener=(event:Electron.IpcMainEvent,r:unknown):void=>{if(event.sender!==contents||event.senderFrame!==contents.mainFrame)return;try{keys(r,['token','ok']);if(r.token!==token||typeof r.ok!=='boolean')return;clearTimeout(timeout);ipcMain.removeListener('workstation:flushed',listener);resolve(r.ok);}catch{}};ipcMain.on('workstation:flushed',listener);contents.send('workstation:flush',token);});
    await store.flush();waiting=false;
    if(ok){closing=true;app.quit();return;}
    const choice=await dialog.showMessageBox(window!,{type:'warning',message:'保存未完成',detail:'可重试保存、返回应用保留编辑，或确认放弃尚未保存的编辑并退出。',buttons:['重试','返回应用','放弃编辑并退出'],defaultId:1,cancelId:1});
    if(choice.response===0)void flushBeforeClose();else if(choice.response===2){closing=true;app.quit();}
  };
  window.on('close',event=>{if(!closing){event.preventDefault();void flushBeforeClose();}});
  app.on('before-quit',event=>{if(!closing){event.preventDefault();void flushBeforeClose();}});
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', event => event.preventDefault());
  contents.on('will-frame-navigate', event => event.preventDefault());
  contents.on('will-redirect', event => event.preventDefault());
  contents.on('will-attach-webview', event => event.preventDefault());
  contents.on('before-input-event', (event, input) => {
    if (config.mode !== 'development' && (input.key === 'F12' || (input.control && input.shift && ['i', 'j', 'c'].includes(input.key.toLowerCase())))) event.preventDefault();
  });
  ipcMain.handle(HEALTH_CHANNEL, (event, request: unknown): HealthResult => {
    if (!authorized({ senderId: event.sender.id, frameIsMain: event.senderFrame === contents.mainFrame, frameURL: event.senderFrame?.url ?? '' }, contents.id, documentURL)) return { ok: false, code: 'UNAUTHORIZED', userMessage: '此窗口没有调用权限。', retryable: false };
    if (!validHealthRequest(request)) return { ok: false, code: 'VALIDATION', userMessage: '请求参数无效。', retryable: false };
    return { ok: true, data: { product: 'Work Station', version: productVersion, stage: '工程基础', mode: config.mode }, revision: 0 };
  });
  contents.once('did-finish-load', () => window?.show());
  await window.loadURL(documentURL);
  return { window, documentURL, secondInstances: () => secondCount };
}
