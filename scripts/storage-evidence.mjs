import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import {sourceHash} from './source-hash.mjs';
const result=spawnSync(process.execPath,['--test','--test-reporter=tap','dist/tests/unit/storage.test.js','dist/tests/unit/storage-acceptance.test.js'],{encoding:'utf8',maxBuffer:8*1024*1024});
const tap=result.stdout??'';const count=Number(/^# tests (\d+)$/m.exec(tap)?.[1]);const passed=Number(/^# pass (\d+)$/m.exec(tap)?.[1]);const failures=Number(/^# fail (\d+)$/m.exec(tap)?.[1]);const skipped=Number(/^# skipped (\d+)$/m.exec(tap)?.[1]);
const good=result.status===0&&count===45&&passed===count&&failures===0&&skipped===0&&!/not ok/.test(tap);
await fs.writeFile('docs/implementation/evidence/storage-latest.json',JSON.stringify({createdAt:new Date().toISOString(),sourceSha256:await sourceHash(),status:good?'passed':'failed',count,passed,failures,skipped,exitCode:result.status,tap,stderr:result.stderr},null,2)+'\n');
console.log(`Storage evidence: ${passed}/${count}, ${good?'passed':'failed'}`);if(!good){console.error(tap,result.stderr);process.exitCode=1;}
