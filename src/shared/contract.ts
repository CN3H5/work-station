export const HEALTH_CHANNEL = 'workstation:health';
export type Failure = { ok: false; code: 'UNAUTHORIZED' | 'VALIDATION'; userMessage: string; retryable: false };
export type HealthResult = { ok: true; data: { product: 'Work Station'; version: string; stage: '工程基础'; mode: 'production' | 'development' | 'test' | 'preview' }; revision: 0 } | Failure;
export interface WorkStationAPI { getHealth(request: Record<string, never>): Promise<HealthResult> }

export function validHealthRequest(value: unknown): value is Record<string, never> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return (proto === Object.prototype || proto === null) && Reflect.ownKeys(value).length === 0;
}
export interface Caller { senderId: number; frameIsMain: boolean; frameURL: string }
export function authorized(caller: Caller, windowId: number, documentURL: string): boolean {
  return caller.senderId === windowId && caller.frameIsMain && caller.frameURL === documentURL;
}
