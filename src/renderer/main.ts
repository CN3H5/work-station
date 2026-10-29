import './style.css';
import type { WorkStationAPI } from '../shared/contract';
import type { StorageState, SnapshotItem } from '../shared/storage-contract';
import { Autosave } from '../shared/autosave';
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
const privacy=document.querySelector<HTMLInputElement>('#privacy')!;
const saveState=document.querySelector<HTMLElement>('#save-state')!;
const warning=document.querySelector<HTMLElement>('#storage-warning')!;
let saver:Autosave<boolean>|undefined;
let storage:StorageState|undefined;
function showState():void { saveState.textContent=({saved:'已保存',saving:'保存中',failed:'保存失败，编辑内容已保留',conflict:'冲突，请重新打开应用核对最新偏好',recovery:'只读恢复，请选择有效副本'} as const)[saver?.state??'recovery']; }
function showWarning():void { warning.textContent=[storage?.softBudget?'普通数据已达到 50 MiB 软预算。':'',storage?.snapshotWarning?'快照未生成，请稍后重试。':'',storage?.cleanupPending?'事务已提交，清理待下次启动重试。':''].filter(Boolean).join(' '); }
async function initialize():Promise<void> {
  const result=await window.workStation.storage({action:'state'});if(!result.ok){saveState.textContent=result.userMessage;return;} storage=result.data as StorageState;
  privacy.checked=storage.privacyNotification;privacy.disabled=storage.mode!=='ready';
  saver=new Autosave(privacy.checked,storage.revision,async(value,revision,id)=>{const r=await window.workStation.storage({action:'savePreference',baseRevision:revision,clientMutationId:id,privacyNotification:value});if(r.ok){storage=r.data as StorageState;showWarning();return {ok:true,revision:storage.revision};}return {ok:false,code:r.code};},showState);
  if(storage.mode!=='ready')saver.state='recovery';showState();showWarning();
}
privacy.addEventListener('change',()=>saver?.edit(privacy.checked));
privacy.addEventListener('blur',()=>{void saver?.flush();});
document.querySelector('#retry')!.addEventListener('click',()=>{void saver?.flush();});
document.querySelector('#snapshot-retry')!.addEventListener('click',()=>{void window.workStation.storage({action:'retrySnapshot'}).then(r=>{if(r.ok){storage=r.data as StorageState;showWarning();}});});
async function snapshots():Promise<void> {
  await saver?.flush(); const r=await window.workStation.storage({action:'snapshots'});if(!r.ok){warning.textContent=r.userMessage;return;}
  const list=document.querySelector('#snapshots')!;list.replaceChildren();
  for(const item of r.data as SnapshotItem[]) {const li=document.createElement('li');li.textContent=item.valid?`${item.createdAt} · ${item.reason}`:'损坏副本（不能恢复）';if(item.valid){const button=document.createElement('button');button.textContent='恢复';button.addEventListener('click',()=>{void(async()=>{
    if(!confirm(`恢复 ${item.createdAt} 的普通业务数据？当前有效数据将先生成保护快照；图片、密码簿及本机提醒终态保留，旧任务不会补发通知。`))return;
    if(!confirm('确认替换普通业务内容？'))return;
    const state=await window.workStation.storage({action:'state'});if(!state.ok)return;
    const restored=await window.workStation.storage({action:'restore',id:item.id,baseRevision:(state.data as StorageState).revision,confirmed:true});if(restored.ok){await initialize();await snapshots();}else warning.textContent=restored.userMessage;
  })();});li.append(button);}list.append(li);}
}
document.querySelector('#snapshots-refresh')!.addEventListener('click',()=>{void snapshots();});
window.workStation.onFlush(async()=>{await saver?.flush();return saver?.state==='saved'||(saver?.state==='recovery'&&privacy.disabled);});
void initialize();

