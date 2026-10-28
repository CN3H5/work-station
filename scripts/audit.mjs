import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const npm = process.env.npm_execpath ?? path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const result = spawnSync(process.execPath, [npm, 'audit', '--json', '--fetch-retries=0', '--fetch-timeout=30000'], { encoding: 'utf8' });
let audit;
try { audit = JSON.parse(result.stdout); } catch { throw new Error('Audit did not return JSON'); }
const evidence = { checkedAt: new Date().toISOString(), node: process.version, lockSha256: createHash('sha256').update(await fs.readFile('package-lock.json')).digest('hex'), command: 'npm audit --json', exitCode: result.status, audit };
await fs.mkdir('docs/implementation/evidence', { recursive: true });
await fs.writeFile('docs/implementation/evidence/dependency-audit.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(audit.metadata ?? audit.error, null, 2));
process.exitCode = result.status ?? 1;
