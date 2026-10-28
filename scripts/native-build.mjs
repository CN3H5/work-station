import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const workspace = process.cwd();
const vswhere = 'C:/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe';
if (!fs.existsSync(vswhere)) throw new Error('Missing Visual Studio / vswhere');
const vs = spawnSync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { encoding: 'utf8' }).stdout.trim();
if (!vs) throw new Error('Missing MSVC x64 tools');
const latest = dir => fs.readdirSync(dir).filter(name => fs.statSync(path.join(dir, name)).isDirectory()).sort((a,b) => a.localeCompare(b, undefined, { numeric:true })).at(-1);
const msvcBase = path.join(vs, 'VC/Tools/MSVC');
const msvcVersion = latest(msvcBase);
const msvc = path.join(msvcBase, msvcVersion);
const sdkBase = 'C:/Program Files (x86)/Windows Kits/10';
const sdkVersion = latest(path.join(sdkBase, 'Include'));
const sdk = path.join(sdkBase, 'Include', sdkVersion);
const headers = path.resolve('.cache/electron-headers/node_headers/include/node');
const nodeLib = path.resolve('.cache/electron-headers/node.lib');
const diagnosis = { msvc: msvcVersion, sdk: sdkVersion, headersPresent: fs.existsSync(path.join(headers, 'node_api.h')), importLibraryPresent: fs.existsSync(nodeLib), architecture: 'x64', electron: '45.0.0' };
console.log(JSON.stringify(diagnosis, null, 2));
fs.mkdirSync('docs/implementation/evidence', { recursive: true });
fs.writeFileSync('docs/implementation/evidence/native-environment.json', JSON.stringify(diagnosis, null, 2)+'\n');
if (process.argv.includes('--diagnose')) process.exit(0);
if (!diagnosis.headersPresent || !diagnosis.importLibraryPresent) throw new Error('Run npm run native:download first');
const compiler = path.join(msvc, 'bin/Hostx64/x64/cl.exe');
const env = { ...process.env,
  INCLUDE: [path.join(msvc,'include'), path.join(sdk,'ucrt'), path.join(sdk,'shared'), path.join(sdk,'um'), headers].join(';'),
  LIB: [path.join(msvc,'lib/x64'), path.join(sdkBase,'Lib',sdkVersion,'ucrt/x64'), path.join(sdkBase,'Lib',sdkVersion,'um/x64')].join(';'),
  PATH: path.dirname(compiler)+';'+process.env.PATH
};
const output = path.resolve('native/build'); fs.mkdirSync(output, { recursive: true });
for (const args of [
  ['/nologo','/std:c++17','/EHsc','/MT','/LD','/DNAPI_VERSION=8','/DNODE_GYP_MODULE_NAME=clipboard',path.join(workspace,'native/clipboard.cc'),path.join(workspace,'native/delay-hook.cc'),'/link',nodeLib,'user32.lib','delayimp.lib','/DELAYLOAD:node.exe','/OUT:clipboard.node'],
  ['/nologo','/EHsc','/MD',path.join(workspace,'native/clipboard-peer.cc'),'/link','user32.lib','/OUT:clipboard-peer.exe']
]) { const result = spawnSync(compiler,args,{env,cwd:output,stdio:'inherit'}); if (result.status !== 0) process.exit(result.status ?? 1); }
