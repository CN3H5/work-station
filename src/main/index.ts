import { app, dialog } from 'electron';
import path from 'node:path';
import { startApplication } from './application';
import { productionRoot } from './data-root';
const projectRoot = path.resolve(__dirname, '../..');
const dev = !app.isPackaged && process.env.WORKSTATION_DEV === '1';
const preview = !app.isPackaged && process.env.WORKSTATION_PREVIEW === '1';
void startApplication({
  root: dev ? path.join(projectRoot, '.local/development') : preview ? path.join(projectRoot, '.local/preview') : productionRoot(process.env.LOCALAPPDATA),
  mode: dev ? 'development' : preview ? 'preview' : 'production',
  ...(dev ? { devURL: 'http://127.0.0.1:5173/' } : {})
}).catch(() => {
  dialog.showErrorBox('Work Station 无法启动', '无法安全打开应用数据目录或资源。现有数据不会被重置。请查阅 README 的目录与故障说明。');
  app.exit(1);
});
