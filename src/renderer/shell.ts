import {pages,locate} from './navigation';
import {message} from './dialog';
import type {WorkStationAPI} from '../shared/contract';
declare global {interface Window {workStation:WorkStationAPI}}
const nav=document.querySelector('#navigation')!,container=document.querySelector('#pages')!;
for(const [key,title] of Object.entries(pages)){
 const b=document.createElement('button');b.textContent=title;b.dataset.target=key;b.onclick=()=>locate(key as keyof typeof pages);nav.append(b);
 if(['home','data'].includes(key))continue;
 const section=document.createElement('section');section.dataset.page=key;section.hidden=true;
 const h=document.createElement('h2');h.textContent=title;section.append(h);container.append(section);
 if(!['settings','appearance'].includes(key)){const p=document.createElement('p');p.textContent=({notes:'T06 笔记和公式',memos:'T06 随手记',ddl:'T07/T08 任务与调度',vault:'T09 独立加密密码簿',schedule:'T10 课表'} as Record<string,string>)[key]+'：后续阶段实现。';section.append(p);}
}
const state=document.querySelector('#desktop-state')!,error=document.querySelector('#error')!;
let revision=0,readonly=true;const dirty=new Map<string,unknown>();let flight:Promise<boolean>|undefined;
const controls=new Map<string,HTMLInputElement|HTMLSelectElement>();
const privacy=document.querySelector<HTMLInputElement>('#privacy')!;controls.set('privacyNotification',privacy);privacy.onchange=()=>{dirty.set('privacyNotification',privacy.checked);state.textContent='有未保存设置';};
function select(page:string,key:string,label:string,values:[string,string][]):void{
 const l=document.createElement('label');l.textContent=label;const c=document.createElement('select');for(const [v,t]of values){const o=document.createElement('option');o.value=v;o.textContent=t;c.append(o);}l.append(c);document.querySelector(`[data-page="${page}"]`)!.append(l);controls.set(key,c);
 c.onchange=()=>{dirty.set(key,key==='fontScale'?Number(c.value):key==='reduceMotion'?c.value==='true':c.value);state.textContent='有未保存设置';apply();};
}
select('appearance','mode','主题',[['system','跟随系统'],['light','浅色'],['dark','深色']]);
select('appearance','fontScale','字号',[['1','100%'],['1.25','125%'],['1.5','150%']]);
select('appearance','reduceMotion','减少动态效果',[['false','跟随系统'],['true','始终减少']]);
select('settings','reminderPause','提醒状态（调度后续实现）',[['false','未暂停'],['true','已暂停']]);
const settings=document.querySelector('[data-page="settings"]')!;
const hot=document.createElement('input');hot.setAttribute('aria-label','未来快速记录快捷键候选');hot.placeholder='例如 Ctrl+Shift+N';controls.set('hotkey',hot);hot.oninput=()=>{dirty.set('hotkey',hot.value);state.textContent='有未保存设置（未注册全局快捷键）';};settings.append(hot);
const guide='普通数据默认未加密。独立密码簿留 T09，主密码不可找回。关闭窗口进入托盘，彻底退出停止提醒（调度留 T08）。普通备份、密码簿和图片需分别迁移，导入导出留后续阶段。备份与清除入口位于数据管理，尚未实现。';
function button(parent:Element,text:string,fn:()=>void):void{const b=document.createElement('button');b.textContent=text;b.onclick=fn;parent.append(b);}
button(settings,'重看首次引导',()=>{void message('首次引导',guide);});
button(settings,'保存设置 / 重试',()=>{void flushSettings();});
button(settings,'重新读取并核对（保留草稿）',()=>{void reloadSettings();});
button(settings,'彻底退出',()=>{void window.workStation.desktop({action:'quit'});});
let data:Record<string,unknown>={};
const dark=matchMedia('(prefers-color-scheme: dark)'),motion=matchMedia('(prefers-reduced-motion: reduce)');
function apply():void{const v={...data,...Object.fromEntries(dirty)};document.documentElement.dataset.theme=v.mode==='system'?(dark.matches?'dark':'light'):String(v.mode);document.documentElement.dataset.motion=String(v.reduceMotion||motion.matches);document.documentElement.style.fontSize=`${Number(v.fontScale??1)*100}%`;}
dark.onchange=apply;motion.onchange=apply;
let loadGeneration=0;
export async function reloadSettings():Promise<void>{const generation=++loadGeneration;const r=await window.workStation.desktop({action:'settings'});if(generation!==loadGeneration)return;if(!r.ok){error.textContent=r.userMessage;return;}if(r.revision<revision)return;revision=r.revision;data=r.data;readonly=Boolean(data.readOnly);for(const[k,c]of controls){c.disabled=readonly;if(c instanceof HTMLInputElement&&c.type==='checkbox')c.checked=Boolean(dirty.has(k)?dirty.get(k):data[k]);else c.value=String(dirty.has(k)?dirty.get(k):data[k]);}apply();if(data.trayError)error.textContent=String(data.trayError);}
export function flushSettings():Promise<boolean>{if(flight)return flight;flight=(async()=>{if(readonly)return dirty.size===0;state.textContent='保存中，请等待；大数据可能超过 10 秒';for(const[key,value]of [...dirty]){const r=await window.workStation.desktop({action:'save',key,value,baseRevision:revision,clientMutationId:crypto.randomUUID()});if(!r.ok){error.textContent=r.code==='CONFLICT'?'保存冲突：请重新读取并核对。草稿已保留。':r.userMessage;state.textContent='保存失败，草稿已保留';return false;}revision=r.revision;if(dirty.get(key)===value)dirty.delete(key);}state.textContent=dirty.size?'有未保存设置':'已保存';await reloadSettings();return dirty.size===0;})().catch(()=>{state.textContent='本地连接失败，草稿已保留';return false;}).finally(()=>{flight=undefined;});return flight;}
document.addEventListener('keydown',e=>{if(e.isComposing||e.repeat||!(e.ctrlKey||e.metaKey))return;if(e.key.toLowerCase()==='s'){e.preventDefault();void flushSettings();}if(e.key.toLowerCase()==='k'&&!(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)){e.preventDefault();void message('搜索 · 后续阶段实现','当前尚未接入业务搜索；快速记录留 T06。');}});
window.addEventListener('focus',()=>{if(!flight)void reloadSettings();});
locate('home');void reloadSettings().then(async()=>{const p=document.createElement('p');p.textContent=`版本 ${data.version} · 未发布 · 数据位置：${data.dataRoot}。许可证见 THIRD_PARTY_NOTICES.md 与 licenses；产品未授予公开分发许可。Ctrl+S 保存，Ctrl+K 搜索说明。自定义配色、背景和图片包留 T11。`;settings.append(p);const auto=document.createElement('button');auto.textContent='开机自启（需打包环境验证）';auto.disabled=!data.launchAvailable||readonly;auto.onclick=()=>{void window.workStation.desktop({action:'launch',value:!data.launchAtLogin}).then(r=>{if(!r.ok)error.textContent=r.userMessage;else void reloadSettings();});};settings.append(auto);if(!data.guideSeen){await message('首次引导',guide);await window.workStation.desktop({action:'guideSeen'});}});
