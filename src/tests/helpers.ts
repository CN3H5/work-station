import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { rejectLinks } from '../main/data-root';
export function isolatedRoot(): { root: string; cleanup: () => void } {
  const base = path.resolve('.test-runs');
  rejectLinks(base);
  fs.mkdirSync(base, { recursive: true });
  const root = path.join(base, randomUUID());
  fs.mkdirSync(root);
  const token = randomUUID();
  fs.writeFileSync(path.join(root, '.test-owned'), token, { flag: 'wx' });
  return { root, cleanup: () => {
    rejectLinks(root);
    if (path.dirname(root) !== base || fs.readFileSync(path.join(root, '.test-owned'), 'utf8') !== token) throw new Error('UNSAFE_TEST_CLEANUP');
    fs.rmSync(root, { recursive: true });
  } };
}
