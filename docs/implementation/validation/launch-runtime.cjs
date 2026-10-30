const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),{randomUUID}=require('node:crypto'),{spawn}=require('node:child_process');
void(async()=>{
const {sourceHash}=await import(pathToFileURL(path.resolve('scripts/source-hash.mjs')).href);const source=await sourceHash();
const id=randomUUID(),base=path.resolve('.test-runs',id);fs.mkdirSync(base);fs.writeFileSync(path.join(base,'.test-owned'),id);
const env={...process.env,WORKSTATION_ACCEPT_BASE:base,WORKSTATION_ACCEPT_SHA:source};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(require('electron'),['docs/implementation/validation/step5-runtime.cjs'],{env,stdio:'inherit'});let timedOut=false;const timer=setTimeout(()=>{timedOut=true;child.kill();},90000);
child.on('exit',async code=>{clearTimeout(timer);console.log('ROOT',base,'EXIT',code);try{const r=JSON.parse(fs.readFileSync(path.join(base,'acceptance.json'),'utf8'));const passed=!timedOut&&code===0&&r.sourceSha256===source&&await sourceHash()===source&&r.results.length===10&&r.results.every(x=>x.status==='passed');process.exitCode=passed?0:1;if(passed){r.testRoot=id;r.harnessSha256=require('node:crypto').createHash('sha256').update(fs.readFileSync('docs/implementation/validation/step5-runtime.cjs')).digest('hex');fs.writeFileSync('docs/implementation/evidence/step5-runtime.json',JSON.stringify(r,null,2)+'\n');}}catch(e){console.error(e);process.exitCode=1;}});
})().catch(e=>{console.error(e);process.exitCode=1;});
