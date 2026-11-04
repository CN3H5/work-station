# Step 6 前置复验记录

日期：2026-11-04。状态：开工门槛未闭合，T06业务未开始。

执行分支 `codex/step6-notes-memos` 从已推送的 `b70abb1` 建立，包含 `1f8498f` 和本任务文件；开工时工作区干净。fetch 后 origin/main 仍为 `48feec8`，未包含提醒状态修复。未合入修复，也未改动应用源码。

本轮源码摘要：`e40dfe3ea45cc739bf2a286536af40946488086ef4a2aa776fe7432954dcb8eb`。统一验证结果以 evidence/verification-summary.json 为准，保留失败门槛。

统一验证实际完成11项成功检查：类型、58项单元测试、存储证据、生产构建、原生构建、Electron安全、Step 5四套件共21项、运行时10项、剪贴板5项、10秒网络观察和离线模拟。第12项原生证据绑定失败：`Stale UI evidence: src/renderer/shell.ts`，verify退出1；第13项性能未执行。没有把本次结果标作全部通过，也未降低证据门槛。旧性能结果继续仅作为历史限制。

## 原生操作受阻

已阅读项目 electron-offline-verification 和当前 computer-use 技能及 guidance、confirmations、API。使用独立目录 `.test-runs/2232d7df-2bd0-4aa1-a111-ea7c2fecafe0`，虚构数据、实际 storage-ui-entry 入口，未操作用户数据。

首次测试目录标记写入错误引发 ENOENT 原生错误框，随后修正标记并重新启动，生成 ready 和独立 data。此错误属于本轮测试准备错误，不是产品保存失败。误生成的工作区单个文件已移除。

sky 可列出窗口和读取测试首页，但原生输入没有取得可验证结果：错误框点击返回 `foreground window did not report a process id`；测试首页点击设置返回 `element 24 is not available in cached app state for electron.exe`；随后激活已选窗口返回 `failed to activate captured window`。停止原生输入，不把读取页面或 Chromium 自动事件当作 Windows 操作通过。

因此设置页暂停/恢复的原生保存、重启、托盘菜单同步，以及保存失败退出的返回/重试/放弃场景，本轮均未完成。原 storage-ui.json、step5-manual-user.json 的摘要与原始结论保留，不重新绑定哈希。旧30分钟网络证据只覆盖原源码；本轮短时网络检查不替代它。

## 待继续

恢复可靠的 Windows 窗口交互后，重做上述场景并另存实际证据；统一验证全部通过后才闭合 Step 5、合入修复并开始 T06。Windows10、安装/便携、自启、系统逐档缩放、物理断网和磁盘故障矩阵继续未执行。大型集合整文件保存的原有限制不变。
