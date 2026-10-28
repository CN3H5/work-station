import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const npm = process.env.npm_execpath ?? path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const files=[];
async function visit(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){if(item.isSymbolicLink())throw new Error('Linked verification source');const p=path.join(dir,item.name);if(item.isDirectory())await visit(p);else if(item.isFile())files.push(p);}}
for(const dir of ['src','scripts','build','assets','native']){
  if(dir==='native'){for(const name of await fs.readdir(dir))if(name.endsWith('.cc'))files.push(path.join(dir,name));}
  else await visit(dir);
}
files.push('package.json','package-lock.json','tsconfig.json','tsconfig.renderer.json');
async function sourceHash(){const hash=createHash('sha256');for(const file of files.sort()){hash.update(file.replaceAll('\\','/')+'\0');hash.update((await fs.readFile(file,'utf8')).replaceAll('\r\n','\n')+'\0');}return hash.digest('hex');}
const report={startedAt:new Date().toISOString(),node:process.version,os:os.version(),release:os.release(),sourceSha256:await sourceHash(),steps:[],status:'running'};
await fs.mkdir('docs/implementation/evidence',{recursive:true});
for(const name of ['typecheck','test','build','native:build','test:electron','test:clipboard','test:network','test:offline']){
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
