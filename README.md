# Work Station

日常学习工作台，产品版本 **1.0.0**。当前为**未发布的 Step 3 工程基础**：仅有本地状态窗口、安全能力桥、目录与单实例基础、构建和测试入口。笔记、DDL、课表、密码簿、保存、通知及备份均尚未实现。

## 启动与验证

开发环境固定 Node.js 24.21.0、npm 11.19.0，Windows x64。在项目目录执行：

```powershell
npm ci
node node_modules/electron/install.js
npm run typecheck
npm test
npm run build
npm run start:preview
```

Electron 45 在首次使用时才下载运行时；显式安装命令便于将下载与离线运行分开。网络环境需要代理时，仅为当前命令配置现有代理，不修改系统设置。下载完成后，生产资源启动无需网络。

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 编译并启动开发模式；Vite 仅绑定 `127.0.0.1:5173`；修改主进程/preload 后重启 |
| `npm run typecheck` | 主进程、preload、共享契约及渲染端类型检查 |
| `npm run verify` | 顺序执行本阶段8个验证命令，记录源码哈希及每步真实退出码；需先准备原生构建材料 |
| `npm test` | 编译后在开发 Node 运行 7 项基础测试；含 Windows junction，用受限沙箱时可能需获准在沙箱外运行 |
| `npm run build` | 编译主进程/preload，构建本地界面，生成资源白名单及内容哈希 |
| `npm run start:preview` | 用生产资源和生产权限启动，数据仅存工作区 `.local/preview` |
| `npm start` | 正式目录契约启动；需先构建，会使用 `%LOCALAPPDATA%\WorkStation`；日常验证请用 preview |
| `npm run test:electron` | 实际 Electron 安全、IPC、资源与单实例测试 |
| `npm run test:network` | 实际进程启动日志、10 秒空闲及重新显示窗口的网络观察 |
| `npm run test:offline` | 首个窗口加载前启用 Chromium 离线模拟；不修改 Windows 网卡 |
| `npm run audit:deps` | 联网查询 npm 公告，记录日期、范围及锁文件 SHA-256 |
| `npm run licenses` | 从实际安装包再生许可证原文和清单；完全本地执行 |
| `npm run native:diagnose` | 诊断现有 MSVC、SDK、Electron 头文件及 x64 导入库 |
| `npm run native:download` | 获取并校验固定 Electron 版本的官方原生构建材料 |
| `npm run native:build` | 用已有工具编译最小剪贴板适配和虚构数据辅助进程 |
| `npm run test:clipboard` | 验证真实 Windows 剪贴板条件清除；会使用虚构字符串覆盖当前剪贴板 |
| `npm run pack:local` | 后续本地技术打包入口，生成未签名的解包目录，不发布 Release；本阶段未验收此入口的成品 |

原生测试顺序为 `native:download` → `native:build` → `compile` → `test:clipboard`。没有 MSVC/SDK 时只诊断并记录，脚本不会安装系统组件或修改执行策略。两类 Electron 测试都要求已完成 `npm run build`；安全测试不自动运行原生模块。

## 目录与安全边界

主进程在 `src/main`，最小桥在 `src/preload`，本地页面在 `src/renderer`，契约在 `src/shared`，测试在 `src/tests`，构建配置在 `build`。生产桥仅有 `getHealth({})`，不提供读文件、写路径、打开 URL 或通用 IPC。

正式运行固定使用 `%LOCALAPPDATA%\WorkStation`，安装版和便携版同一用户共享目录和单实例锁。便携程序复制不会迁移个人数据。当前只创建：

- `owner.json`：产品与目录格式标识。未知目录、不兼容版本和链接目录拒绝打开，不重置数据。
- `instance.lock`：进程占用标识；正常退出清理，崩溃后仅在确认原进程不存在时移除。PID 被复用时会保守拒绝，不能据此删除用户数据。
- `runtime/`：Electron 会话缓存、偏好及诊断元数据。

开发目录为工作区 `.local/development`，预览目录为 `.local/preview`，自动化目录为 `.test-runs/<UUID>`，均被 Git 排除。测试不读取正式业务数据。基础测试只清理由本次创建且通过标记、路径和链接检查的目录；Electron 测试保留隔离产物便于排查，不会自动删除不明目录。

当前没有应用内清除或数据备份。需要清理**测试目录**时先关闭本项目进程并核对绝对路径；不要将测试清理流程用于正式目录。T04 才实现数据事务、迁移、快照和恢复。

普通业务数据未来默认明文；私有仓库不能替代加密。密码簿尚未实现，不能在本版本输入或保存真实密码。后续独立主密码不可找回，普通备份必须排除密码簿与背景图片本体；密码簿需独立加密备份，图片需独立迁移。未来应定期备份，设备整体保护可结合 Windows 磁盘加密。应用无法抵御已控制当前 Windows 会话的软件、键盘记录或录屏。

本阶段关闭窗口即退出；托盘、提醒和全局快捷键待后续阶段，不能依赖本版本提醒。未来完整产品仍遵循“彻底退出后不提醒”的既有决策。

## 验证状态与限制

当前在 Windows 11 家庭中文版 x64，版本 10.0.26300 上验证。Windows 10、安装版/便携版四组合、SmartScreen、30 分钟托盘待机与完整业务页均未执行。离线冷启动采用 Chromium 网络离线模拟，不代表物理断开网卡。网络结论只覆盖当前骨架及观察时段。

出现启动失败时，先确认 `npm run build` 成功、目录标识兼容、没有本项目已有进程及目录链接。应用不会把未知目录清空；不要删除个人资料以“修复”启动。Electron 控制台可能输出其自带图标色彩配置警告，不等于业务报错。

完整结果见 [环境记录](docs/implementation/step3-environment.md)、[验证记录](docs/implementation/step3-validation.md)、[下一阶段交接](docs/implementation/step3-handoff.md)。第三方声明见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)。许可原文由锁定安装包离线再生，较大的 Chromium 声明不进入源码历史，但随本地技术包附带。

可复用流程位于 [.agents/skills/electron-offline-verification](.agents/skills/electron-offline-verification/SKILL.md)，只涵盖已经实际验证的工程基础方法。

私有仓库：[CN3H5/work-station](https://github.com/CN3H5/work-station)。本阶段不提供正式安装包、数字签名或 Release。
