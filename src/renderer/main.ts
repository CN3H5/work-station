import {flushSettings, reloadSettings} from './shell';
import './style.css';
import type { WorkStationAPI } from '../shared/contract';
import type { StorageState, SnapshotItem } from '../shared/storage-contract';

declare global { interface Window { workStation: WorkStationAPI } }
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const refresh = document.querySelector<HTMLButtonElement>('#refresh')!;
async function check(): Promise<void> {
  refresh.disabled = true;
  try {
    const result = await window.workStation.getHealth({});
    status.textContent = result.ok ? `本地连接正常 · 版本 ${result.data.version}` : result.userMessage;
  } catch { status.textContent = '本地连接失败。请关闭后重新启动应用。'; }
  finally { refresh.disabled = false; }
}
refresh.addEventListener('click', () => { void check(); });
document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('drop', event => event.preventDefault());
void check();
const warning=document.querySelector<HTMLElement>('#storage-warning')!;
let storage:StorageState|undefined;
function showWarning():void { warning.textContent=[storage?.softBudget?'普通数据已达到 50 MiB 软预算。':'',storage?.snapshotWarning?'快照未生成，请稍后重试。':'',storage?.cleanupPending?'事务已提交，清理待下次启动重试。':''].filter(Boolean).join(' '); }
async function initialize():Promise<void> {
  const result=await window.workStation.storage({action:'state'});if(!result.ok){warning.textContent=result.userMessage;return;} storage=result.data as StorageState;

  showWarning();
}


document.querySelector('#retry')!.addEventListener('click',()=>{void flushSettings();});
document.querySelector('#snapshot-retry')!.addEventListener('click',()=>{void window.workStation.storage({action:'retrySnapshot'}).then(r=>{if(r.ok){storage=r.data as StorageState;showWarning();}});});
async function snapshots():Promise<void> {
  const r=await window.workStation.storage({action:'snapshots'});if(!r.ok){warning.textContent=r.userMessage;return;}
  const list=document.querySelector('#snapshots')!;list.replaceChildren();
  for(const item of r.data as SnapshotItem[]) {const li=document.createElement('li');li.textContent=item.valid?`${item.createdAt} · ${item.reason}`:'损坏副本（不能恢复）';if(item.valid){const button=document.createElement('button');button.textContent='恢复';button.addEventListener('click',()=>{void(async()=>{
    if(!confirm(`恢复 ${item.createdAt} 的普通业务数据？当前有效数据将先生成保护快照；图片、密码簿及本机提醒终态保留，旧任务不会补发通知。`))return;
    if(!confirm('确认替换普通业务内容？'))return;
    const state=await window.workStation.storage({action:'state'});if(!state.ok)return;
    const restored=await window.workStation.storage({action:'restore',id:item.id,baseRevision:(state.data as StorageState).revision,confirmed:true});if(restored.ok){await initialize();await reloadSettings();await snapshots();}else warning.textContent=restored.userMessage;
  })();});li.append(button);}list.append(li);}
}
document.querySelector('#snapshots-refresh')!.addEventListener('click',()=>{void snapshots();});
window.workStation.onFlush(flushSettings);
void initialize();

