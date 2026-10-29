# Step 4 故障验证

环境沿用项目 Windows11 x64 开发运行时，虚构数据、独立 `.test-runs/<UUID>`、可控业务时钟。自动测试源：`src/tests/unit/storage.test.ts`、`storage-acceptance.test.ts`；实际终止辅助进程：`src/tests/storage-crash.ts`。

| 验证 | 方法与判断 |
| --- | --- |
| 保存与去重 | 重启、并发串行、旧revision、重复与异内容mutation；后续保存重启仍返回原回执，超过256窗口冲突 |
| 七阶段异常 | new/old/PREPARED/replace/readback/COMMITTED/cleanup 注入异常；前三个及替换/回读回旧，提交后留新 |
| 实际进程终止 | 独立Node子进程在七阶段报告屏障后由父进程终止，重新打开校验完整旧或新版本 |
| 初始化 | 七阶段注入异常及七阶段实际子进程终止；已有数据缺失与新目录分开处理 |
| 迁移 | 仅测试注册版本0；成功、失败，以及PREPARED/replace/COMMITTED实际终止后重复启动 |
| 恢复再中断 | 先在replace终止，再在rollback终止，第三次启动仍恢复旧版本 |
| 写入失败/空间不足 | 注入带ENOSPC的故障；模拟磁盘满，没有填满物理盘 |
| Windows文件占用 | 独立PowerShell进程用FileShare.None占用current，替换失败后重启保持旧版本 |
| 损坏 | 错误JSON、重复/危险键、错误字段与类型、重复ID、所有引用字段、期次重复、错误哈希、未来版本、损坏journal与快照 |
| 容量 | 51MiB软提示；100MiB以上保存拒绝；100001实体拒绝；超大读取先stat后解析，旧版本保留 |
| 快照 | 同日多次、跨日、回拨、相同业务、纯账本变动、9份轮换、失败重试、恢复保护失败及事务副本隔离 |
| 隔离 | 普通保存/恢复前后虚构vault/images文件字节相同；保留通知终态和资源索引，恢复任务抑制 |
| 实际Electron | 合法IPC落盘、恶意路径/额外字段、未授权窗口、原有权限和网络边界 |
| 实际Windows界面 | 按computer-use技能操作真实原生对话框：返回应用保留草稿；故障解除后重试写入revision1/false并退出；放弃退出保持revision0/true |

自动化存储报告 `evidence/storage-latest.json` 包含45项TAP证据与源码摘要；数量不符、失败、跳过或异常退出均拒绝。UI记录 `storage-ui.json` 保留两个隔离目录ID、实际观察与相关控制代码哈希；统一验证检查三项结果和源码绑定。性能与统一报告绑定整个验证源码摘要。

这是注入异常、操作系统进程终止和实际文件占用证据，不是物理断电/物理磁盘满证据。Windows10、安装/便携版、物理断网和长期待机仍保留后续门槛。网络观察仍是10秒窗口与Chromium离线模拟，不能外推到未实现业务或物理断网。
