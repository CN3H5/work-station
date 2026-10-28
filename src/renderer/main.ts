import './style.css';
import type { WorkStationAPI } from '../shared/contract';
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
