# Step 5 桌面框架与生命周期

本阶段只实现T05；完整笔记/公式/随手记留T06，DDL与调度留T07/T08，密码簿留T09，课表留T10，自定义背景及图片包留T11。没有模拟业务记录、虚假通知成功或全局快捷键注册。

## 页面与设置

九页由 renderer/navigation.ts 的页面枚举切换；内部定位仅接受枚举与UUID。默认首页，窄窗紧凑导航、可滚动内容、固定可见焦点。renderer/dialog.ts 提供原生HTML模态对话框与焦点返回，恢复需要二次明确确认。数据管理保留快照候选、恢复与快照重试入口。

workstation:desktop 的 settings 查询仅返回相关设置/本机DTO；save 接受baseRevision、clientMutationId、单个白名单key/value，拒绝数组键、错误值、重复修饰键以及任意路径/payload/账本。OrdinaryStore 串行合并单字段、持久去重、拒绝旧revision。草稿跨页保留；被动刷新不推进有草稿编辑器的基准revision；冲突需“重新读取并核对”展示磁盘值和草稿，用户确认后才能使用新revision保存。保存成功清除旧错误。

主题system/light/dark、字号100/125/150%、privacyNotification、reduceMotion、hotkey候选与reminderPause均使用schemaVersion=1现有字段。reduceMotion=false跟随系统媒体查询，true始终减少；系统变化不写回用户偏好。主题与字号仅映射受控样式。Ctrl+S实际保存；Ctrl+K显示后续搜索说明；输入及组合输入保护，Ctrl+N不截获。设置页包含版本、未发布、数据位置、许可证与重看引导。

## 本机标记

main/ui-state.ts 管理 runtime/ui-state.json，固定version=1与guideSeen/closeSeen。主进程只允许两个明确标记动作；有大小上限、严格字段/重复键校验、拒绝链接、临时文件fsync后rename，持久化失败不推进内存标记。损坏仅重置提示，不重置业务数据；不进入普通快照或备份。未来全部清除必须覆盖该文件。

## 托盘与保存退出

本地打包PNG图标，菜单提供打开、暂停/恢复（明确调度未实现）、彻底退出。关窗先说明且默认返回，再flush渲染草稿与主进程队列后隐藏；失败保留窗口并提供重试、返回、确认放弃。托盘失败禁止隐藏。打开/双击及第二次启动恢复同一窗口，最小化先restore再show/focus。重复退出请求不重复提交，退出意图可升级隐藏请求。正常退出销毁托盘、移除powerMonitor监听及IPC处理器、释放目录锁。

等待状态通过save-wait事件区分processing/unresponsive/failed。渲染失联与明确保存失败有不同原生提示；仍有主进程写入事务时继续等待，不把120秒完成确认窗口当作磁盘失败。不能提前显示已保存，也不取消事务校验。

## T08/T09契约

reminderState 查询返回 paused/revision/readOnly/scheduler='not-implemented'。onDesktopEvent 只订阅固定通道并返回注销函数；主进程只向授权主窗口推送reminder-state。保存及恢复会刷新菜单和状态；数据管理据此重新查询快照/容量警告。

lock-request 包含reason=minimize/hide/screen-lock及递增sequence，分别来自窗口事件和powerMonitor。此契约供T09订阅，不是密码簿已锁定的确认，不传秘密正文。当前无密码簿处理。

开机自启仅允许打包环境对固定process.execPath及空参数调用并校验OS状态；失败尝试回退原状态。开发/预览禁用，不注册Electron测试入口。普通数据恢复不调用系统注册。安装/便携真实行为仍是分发矩阵门槛。

## 测试边界

testTrayFailure与inspectDesktop只存在于受信的mode=test配置/返回对象，不经preload或IPC开放。自动化通过实际Electron调用菜单处理器、注入对话框响应和合成锁屏事件，不冒充Windows鼠标托盘操作或真实锁屏。源码摘要覆盖src/scripts/build/assets、验收脚本与native源码；PNG按原始字节计算。
