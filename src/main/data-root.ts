import fs from 'node:fs';
import path from 'node:path';
export const OWNER = Object.freeze({ kind: 'work-station-owner', formatVersion: 1 });

export function rejectLinks(target: string): void {
  let current = path.resolve(target);
  for (;;) {
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error('LINKED_DATA_ROOT'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
export function prepareDataRoot(root: string): void {
  if (!path.isAbsolute(root)) throw new Error('ABSOLUTE_ROOT_REQUIRED');
  rejectLinks(root);
  if (fs.existsSync(root)) {
    const entries = fs.readdirSync(root);
    if (entries.length && !entries.includes('owner.json')) throw new Error('UNKNOWN_DATA_ROOT');
  } else fs.mkdirSync(root, { recursive: true });
  const marker = path.join(root, 'owner.json');
  if (fs.existsSync(marker)) {
    if (fs.lstatSync(marker).isSymbolicLink() || fs.statSync(marker).size > 1024) throw new Error('INVALID_OWNER');
    const owner: unknown = JSON.parse(fs.readFileSync(marker, 'utf8'));
    if (JSON.stringify(owner) !== JSON.stringify(OWNER)) throw new Error('INCOMPATIBLE_OWNER');
  } else fs.writeFileSync(marker, JSON.stringify(OWNER), { flag: 'wx' });
}
export function acquireRootLock(root: string): () => void {
  const filename = path.join(root, 'instance.lock');
  rejectLinks(filename);
  const create = (): number => fs.openSync(filename, 'wx');
  let fd: number;
  try { fd = create(); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if (fs.statSync(filename).size > 128) throw new Error('INVALID_LOCK');
    const previous = Number(fs.readFileSync(filename, 'utf8'));
    if (!Number.isSafeInteger(previous) || previous < 1) throw new Error('INVALID_LOCK');
    try { process.kill(previous, 0); throw new Error('DATA_ROOT_IN_USE'); }
    catch (probe) {
      if ((probe as NodeJS.ErrnoException).code !== 'ESRCH') throw probe;
    }
    fs.unlinkSync(filename);
    fd = create();
  }
  fs.writeFileSync(fd, String(process.pid));
  return () => { fs.closeSync(fd); if (fs.readFileSync(filename, 'utf8') === String(process.pid)) fs.unlinkSync(filename); };
}
export function productionRoot(localAppData: string | undefined): string {
  if (!localAppData || !path.isAbsolute(localAppData)) throw new Error('LOCALAPPDATA_REQUIRED');
  return path.join(localAppData, 'WorkStation');
}
