import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {sourceHash} from './source-hash.mjs';
import { spawnSync } from 'node:child_process';
const npm = process.env.npm_execpath ?? path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const report={startedAt:new Date().toISOString(),node:process.version,os:os.version(),release:os.release(),sourceSha256:await sourceHash(),steps:[],status:'running'};
await fs.mkdir('docs/implementation/evidence',{recursive:true});
for(const name of ['typecheck','test','test:storage','build','native:build','test:electron','test:step5','test:step5-runtime','test:clipboard','test:network','test:offline','test:storage-ui-evidence','test:storage-perf']){
  console.log(`\nVERIFY ${name}`);
  const start=Date.now();
  const result=spawnSync(process.execPath,[npm,'run',name],{stdio:'inherit'});
  report.steps.push({command:`npm run ${name}`,exitCode:result.status,durationMs:Date.now()-start,status:result.status===0?'passed':'failed'});
  if(result.status!==0){report.status='failed';break;}
}
if(await sourceHash()!==report.sourceSha256)report.status='source-changed-during-verification';
else if(report.status==='running')report.status='passed';
report.finishedAt=new Date().toISOString();
await fs.writeFile('docs/implementation/evidence/verification-summary.json',JSON.stringify(report,null,2)+'\n');
process.exitCode=report.status==='passed'?0:1;
