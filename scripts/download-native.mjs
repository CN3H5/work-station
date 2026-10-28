import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root = path.resolve('.cache/electron-headers');
await fs.mkdir(root, { recursive: true });
const response = await fetch('https://www.electronjs.org/headers/v45.0.0/SHASUMS256.txt');
if (!response.ok) throw new Error(`Checksum HTTP ${response.status}`);
const sums = await response.text();
await fs.writeFile(path.join(root,'SHASUMS256.txt'), sums);
for (const [source, dest] of [['node-v45.0.0-headers.tar.gz','headers.tar.gz'],['win-x64/node.lib','node.lib']]) {
  let bytes;
  try { bytes = await fs.readFile(path.join(root,dest)); } catch { const r = await fetch('https://www.electronjs.org/headers/v45.0.0/'+source); if (!r.ok) throw new Error(`Download HTTP ${r.status}`); bytes = Buffer.from(await r.arrayBuffer()); }
  const expected = sums.split(/\r?\n/).find(line => line.trim().endsWith('  '+source))?.split(/\s+/)[0];
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (!expected || actual !== expected) throw new Error(`Checksum mismatch: ${source}`);
  await fs.writeFile(path.join(root,dest),bytes);
  console.log(`Verified ${source}: ${actual}`);
}
const listing = spawnSync('tar',['-tzf',path.join(root,'headers.tar.gz')],{encoding:'utf8'});
if (listing.status !== 0 || listing.stdout.split(/\r?\n/).filter(Boolean).some(p => !p.startsWith('node_headers/') || p.split('/').includes('..') || p.includes('\\'))) throw new Error('Unsafe header archive');
const extracted = spawnSync('tar',['-xzf',path.join(root,'headers.tar.gz'),'-C',root],{stdio:'inherit'});
if (extracted.status !== 0) throw new Error('Header extraction failed');
