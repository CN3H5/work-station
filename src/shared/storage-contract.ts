export type StoreResult<T> = { ok: true; data: T; revision: number } | { ok: false; code: string; userMessage: string; retryable: boolean };
export interface SnapshotItem { id: string; valid: boolean; createdAt?: string; reason?: string }
export interface StorageState { mode: 'ready'|'recovery'; revision: number; privacyNotification: boolean; softBudget: boolean; snapshotWarning: boolean; cleanupPending: boolean }

