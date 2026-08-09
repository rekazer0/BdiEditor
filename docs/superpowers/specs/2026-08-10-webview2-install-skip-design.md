# Windows WebView2 安装跳过设计

## 目标

避免 BdiEditor 的 Windows 安装包重复运行 WebView2 安装程序，从而消除 WebView2 已存在时因 `0x800700B7` 导致的应用安装失败。

## 设计

在 `src-tauri/tauri.windows.conf.json` 的 `bundle.windows` 中将 `webviewInstallMode.type` 设置为 `skip`。Windows 安装包不再下载或执行 WebView2 安装程序，应用运行时直接使用系统已有的 WebView2 Runtime。

不添加自定义 NSIS 脚本，不修改应用运行时代码，也不改变 macOS 打包配置。

## 兼容性

Windows 安装不再因 WebView2 安装器返回“已存在”而中止。没有 WebView2 Runtime 的系统需要先从微软官方渠道安装 Runtime，之后才能运行 BdiEditor。

## 验证

增加配置测试，确认 Windows 配置明确使用 `skip`。运行完整测试、前端构建以及 Tauri 配置校验，确保配置结构有效且现有功能不受影响。
