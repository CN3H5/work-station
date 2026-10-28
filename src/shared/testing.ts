export interface Clock { now(): number }
export const systemClock: Clock = { now: () => Date.now() };
export class ManualClock implements Clock {
  constructor(private value: number) {}
  now(): number { return this.value; }
  advance(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new RangeError('INVALID_ADVANCE');
    this.value += milliseconds;
  }
}
// T04 will define transaction-specific checkpoints; there is no storage transaction yet.
export interface FaultInjector { hit(checkpoint: string): Promise<void> }
export const noFaults: FaultInjector = { hit: async () => {} };
