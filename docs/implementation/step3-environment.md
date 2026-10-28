# Step 3 环境与依赖记录

日期：2026-10-27（Asia/Shanghai）。范围 T03。执行依据为已保存的 Step 3 需求及 Step 1/2 定稿；历史阶段的“不开发”限制不延伸到本阶段。未委派子代理。

## 实际环境

| 项目 | 实际值与证据 |
| --- | --- |
| 当前系统 | CIM Caption：Microsoft Windows 11 家庭版 中文版；10.0.26300，x64；注册表 DisplayVersion=26H2、UBR=9711。旧 ProductName 仍写 Windows 10，未按该旧字段误标系统 |
| 开发 Node / npm | 24.21.0 / 11.19.0；`.node-version`、packageManager、engines 固定；单一 npm 锁文件 |
| Electron | npm 固定 45.0.0；官方 Windows x64 zip SHA-256 `ae53887a23bb640369c93dbd38c408a2af5c0deb86f2fa76c6c244cb444b7f47`，与包内 checksums.json 一致 |
| Electron 内置运行时 | 实际进程报告 Node 24.22.0、Chromium 156.0.8078.48、Node-API 10、模块 ABI 150；与开发 Node 分开记录，见 evidence/security-latest.json |
| TypeScript / Vite | 6.0.3 / 8.3.5；npm 实际可获取包、engines 与编译/构建已验证 |
| electron-builder | 26.18.0；实际 builder-util-runtime=9.7.0，只有一个解析副本 |
| Git | 2.55.0.windows.5；本地 .git 写入需沙箱外执行授权。GitHub 插件账户 CN3H5，对目标私有仓库有写权限 |
| MSVC / SDK | MSVC 14.51.36231（cl 输出14.51.36256.0）；SDK 10.0.26100.0；已有 Visual Studio Community 2026。诊断见 evidence/native-environment.json |

## 版本选择与审计范围

沿用 Step 2 的 Electron 45.0.0、Vite 8.3.5、TypeScript 6.0.3、builder 26.18.0。npm 的 TypeScript latest 标签为 7.0.2，但本阶段无需迁移编译器主版本，继续选已核实且实际编译通过的 6.0.3。没有提前引入 React、Zod、Temporal、Markdown、KaTeX、DOMPurify 或密码学业务依赖。

npm engines：Electron 要求 Node≥22.12.0；Vite 为 ^20.19.0 或≥22.12.0；TypeScript 6.0.3 为≥14.17；builder 为≥14。开发 Node 24.21.0 满足，仍以实际类型检查、构建、Electron 启动作为组合验证。

执行 `npm audit --json`，包含直接、传递、构建和可选依赖。报告列出320项（含未安装的其他平台可选项），此次已知漏洞数为0；完整日期、锁哈希、退出码、结果见 [dependency-audit.json](evidence/dependency-audit.json)。这只是该日期、该锁文件与 npm 公告库的检查，不表示绝对安全或覆盖所有未公开问题。

通过已连接 GitHub 工具核对 Electron 官方45.0.0发布及 Step 2 的源码证据。重点公告包括 [Electron证书修复](https://github.com/electron/electron/security/advisories/GHSA-jr5w-w6x2-84p9)、[builder-util-runtime重定向修复](https://github.com/electron-userland/electron-builder/security/advisories/GHSA-p2f4-r6v6-j797)、[Vite Windows路径修复](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff)。实际运行库9.7.0达到既有修复下限；不使用 updater，不配置发布凭据。无新增业务包，因此其业务安全验证仍在后续阶段。

## 安装及许可归档

`npm install` 建立 package-lock.json；后续使用 `npm ci`。npm 没有运行未批准的 electron-winstaller 安装脚本：本阶段不使用 Squirrel，该项未批准不影响本次源码构建，不能外推打包通过。Electron45在首次引用时下载运行时，本次显式下载并校验后解压，没有按错误提示盲目删除工程。

运行 `npm run licenses` 从实际安装包提取许可原文；320条锁定项中，未安装的其他平台可选包单列，安装包清单含 SHA-256 和完整性。许可类别与原文可追溯至 [inventory.json](../../licenses/inventory.json)。MIT、ISC、BSD、Apache、Python、BlueOak、MPL、WTFPL及多许可声明均记录；17个开发依赖包没有独立许可文件，保留其实际 package.json 和 README，并明确 `licenseEvidence=package-declaration-and-readme`。其中 isarray 的 README 内含完整MIT原文；不把所有包都写成“已有独立许可证原文”。没有修改这些依赖源码。

Electron运行包的 LICENSE 与 LICENSES.chromium.html 已归档至本地 licenses/electron；后者5,705,935字节。许可归档文件由锁定包再生，npm原文目录和大体积Chromium声明被Git排除，清单和生成脚本提交源码。`pack:local`先重新构建和归档，再将THIRD_PARTY_NOTICES及licenses随包复制；后续NSIS工具实际下载和最终包分发许可仍需T14复核。

外部技能：已阅读用户指定技能，查看 skills.sh 目录，当前已有工具足够，本阶段没有安装额外生态技能或修改全局配置。仅把已经验证的离线骨架检查方法保存为工作区技能。

2026-10-28续验：统一验证8步全部通过，源码摘要为`53bc4039f8445091c23541fe6b054cbbccc4ce4d68daffbdc835dcbfd800ec35`。同日刷新npm审计仍为0项已知漏洞，锁文件未改变。skill-creator官方校验脚本已通过；其所需PyYAML6.0.3（MIT）仅从官方`yaml/pyyaml@6.0.3`的17个纯Python模块准备到`.cache/skill-validator`，不进入应用、全局Python或源码库。原PyPI下载因连接超时失败，使用已连接GitHub工具读取官方源文件完成准备，未替换校验逻辑。

## 原生剪贴板构建

使用 Electron 官方45.0.0头文件和x64 node.lib，下载脚本按同站SHASUMS256验证：

- headers SHA-256 `bf3ec8efe30aa2d66759f2e9e8afd05182f656edb09478424d8fb5bcddfae4f6`。
- node.lib SHA-256 `c4ba898a42b8e5e37eeecae6e89c9831d59e0e2d9a279b4189fc2b349ac63156`。

仅编译两个受限方法 `copySecret`、`clearIfUnchanged`，不提供通用Win32/FFI，不接入渲染端。清除在一次OpenClipboard排他区间内比较代次、序列和所有者，再EmptyClipboard；复制发布后记录序列，避免CloseClipboard时系统格式补全改变序列。Electron需要延迟加载node.exe并解析为宿主导出；当前源码自带该最小适配，不新增通用原生包。

脚本仅设置编译子进程环境。系统PowerShell执行策略阻止初版ps1入口后，改为Node调用既有编译器；没有修改执行策略或安装组件。当前Windows11的5项技术验证通过；Windows10与NSIS/portable实物加载和清除测试未执行，仍为T09接入/最终发布门槛。

## 已发现并修复的问题

1. 首轮junction测试在沙箱内被拒绝；同一隔离夹具在获准沙箱外运行后通过，未跳过该断言。
2. Electron45部分API变化：clipboard.readText需等待异步返回；删除已不可用的测试API，改测实际通知和定位权限请求。
3. 初次native加载因node.exe导入失败；加入受限延迟加载，使用静态CRT后在真实Electron中验证。
4. 初次网络观察发现默认Hunspell词典下载，页面webRequest不能证明此处离线。关闭窗口与会话拼写检查，清空词典语言并固定中文应用语言；空白目录复测含启动早期日志，无外部连接。相关机制见 [Electron拼写检查说明](https://www.electronjs.org/docs/latest/tutorial/spellchecker)。
5. 本机Git无可用凭据，CLI交互提示被禁用后明确失败；仓库采用连接插件的Git对象接口同步，未读取令牌、未强制推送。
