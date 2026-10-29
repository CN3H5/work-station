import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { rejectLinks } from './data-root';
import { canonical, decode, emptyPayload, envelope, fail, hash, keys, parseStrict, snapshotHash, StoreError, utc, uuid, validatePayload, type Entity, type Ordinary, type Payload, type Json } from './ordinary-model';

export type Stage = 'new'|'old'|'prepared'|'replace'|'readback'|'committed'|'cleanup'|'rollback';
export interface StoreOptions { now?: () => Date; fault?: (stage: Stage) => void | Promise<void>; snapshotFault?: () => void }
export interface Snapshot { id: string; schemaVersion: number; createdAt: string; localDateAtCreation: string; reason: string; snapshotHash: string; business: Record<string, Json>;sequence?:number }
import type {StoreResult,StorageState,SnapshotItem} from '../shared/storage-contract';
const MAX = 100*1024*1024;
const PREVIOUS_ID='00000000-0000-4000-8000-000000000001';
const bytesHash=(text:string):string=>createHash('sha256').update(text).digest('hex');
export class OrdinaryStore {
  private current: Ordinary | undefined;
  private tail: Promise<unknown> = Promise.resolve();
  private mode: 'ready'|'recovery' = 'recovery';
  private snapshotWarning = false;
  private cleanupPending = false;
  private readonly now: () => Date;
  private migrations = new Map<number,(v: unknown) => unknown>();
  private recoveryRunning=false;
  private sizeBytes=0;
  private recoveryCode='RECOVERY_REQUIRED';
  constructor(readonly root: string, private options: StoreOptions = {}) { this.now=options.now ?? (()=>new Date()); }
  private file(...parts: string[]): string { const p=path.resolve(this.root,...parts); if (!p.startsWith(path.resolve(this.root)+path.sep)) fail(); rejectLinks(p); return p; }
  private async read(file: string): Promise<string> { rejectLinks(file); const h=await fs.open(file,'r'); try { if((await h.stat()).size>MAX)fail(); return await h.readFile('utf8'); } finally { await h.close(); } }
  private async durable(file: string, text: string): Promise<void> { rejectLinks(file); const h=await fs.open(file,'wx'); try { await h.writeFile(text); await h.sync(); } finally { await h.close(); } }
  private async exists(file: string): Promise<boolean> { try { await fs.lstat(file); return true; } catch(e) { if((e as NodeJS.ErrnoException).code==='ENOENT')return false; throw e; } }
  private serial<T>(action:()=>Promise<T>): Promise<T> { const next=this.tail.then(action); this.tail=next.catch(()=>{}); return next; }
  private async result<T>(action:()=>Promise<T>): Promise<StoreResult<T>> { try { const data=await action(); return {ok:true,data,revision:data&&typeof data==='object'&&'revision' in data?Number(data.revision):this.current?.revision??0}; } catch(e) { const code=e instanceof StoreError?e.code:'IO_FAILED'; return {ok:false,code,userMessage:({CONFLICT:'数据已更新，请重新加载后重试。',VALIDATION:'数据格式或请求参数无效。',UNSUPPORTED_VERSION:'数据版本不受支持，原文件已保留。',RECOVERY_REQUIRED:'需要选择有效副本恢复，原文件已保留。'} as Record<string,string>)[code]??'保存失败，编辑内容仍保留，请重试。',retryable:code==='IO_FAILED'}; } }
  state(): StorageState { return {mode:this.mode,revision:this.current?.revision??0,privacyNotification:Boolean(this.current?.payload.business.preferences && (this.current.payload.business.preferences as Entity).privacyNotification),softBudget:this.sizeBytes>=50*1024*1024,snapshotWarning:this.snapshotWarning,cleanupPending:this.cleanupPending}; }
  private receipt(payload:Payload):StorageState {return {...this.state(),mode:'ready',revision:this.current!.revision+1,privacyNotification:Boolean((payload.business.preferences as Entity).privacyNotification),snapshotWarning:false,cleanupPending:false};}
  private async writable():Promise<void>{if(this.mode!=='ready'||this.cleanupPending){try{await this.recover();this.current=decode(await this.read(this.file('ordinary','current.json')));this.mode='ready';}catch{fail(this.recoveryCode);}if(this.cleanupPending)fail('IO_FAILED');}if(!this.current)fail('RECOVERY_REQUIRED');}
  query(): Ordinary | undefined { return this.current ? structuredClone(this.current):undefined; }
  async flush(): Promise<void> { await this.tail; }
  registerMigration(version: number, migrate:(v:unknown)=>unknown): void { if(this.current || version>=1 || this.migrations.has(version))fail(); this.migrations.set(version,migrate); }
  async open(): Promise<StoreResult<StorageState>> { return this.serial(()=>this.result(async()=>{
    for(const d of ['ordinary','transactions','snapshots']) { const p=this.file(d); await fs.mkdir(p,{recursive:true}); }
    try {
      await this.recover();
      const current=this.file('ordinary','current.json');
      if(await this.exists(current)) {
        const text=await this.read(current); const raw=parseStrict(text); keys(raw,['kind','schemaVersion','datasetId','revision','savedAt','payload','contentHash']);
        if(raw.schemaVersion!==1 && this.migrations.has(Number(raw.schemaVersion))) {
          if(raw.kind!=='work-station-ordinary'||!uuid(raw.datasetId)||!Number.isSafeInteger(raw.revision)||raw.contentHash!==hash(raw.payload))fail();
          await this.durable(this.file('ordinary',`migration-${randomUUID()}.json`),text);
          let v:unknown=raw; let version=Number(raw.schemaVersion);
          while(version<1) { const migrate=this.migrations.get(version); if(!migrate)fail('UNSUPPORTED_VERSION'); v=migrate(structuredClone(v)); version++; if((v as Ordinary).schemaVersion!==version)fail(); }
          const migrated=decode(canonical(v));migrated.revision=Number(raw.revision)+1;migrated.savedAt=this.now().toISOString(); await this.transaction(migrated,text); this.current=migrated;
        } else this.current=decode(text);
      } else {
        // An explicit durable intent is evidence of interrupted initialization; any other data means missing current.
        const entries=await fs.readdir(this.file('ordinary'));
        if(entries.length)fail('RECOVERY_REQUIRED');
        if((await fs.readdir(this.file('snapshots'))).length || (await fs.readdir(this.file('transactions'))).length)fail('RECOVERY_REQUIRED');
        await this.durable(this.file('ordinary','initializing.json'),canonical({kind:'initializing',datasetId:randomUUID()}));
        this.current=envelope(emptyPayload(),0,this.now().toISOString()); await this.transaction(this.current,null);
      }
      if(!await this.exists(this.file('ordinary','initialized.json')))await this.durable(this.file('ordinary','initialized.json'),canonical({kind:'initialized'}));
      this.sizeBytes=(await fs.stat(current)).size;this.mode='ready';
    } catch(e) { this.mode='recovery';this.current=undefined;this.recoveryCode=e instanceof StoreError&&e.code==='UNSUPPORTED_VERSION'?'UNSUPPORTED_VERSION':'RECOVERY_REQUIRED';fail(this.recoveryCode); }
    return this.state();
  })); }
  private async recover(): Promise<void> {
    if(this.recoveryRunning)fail('RECOVERY_REQUIRED');this.recoveryRunning=true;
    try {this.cleanupPending=false;
    for(const id of await fs.readdir(this.file('transactions'))) {
      if(!uuid(id))fail('RECOVERY_REQUIRED'); const dir=this.file('transactions',id); rejectLinks(dir);
      const journal=path.join(dir,'journal.json');
      if(!await this.exists(journal)) { // No durable PREPARED means current was never replaced.
        if(await this.exists(path.join(dir,'committed.json')))fail('RECOVERY_REQUIRED');
        await fs.rm(dir,{recursive:true}); continue;
      }
      let j:Record<string,unknown>;
      try { const v=parseStrict(await this.read(journal)); keys(v,['id','target','oldHash','newHash','initialization']); if(v.id!==id || v.target!=='ordinary' || typeof v.initialization!=='boolean' || !(v.oldHash===null||/^[a-f0-9]{64}$/.test(String(v.oldHash))) || !/^[a-f0-9]{64}$/.test(String(v.newHash)))fail(); j=v; } catch { return fail('RECOVERY_REQUIRED'); }
      const committed=path.join(dir,'committed.json');
      if(await this.exists(committed)) {
        const c=parseStrict(await this.read(committed)); keys(c,['id','newHash']); if(c.id!==id || c.newHash!==j.newHash)fail('RECOVERY_REQUIRED');
        const text=await this.read(this.file('ordinary','current.json')); const v=decode(text); if(hash(v)!==j.newHash)fail('RECOVERY_REQUIRED');
        // Previous was installed before COMMITTED; never roll back a committed version.
      } else if(j.oldHash!==null) {
        const old=await this.read(path.join(dir,'old.json')); if(bytesHash(old)!==j.oldHash)fail('RECOVERY_REQUIRED');
        // For migrations, the old envelope may intentionally have an unsupported schema.
        // The previous bytes can be damaged or an unsupported version. Rollback preserves them exactly;
        // opening the result still requires full validation and remains read-only when damaged.
        await this.replaceCurrent(old); await this.options.fault?.('rollback');
      } else {
        if(j.initialization&&!await this.exists(this.file('ordinary','initializing.json')))fail('RECOVERY_REQUIRED');
        await fs.rm(this.file('ordinary','current.json'),{force:true});
      }
      try { await fs.rm(dir,{recursive:true}); } catch { this.cleanupPending=true; }
    }
    const init=this.file('ordinary','initializing.json');
    if(await this.exists(init)) {
      const v=parseStrict(await this.read(init)); keys(v,['kind','datasetId']); if(v.kind!=='initializing'||!uuid(v.datasetId))fail('RECOVERY_REQUIRED');
      const current=this.file('ordinary','current.json');
      if(!await this.exists(current)) { const initial=envelope(emptyPayload(),0,this.now().toISOString(),String(v.datasetId)); await this.transaction(initial,null); }
      else decode(await this.read(current));
      await fs.rm(init,{force:true});
    }
    }finally{this.recoveryRunning=false;}
  }
  private async replaceCurrent(text: string): Promise<void> { const tmp=this.file('ordinary',`replace-${randomUUID()}.json`); await this.durable(tmp,text); try { await fs.rename(tmp,this.file('ordinary','current.json')); } finally { await fs.rm(tmp,{force:true}).catch(()=>{}); } }
  private async transaction(next: Ordinary, oldText: string|null): Promise<void> {
    const text=canonical(next); if(Buffer.byteLength(text)>MAX)fail(); decode(text);
    const id=randomUUID(); const dir=this.file('transactions',id); await fs.mkdir(dir);
    let committed=false;
    try {
      await this.durable(path.join(dir,'new.json'),text); decode(await this.read(path.join(dir,'new.json'))); await this.options.fault?.('new');
      if(oldText!==null) { await this.durable(path.join(dir,'old.json'),oldText); if(await this.read(path.join(dir,'old.json'))!==oldText)fail(); } await this.options.fault?.('old');
      await this.durable(path.join(dir,'journal.json'),canonical({id,target:'ordinary',oldHash:oldText===null?null:bytesHash(oldText),newHash:hash(next),initialization:oldText===null&&await this.exists(this.file('ordinary','initializing.json'))})); await this.options.fault?.('prepared');
      await this.replaceCurrent(text); await this.options.fault?.('replace');
      if(hash(decode(await this.read(this.file('ordinary','current.json'))))!==hash(next))fail(); await this.options.fault?.('readback');
      if(oldText!==null) { const tmp=this.file('ordinary',`previous-${id}.json`); await this.durable(tmp,oldText); await fs.rename(tmp,this.file('ordinary','previous.json')); }
      await this.durable(path.join(dir,'committed.json'),canonical({id,newHash:hash(next)})); committed=true; this.current=next;this.sizeBytes=Buffer.byteLength(text);
      await this.options.fault?.('committed');
      await this.options.fault?.('cleanup'); await fs.rm(dir,{recursive:true}); await fs.rm(this.file('ordinary','initializing.json'),{force:true});
    } catch(e) { if(committed) { this.cleanupPending=true; return; }
      this.mode='recovery';
      if(oldText!==null&&!this.recoveryRunning)try { await this.recover(); this.current=decode(await this.read(this.file('ordinary','current.json')));this.mode='ready'; } catch { /* Keep all remaining evidence for restart/manual recovery. */ }
      throw e;
    }
  }
  commit(request:{baseRevision:number;clientMutationId:string;payload:Payload}):Promise<StoreResult<StorageState>> { return this.serial(()=>this.result(async()=>{
    await this.writable();if(!this.current)fail('RECOVERY_REQUIRED');
    keys(request,['baseRevision','clientMutationId','payload']); if(!uuid(request.clientMutationId))fail(); validatePayload(request.payload);
    const inputHash=hash(request.payload); const duplicate=this.current.payload.mutations.find(m=>m.id===request.clientMutationId);
    if(duplicate) { if(duplicate.hash!==inputHash)fail(); return duplicate.result??{...this.state(),revision:duplicate.revision}; }
    if(request.baseRevision!==this.current.revision)fail('CONFLICT');
    const payload=structuredClone(request.payload);const receipt=this.receipt(payload); payload.mutations=[...this.current.payload.mutations,{id:request.clientMutationId,hash:inputHash,revision:this.current.revision+1,result:receipt}].slice(-256);
    const next=envelope(payload,this.current.revision+1,this.now().toISOString(),this.current.datasetId);
    const changed=snapshotHash(this.current.payload)!==snapshotHash(payload);
    await this.transaction(next,canonical(this.current));
    if(changed)await this.dailySnapshot(); return receipt;
  })); }
  savePreference(request: unknown): Promise<StoreResult<StorageState>> {
    return this.serial(()=>this.result(async()=>{
      keys(request,['baseRevision','clientMutationId','privacyNotification']); if(typeof request.privacyNotification!=='boolean'||!uuid(request.clientMutationId)||!Number.isSafeInteger(request.baseRevision))fail();
      await this.writable();if(!this.current)fail('RECOVERY_REQUIRED');
      const inputHash=hash(request); const duplicate=this.current.payload.mutations.find(m=>m.id===request.clientMutationId);
      if(duplicate) { if(duplicate.hash!==inputHash)fail(); return duplicate.result??{...this.state(),revision:duplicate.revision}; }
      if(request.baseRevision!==this.current.revision)fail('CONFLICT');
      const payload=structuredClone(this.current.payload); (payload.business.preferences as Entity).privacyNotification=request.privacyNotification;
      const receipt=this.receipt(payload);payload.mutations=[...payload.mutations,{id:String(request.clientMutationId),hash:inputHash,revision:this.current.revision+1,result:receipt}].slice(-256);
      const changed=snapshotHash(payload)!==snapshotHash(this.current.payload);
      await this.transaction(envelope(payload,this.current.revision+1,this.now().toISOString(),this.current.datasetId),canonical(this.current)); if(changed)await this.dailySnapshot(); return receipt;
    }));
  }
  private localDate(): string { const d=this.now(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  private async readSnapshot(id:string):Promise<Snapshot> {
    if(id===PREVIOUS_ID) {const previous=decode(await this.read(this.file('ordinary','previous.json')));return {id,schemaVersion:1,createdAt:previous.savedAt,localDateAtCreation:previous.savedAt.slice(0,10),reason:'previous',snapshotHash:snapshotHash(previous.payload),business:previous.payload.business};}
    if(!uuid(id))fail(); const s=parseStrict(await this.read(this.file('snapshots',`${id}.json`))); keys(s,['id','schemaVersion','createdAt','localDateAtCreation','reason','snapshotHash','business'],['sequence']);if(s.sequence!==undefined&&(!Number.isSafeInteger(s.sequence)||Number(s.sequence)<1))fail();
    if(s.id!==id||s.schemaVersion!==1||!utc(s.createdAt)||!/^\d{4}-\d\d-\d\d$/.test(String(s.localDateAtCreation))||!['daily','pre-import','pre-restore'].includes(String(s.reason)))fail();
    const p=emptyPayload(); p.business=s.business as Record<string,Json>; validatePayload(p); if(snapshotHash(p)!==s.snapshotHash)fail(); return s as unknown as Snapshot;
  }
  async listSnapshots():Promise<SnapshotItem[]> {
    const out:SnapshotItem[]=[];
    for(const name of await fs.readdir(this.file('snapshots'))) { if(!name.endsWith('.json'))continue; const id=name.slice(0,-5); if(!uuid(id))continue; try { const s=await this.readSnapshot(id); out.push({id,valid:true,createdAt:s.createdAt,reason:s.reason,sequence:s.sequence??0}); } catch { out.push({id,valid:false}); } }
    return out.sort((a,b)=>(b.sequence??0)-(a.sequence??0)||(b.createdAt??'').localeCompare(a.createdAt??'')||b.id.localeCompare(a.id));
  }
  async recoveryCandidates():Promise<SnapshotItem[]> { const list=await this.listSnapshots();if(await this.exists(this.file('ordinary','previous.json'))){try{const s=await this.readSnapshot(PREVIOUS_ID);list.push({id:PREVIOUS_ID,valid:true,createdAt:s.createdAt,reason:'previous'});}catch{list.push({id:PREVIOUS_ID,valid:false});}}return list; }
  private async makeSnapshot(reason:string):Promise<string> {
    if(!this.current)fail('RECOVERY_REQUIRED'); const businessHash=snapshotHash(this.current.payload);
    for(const item of await this.listSnapshots()) if(item.valid && (await this.readSnapshot(item.id)).snapshotHash===businessHash)return item.id;
    this.options.snapshotFault?.(); const id=randomUUID(); const sequence=Math.max(0,...(await this.listSnapshots()).map(s=>s.sequence??0))+1;const s:Snapshot={id,schemaVersion:1,createdAt:this.now().toISOString(),localDateAtCreation:this.localDate(),reason,snapshotHash:businessHash,business:structuredClone(this.current.payload.business),sequence};
    const tmp=this.file('snapshots',`${id}.tmp`); await this.durable(tmp,canonical(s)); await fs.rename(tmp,this.file('snapshots',`${id}.json`)); await this.readSnapshot(id);
    const list=await this.listSnapshots(); for(const item of list.slice(7))await fs.rm(this.file('snapshots',`${item.id}.json`)); return id;
  }
  private async dailySnapshot():Promise<void> {
    try {const marker=this.file('ordinary','snapshot-days.json');let days:string[]=[];
      if(await this.exists(marker)){const v=parseStrict(await this.read(marker));keys(v,['days','hash']);if(!Array.isArray(v.days)||v.days.some(d=>typeof d!=='string'||!/^\d{4}-\d\d-\d\d$/.test(d))||hash(v.days)!==v.hash)fail();days=v.days as string[];}
      if(days.includes(this.localDate())){this.snapshotWarning=false;return;}
      const list=await this.listSnapshots();const latest=list.find(i=>i.valid);if(latest&&(await this.readSnapshot(latest.id)).snapshotHash===snapshotHash(this.current!.payload)){this.snapshotWarning=false;return;}
      await this.makeSnapshot('daily'); days=[...new Set([...days,this.localDate()])].sort();const tmp=this.file('ordinary',`days-${randomUUID()}.tmp`);await this.durable(tmp,canonical({days,hash:hash(days)}));await fs.rename(tmp,marker);this.snapshotWarning=false;
    } catch { this.snapshotWarning=true; }
  }
  retrySnapshot():Promise<StoreResult<StorageState>> { return this.serial(()=>this.result(async()=>{if(this.mode!=='ready')fail('RECOVERY_REQUIRED');await this.dailySnapshot();return this.state();})); }
  prepareImport():Promise<StoreResult<string>> { return this.serial(()=>this.result(()=>this.makeSnapshot('pre-import'))); }
  restore(id:string,baseRevision:number,confirmed:boolean):Promise<StoreResult<StorageState>> { return this.serial(()=>this.result(async()=>{
    if(this.recoveryCode==='UNSUPPORTED_VERSION')fail('UNSUPPORTED_VERSION');
    if(!confirmed||!uuid(id)||baseRevision!==(this.current?.revision??0))fail('CONFLICT');
    const s=await this.readSnapshot(id); let old=this.current;
    let oldText:string|null=null; const currentFile=this.file('ordinary','current.json');
    if(await this.exists(currentFile)) { const text=await this.read(currentFile); try { old=decode(text);oldText=text; } catch { old=undefined;await this.durable(this.file('ordinary',`damaged-${randomUUID()}.json`),text); } }
    if(old && oldText!==null)await this.makeSnapshot('pre-restore');
    // Without a valid current, local terminal ledger cannot be recovered: suppress every restored task.
    const payload=emptyPayload(); payload.business=structuredClone(s.business); if(old)payload.local=structuredClone(old.payload.local);
    else try{payload.local=decode(await this.read(this.file('ordinary','previous.json'))).payload.local;}catch{/* Invalid local projections are never trusted. */}
    for(const e of payload.local.reminderEvents)if(!['delivered','suppressed'].includes(String(e.status))){e.status='suppressed';e.reason='ordinary-restore';}
    for(const t of payload.business.tasks as Entity[]) t.reminderSuppressed=true;
    if(old) { const prefs=payload.business.preferences as Entity; const localPrefs=old.payload.business.preferences as Entity; prefs.hotkey=localPrefs.hotkey!;prefs.launchAtLogin=localPrefs.launchAtLogin!; }
    validatePayload(payload);
    // Explicit user recovery supersedes undecidable journals, preserving their complete evidence.
    for(const tx of await fs.readdir(this.file('transactions'))){if(!uuid(tx))fail('RECOVERY_REQUIRED');await fs.rename(this.file('transactions',tx),this.file('ordinary',`recovery-${tx}`));}
    if(oldText===null) { // Preserve damaged current as rollback protection; a failed restore stays read-only.
      if(await this.exists(currentFile))oldText=await this.read(currentFile);
      // Missing current in an established dataset is not initialization; failed recovery keeps it missing/read-only.
    }
    await this.transaction(envelope(payload,(old?.revision??0)+1,this.now().toISOString(),old?.datasetId),oldText); this.mode='ready'; return this.state();
  })); }
}

