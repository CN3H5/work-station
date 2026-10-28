import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const mode = process.argv[2];
if (!['dev', 'production', 'preview'].includes(mode)) throw new Error('Unknown launch mode');
let server;
if (mode === 'dev') {
  const compiled = spawnSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
  if (compiled.status) process.exit(compiled.status);
  const { createServer } = await import('vite');
  server = await createServer({ configFile: 'build/vite.config.mjs' });
  await server.listen();
}
const env = { ...process.env, WORKSTATION_DEV: mode === 'dev' ? '1' : '0', WORKSTATION_PREVIEW: mode === 'preview' ? '1' : '0' };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), ['.'], { env, stdio: 'inherit', windowsHide: false });
child.on('exit', async code => { await server?.close(); process.exitCode = code ?? 1; });
process.on('SIGINT', () => child.kill());
process.on('SIGTERM', () => child.kill());
