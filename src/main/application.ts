import { app, BrowserWindow, ipcMain, Menu, protocol, session, screen } from 'electron';
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
