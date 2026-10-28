# 第三方许可

本项目为未发布的工程基础。依赖清单来自实际安装包与 package-lock.json。生成命令：`npm run licenses`。

锁文件 SHA-256：`04ecadf288da5c30428b7746c381571fe0251370d1cf35edd0a6b328e042c822`。

完整包名、版本、声明、完整性及许可文件哈希见 [inventory](licenses/inventory.json)。原文位于 licenses/npm；Electron 与 Chromium/Node 随发行包声明位于 licenses/electron。构建配置将这些声明随包附带。尚未安装的可选平台包在清单中单列，不冒充已检查实物。

运行时仅 Electron，业务库暂未引入；构建依赖包含 electron-builder、NSIS 下载器等，后续实际打包工具须再次归档。electron-builder 的更新检查属于开发工具，不进入产品。

已安装包 295，没有独立许可文件的包 17（见清单，须逐项核对其包内声明或上游许可）。
