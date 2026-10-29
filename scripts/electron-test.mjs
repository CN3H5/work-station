import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateEvidence, evidenceExitCode } from './evidence-gate.mjs';
const require = createRequire(import.meta.url);
const id = randomUUID();
const base = path.resolve('.test-runs', id);
await fs.mkdir(base, { recursive: true });
await fs.writeFile(path.join(base, '.test-owned'), id, { flag: 'wx' });
const suite = process.argv[2] ?? 'security';
if (!['security','clipboard','network','offline'].includes(suite)) throw new Error('Unknown test suite');
const env = { ...process.env, WORKSTATION_TEST_BASE: base, WORKSTATION_TEST_ID: id, WORKSTATION_TEST_SUITE: suite };
delete env.ELECTRON_RUN_AS_NODE;
const args = suite === 'network' ? [`--log-net-log=${path.join(base, 'netlog.json')}`, '--net-log-capture-mode=Default'] : [];
args.push(suite === 'clipboard' ? 'dist/tests/clipboard-entry.js' : suite === 'network' || suite === 'offline' ? 'dist/tests/network-entry.js' : 'dist/tests/electron-entry.js');
const child = spawn(require('electron'), args, { env, stdio: 'inherit' });
let timedOut = false;
const timeout = setTimeout(() => { timedOut = true; child.kill(); process.exitCode = 1; }, suite==='network'?1950000:90000);
child.on('exit', async code => {
  clearTimeout(timeout);
  console.log(`Electron suite ${suite} exit: ${code}`);
  const report = path.join(base, 'report.json');
  if (suite === 'network') {
    try {
      const log = JSON.parse(await fs.readFile(path.join(base,'netlog.json'),'utf8'));
      const types = Object.fromEntries(Object.entries(log.constants.logEventTypes).map(([name,value])=>[value,name]));
      const events = log.events.filter(event => /^(TCP_CONNECT|UDP_CONNECT|SSL_CONNECT)$/.test(types[event.type]??''));
      const hostnames = [...new Set(log.events.filter(event=>event.params?.url && /^https?:/.test(event.params.url)).map(event=>new URL(event.params.url).hostname))];
      const data = JSON.parse(await fs.readFile(report,'utf8'));
      data.earlyStartup = { socketEvents:events.length, httpHostnames:hostnames };
      data.results.push({name:'Chromium log from process launch',status:events.length||hostnames.length?'failed':'passed'});
      await fs.writeFile(report,JSON.stringify(data,null,2)+'\n');
      if(events.length||hostnames.length) code=1;
    } catch (error) {console.error('Launch log audit failed:',error);code=1;}
  }
  let evidenceValid = false;
  try {
    const evidence = JSON.parse(await fs.readFile(report, 'utf8'));
    await fs.copyFile(report, `docs/implementation/evidence/${suite}-latest.json`);
    validateEvidence(suite, evidence);
    evidenceValid = true;
  }
  catch (error) { console.error('Missing, invalid or failed Electron evidence; inspect isolated test run:', id, error); }
  process.exitCode = evidenceExitCode(code, timedOut, evidenceValid);
  console.log('Isolated test artifacts:', base);
});
