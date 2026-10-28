# Step 3 验证记录

范围：当前已实现的工程骨架。初验2026-10-27，交付续审2026-10-28。全部业务输入为虚构字符串，未读取正式业务数据。Windows 11与Windows 10结果分开，后者没有可用环境。

## 对象、环境与复现

Windows 11 家庭中文版 x64，10.0.26300；开发Node 24.21.0、npm11.19.0；Electron45.0.0内置Node24.22.0。实际版本细目见 [环境记录](step3-environment.md)。

先安装锁定依赖、显式准备Electron运行时，再执行 `npm run build`。原生前置为 `npm run native:download` 和 `npm run native:build`。`npm run verify` 顺序执行8个命令，记录源码SHA-256、命令、起止时间、耗时及退出码，首次失败即停止；不会将后续未执行项计为通过。最新机器记录为 [verification-summary.json](evidence/verification-summary.json)：2026-10-28全部8步通过，源码摘要`53bc4039f8445091c23541fe6b054cbbccc4ce4d68daffbdc835dcbfd800ec35`。

## 本阶段检查映射

| 要求／验证项 | 输入与操作、预期 | 实际证据与状态 |
| --- | --- | --- |
| V-DEPS | npm实际版本与engines、传递依赖审计，固定锁文件 | [dependency-audit](evidence/dependency-audit.json)：已检查的锁文件中已知公告数0；不代表绝对安全 |
| 类型与构建 | TypeScript两端检查、Vite生产构建、生成资源清单 | 统一验证记录保存真实退出码；生产清单4个本地资源 |
| 基础测试 | 类型/未知键/危险键、调用源、未知/高版目录、排他锁、资源哈希、junction、可控时钟 | 7项真实断言；见 `src/tests/unit/boundaries.test.ts` 与统一验证结果 |
| 开发启动 | `npm run dev`，环回页面、按钮重新检查 | 2026-10-27实际窗口及按钮反馈检查通过；数据为`.local/development` |
| 生产启动与窗口复核 | `npm run start:preview`，本地生产页面和资源 | 2026-10-28通过当前computer-use工具置前并复核：地址`app://workstation/index.html`、版本1.0.0、未发布标识、业务未实现提示、完整可见布局；数据为`.local/preview` |
| IPC正常调用 | 主窗口`getHealth({})` | [security-latest](evidence/security-latest.json)：DTO正确、没有路径或内部对象 |
| IPC非法参数与权限 | null、数组、字符串、未知字段、危险键；第二个未授权窗口 | 实际Electron IPC拒绝，非纯模拟 |
| 渲染权限隔离 | 读取`typeof require/process`及桥的键 | 均无Node访问，桥只有getHealth |
| 新窗口与导航 | 实际window.open、location跳转 | 无新增窗口、原地址保持 |
| 生产开发者工具 | 主进程尝试openDevTools | 工具保持关闭；快捷键阻止与无菜单为补充防线 |
| 本地资源边界 | 已允许图标、HTML、JS、CSS；未知文件、编码穿越、查询串及外部路径 | 允许资源正常，其余404；哈希改变的资源拒绝；没有映射任意文件系统 |
| CSP与权限 | 插入内联脚本、外网fetch、通知和定位请求 | 内联与fetch被阻止；通知和定位拒绝 |
| 单实例 | 首进程最小化，第二Electron进程携带虚构路径参数启动 | 第二进程退出，原窗口恢复，仅1个窗口；路径参数不执行 |
| 数据隔离 | 检查userData/sessionData及owner | 均为本次`.test-runs/<UUID>/data`，不使用正式目录 |
| 生产安全小计 | 上述实际进程验证 | [security-latest](evidence/security-latest.json)含14项；测试前提与限制不计入通过数 |
| V-OFFLINE资源可用 | 首个窗口前启用Chromium offline，再冷启动 | [offline-latest](evidence/offline-latest.json)：界面、图标、健康检查通过；未关闭Windows网卡，物理断网未执行 |
| 默认不联网 | 全新目录，启动、10秒空闲、隐藏后重开 | [network-latest](evidence/network-latest.json)：从进程启动的Chromium NetLog、主进程Node诊断、Windows进程树与TCP查询；结果按记录，不以配置搜索代替 |
| V-CLIP | 真实Electron加载本地模块；虚构复制、条件清除、相同文本跨进程替换、旧代次、独占占用 | [clipboard-latest](evidence/clipboard-latest.json)：5项技术验证通过；没有实现完整密码簿或30秒业务计时UI |
| 许可归档 | 对实际安装包执行licenses | [inventory](../../licenses/inventory.json)逐包记录；17个开发依赖只有声明/README，未冒称独立许可文件 |
| 工作区技能 | skill-creator校验，检查内容是否来自实测 | `.agents/skills/electron-offline-verification`；[官方校验结果](evidence/skill-validation.json)通过 |
| GitHub与秘密检查 | 私有可见性、源码树、文件清单、秘密模式、PR状态 | 以交接中的最终提交/PR和仓库检查为准；真实数据、运行时、密文和构建产物不进入源码树 |

## 网络观察的覆盖与限制

Chromium启动日志覆盖浏览器网络服务、渲染进程、GPU等应用进程产生的网络事件；主进程另订阅Node网络诊断。应用metrics持续采样40次；Windows侧从主进程递归列出子进程并查询TCP连接。查询辅助PowerShell自身属于测试工具，不能归为产品主动流量。原始NetLog留在Git排除的隔离目录，提交去除URL查询内容后的摘要，避免无关网络元数据进入源码库。

首轮曾发现Hunspell词典下载，修复后使用空白目录重测。不能把页面webRequest阻止当作进程树不联网的证据，也不能把Node诊断为空覆盖为所有未来Node/UDP/worker行为。当前骨架不含额外业务子进程。TCP快照可能漏瞬时连接，使用全时段Chromium日志及主进程诊断补充。

观察仅10秒，不是30分钟托盘验收；当前没有托盘功能。下载依赖和原生头文件属于开发流量，Vite环回属于开发模式，Windows其他进程流量不计入本应用。本记录没有声称九页业务流程已离线验收。

## 系统矩阵与保留门槛

| 组合 | 状态 | 后续影响 |
| --- | --- | --- |
| Windows11 x64、未打包生产资源、当前骨架 | 已执行，逐项以证据为准 | 支持T04/T05开发准备 |
| Windows10 x64 | 未执行，缺少该系统环境 | 不能宣称兼容验收完成；T09及T14必须补测 |
| Windows10/11 × NSIS/portable | 未执行，本阶段不发布正式包 | 原生模块分发、单实例跨包、安装卸载及SmartScreen仍待T14 |
| 物理断网、长期待机、休眠/恢复 | 未执行 | 已有应用离线模拟不替代最终系统矩阵 |
| 日期、事务、导入、快照、密码学及完整UI | 未实现/未执行 | 继续使用H-02各V项，不能计入本阶段通过 |

Windows界面工具两次收到用户物理Esc停止信号后均停止继续输入。生产置前画面与本地文档地址已核实；后续改用已授权的文件、命令及连接工具完成交付，没有继续操作用户其他窗口。

## 已处理失败

早期junction沙箱限制、原生DLL加载、剪贴板CloseClipboard序列变化、异步读取、NetLog接口选择及词典下载均保留为实际发现，详见环境记录。最终交付只依据后续成功证据，不把早期失败输出当作通过。若统一验证存在失败，应保留草稿PR并修复，不能直接合主分支。
