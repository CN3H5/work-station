export const HEALTH_CHANNEL = 'workstation:health';
export type Failure = { ok: false; code: 'UNAUTHORIZED' | 'VALIDATION'; userMessage: string; retryable: false };
export type HealthResult = { ok: true; data: { product: 'Work Station'; version: string; stage: '桌面框架'; mode: 'production' | 'development' | 'test' | 'preview' }; revision: 0 } | Failure;
import type { StorageState, SnapshotItem, StoreResult } from '../shared/storage-contract';
export type ReminderStatus = {paused:boolean;revision:number;readOnly:boolean;scheduler:'not-implemented'};
// T09 subscribes to lock-request before implementing secret-bearing views. An event is not a lock acknowledgement.
export type DesktopEvent = {kind:'reminder-state';state:ReminderStatus}
  | {kind:'lock-request';reason:'minimize'|'hide'|'screen-lock';sequence:number}
  | {kind:'save-wait';status:'processing'|'unresponsive'|'failed';intent:'hide'|'quit'};
export interface WorkStationAPI {
  onDesktopEvent(callback:(event:DesktopEvent)=>void):()=>void;
  getHealth(request: Record<string, never>): Promise<HealthResult>;
  storage(request: unknown): Promise<StoreResult<StorageState | SnapshotItem[]>>;
  desktop(request: unknown): Promise<import('./storage-contract').StoreResult<Record<string, unknown>>>;
  onFlush(callback: () => Promise<boolean>): void;
}

export function validHealthRequest(value: unknown): value is Record<string, never> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return (proto === Object.prototype || proto === null) && Reflect.ownKeys(value).length === 0;
}
export interface Caller { senderId: number; frameIsMain: boolean; frameURL: string }
export function authorized(caller: Caller, windowId: number, documentURL: string): boolean {
  return caller.senderId === windowId && caller.frameIsMain && caller.frameURL === documentURL;
}

