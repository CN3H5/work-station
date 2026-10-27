# Work Station · Step 2 验证与Step 3交接

日期2026-10-23。范围T01/T02。五份设计文件已形成；用户三组U2及追加U3均明确确认。设计定稿与工程可运行是两种状态：当前没有应用，所有产品自动化、构建和Windows实测均未执行。

2026-10-25续审：已读取中断前聊天工作日志、五份Step 2和四份Step 1文件；保留用户答复，补齐跨模块细节与事实证据，更正TypeScript候选为6.0.3。最终文档检查结果见H-06。

## H-01 交付与进入条件

- [行为决策](step2-behavior-decisions.md)：Q-08.01—14、DT01—16、提醒与导入状态。
- [架构](step2-architecture.md)：AR-01—05、源码证据、候选版本、安全边界。
- [数据](step2-data-design.md)：D-01—06、字段、事务、三类迁移、加密及清除。
- [页面流程](step2-ui-flows.md)：九页、F-01—09、窗口/键盘/状态。
- 本文：68项映射、验证门槛、风险与下一阶段顺序。

设计已定稿：周期/计划期/提醒分离；休眠与退出区分；普通数据与密码簿隔离；导入统一事务、ID重映射、快照与保护副本分开；九页流程。需用户决定：无，2026-10-23追加问题也已明确接受。需实际构建或运行：下表全部。

T03可启动安全骨架、测试入口、依赖锁定和许可证归档；不存在尚未答复的行为问题阻塞首批实现。条件是进入Step 3的明确任务授权，并先完成V-DEPS再冻结工具链。T04/T07/T09等不能跳过各自技术门槛直接当成可用产品。依赖构建失败、漏洞未修复或权限验证失败时，停止受影响实现/提交并按替代方案处理，不以文档完成免除验证。

## H-02 未执行验证清单

| ID／阶段 | 输入、操作与成功条件 | 风险与失败替代 |
| --- | --- | --- |
| V-DEPS／T03 | 复核发布版本、engines、全部传递依赖安全公告/许可，记录锁文件hash；开发Node与Electron内置Node分别记录；核对builder-util-runtime修复范围 | 本阶段无安装锁文件，不能声称依赖审计通过；选兼容的受支持修复版，必要时暂缓该组件，不能使用已知受影响版作捷径 |
| V-BOOT／T03 | Windows10/11 x64启动精简安全窗口，生成本地HTML/preload/主进程，断网冷启动 | TypeScript/Vite接口适配失败则先固定已验证的兼容补丁组合；依旧保持安全基线，不复制不安全示例 |
| V-SEC／T03、T14 | 恶意IPC、伪造frame、任意路径/新窗口/导航/URL协议、renderer require、devtools入口、权限请求全部拒绝；正常接口可用 | 修正能力桥、协议路径白名单；任何关键绕过阻塞功能合入 |
| V-STORE／T04 | 在prepare、old写完、journal、replace、回读、commit、cleanup各点注入崩溃/磁盘满/占用；结果为完整旧或新版本，无法恢复时只读且不空库 | Windows原子替换或持久性不符则修正双版本提交与恢复协议；不把“rename成功”当整事务证明 |
| V-SNAPSHOT／T04/T12 | 同日多次、次日首次、未变内容、9份快照、导入前/恢复前；最终7份且保护副本不被轮换；失败触发可重试 | 快照失败独立显示；导入前保护失败必须中止 |
| V-DATE／T07 | DT01—16全部；多期未完成、最新期已存在、删除抑制、修改瞬间、回拨后再前进、跨年/闰年；提前量修改与同钟点计划替换不重复提醒、停用后重开不补期 | Temporal/ICU不一致先修正适配器；不因日期库默认值改变基线 |
| V-LIFE／T08 | 提前通知→计划卡→正式期；休眠3期仅建最近而汇总全部漏事件；退出重启仅应用内；暂停恢复；重复resume；claimed边界崩溃 | OS不保证送达，保留应用内记录；Windows通知API行为失败则修正appId/包适配，不悄悄依赖退出后服务 |
| V-RENDER／T06 | 四语法与代码排除、10类工具、表格、错误公式、恶意HTML/MathML/SVG、外链、原型污染、宏循环；CSP下本地字体与公式布局正常 | 净化兼容失败调整精确白名单/局部样式，不开放任意脚本或链接；复杂内容超时只禁该次预览 |
| V-CRYPTO／T09 | 正/错密码、篡改头/tag/密文、超大KDF拒绝、盐nonce每次变化、改密码中断、恢复取消/锁定竞态；检查所有落盘无明文；低配测内存与延迟 | 异步KDF隔离；性能不足先减少重复工作，不擅降工作因子；未通过不得用普通存储临时承载密码 |
| V-CLIP／T03技术入口、T09完成 | 构建仅主进程可用的Windows条件清除模块；复制代次/序列号/所有者在持有剪贴板锁期间核对；同文替换、另一进程替换、新复制旧计时器、占用重试和退出清除；两系统/两包实测 | 公开Electron接口不足以证明原子条件清除；若本地适配未通过，阻塞T09复制及最终发布，不阻塞安全骨架；不以字符串比较代替 |
| V-VAULT-UI／T09 | 5分钟、仅簿内活动、15秒隐藏、最小化/托盘/系统锁屏；锁定丢未存编辑；复制30秒且被替换不清新内容，剪贴板被占用不得谎报已清除 | 依赖V-CLIP，记录OS不可访问的实际结果；改进实现并明示限制 |
| V-IMPORT／T12 | 四选项/未选/取消、标签分类墓碑与映射、课程与时段、整规则副本停用、单期副本独立、父缺失拒绝、不可变版本同ID异内容、重复key；预览期间本地变化重新确认；各阶段写故障回滚和统计；恢复不复活旧系统提醒 | 任何悬空引用或部分写入阻塞导入；回滚失败只读保护，绝不继续修改 |
| V-IMAGES／T11 | 三格式魔数、像素炸弹、base64超限、同名同hash异hash、恶意路径字段、导入取消/中断清理、普通备份缺图后确认应用 | 损坏包全部拒绝；压缩视觉不达标调整工程参数并记录，不扩大外部路径权限 |
| V-CLEAR／T12 | 含所有类型/事务/缓存；根外备份、junction与UNC诱导；各删除点断电重启，clear-intent先恢复且外部备份完好 | 遇链接/路径不确定停止并报告；只重试固定白名单，不跨shell拼删除命令 |
| V-COURSE／T10 | A-COURSE全部、C1—C7及相接端点；学期前后、非周一起点拒绝、特殊时间跨午夜拒绝 | 同一领域函数供首页/课表；不维护两套日期真相 |
| V-UI／T05/T14 | 960×640、字体100/125/150%、系统缩放100/125/150/200%、小工作区、纯键盘和中文输入法；错误/锁定/缺图状态可达可读 | 改响应式布局、滚动和焦点，不缩小文字规避；textarea不足再限定评估CodeMirror |
| V-PERF／T04/T06 | 1万/10万实体、2MiB笔记、100MiB导入边界；搜索目标常用数据≤300ms、预览预算1s、常规保存目标≤1s；实录p50/p95 | 这是目标而非测得值；分批索引/worker/进度反馈；若必须改存储架构另写迁移设计 |
| V-OFFLINE／T03/T14 | 断网冷启动逐页完整流程；联网监测主进程/renderer/子进程DNS/TCP/HTTP、托盘待机30分钟及恢复，无默认请求 | 禁请求只是防线，仍删来源；用户主动浏览器打开单独记录；系统自身流量不误计为应用 |
| V-PACK／T14 | Windows10/11 x64 × NSIS/portable四组合；安装卸载、同用户双包单实例、不同用户隔离、中文路径、SmartScreen、托盘通知/快捷键/自启 | 便携启动器差异调整appId/路径；必要时受支持打包工具替代但重验全部包行为；不承诺签名 |
| V-RELEASE／T15 | 干净源码可重建、README路径一致、私有work-station、真实地址、Release两包SHA-256、无真实数据 | 发布前人工检查索引和产物；里程碑产物必须对应已验证提交 |

Windows操作前按computer-use技能及guidance/confirmations准备；此阶段没有初始化该工具。测试全部虚构数据。记录构建版本/hash、系统、输入、动作、预期、实际、证据和结果；“未执行”不能写成通过。

## H-03 Step 3 首批顺序

1. T03-a读取本五份设计与U2/U3同步记录；复核V-DEPS，选定开发Node/TS/Vite/Electron补丁、许可，建立精简工程及锁文件。此为下一阶段动作。
2. T03-b先实现安全窗口、app协议、最小preload和默认拒绝权限；不开业务特权和更新功能，完成V-BOOT/SEC/OFFLINE基础验证。
3. T03-c建立node:test入口、可控时钟、临时隔离数据根和故障注入接口；先为日期/存储/导入/加密的关键不变量建立测试，不读取真实用户数据；同时登记V-CLIP所需Windows本地编译/打包条件，先验证最小接口，避免到T09才发现能力缺口。
4. T03-d添加.gitignore（应用数据、备份、日志、密文、个人配置、构建目录）、虚构样例与README安全/路径/构建说明；只读检查待提交清单和秘密扫描。
5. T03-e按下一阶段授权建立私有GitHub `work-station`，本地初始化与工作分支，首次检查通过后提交安全骨架、文档、锁文件及测试入口。若远端已存在先核查，不能覆盖他人数据。
6. 阶段结束推工作分支，验收后合主分支；再T04普通存储/恢复、T05界面基础，随后T06—T13按[原路线图](step1-roadmap.md)依赖；T14候选包验收，T15里程碑发布构建与hash。不得上传真实个人数据。

## H-04 交叉审阅结论

提前提醒引用计划期key，Task表在到期才写；多期保留只指已生成期，跳期只影响缺失期；休眠汇总事件不强行补建中间Task；退出事件归应用内。副本引用通过映射整图校验，单期副本解除周期唯一性；快照轮换与事务old隔离。密码簿明文只在解锁内存和必要UI出现，普通导出/搜索/快照无载荷。全部清除含密码簿但普通恢复绝不触碰它。

本次仅文件/链接/编号及设计逻辑审查；没有执行上表产品验证。可复用候选为需求追踪、离线依赖审查、故障恢复验证、Windows生命周期验证；待真实验证并证明复用价值才按skill-creator创建技能。

## H-05 需求—设计—验收逐项映射

下表保留全部原需求编号，A-同名案例仍是基础，补充V项按H-02执行。跨文档章节编号作为稳定引用，点击文件后可搜索编号。

| 需求 | 设计落点 | 原验收 | 补充验证（均未执行） |
| --- | --- | --- | --- |
| SCOPE-001 | [架构 AR-01/03/04](step2-architecture.md) | A-SCOPE-001 | V-BOOT、V-OFFLINE |
| SCOPE-002 | [架构 AR-01/03/04](step2-architecture.md) | A-SCOPE-002 | V-BOOT、V-OFFLINE |
| SCOPE-003 | [架构 AR-01/03/04](step2-architecture.md) | A-SCOPE-003 | V-BOOT、V-OFFLINE |
| SCOPE-004 | [架构 AR-01/03/04](step2-architecture.md) | A-SCOPE-004 | V-BOOT、V-OFFLINE |
| HOME-001 | [行为 B-05](step2-behavior-decisions.md)、[架构 AR-01](step2-architecture.md) | A-HOME-001 | V-DATE、V-COURSE |
| HOME-002 | [行为 B-05](step2-behavior-decisions.md)、[架构 AR-01](step2-architecture.md) | A-HOME-002 | V-DATE、V-COURSE |
| FIND-001 | [架构 AR-01/02](step2-architecture.md) | A-FIND-001 | V-SEC、V-PERF |
| FIND-002 | [架构 AR-01/02](step2-architecture.md) | A-FIND-002 | V-SEC、V-PERF |
| QUICK-001 | [界面 UI-04](step2-ui-flows.md) | A-QUICK-001 | V-UI、V-PACK |
| TAG-001 | [数据 D-02](step2-data-design.md) | A-TAG-001 | V-IMPORT |
| TAG-002 | [数据 D-02](step2-data-design.md) | A-TAG-002 | V-IMPORT |
| UI-001 | [界面 UI-BASE/STATE](step2-ui-flows.md) | A-UI-001 | V-UI |
| UI-002 | [界面 UI-BASE/STATE](step2-ui-flows.md) | A-UI-002 | V-UI |
| UI-003 | [界面 UI-BASE/STATE](step2-ui-flows.md) | A-UI-003 | V-UI |
| UI-004 | [界面 UI-BASE/STATE](step2-ui-flows.md) | A-UI-004 | V-UI |
| NOTE-001 | [架构 AR-03](step2-architecture.md)、[界面 UI-02](step2-ui-flows.md) | A-NOTE-001 | V-RENDER、V-STORE |
| NOTE-002 | [架构 AR-03](step2-architecture.md)、[界面 UI-02](step2-ui-flows.md) | A-NOTE-002 | V-RENDER、V-STORE |
| NOTE-003 | [架构 AR-03](step2-architecture.md)、[界面 UI-02](step2-ui-flows.md) | A-NOTE-003 | V-RENDER、V-STORE |
| NOTE-004 | [架构 AR-03](step2-architecture.md)、[界面 UI-02](step2-ui-flows.md) | A-NOTE-004 | V-RENDER、V-STORE |
| NOTE-005 | [架构 AR-03](step2-architecture.md)、[界面 UI-02](step2-ui-flows.md) | A-NOTE-005 | V-RENDER、V-STORE |
| MEMO-001 | [数据 D-02/03](step2-data-design.md)、[界面 UI-04](step2-ui-flows.md) | A-MEMO-001 | V-STORE、V-UI |
| MEMO-002 | [数据 D-02/03](step2-data-design.md)、[界面 UI-04](step2-ui-flows.md) | A-MEMO-002 | V-STORE、V-UI |
| DDL-001 | [行为 B-01至05](step2-behavior-decisions.md) | A-DDL-001 | V-DATE、V-LIFE |
| DDL-002 | [行为 B-01至05](step2-behavior-decisions.md) | A-DDL-002 | V-DATE、V-LIFE |
| DDL-003 | [行为 B-01至05](step2-behavior-decisions.md) | A-DDL-003 | V-DATE、V-LIFE |
| DDL-004 | [行为 B-01至05](step2-behavior-decisions.md) | A-DDL-004 | V-DATE、V-LIFE |
| DDL-005 | [行为 B-01至05](step2-behavior-decisions.md) | A-DDL-005 | V-DATE、V-LIFE |
| DDL-006 | [行为 B-01至05](step2-behavior-decisions.md) | A-DDL-006 | V-DATE、V-LIFE |
| DDL-007 | [行为 B-01至05](step2-behavior-decisions.md) | A-DDL-007 | V-DATE、V-LIFE |
| DDL-008 | [行为 B-01至05](step2-behavior-decisions.md) | A-DDL-008 | V-DATE、V-LIFE |
| DDL-009 | [行为 B-01至05](step2-behavior-decisions.md) | A-DDL-009 | V-DATE、V-LIFE |
| DDL-010 | [行为 B-01至05](step2-behavior-decisions.md) | A-DDL-010 | V-DATE、V-LIFE |
| DDL-011 | [行为 B-01至05](step2-behavior-decisions.md) | A-DDL-011 | V-DATE、V-LIFE |
| VAULT-001 | [数据 D-05](step2-data-design.md)、[行为 B-06](step2-behavior-decisions.md) | A-VAULT-001 | V-CRYPTO、V-VAULT-UI |
| VAULT-002 | [数据 D-05](step2-data-design.md)、[行为 B-06](step2-behavior-decisions.md) | A-VAULT-002 | V-CRYPTO、V-VAULT-UI |
| VAULT-003 | [数据 D-05](step2-data-design.md)、[行为 B-06](step2-behavior-decisions.md) | A-VAULT-003 | V-CRYPTO、V-VAULT-UI |
| VAULT-004 | [数据 D-05](step2-data-design.md)、[行为 B-06](step2-behavior-decisions.md) | A-VAULT-004 | V-CRYPTO、V-VAULT-UI |
| VAULT-005 | [数据 D-05](step2-data-design.md)、[行为 B-06](step2-behavior-decisions.md) | A-VAULT-005 | V-CRYPTO、V-VAULT-UI |
| VAULT-006 | [数据 D-05](step2-data-design.md)、[行为 B-06](step2-behavior-decisions.md) | A-VAULT-006 | V-CRYPTO、V-VAULT-UI |
| VAULT-007 | [数据 D-05](step2-data-design.md)、[行为 B-06](step2-behavior-decisions.md) | A-VAULT-007 | V-CRYPTO、V-VAULT-UI |
| VAULT-008 | [数据 D-05](step2-data-design.md)、[行为 B-06](step2-behavior-decisions.md) | A-VAULT-008 | V-CRYPTO、V-VAULT-UI |
| COURSE-001 | [行为 B-05](step2-behavior-decisions.md)、[界面 UI-06](step2-ui-flows.md) | A-COURSE-001 | V-COURSE |
| COURSE-002 | [行为 B-05](step2-behavior-decisions.md)、[界面 UI-06](step2-ui-flows.md) | A-COURSE-002 | V-COURSE |
| COURSE-003 | [行为 B-05](step2-behavior-decisions.md)、[界面 UI-06](step2-ui-flows.md) | A-COURSE-003 | V-COURSE |
| COURSE-004 | [行为 B-05](step2-behavior-decisions.md)、[界面 UI-06](step2-ui-flows.md) | A-COURSE-004 | V-COURSE |
| COURSE-005 | [行为 B-05](step2-behavior-decisions.md)、[界面 UI-06](step2-ui-flows.md) | A-COURSE-005 | V-COURSE |
| COURSE-006 | [行为 B-05](step2-behavior-decisions.md)、[界面 UI-06](step2-ui-flows.md) | A-COURSE-006 | V-COURSE |
| LOOK-001 | [数据 D-04](step2-data-design.md)、[界面 UI-07](step2-ui-flows.md) | A-LOOK-001 | V-IMAGES、V-UI |
| LOOK-002 | [数据 D-04](step2-data-design.md)、[界面 UI-07](step2-ui-flows.md) | A-LOOK-002 | V-IMAGES、V-UI |
| LOOK-003 | [数据 D-04](step2-data-design.md)、[界面 UI-07](step2-ui-flows.md) | A-LOOK-003 | V-IMAGES、V-UI |
| LOOK-004 | [数据 D-04](step2-data-design.md)、[界面 UI-07](step2-ui-flows.md) | A-LOOK-004 | V-IMAGES、V-UI |
| DATA-001 | [数据 D-01至06](step2-data-design.md) | A-DATA-001 | V-STORE、V-SNAPSHOT、V-IMPORT、V-CLEAR |
| DATA-002 | [数据 D-01至06](step2-data-design.md) | A-DATA-002 | V-STORE、V-SNAPSHOT、V-IMPORT、V-CLEAR |
| DATA-003 | [数据 D-01至06](step2-data-design.md) | A-DATA-003 | V-STORE、V-SNAPSHOT、V-IMPORT、V-CLEAR |
| DATA-004 | [数据 D-01至06](step2-data-design.md) | A-DATA-004 | V-STORE、V-SNAPSHOT、V-IMPORT、V-CLEAR |
| DATA-005 | [数据 D-01至06](step2-data-design.md) | A-DATA-005 | V-STORE、V-SNAPSHOT、V-IMPORT、V-CLEAR |
| DATA-006 | [数据 D-01至06](step2-data-design.md) | A-DATA-006 | V-STORE、V-SNAPSHOT、V-IMPORT、V-CLEAR |
| DATA-007 | [数据 D-01至06](step2-data-design.md) | A-DATA-007 | V-STORE、V-SNAPSHOT、V-IMPORT、V-CLEAR |
| DATA-008 | [数据 D-01至06](step2-data-design.md) | A-DATA-008 | V-STORE、V-SNAPSHOT、V-IMPORT、V-CLEAR |
| SEC-001 | [架构 AR-02/03](step2-architecture.md)、交接H-03 | A-SEC-001 | V-SEC、V-RELEASE |
| SEC-002 | [架构 AR-02/03](step2-architecture.md)、交接H-03 | A-SEC-002 | V-SEC、V-RELEASE |
| SEC-003 | [架构 AR-02/03](step2-architecture.md)、交接H-03 | A-SEC-003 | V-SEC、V-RELEASE |
| REL-001 | [交接 H-03](step2-validation-handoff.md) | A-REL-001 | V-DEPS、V-PACK、V-RELEASE |
| REL-002 | [交接 H-03](step2-validation-handoff.md) | A-REL-002 | V-DEPS、V-PACK、V-RELEASE |
| REL-003 | [交接 H-03](step2-validation-handoff.md) | A-REL-003 | V-DEPS、V-PACK、V-RELEASE |
| REL-004 | [交接 H-03](step2-validation-handoff.md) | A-REL-004 | V-DEPS、V-PACK、V-RELEASE |
| FLOW-001 | [交接 H-03/04](step2-validation-handoff.md) | A-FLOW-001 | V-RELEASE |
| FLOW-002 | [交接 H-03/04](step2-validation-handoff.md) | A-FLOW-002 | V-RELEASE |

## H-06 最终文档检查与续作记录（2026-10-25）

目标：完成被中断的T01/T02设计交付。约束：沿用Q-01—07和已答U2/U3，仅写Markdown与只读调研，不开发、安装、克隆、建仓、提交或发布，不委派子代理。

已完成工作：核对中断前聊天日志和九份规划文件；补齐提醒身份别名/独立提前量策略、停用再开启、恢复后的通知抑制、分类历史引用、快照业务哈希与覆盖导入范围；校正图片包字节格式；补充Windows剪贴板原子清除设计及V-CLIP门槛；按固定版本源码补证并纠正TypeScript候选。用户决定仍来自10月23日原答复，未把本次工程细节写成用户新确认。

| 文档检查项 | 方法 | 结果及边界 |
| --- | --- | --- |
| 需求/验收/设计覆盖 | 提取Step 1需求、同名A案例、H-05映射编号，比较集合与重复项 | 各68项、各68个唯一编号，缺项/多余均为0；是文档覆盖检查 |
| Q-08状态 | 对照B-01的14个子项、B-08的U2/U3记录及Step 1追加 | 每项有方案、状态、日期例与后续入口，无待用户答复项；工程参数仍待实现测量 |
| 本地链接 | 对九份文件中的Markdown本地.md链接逐个检查存在性 | 修复一处已失效computer-use缓存版本链接；本地目标均可定位。外链证据按各自核查日期使用，不宣称网络永远可达 |
| 日期例的资料核对 | 用系统日历核对2026-10-21星期、2028年2月天数，并用系统时区资料核对2026-03-08 02:30缺口及11-01 01:30重叠 | 与DT04/06/11/12一致；未运行产品日期算法，V-DATE仍未执行 |
| 关键跨模块边界 | 审阅H-04、B-02/04/07、D-02/03/05 | 提前事件不预建Task，跳期不丢已生成历史；休眠汇总和退出展示分开；副本引用、回滚保护与密码簿隔离有明确契约 |
| 阶段范围 | 枚举工作目录文件与本次操作 | 工作区只有九份规划Markdown；无应用工程、依赖安装、候选运行、仓库创建或提交发布 |

结论分类：设计已定稿；需用户决定事项为0；实际构建/运行验证全部留H-02，其中V-DEPS为T03冻结依赖的门槛，V-CLIP为T09复制及最终发布的门槛。首批安全骨架与测试入口已有设计输入，不代表整个产品已经通过验收。

可复用经验候选：用稳定身份与提交点审阅跨模块行为，按固定tag而非“latest”推断版本，对文档检查和产品实测分别记录结果。尚未实际验证为通用流程，因此未创建新Skill。


