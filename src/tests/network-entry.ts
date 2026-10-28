import { app, session, netLog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { channel } from 'node:diagnostics_channel';
import { spawnSync } from 'node:child_process';
import { startApplication } from '../main/application';
import { rejectLinks } from '../main/data-root';
const base=process.env.WORKSTATION_TEST_BASE??'';
const id=process.env.WORKSTATION_TEST_ID??'';
if (!/^[0-9a-f-]{36}$/.test(id)||path.resolve(base)!==path.resolve('.test-runs',id)||fs.readFileSync(path.join(base,'.test-owned'),'utf8')!==id) throw new Error('INVALID_TEST_ROOT');
rejectLinks(base);
const offline=process.env.WORKSTATION_TEST_SUITE==='offline';
const nodeEvents:string[]=[];
for(const name of ['net.client.socket','http.client.request.start','undici:request:create','dns.lookup.start','dns.resolve.start']) channel(name).subscribe(()=>nodeEvents.push(name));
const delay=(ms:number):Promise<void>=>new Promise(resolve=>setTimeout(resolve,ms));
void (async()=>{
  const running=await startApplication({root:path.join(base,'data'),mode:'test',beforeWindow:async()=>{if(offline)session.defaultSession.enableNetworkEmulation({offline:true});else await netLog.startLogging(path.join(base,'observed-netlog.json'));}});
  if(!running)return;
  const samples:Array<{elapsedMs:number;pids:number[];types:string[]}>=[];
  const started=Date.now();
  for(let i=0;i<40;i++) {const metrics=app.getAppMetrics();samples.push({elapsedMs:Date.now()-started,pids:metrics.map(m=>m.pid),types:metrics.map(m=>m.type)});if(i===20){running.window.hide();running.window.show();running.window.focus();}await delay(250);}
  const status=await running.window.webContents.executeJavaScript('document.querySelector("#status").textContent');
  assert.match(status,/本地连接正常/);
  const knownPids=[...new Set(samples.flatMap(x=>x.pids))];
  let osSnapshot:unknown=null;
  if(!offline){
    const command=`$taskPids=@(${process.pid}); $taskRows=@(Get-CimInstance Win32_Process -ErrorAction Stop | Select-Object ProcessId,ParentProcessId,Name); do { $taskNew=@($taskRows | Where-Object { $taskPids -contains [int]$_.ParentProcessId -and $taskPids -notcontains [int]$_.ProcessId }); $taskPids+=@($taskNew | ForEach-Object { [int]$_.ProcessId }) } while ($taskNew.Count -gt 0); $taskConnections=@(Get-NetTCPConnection -ErrorAction Stop | Where-Object { $taskPids -contains $_.OwningProcess } | Select-Object State,RemotePort,OwningProcess); @{ processCount=$taskPids.Count; processNames=@($taskRows | Where-Object { $taskPids -contains [int]$_.ProcessId } | Select-Object -ExpandProperty Name); connections=$taskConnections } | ConvertTo-Json -Depth 4 -Compress`;
    const result=spawnSync('powershell.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true});
    osSnapshot={exitCode:result.status,stdout:result.stdout.trim(),error:result.stderr.trim()};
    await netLog.stopLogging();
  }
  let chromeEvents:Record<string,number>={};
  if(!offline){const log=JSON.parse(fs.readFileSync(path.join(base,'observed-netlog.json'),'utf8'));const types=Object.fromEntries(Object.entries(log.constants.logEventTypes).map(([name,value])=>[value,name]));for(const event of log.events){const name=types[event.type]??'UNKNOWN';if(/HOST_RESOLVER.*(DNS|SYSTEM)|TCP_CONNECT|UDP_CONNECT|URL_REQUEST_START_JOB|SSL_CONNECT/.test(name)){chromeEvents[name]=(chromeEvents[name]??0)+1;}}}
  const outbound=Object.entries(chromeEvents).some(([name,count])=>count>0&&/TCP_CONNECT|UDP_CONNECT|SSL_CONNECT/.test(name));
  const osFailed=!offline && (osSnapshot as {exitCode:number|null}).exitCode!==0;
  const report={createdAt:new Date().toISOString(),runtime:process.versions,mode:offline?'Chromium offline before first window':'online startup + 10s idle + reopen',results:[{name:'cold interface and resources available',status:'passed'},{name:'main Node network events',status:nodeEvents.length===0?'passed':'failed'},{name:'Chromium external sockets',status:offline?'not-executed':outbound?'failed':'passed'}],nodeEvents,chromeEvents,processCoverage:{uniquePids:knownPids.length,types:[...new Set(samples.flatMap(s=>s.types))],samples:samples.length},osSnapshot,limits:['Chromium offline emulation does not disable the Windows network adapter.','10-second observation covers only implemented skeleton; not 30-minute tray or future business features.','TCP snapshot can miss short-lived sockets; Chromium netlog and main-process Node diagnostics supplement it.','No remote utilityProcess or child Node runtime is part of the skeleton.']};
  report.results.push({name:'Windows descendant process/TCP query',status:offline?'not-executed':osFailed?'failed':'passed'});
  fs.writeFileSync(path.join(base,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));app.exit(nodeEvents.length||outbound||osFailed?1:0);
})().catch(error=>{console.error(error);app.exit(1);});
