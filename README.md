# BdiEdito

一个面向百度输入法 iOS `.bdi` 与 Android `.bds` 皮肤的可视化桌面编辑器。BdiEdito 让皮肤布局、按键样式与资源编辑回到可实时预览的桌面工作流。

支持 macOS 与 Windows，采用轻量的 Tauri 2 + 原生 HTML/CSS/TypeScript 技术栈。

## v0.2.0 更新

- 新增候选栏、工具栏、整体键盘、按键背景与前景样式检查器，并支持处理后图片预览；
- 新增 RGBA 颜色选择器、透明度编辑和画布背景选项；
- 新增编辑模式右键复制/删除、Shift 连续范围选择和源代码选中区域自动定位；
- 新增 iPhone 与主流 Android 设备预览、Android 底部安全区，以及候选栏/工具栏的画布预览；
- 新增设置、关于、内置项目模板和 4 套“尘埃”皮肤模板；
- 修复工具栏尺寸、按键点击状态、画布错位、源码光标错位、导出菜单遮挡、图标模糊和撤销/返回时预览闪烁；
- 优化左右检查器布局、保存/导出图标、源码整行高亮、图片资源预览和 macOS 系统图标渲染。

## 特性

- 打开、创建、保存 `.bdi/.bds` 皮肤；导出时会转换平台目录和 `SupportPlatform`，而非仅改扩展名；
- 自动识别九键、魔改九键和 26 键布局；
- 浅色/深色、竖屏/横屏实时预览；内置 iPhone 17 Pro、iPhone 17 Pro Max、Xiaomi 17、Pixel 10 Pro 与 Galaxy S25 Ultra 的厂商公布分辨率模板；
- 普通、按下/高亮、滑动方向和长按事件预览；
- 交互预览中的字面按键可进入模拟输入区；可视化切换符号、数字、ABC 与 `Z+页面`，其他 `Fxx/Sxx` 只记录事件；
- `Command + 单击`多选按键，Windows 使用 `Ctrl + 单击`；Shift 单击可选择锚点到目标之间的连续按键；
- 编辑模式右键复制或删除一个及多个按键；
- 拖动、等宽、等高、对齐、分布和精确间距；
- 编辑显示文字、点击输入、上下左右滑和长按动作；
- 编辑整体键盘高度、背景图片、背景透明色，以及按键背景/前景样式、字体、字号和正常/按下颜色；
- 多选按键后批量修改正常与按下图片；
- 解析和编辑皮肤名称、描述、作者、版本、平台与深色模式信息；
- 语义化导航并可视化预览皮肤信息、布局、候选栏、符号、工具栏、手写和资源；
- 配置源码提供 INI 语法高亮、选中 section 整行高亮与自动定位，编辑结果与画布实时同步；
- 保留注释、空行、字段顺序、未知字段和未修改资源；
- 保存时保留原始 ZIP 条目顺序、权限、时间扩展字段和未修改条目的压缩数据；
- 默认皮肤模板、4 套“尘埃”内置模板、新建皮肤、撤销/重做和未保存保护；
- 可选择默认、马赛克、白色或深色画布背景；
- 新建、打开、保存、另存为和图片替换具有统一的进行中/成功/取消/失败反馈；文件错误会显示原生错误对话框；
- `.bdi/.bds` 文件关联，可从 Finder 双击打开。

## 范围

0.2 只还原键盘外观和按键状态，不实现百度输入法的拼音候选算法、功能码执行或真实输入引擎。候选内容、输入区与页面切换属于编辑器模拟；未明确支持的 `Fxx/Sxx` 只显示含义或事件。

## 开发与构建

需要 Node.js 20.19+ 或 22.12+、Rust stable，以及对应平台的 Tauri 2 系统依赖。

```bash
npm install
npm test
npm run build
npm run tauri dev
```

构建 macOS `.app`：

```bash
CI=true npm run tauri build -- --bundles app
```

构建结果位于 `src-tauri/target/release/bundle/macos/`。

在 Windows 上构建 NSIS `.exe`：

```powershell
npm run tauri build -- --bundles nsis
```

构建结果位于 `src-tauri/target/release/bundle/nsis/`。推送 `v*` 标签会由 GitHub Actions 同时构建并上传 macOS `.app.zip` 与 Windows `.exe`。

## 兼容性

当前保证兼容项目测试样本所属的百度 iOS 皮肤格式家族。所有未知文件和字段会被保留，但其他历史格式仍需真实样本验证。详情见 [兼容性说明](docs/compatibility.md)。

界面以白色系统风格为主，使用轻量毛玻璃，不依赖 Tauri `macos-private-api`。macOS 发布包使用 ad-hoc 签名，尚未使用 Apple Developer ID 公证；首次打开若被 Gatekeeper 拦截，请在 Finder 中右键应用并选择“打开”。Windows 版本依赖系统 WebView2 Runtime。

## 隐私

编辑器在本地处理皮肤文件，不上传皮肤、配置或图片。

## License

[LICENSE](LICENSE)
