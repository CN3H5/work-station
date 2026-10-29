import fs from 'node:fs';
import path from 'node:path';
import {app} from 'electron';
import {startApplication} from '../main/application';
import {rejectLinks} from '../main/data-root';
const base=process.env.WORKSTATION_UI_TEST_BASE??'';
if(path.dirname(base)!==path.resolve('.test-runs')||fs.readFileSync(path.join(base,'.test-owned'),'utf8')!==path.basename(base))throw Error('INVALID_TEST_ROOT');rejectLinks(base);
let enabled=false;
void(async()=>{const appInstance=await startApplication({root:path.join(base,'data'),mode:'test',storeOptions:{fault:stage=>{if(enabled&&stage==='new'&&fs.existsSync(path.join(base,'fail-save')))throw Object.assign(Error('fictional ENOSPC'),{code:'ENOSPC'});}}});if(!appInstance)return;enabled=true;fs.writeFileSync(path.join(base,'ready'),'ready');app.on('will-quit',()=>{fs.writeFileSync(path.join(base,'exited'),'normal-quit');});})().catch(e=>{console.error(e);app.exit(1);});
