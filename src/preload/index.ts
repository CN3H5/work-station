import { contextBridge, ipcRenderer } from 'electron';
import type { HealthResult, WorkStationAPI, DesktopEvent } from '../shared/contract';
const api: WorkStationAPI = Object.freeze({
  onDesktopEvent: (callback:(event:DesktopEvent)=>void) => {
    const listener=(_event:Electron.IpcRendererEvent,value:DesktopEvent):void=>{callback(value);};
    ipcRenderer.on('workstation:desktop-event',listener);
    return ()=>{ipcRenderer.removeListener('workstation:desktop-event',listener);};
  },
  getHealth: (request: Record<string, never>): Promise<HealthResult> => ipcRenderer.invoke('workstation:health', request),
  desktop: (request: unknown) => ipcRenderer.invoke('workstation:desktop', request),
  storage: (request: unknown) => ipcRenderer.invoke('workstation:storage', request),
  onFlush: (callback: () => Promise<boolean>) => { ipcRenderer.on('workstation:flush', (_event, token: string) => { void callback().catch(()=>false).then(ok => ipcRenderer.send('workstation:flushed', {token,ok})); }); }
});
contextBridge.exposeInMainWorld('workStation', api);
