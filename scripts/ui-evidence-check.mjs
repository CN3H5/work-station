import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const report=JSON.parse(await fs.readFile('docs/implementation/evidence/storage-ui.json','utf8'));
if(report.status!=='passed'||report.results?.length!==3||report.results.some(r=>r.status!=='passed'))throw Error('Missing/failed UI evidence');
for(const [file,sha] of Object.entries(report.sources)){if(createHash('sha256').update((await fs.readFile(file,'utf8')).replaceAll('\r\n','\n')).digest('hex')!==sha)throw Error('Stale UI evidence: '+file);}
console.log('Native UI evidence: 3 passed, source bindings match');
