import { spawnSync } from 'node:child_process';
import { build } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
await build({ configFile: 'build/vite.config.mjs' });
const root = path.resolve('dist/renderer');
const manifest = {};
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
async function visit(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Linked build resource');
    if (entry.isDirectory()) await visit(file);
    else {
      const mime = types[path.extname(file)];
      if (!mime) throw new Error(`Unapproved resource type: ${path.extname(file)}`);
      manifest[path.relative(root, file).split(path.sep).join('/')] = { sha256: createHash('sha256').update(await fs.readFile(file)).digest('hex'), mime };
    }
  }
}
await visit(root);
await fs.writeFile('dist/resources.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`Manifest: ${Object.keys(manifest).length} local resources`);
