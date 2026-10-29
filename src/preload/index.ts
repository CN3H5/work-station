import { contextBridge, ipcRenderer } from 'electron';
import type { HealthResult, WorkStationAPI } from '../shared/contract';
const api: WorkStationAPI = Object.freeze({
  getHealth: (request: Record<string, never>): Promise<HealthResult> => ipcRenderer.invoke('workstation:health', request),
  storage: (request: unknown) => ipcRenderer.invoke('workstation:storage', request),
  onFlush: (callback: () => Promise<boolean>) => { ipcRenderer.on('workstation:flush', (_event, token: string) => { void callback().then(ok => ipcRenderer.send('workstation:flushed', {token,ok})); }); }
});
contextBridge.exposeInMainWorld('workStation', api);
