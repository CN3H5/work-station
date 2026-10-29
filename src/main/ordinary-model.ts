import { createHash, randomUUID } from 'node:crypto';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Entity = { [key: string]: Json };
export const collections = ['notes','memos','tags','categories','rules','ruleRevisions','reminderPolicies','tasks','occurrenceTombstones','scheduleCursors','semesters','courses','courseSlots'] as const;
export interface Payload { business: Record<string, Json>; local: { reminderEvents: Entity[]; reminderBatches: Entity[]; reminderAliases: Entity[]; imageAssets: Entity[] }; mutations: { id: string; hash: string; revision: number }[] }
export interface Ordinary { kind: 'work-station-ordinary'; schemaVersion: number; datasetId: string; revision: number; savedAt: string; payload: Payload; contentHash: string }
export class StoreError extends Error { constructor(public code: string) { super(code); } }
export function fail(code = 'VALIDATION'): never { throw new StoreError(code); }
export function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical((value as Entity)[k])).join(',') + '}';
  return fail();
}
export const hash = (value: unknown): string => createHash('sha256').update(canonical(value)).digest('hex');
// Parse with a bounded recursive descent: JSON.parse alone silently accepts duplicate keys.
export function parseStrict(text: string): unknown {
  let i = 0;
  const ws = (): void => { while (/\s/.test(text[i] ?? '') && i < text.length) i++; };
  function value(depth: number): unknown {
    if (depth > 64) fail(); ws(); const c = text[i];
    if (c === '{') { i++; ws(); const out: Record<string, unknown> = {}; const seen = new Set<string>();
      if (text[i] === '}') { i++; return out; }
      for (;;) { ws(); if (text[i] !== '"') fail(); const key = string();
        if (seen.has(key) || ['__proto__','constructor','prototype'].includes(key)) fail(); seen.add(key); ws(); if (text[i++] !== ':') fail(); out[key] = value(depth + 1); ws(); const end = text[i++]; if (end === '}') return out; if (end !== ',') fail(); }
    }
    if (c === '[') { i++; ws(); const out: unknown[] = []; if (text[i] === ']') { i++; return out; } for (;;) { out.push(value(depth + 1)); ws(); const end = text[i++]; if (end === ']') return out; if (end !== ',') fail(); } }
    if (c === '"') return string();
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i)); if (!match) return fail(); i += match[0].length; const v: unknown = JSON.parse(match[0]); if (typeof v === 'number' && !Number.isFinite(v)) fail(); return v;
  }
  function string(): string { const start = i++; for (; i < text.length; i++) { if (text[i] === '\\') { i++; continue; } if (text[i] === '"') { i++; return JSON.parse(text.slice(start, i)) as string; } } return fail(); }
  const out = value(0); ws(); if (i !== text.length) fail(); return out;
}
export function object(value: unknown): asserts value is Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(); }
export function keys(value: unknown, required: string[], optional: string[] = []): asserts value is Record<string, unknown> { object(value); if (required.some(k => !Object.hasOwn(value,k)) || Object.keys(value).some(k => ![...required,...optional].includes(k))) fail(); }
export const uuid = (v: unknown): boolean => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export const utc = (v: unknown): boolean => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const date = (v: unknown): boolean => typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
const time = (v: unknown): boolean => typeof v === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): boolean => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
const spec: Record<string, [string, string]> = {
  notes: ['title markdown tagIds',''], memos: ['title body tagIds',''], tags: ['name color','deletedAt'], categories: ['name','deletedAt'],
  rules: ['active currentRevisionId reminderPolicyId stoppedAt','resumedAt'],
  ruleRevisions: ['ruleId effectiveFrom effectiveUntil startDate time kind interval weekdays anchorWeek anchorMonth originalDay title notes categoryId tagIds',''],
  reminderPolicies: ['ruleId leadMinutes policyRevision',''],
  tasks: ['title notes categoryId tagIds dueLocal dueZoneAtCreation resolvedInstantAtCreation status source scheduleRevision reminderLeadMinutes reminderSuppressed','completedAt ruleId ruleRevisionId occurrenceKey'],
  occurrenceTombstones: ['occurrenceKey deletedAt',''], scheduleCursors: ['ruleRevisionId processedThroughLocal skippedRanges',''],
  semesters: ['name startDate week1Start weeks periodTable',''], courses: ['semesterId name teacher color weekStart weekEnd parity notes',''],
  courseSlots: ['courseId weekday startPeriod endPeriod place','specialStart specialEnd'],
  reminderEvents: ['eventId targetKey scheduledLocal status','taskId batchId claimedAt deliveredAt reason'], reminderBatches: ['memberEventIds state',''],
  reminderAliases: ['oldOccurrenceKey newOccurrenceKey reason',''], imageAssets: ['sha256 mime width height bytes displayName','']
};
export function emptyPayload(): Payload {
  const business: Record<string, Json> = Object.fromEntries(collections.map(k => [k, []]));
  business.appearance = { mode: 'system', colors: {}, backgroundKind: 'color', overlay: 0, fontScale: 1, reduceMotion: false };
  business.preferences = { hotkey: '', launchAtLogin: false, privacyNotification: true, reminderPause: false, vaultIdleMinutes: 5, revealSeconds: 15 };
  return { business, local: { reminderEvents: [], reminderBatches: [], reminderAliases: [], imageAssets: [] }, mutations: [] };
}
export function snapshotProjection(payload: Payload): Record<string, Json> {
  const strip = (v: Json): Json => Array.isArray(v) ? v.map(strip) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => !['createdAt','updatedAt','entityRevision','processedThroughLocal','skippedRanges'].includes(k)).map(([k,x])=>[k,strip(x)])) : v;
  return strip(payload.business) as Record<string, Json>;
}
export const snapshotHash = (payload: Payload): string => hash(snapshotProjection(payload));
export function envelope(payload: Payload, revision: number, now: string, datasetId = randomUUID() as string): Ordinary {
  return { kind: 'work-station-ordinary', schemaVersion: 1, datasetId, revision, savedAt: now, payload, contentHash: hash(payload) };
}
export function validatePayload(payload: unknown): asserts payload is Payload {
  keys(payload,['business','local','mutations']); keys(payload.business,[...collections,'appearance','preferences']); keys(payload.local,['reminderEvents','reminderBatches','reminderAliases','imageAssets']);
  const b = payload.business; const l = payload.local; const ids = new Set<string>(); const byType: Record<string, Set<string>> = {}; let count = 0;
  for (const [type, [required, optional]] of Object.entries(spec)) {
    const rows = (Object.hasOwn(b,type) ? b[type] : l[type]); if (!Array.isArray(rows)) fail(); byType[type] = new Set();
    for (const row of rows as unknown[]) {
      keys(row,['id','createdAt','updatedAt','entityRevision',...required.split(' ').filter(Boolean)],optional.split(' ').filter(Boolean));
      if (!uuid(row.id) || ids.has(String(row.id)) || !utc(row.createdAt) || !utc(row.updatedAt) || !integer(row.entityRevision)) fail(); ids.add(String(row.id)); byType[type]!.add(String(row.id)); count++;
      for (const [k,v] of Object.entries(row)) {
        if (['id','createdAt','updatedAt','entityRevision'].includes(k)) continue;
        if (['active','reminderSuppressed'].includes(k)) { if (typeof v !== 'boolean') fail(); }
        else if (k === 'tagIds' || k === 'memberEventIds') { if (!Array.isArray(v) || v.some(x => typeof x !== 'string') || new Set(v).size !== v.length) fail(); }
        else if (['interval','scheduleRevision','policyRevision','leadMinutes','reminderLeadMinutes','weeks','weekStart','weekEnd','weekday','startPeriod','endPeriod','originalDay','width','height','bytes'].includes(k)) { if (!integer(v, ['interval','weeks','weekStart','weekEnd','weekday','startPeriod','endPeriod','originalDay','width','height'].includes(k) ? 1 : 0)) fail(); }
        else if (k === 'weekdays') { if (!Array.isArray(v) || v.some(x=>!integer(x,1,7)) || new Set(v).size !== v.length) fail(); }
        else if (k === 'periodTable') { if (!Array.isArray(v) || v.length !== 13) fail(); for (const p of v) { keys(p,['start','end']); if (!time(p.start) || !time(p.end) || String(p.start)>=String(p.end)) fail(); } }
        else if (k === 'skippedRanges') { if (!Array.isArray(v)) fail(); for (const r of v) { keys(r,['from','through']); if (!date(r.from) || !date(r.through) || String(r.from)>String(r.through)) fail(); } }
        else if (['stoppedAt','resumedAt','completedAt','deletedAt','effectiveFrom','effectiveUntil','claimedAt','deliveredAt','resolvedInstantAtCreation'].includes(k)) { if (v !== null && !utc(v)) fail(); }
        else if (['startDate','week1Start','anchorWeek','processedThroughLocal'].includes(k)) { if (!date(v)) fail(); }
        else if (['time','specialStart','specialEnd'].includes(k)) { if (!time(v)) fail(); }
        else if (k === 'anchorMonth') { if (typeof v !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) fail(); }
        else if (k === 'dueLocal' || k === 'scheduledLocal') { if (typeof v !== 'string' || !date(v.slice(0,10)) || v[10] !== 'T' || !time(v.slice(11)) ) fail(); }
        else if (k === 'categoryId') { if (v !== null && !uuid(v)) fail(); }
        else if (typeof v !== 'string') fail();
      }
      if (type === 'notes' && Buffer.byteLength(String(row.markdown),'utf8') > 2*1024*1024) fail();
      if (['tags','categories'].includes(type) && (!String(row.name).trim() || row.name !== String(row.name).trim())) fail();
      if (type === 'tasks') { if (!['pending','completed'].includes(String(row.status)) || !['single','recurring'].includes(String(row.source))) fail(); try { new Intl.DateTimeFormat('en',{timeZone:String(row.dueZoneAtCreation)}); } catch { fail(); } if (row.source === 'recurring' && (!row.ruleId || !row.ruleRevisionId || !row.occurrenceKey)) fail(); if (row.source === 'single' && (row.ruleId || row.ruleRevisionId || row.occurrenceKey)) fail(); }
      if (type === 'ruleRevisions' && (!['day','week','month'].includes(String(row.kind)) || !integer(row.originalDay,1,31))) fail();
      if (type === 'semesters' && (!integer(row.weeks,1,60) || new Date(String(row.week1Start)).getUTCDay() !== 1)) fail();
      if (type === 'courses' && (!['all','odd','even'].includes(String(row.parity)) || Number(row.weekStart)>Number(row.weekEnd))) fail();
      if (type === 'courseSlots' && (!integer(row.weekday,1,7) || !integer(row.startPeriod,1,13) || !integer(row.endPeriod,Number(row.startPeriod),13) || (!!row.specialStart !== !!row.specialEnd) || (row.specialStart && String(row.specialStart)>=String(row.specialEnd)))) fail();
      if (type === 'imageAssets' && (row.mime !== 'image/webp' || !/^[a-f0-9]{64}$/.test(String(row.sha256)))) fail();
      if (type === 'reminderEvents' && !['pending','claimed','delivered','suppressed'].includes(String(row.status))) fail();
    }
  }
  if (count > 100000) fail();
  const refs: Record<string,string> = { categoryId:'categories',ruleId:'rules',ruleRevisionId:'ruleRevisions',currentRevisionId:'ruleRevisions',reminderPolicyId:'reminderPolicies',semesterId:'semesters',courseId:'courses',taskId:'tasks',batchId:'reminderBatches' };
  for (const type of Object.keys(spec)) for (const row of ((b[type] ?? l[type]) as Entity[])) {
    for (const [field,target] of Object.entries(refs)) if (row[field] != null && !byType[target]!.has(String(row[field]))) { if(type==='reminderEvents'&&['taskId','batchId'].includes(field)&&['delivered','suppressed'].includes(String(row.status)))continue;fail(); }
    if (Array.isArray(row.tagIds) && row.tagIds.some(id=>!byType.tags!.has(String(id)))) fail();
    if (type === 'tasks' && row.ruleRevisionId) { const rev=(b.ruleRevisions as Entity[]).find(r=>r.id===row.ruleRevisionId)!; if (rev.ruleId!==row.ruleId) fail(); }
    if (type === 'rules') { if ((b.ruleRevisions as Entity[]).find(r=>r.id===row.currentRevisionId)?.ruleId!==row.id || (b.reminderPolicies as Entity[]).find(r=>r.id===row.reminderPolicyId)?.ruleId!==row.id) fail(); }
    if (type === 'courses' && Number(row.weekEnd)>Number((b.semesters as Entity[]).find(r=>r.id===row.semesterId)?.weeks)) fail();
  }
  const occurrence = new Set<string>(); for (const row of [...b.tasks as Entity[], ...b.occurrenceTombstones as Entity[]]) if (row.occurrenceKey) { if (occurrence.has(String(row.occurrenceKey))) fail(); occurrence.add(String(row.occurrenceKey)); }
  const aliases = new Map((l.reminderAliases as Entity[]).map(r=>[String(r.oldOccurrenceKey),String(r.newOccurrenceKey)])); for (const key of aliases.keys()) { const seen=new Set<string>(); let x: string|undefined=key; while(x && aliases.has(x)) { if(seen.has(x)) fail(); seen.add(x); x=aliases.get(x); } }
  keys(b.preferences,['hotkey','launchAtLogin','privacyNotification','reminderPause','vaultIdleMinutes','revealSeconds']);
  if (typeof b.preferences.hotkey !== 'string' || b.preferences.hotkey.length>100 || ['launchAtLogin','privacyNotification','reminderPause'].some(k=>typeof (b.preferences as Record<string,unknown>)[k] !== 'boolean') || !integer(b.preferences.vaultIdleMinutes,1,120) || !integer(b.preferences.revealSeconds,1,120)) fail();
  keys(b.appearance,['mode','colors','backgroundKind','overlay','fontScale','reduceMotion'],['imageHash']); object(b.appearance.colors);
  if (!['system','light','dark'].includes(String(b.appearance.mode)) || !['color','image'].includes(String(b.appearance.backgroundKind)) || typeof b.appearance.reduceMotion!=='boolean' || typeof b.appearance.overlay!=='number' || b.appearance.overlay<0 || b.appearance.overlay>1 || typeof b.appearance.fontScale!=='number' || b.appearance.fontScale<0.5 || b.appearance.fontScale>3 || (b.appearance.imageHash!==undefined && !/^[a-f0-9]{64}$/.test(String(b.appearance.imageHash))) || Object.values(b.appearance.colors).some(v=>typeof v!=='string' || !/^#[a-f0-9]{6}$/i.test(v))) fail();
  if (!Array.isArray(payload.mutations) || payload.mutations.length>256) fail(); const mutations=new Set<string>(); for(const m of payload.mutations as unknown[]) { keys(m,['id','hash','revision']); if(!uuid(m.id)||mutations.has(String(m.id))||!/^[a-f0-9]{64}$/.test(String(m.hash))||!integer(m.revision))fail();mutations.add(String(m.id)); }
}
export function decode(text: string): Ordinary {
  const v = parseStrict(text); keys(v,['kind','schemaVersion','datasetId','revision','savedAt','payload','contentHash']);
  if (v.schemaVersion !== 1) fail('UNSUPPORTED_VERSION');
  if (v.kind !== 'work-station-ordinary' || !uuid(v.datasetId) || !integer(v.revision) || !utc(v.savedAt)) fail(); validatePayload(v.payload); if (v.contentHash !== hash(v.payload) || v.payload.mutations.some(m=>m.revision>Number(v.revision))) fail(); return v as unknown as Ordinary;
}

