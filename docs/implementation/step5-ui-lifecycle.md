# Step 5 页面、设置与生命周期（待验收）

2026-10-29。此分支实现桌面框架初稿，尚未满足 Step 5 完成标准。

九页本地导航由 renderer/navigation.ts 控制，页面枚举与 UUID 记录定位不接受路径或 URL。主页默认展示；尚未实现的业务按 T06—T11 标明阶段。数据管理保留快照重试、候选查询与双重确认恢复。通用对话框使用原生 dialog，实现焦点约束、Esc 和关闭后恢复焦点。主题、字号和减少动态效果使用固定选项；reduceMotion=false 跟随系统媒体查询，true 始终减少，媒体查询变化不写回用户偏好。

新增 workstation:desktop 受限桥接：settings 查询相关 DTO 与本机状态；save 只允许 mode/fontScale/reduceMotion/privacyNotification/hotkey/reminderPause 单键写入，携带 baseRevision 和 clientMutationId，沿用 OrdinaryStore 串行事务、revision 冲突和持久去重；guideSeen 记录引导；quit 请求退出；launch 在打包环境调用固定 process.execPath，无网页路径/参数入口。恢复模式拒绝普通写入。启动注册以 OS 状态为准，恢复普通快照不会触发自启注册。安装/便携目标适配尚待分发验证。

runtime/ui-state.json 为独立 version=1 本机标记文件，包含 guideSeen/closeSeen。读取损坏只重置提示标记，不改普通业务；固定文件路径拒绝链接，以临时文件 fsync 后 rename 保存，不进入业务快照。未来全部清除必须覆盖 runtime/ui-state.json。

托盘使用本地 PNG，提供打开、暂停/恢复（调度未实现）、彻底退出。关窗前先说明、再等待 renderer flush 与主进程队列；失败时窗口保留，提供重试/返回/放弃。退出销毁托盘。托盘创建失败禁止隐藏。二次启动 restore/show/focus 同一窗口。保存等待上限由10秒改为120秒，不提前报告成功；尚待实际超过10秒退出路径验收。

已知未完成：T08 的主动状态推送、T09 隐藏/最小化/锁屏锁定事件契约尚未补齐；只提供提醒偏好及查询。Ctrl+S 调用真实设置保存，Ctrl+K 显示后续搜索说明；不注册全局快捷键，候选格式检查不等于系统冲突检查。
