import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const lockBytes = await fs.readFile('package-lock.json');
const lock = JSON.parse(lockBytes);
const entries = [];
await fs.mkdir('licenses/npm', { recursive: true });
for (const [location, locked] of Object.entries(lock.packages)) {
  if (!location) continue;
  let pkg;
  try { pkg = JSON.parse(await fs.readFile(path.join(location, 'package.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && locked.optional) { entries.push({ location, version: locked.version, status: 'optional-not-installed', license: locked.license }); continue; } throw error; }
  const files = (await fs.readdir(location)).filter(name => /^(licen[sc]e|copying|notice)(\.|$|-)/i.test(name));
  // Some published packages contain the only permission statement in README/package.json.
  if (!files.length) files.push(...(await fs.readdir(location)).filter(name => /^(readme(\..*)?|package\.json)$/i.test(name)));
  const archived = [];
  for (const filename of files) {
    const source = path.join(location, filename);
    if (!(await fs.stat(source)).isFile()) continue;
    const bytes = await fs.readFile(source);
    const dest = `${pkg.name.replaceAll('/', '__').replaceAll('@', '')}-${pkg.version}-${filename}`;
    await fs.writeFile(path.join('licenses/npm', dest), bytes);
    archived.push({ file: `licenses/npm/${dest}`, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  entries.push({ name: pkg.name, version: pkg.version, location, license: pkg.license ?? locked.license ?? 'UNSPECIFIED', integrity: locked.integrity, status: 'installed', licenseEvidence: files.some(x=>/^(licen[sc]e|copying|notice)(\.|$|-)/i.test(x)) ? 'standalone-text' : 'package-declaration-and-readme', files: archived });
}
for (const name of ['LICENSE', 'LICENSES.chromium.html']) {
  const bytes = await fs.readFile(path.join('node_modules/electron/dist', name));
  await fs.mkdir('licenses/electron', { recursive: true });
  await fs.writeFile(path.join('licenses/electron', name), bytes);
}
const result = { generatedAt: new Date().toISOString(), lockSha256: createHash('sha256').update(lockBytes).digest('hex'), entries };
await fs.writeFile('licenses/inventory.json', JSON.stringify(result, null, 2) + '\n');
const missing = entries.filter(x => x.status === 'installed' && x.licenseEvidence === 'package-declaration-and-readme');
await fs.writeFile('THIRD_PARTY_NOTICES.md', `# 第三方许可\n\n本项目为未发布的工程基础。依赖清单来自实际安装包与 package-lock.json。生成命令：\`npm run licenses\`。\n\n锁文件 SHA-256：\`${result.lockSha256}\`。\n\n完整包名、版本、声明、完整性及许可文件哈希见 [inventory](licenses/inventory.json)。原文位于 licenses/npm；Electron 与 Chromium/Node 随发行包声明位于 licenses/electron。构建配置将这些声明随包附带。尚未安装的可选平台包在清单中单列，不冒充已检查实物。\n\n运行时仅 Electron，业务库暂未引入；构建依赖包含 electron-builder、NSIS 下载器等，后续实际打包工具须再次归档。electron-builder 的更新检查属于开发工具，不进入产品。\n\n已安装包 ${entries.filter(x => x.status === 'installed').length}，没有独立许可文件的包 ${missing.length}（见清单，须逐项核对其包内声明或上游许可）。\n`);
console.log(JSON.stringify({ packages: entries.length, missingLicenseFiles: missing.map(x => ({ name: x.name, version: x.version, license: x.license })) }, null, 2));
