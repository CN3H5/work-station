import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { rejectLinks } from './data-root';
export const CSP = "default-src 'none'; script-src 'self'; worker-src 'self'; connect-src 'none'; img-src 'self'; font-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
export type ResourceManifest = Record<string, { sha256: string; mime: string }>;
export function resourceKey(input: string): string | null {
  if (!input.startsWith('app://workstation/') || /[\\%?#\u0000-\u0020]/.test(input)) return null;
  const key = input.slice('app://workstation/'.length);
  if (!key || key.split('/').some(part => part === '..' || part === '.' || part === '')) return null;
  return key;
}
export async function resourceResponse(input: string, method: string, root: string, manifest: ResourceManifest): Promise<Response> {
  const key = resourceKey(input);
  if (method !== 'GET' || !key || !Object.hasOwn(manifest, key)) return new Response('Not found', { status: 404 });
  const target = path.resolve(root, key);
  if (!target.startsWith(path.resolve(root) + path.sep)) return new Response('Not found', { status: 404 });
  try {
    rejectLinks(target);
    const bytes = await fs.readFile(target);
    const entry = manifest[key]!;
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error('RESOURCE_CHANGED');
    return new Response(bytes, { headers: { 'Content-Type': entry.mime, 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' } });
  } catch { return new Response('Unavailable', { status: 404 }); }
}
