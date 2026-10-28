import { contextBridge, ipcRenderer } from 'electron';
import type { HealthResult, WorkStationAPI } from '../shared/contract';
const api: WorkStationAPI = Object.freeze({
  getHealth: (request: Record<string, never>): Promise<HealthResult> => ipcRenderer.invoke('workstation:health', request)
});
contextBridge.exposeInMainWorld('workStation', api);
