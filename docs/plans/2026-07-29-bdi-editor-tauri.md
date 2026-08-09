# 百度 iOS 皮肤编辑器 Implementation Plan

**Goal:** 构建一个 macOS 首发、Windows 可移植的桌面编辑器，对目标版本百度 iOS `.bdi/.bds` 皮肤包进行可视化与文本双向编辑。

**Architecture:** 使用 Tauri 作为最薄桌面壳，原生 HTML/CSS/TypeScript 负责 ZIP、保格式配置文档、编辑状态和 Canvas 预览。Rust 仅负责窗口、文件对话框和受控文件读写；不使用前端框架、状态库、自有工程格式或双份领域模型。

**Tech Stack:** Tauri 2、Rust、HTML、CSS、TypeScript、Canvas 2D、Vite、fflate、Node 内置测试

---

## 已确认范围

- 首发 macOS，第二阶段 Windows；
- 仅保证兼容两个给定样本所属的 iOS 皮肤格式；
- 读取并保留包内所有文件及未知配置；
- INI/CSS/TIL/文本配置可编辑并与预览双向同步；
- 像素级外观、按下/高亮、滑动方向、横竖屏、明暗模式；
- `Fxx/Sxx` 显示含义或事件日志，但不执行；
- 不实现候选算法、拼音引擎和真实输入逻辑；
- “新建”复制默认皮肤；默认皮肤可由用户配置；
- 保存保留注释、空行、字段顺序、未知字段和未修改的二进制资源。

## 最小目录

```text
index.html
src/
  main.ts
  style.css
  ini.ts
  skin.ts
  preview.ts
src-tauri/
  Cargo.toml
  build.rs
  tauri.conf.json
  capabilities/default.json
  src/main.rs
tests/
  ini.test.ts
  skin.test.ts
```

暂不拆包、建 monorepo、建插件系统或引入 UI 组件库。

### Task 1: 建立可运行的 Tauri 空壳

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/style.css`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/src/main.rs`

**Steps:**

1. 写最小 HTML 窗口和空编辑区。
2. 配置 Vite 与 TypeScript。
3. 配置 Tauri 文件对话框。
4. 运行 `npm run build`；预期前端构建成功。
5. 运行 `npm run tauri dev`；预期 macOS 窗口打开。
6. Commit: `feat: scaffold minimal Tauri editor`

### Task 2: 实现保格式配置文档

**Files:**
- Create: `src/ini.ts`
- Create: `tests/ini.test.ts`

**Step 1: Write the failing test**

```ts
const doc = IniDocument.parse("; keep\n[KEY1]\nVIEW_RECT=1,2,3,4\n")
doc.set("KEY1", "VIEW_RECT", "5,6,7,8")
assert.equal(doc.toString(), "; keep\n[KEY1]\nVIEW_RECT=5,6,7,8\n")
```

**Steps:**

1. 用 Node 内置 `node:test` 写注释、空行、CRLF、BOM、未知字段测试。
2. 运行 `npm test`；预期失败。
3. 实现逐行模型，只替换值区间。
4. 再运行 `npm test`；预期通过。
5. Commit: `feat: preserve skin config formatting`

### Task 3: 打开和保存原始皮肤包

**Files:**
- Create: `src/skin.ts`
- Create: `tests/skin.test.ts`
- Modify: `src/main.ts`

**Steps:**

1. 写测试：打开 ZIP 后文件名和原始字节完整。
2. 写测试：修改一个 INI 后，其他条目字节不变。
3. 用 `fflate` 实现内存解压和重新打包。
4. 为路径穿越、重复文件名、超大解压体积增加边界检查。
5. 接入打开、保存、另存为。
6. 用两个给定样本执行读取和往返测试。
7. Commit: `feat: open and save BDI and BDS archives`

### Task 4: 配置树与文本编辑

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/style.css`

**Steps:**

1. 显示包内文件树，并按 light/dark、port/land 分组。
2. 文本文件显示保格式编辑器，图片显示预览。
3. 文本输入后更新共享文档模型。
4. 未保存变化显示脏状态。
5. 保存前显示修改文件清单。
6. Commit: `feat: add archive and config workspace`

### Task 5: 布局画布双向同步

**Files:**
- Create: `src/preview.ts`
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Create: `tests/preview.test.ts`

**Steps:**

1. 测试从 `VIEW_RECT` 解析矩形和写回字符串。
2. Canvas 按配置坐标绘制键位。
3. 文本修改后重新绘制。
4. 拖动和缩放键位时定点修改对应 `VIEW_RECT`。
5. 用 `UndoManager` 风格的最小命令栈实现撤销/重做。
6. Commit: `feat: sync layout config and canvas`

### Task 6: 样式、图集和交互状态

**Files:**
- Modify: `src/preview.ts`
- Create: `src/atlas.ts`
- Create: `src/codes.ts`
- Create: `tests/atlas.test.ts`

**Steps:**

1. 解析 `BACK_STYLE/FORE_STYLE` 到 CSS 样式段。
2. 解析 `.til` 的 `SOURCE_RECT` 并从 PNG 图集裁切。
3. 绘制普通、按下和高亮状态。
4. 支持 light/dark、port/land 切换。
5. 显示 UP/DOWN/LEFT/RIGHT/HOLD 方向提示。
6. 点击或滑动时输出 `Fxx/Sxx` 事件日志。
7. 未知代码只显示原值，不猜测行为。
8. Commit: `feat: render skin styles and key states`

### Task 7: 默认模板与 macOS Beta

**Files:**
- Modify: `src/main.ts`
- Modify: `src-tauri/src/main.rs`
- Create: `docs/compatibility.md`
- Create: `docs/release-checklist.md`

**Steps:**

1. 设置中允许用户选择默认 `.bdi/.bds`。
2. “新建”复制模板并清理名称、作者等元数据。
3. 未配置模板时提示选择，不生成残缺包。
4. 记录支持的目录结构和样本哈希。
5. 运行单测、前端构建和两个样本的往返检查。
6. 完成 macOS 签名、公证和干净机器安装测试。
7. Commit: `release: prepare macOS beta`

### Task 8: 发布 GitHub 0.1

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Modify: `package.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/tauri.conf.json`

**Steps:**

1. 确认 `npm test`、`npm run build` 和 Tauri release build 全部通过。
2. 确认两个真实样本可打开、修改和重新打包。
3. 初始化 Git，检查全部待提交文件，不提交样本皮肤或构建产物。
4. 配置远端 `https://github.com/rekazer0/BdiEditor.git`。
5. 提交 0.1 源码并推送。
6. 创建标签 `0.1`。
7. 创建 GitHub Release `0.1`，附带 macOS 安装产物和校验值。
8. 在发布页说明 Windows 为后续阶段，不暗示已经支持。

## Windows 第二阶段

保持 TypeScript 代码不含 macOS 路径和 API。Beta 稳定后只新增：

1. Windows 构建环境与 WebView2 验证；
2. `.bdi/.bds` 文件关联；
3. Windows 安装器和代码签名；
4. 字体、Canvas 和文件路径差异测试。

不为 Windows 复制业务代码，不提前建立平台抽象接口；出现第一个真实差异时再加条件分支。

## 2026-07-30 完成交付清单

用户已确认继续执行到项目完成，不再等待阶段性确认。0.1 发布前必须完成：

### Task 9: 完成画布编辑与检查器

**Files:**
- Modify: `src/preview.ts`
- Modify: `src/main.ts`
- Modify: `index.html`
- Modify: `src/style.css`
- Create: `tests/layout.test.ts`

**Steps:**

1. 抽离可测试的矩形批量布局函数。
2. 测试等宽、等高、精确间距和水平/垂直分布。
3. 实现按键右下角缩放手柄并写回 `VIEW_RECT`。
4. 实现单选、Shift 多选和多键拖动。
5. 实现至少一层撤销/重做历史，支持 `Cmd/Ctrl+Z` 和 `Cmd/Ctrl+Shift+Z`。
6. 完成长按事件识别，方向滑动优先于长按。
7. 验证检查器布局、外观、文字、动作和共享样式修改。

### Task 10: 完成桌面产品行为

**Files:**
- Modify: `src/main.ts`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/src/lib.rs`

**Steps:**

1. 为 `.bdi`、`.bds` 添加文件关联。
2. 保存与另存为后验证产物可重新打开。
3. 增加未保存状态保护，至少覆盖新建、打开和关闭窗口。
4. 验证默认模板损坏/丢失后的恢复路径。
5. 使用无透明窗口、无 Liquid Glass 的系统深浅色界面。

### Task 11: 文档、完整测试和正式发布

**Files:**
- Create: `README.md`
- Create: `docs/compatibility.md`
- Create: `docs/release-checklist.md`
- Create: `LICENSE`

**Steps:**

1. 运行所有单元测试和 TypeScript 检查。
2. 对两个真实样本执行打开、修改、保存、重新打开和未修改条目校验。
3. 用原生 macOS 应用完整操作新建、打开、主题、方向、布局、选键、多选、拖动、缩放、动作预览、图片替换和另存为。
4. 构建 release `.app` 与 `.dmg`，记录 SHA-256。
5. 初始化 Git，仅提交源代码与文档。
6. 推送 `rekazer0/BdiEditor`，创建标签和 GitHub Release `0.1`。
