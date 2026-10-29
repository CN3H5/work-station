import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const require=createRequire(import.meta.url);
const {OrdinaryStore}=require('../dist/main/ordinary-store.js');
const {validatePayload,emptyPayload}=require('../dist/main/ordinary-model.js');
const output=[];
for(const [name,count,body] of [['10k',10000,0],['100k',100000,0],['note-2MiB',1,2*1024*1024]]){
 const samples=[];
 for(let run=0;run<5;run++){
  const root=path.resolve('.test-runs',randomUUID());await fs.mkdir(root,{recursive:true});
  const now='2026-10-29T00:00:00.000Z';const payload=emptyPayload();
  payload.business[body?'notes':'tags']=Array.from({length:count},()=>({id:randomUUID(),createdAt:now,updatedAt:now,entityRevision:0,...(body?{title:'fictional',markdown:'x'.repeat(body),tagIds:[]}:{name:'fictional',color:'#123456'})}));
  const store=new OrdinaryStore(root);await store.open();
  const timed=async fn=>{const start=performance.now();await fn();return performance.now()-start;};
  const validation=await timed(()=>validatePayload(payload));
  const save=await timed(async()=>{const r=await store.commit({payload,baseRevision:0,clientMutationId:randomUUID()});if(!r.ok)throw Error(r.code);});
  const open=await timed(async()=>{if(!(await new OrdinaryStore(root).open()).ok)throw Error('open');});
  const snapshot=await timed(async()=>{const r=await store.prepareImport();if(!r.ok)throw Error(r.code);});
  samples.push({validation,saveIncludingDailySnapshot:save,open,snapshotReuse:snapshot,rss:process.memoryUsage().rss});
 }
 const percentiles={};for(const key of Object.keys(samples[0])){const a=samples.map(x=>x[key]).sort((a,b)=>a-b);percentiles[key]={p50:a[2],p95:a[4]};}
 output.push({name,samples,percentiles});
}
await fs.writeFile('docs/implementation/evidence/storage-performance.json',JSON.stringify({createdAt:new Date().toISOString(),runtime:process.version,repetitions:5,units:'milliseconds; rss bytes (process cumulative, not isolated peak)',output},null,2)+'\n');
