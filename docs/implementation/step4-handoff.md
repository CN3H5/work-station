# Step 4 存储实现与验证交接

日期：2026-10-29。范围是普通单文件存储，不实现笔记、DDL、密码簿、图片迁移或备份导入导出页面。

## 接口和协议

`src/main/ordinary-model.ts` 定义 schemaVersion=1、空数据、严格解析、业务图校验、规范化 JSON 和两种 SHA-256 投影。主进程生成 UUID，UTC 审计，revision 单调增加。普通数据包括 business、local 和最近 256 个 mutation；业务快照排除 local、mutation 和审计字段的哈希影响。

`OrdinaryStore` 提供 open/state/query/commit/flush/listSnapshots/recoveryCandidates/restore/registerMigration/prepareImport/retrySnapshot。query 返回副本，commit 仅供受信主进程业务模块；不可将其直接暴露给渲染端。实际桥只接受状态、单个 privacyNotification 偏好、快照列表、快照重试和确认恢复；拒绝额外字段和路径。统一返回不含路径、正文和堆栈的结果。

事务文件是 `transactions/<UUID>/{new.json,old.json,journal.json,committed.json}`。journal 的目标固定为 ordinary，不接受路径。每个文件写入后 sync，current 使用同卷 rename 替换。成功点是回读验证、previous 安装和 committed 持久写入；之后清理失败不回滚。启动 PREPARED 回滚 old，COMMITTED 核验 current；无法验证则只读。初始化有独立 intent，成功后保留 initialized 标识，避免丢失 current 时误判新目录。文件系统和硬件对物理断电持久性的保证仍有边界。

正常偏好修改经 500ms 防抖；旧响应不能确认新草稿。blur 和正常退出 flush。退出保存失败用原生对话框提供重试、返回应用、放弃编辑。冲突保留草稿，当前最小界面需要重新打开应用核对。

50 MiB 提示、100 MiB 和 100000 实体硬限。普通业务、提醒账本、图片索引有独立投影。恢复保留可用 current 的 local，旧任务一律 reminderSuppressed。current 损坏时保留 damaged 原件；本机账本若已无法验证，则无法声称恢复其全部终态，依靠恢复任务抑制避免补通知。图片和密码簿文件不参与普通操作。生产只支持版本 1；虚构版本 0 仅在测试里注册。

## 已执行证据

`npm test` 33 项通过：串行请求、revision 冲突、重复 mutation、旧响应与新草稿、严格 JSON、未来版本及哈希、7 阶段注入异常、初始化各阶段异常、7 阶段实际子进程终止重启、Windows FileShare.None 独占 current、测试专用迁移成功/失败、9 份快照轮换、失败重试和虚构 vault/images 隔离。ENOSPC 为注入异常，没有实际填满磁盘。终止是进程终止，没有模拟物理断电。

完整统一检查见 [verification-summary](evidence/verification-summary.json)，源码变化后重新运行；实际 Electron 增至 16 项，含合法偏好落盘、恶意参数和未授权窗口。保留缺失/失败/未执行门槛和网络观察的原有限制。

[性能原始记录](evidence/storage-performance.json)：每组5次，毫秒 p50/p95。1万实体校验81/118、打开262/282、保存含每日快照1234/1317；10万实体734/805、1951/2028、10465/10834；2 MiB 笔记2/2、48/64、229/247。快照复用分别373/433、2750/2787、55/62。RSS 是同一进程累积采样而非独立峰值，10万组 p95 约741 MiB。1万和10万实体保存超过约1秒目标，当前采用整文件完整校验，不能宣称高容量交互性能已达标。性能是早期实现样本，之后的小幅恢复接口变更未重新测量。

## 尚待完成的验收与限制

尚未逐项覆盖：恢复过程再次中断、迁移中断、真实初始化子进程终止、去重窗口淘汰、全部关系字段负例、100 MiB 边界、时间回拨与纯账本变化、恢复保护失败、退出失败三个选项的实际 UI 操作。现有测试通过不能代替这些要求。当前最小界面未提供草稿冲突合并。

Windows 10、安装/便携版、物理断网、物理磁盘满、真实断电、长期待机仍未执行。尚不具备完整 T04 验收并合入主分支的条件；T05 应等上述必要存储门槛补齐后再开始。不得将该记录作为完整产品或发布认证。
