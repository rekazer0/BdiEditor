# 0.1 发布检查清单

## 自动测试

- [x] `npm test`（87/87）
- [x] `npx tsc --noEmit`
- [x] `npm run build`
- [x] `cargo test`（1/1）
- [x] `npm run tauri build -- --bundles app`
- [x] `codesign --verify --deep --strict`

## 样本往返

- [x] `.bdi` 可打开；
- [x] `.bds` 可打开；
- [x] 修改 `VIEW_RECT` 后保存并重新打开；
- [x] 修改动作字段后保存并重新打开；
- [x] 替换 PNG 后保存并重新打开；
- [x] 未修改文件的解压后字节不变；
- [x] 原始 ZIP 条目顺序、权限、时间扩展字段与目录存储方式保留；
- [x] 输出 ZIP 不包含不安全路径。

## 原生界面

- [x] 新建和固定内置默认模板；
- [x] 打开、保存和另存为；
- [x] 未保存保护；
- [x] Finder 文件关联（Info.plist 与打开事件）；
- [x] 浅色/深色；
- [x] 竖屏/横屏；
- [x] 九键/26 键；
- [x] 单选、Command/Ctrl/Shift 多选；
- [x] 方向键移动（Shift 为 10 单位）；
- [x] 对齐、等宽/高、分布和精确间距；
- [x] 撤销和重做；
- [x] 普通、按下、滑动和长按事件；
- [x] iPhone 17 Pro / 小米 17 Pro 设备模板与整机横竖屏；
- [x] 字面按键模拟输入与候选占位预览；
- [x] 候选栏、符号面板和工具栏组件预览；
- [x] 红色关闭按钮与未保存确认；
- [x] 字体、颜色、显示文字和动作编辑；
- [x] PNG 预览和替换；
- [x] 无透明窗口、无 Liquid Glass 的系统深浅色界面。

## 发布

- [x] 仅构建 release `.app`；
- [x] 内置模板 SHA-256；
- [x] Git 工作区只包含源代码和文档；
- [ ] 推送 `rekazer0/BdiEditor`；
- [ ] 创建标签 `0.1`；
- [ ] 创建 GitHub Release `0.1`；
- [ ] 上传 `.app` 发布产物；
- [x] 发布说明明确 macOS 范围和 Windows 后续计划。

## 结果

2026-08-05 在 Apple Silicon macOS 上完成自动验证。最终 `.app` 通过 `codesign --verify --deep --strict`；使用 ad-hoc 签名，未进行 Apple Developer ID 公证。GUI 接受测试由用户完成。
