# Windows WebView2 已存在错误兼容设计

## 目标

保留缺少 WebView2 时的自动安装，同时避免 WebView2 安装器以 `0x800700B7` 报告 Runtime 已存在时中止 BdiEditor 安装。

## 设计

在 `src-tauri/tauri.windows.conf.json` 中保留 `downloadBootstrapper`。安装器先按 Tauri 默认逻辑检查系统与当前用户的 WebView2 注册信息；检测不到才下载并运行 Evergreen Bootstrapper。

使用与当前 Tauri CLI 2.11.4 匹配的官方 NSIS 模板。仅扩展 WebView2 安装结果分支：退出码为 `0` 时成功，退出码为 `-2147024713`（`0x800700B7`，`ERROR_ALREADY_EXISTS`）时也继续安装应用，其他非零退出码仍然中止。

## 兼容性

已有 WebView2 的系统正常跳过；检测遗漏但 Bootstrapper 确认已存在时继续；真正缺少 Runtime 的系统仍自动安装；其他下载或安装错误仍会阻止应用安装。

## 验证

增加配置测试，确认 Windows 使用 `downloadBootstrapper`、指定自定义 NSIS 模板，且模板包含 `0x800700B7` 分支。运行完整测试和 Windows 交叉构建，并由 Windows CI 完成最终 NSIS 编译。
