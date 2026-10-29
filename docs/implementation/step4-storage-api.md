# Step 4 普通存储接口

主进程是唯一写者。目录根由应用固定选择，`OrdinaryStore` 不接受渲染器路径，所有目标拒绝链接。根独占锁由 application 持有。

| 内部方法 | 语义 |
| --- | --- |
| open | 先处理事务再加载；未知、损坏或未来版本只读，不清空 |
| state / query | 状态 DTO / 数据副本；query 只供主进程使用 |
| commit | baseRevision、clientMutationId、受信业务层构造的 payload；串行验证后事务提交 |
| savePreference | 只接受 privacyNotification 布尔值、revision 和 mutation UUID |
| flush | 等待队列；渲染草稿先由 Autosave.flush 提交，再等待主进程队列 |
| listSnapshots / recoveryCandidates | 从实际封装重建并校验；后者包含 previous，不占7份名额 |
| restore | 指定有效副本、当前 revision 和确认标记；先保护当前再事务切换 |
| prepareImport | 未来导入前的保护快照接口；不实现导入入口 |
| retrySnapshot | 业务保存已成功时单独重试快照 |
| registerMigration | 逐版本副本迁移；生产不注册虚构旧格式 |

渲染 IPC `workstation:storage` 只开放 state/savePreference/snapshots/retrySnapshot/restore，逐动作拒绝未知字段。校验发送窗口 ID、主框架及精确文档 URL。禁止渲染器提交 payload、本机通知账本或路径。主进程的故障回调仅接受 mode=test 的程序配置，不提供环境变量/IPC故障开关，测试入口不打包。

成功回执包含固定 revision 和偏好状态。最近256个成功 mutation 的输入摘要和固定回执随 payload 原子写入；重复相同请求返回原回执，不同内容拒绝，淘汰后旧 revision 返回 CONFLICT。快照/待清理/软预算的最新状态通过 state 单独读取。错误 DTO 不含正文、路径或堆栈。

普通文件 contentHash 覆盖完整 payload；snapshotHash 只覆盖普通业务投影并排除审计/扫描更新时间。本机提醒、图片索引、业务投影有独立函数。集合按 UUID 排序，mutation 窗口保留提交顺序。首版 schemaVersion=1，无正式历史格式。

事务的 new、old、PREPARED journal、current 替换、回读、COMMITTED、cleanup 各阶段可测试中断。journal 只存固定目标 ordinary、应用生成 UUID、校验值与初始化标记。旧副本采用原始字节 SHA-256，允许准确回滚损坏 JSON；打开回滚后的损坏状态仍只读。COMMITTED 后清理失败不回滚，下一次写入先重试清理，避免多代遗留 journal 混淆。

恢复会保留可验证 current 的本机资源与账本；current 无法验证时可从有效 previous 保留本机投影。两者都损坏时无法重建已丢失索引，图片文件仍不删除。待提醒事件转为抑制，已投递/抑制终态保留；所有恢复任务抑制补发。损坏 current 与不可判定事务移入普通目录恢复证据，不作为正常快照。未来版本不能通过普通保存或恢复降级。

本协议只覆盖普通单文件。密码簿、图片多文件事务、全部清除及普通备份导入导出均留后续阶段；这些入口尚未开放。
