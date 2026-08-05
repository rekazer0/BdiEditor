# 百度输入法皮肤编辑器（macOS）Implementation Plan（已废弃）

> 本文基于早期“macOS 桌面输入法皮肤”假设，已被
> `docs/plans/2026-07-29-bdi-editor-tauri.md` 取代，请勿据此实施。

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一款 macOS 原生可视化编辑器，让用户创建、预览、校验并导出可被目标版本百度输入法使用的皮肤。

**Architecture:** 采用 SwiftUI + AppKit 的模块化单体：SwiftUI 负责窗口、属性面板和文档流程，AppKit/Core Graphics 负责像素级画布、缩放、命中测试和渲染。应用内部使用公开、自有的 `.bdiskin` 工程包；百度 `.bps` 仅通过隔离的适配器导入/导出，避免把未经验证的私有格式扩散到编辑器核心。

**Tech Stack:** Swift 6、SwiftUI、AppKit、Core Graphics、ImageIO、UniformTypeIdentifiers、Swift Testing/XCTest、Xcode 18+、macOS 14+

---

## 1. 产品边界与关键假设

本计划把“百度输入法的编辑器”解释为“百度输入法桌面皮肤编辑器”，而不是重新实现输入法引擎。首版支持：

- 新建、打开、保存一个皮肤工程；
- 导入 PNG/APNG 素材；
- 编辑输入条背景、候选区、状态区、边距、拉伸区和文本样式；
- 实时预览常见输入状态与 Retina/非 Retina 缩放；
- 校验缺失素材、尺寸、透明度、边界和配置；
- 在兼容性验证通过后导入/导出 `.bps`；
- 导出失败时给出可操作的错误，不损坏原工程。

首版不包含：

- 自研输入法内核、拼音算法、词库或云同步；
- iOS/Android 皮肤；
- 在线账号、作品社区、素材商城；
- AI 生图、插件系统、多人协作；
- 未经百度授权的上传、自动发布或绕过签名/校验。

## 2. 首要风险与验收门

`.bps` 是最大的技术和合规风险。百度公开页面说明它由官方编辑器生成，内容包括 PNG/APNG 与配置信息，但公开资料不足以保证当前 macOS 百度输入法与旧 Windows 编辑器格式完全兼容。

在正式开发前必须完成 Gate 0：

1. 明确要兼容的百度输入法 macOS 版本与最低 macOS 版本。
2. 收集至少 10 个有权用于测试的 `.bps` 样本：静态、动态、不同尺寸、不同年代各有覆盖。
3. 用官方 Windows 编辑器生成 3 个“已知输入 → 已知输出”样本作为行为基准。
4. 验证 `.bps` 是否为可解析容器、是否有签名/加密、是否存在版本字段。
5. 将重建文件安装到目标百度输入法，完成真实加载测试。
6. 向百度确认第三方工具生成/上传皮肤的许可边界。

**继续条件：** 至少 90% 样本可无损读取，3 个基准样本可重新导出并由目标客户端加载，且没有需要绕过保护机制的步骤。

**未通过时的降级方案：** 先发布“皮肤设计与切图工具”，输出规范化素材包和配置报告，最终 `.bps` 仍交由官方 Windows 编辑器生成。

## 3. 推荐架构

```text
BaiduSkinStudioApp
├── App/UI
│   ├── 文档窗口、工具栏、检查器、素材库
│   └── AppKit 画布桥接
├── SkinDomain
│   ├── SkinProject / Element / State / TextStyle
│   ├── 坐标、九宫格拉伸、布局规则
│   └── ValidationIssue
├── SkinRenderer
│   ├── Core Graphics 渲染
│   ├── PNG/APNG 解码
│   └── 预览与快照输出
├── ProjectIO
│   ├── .bdiskin 工程包读写
│   ├── schema 迁移
│   └── 原子保存、恢复
└── BaiduBPSAdapter
    ├── BPS 解析/生成
    ├── 版本能力表
    └── 兼容性诊断
```

选择模块化单体，而不是微服务或复杂插件架构。编辑、渲染、工程存储和 `.bps` 兼容层只需要清楚的 Swift 模块边界，不需要跨进程通信。

### 数据模型

建议用一个规范化模型覆盖编辑态，而不是直接把 `.bps` 字段绑定到 UI：

```swift
struct SkinProject: Codable, Sendable {
    var schemaVersion: Int
    var metadata: Metadata
    var canvas: CanvasSpec
    var states: [InputState]
    var elements: [SkinElement]
    var assets: [Asset]
}

struct SkinElement: Codable, Identifiable, Sendable {
    var id: UUID
    var role: ElementRole
    var frame: CGRectValue
    var assetID: UUID?
    var capInsets: EdgeInsetsValue?
    var textStyle: TextStyle?
    var visibility: Set<InputState>
}
```

`.bps` 适配器负责 `BPS ↔ SkinProject` 映射，并把无法表达的内容作为 warning 或只读扩展字段保留。

### 工程格式

使用 macOS package document：

```text
Example.bdiskin/
├── manifest.json
├── assets/
│   ├── <uuid>.png
│   └── <uuid>.apng
└── thumbnails/
    └── preview.png
```

- `manifest.json` 使用版本化 JSON Schema；
- 素材导入时复制进工程，避免源文件移动后失效；
- 保存使用临时包 + 原子替换；
- 未知字段读取后原样保留，方便向前兼容；
- `.bps` 是导入/导出格式，不作为唯一工作文件。

### UI 布局

- 左侧：输入状态和图层；
- 中间：可缩放画布、标尺、参考线和候选词模拟；
- 右侧：几何、素材、九宫格、字体、颜色属性；
- 底部：错误/警告面板；
- 工具栏：状态切换、缩放、预览、校验、导出。

所有编辑操作接入 `UndoManager`；画布拖动期间只更新预览，鼠标释放后形成一个撤销单元。

## 4. 建议目录

```text
bdi-edit/
├── BaiduSkinStudio.xcodeproj/
├── App/
│   ├── BaiduSkinStudioApp.swift
│   ├── Document/
│   ├── Views/
│   └── Canvas/
├── Packages/
│   ├── SkinDomain/
│   ├── SkinRenderer/
│   ├── ProjectIO/
│   └── BaiduBPSAdapter/
├── Tests/
│   ├── Fixtures/
│   ├── GoldenImages/
│   └── CompatibilityMatrix.md
├── docs/
│   ├── architecture.md
│   ├── bps-findings.md
│   └── plans/
└── scripts/
    └── verify-release.sh
```

## 5. 分阶段实施计划

### Task 0: 建立兼容性与合规基线（3–5 天）

**Files:**
- Create: `docs/product-scope.md`
- Create: `docs/bps-findings.md`
- Create: `Tests/CompatibilityMatrix.md`
- Create: `Tests/Fixtures/README.md`

**Steps:**

1. 记录目标百度输入法/macOS 版本和首版功能清单。
2. 为测试样本登记来源、授权、哈希、百度输入法版本和预期效果。
3. 检查样本的文件头、目录结构、压缩方式、版本字段和完整性字段。
4. 用官方编辑器创建最小、静态、APNG 三个基准文件。
5. 对比只改变一个属性前后的二进制/配置差异。
6. 写出 `.bps` 能力表：字段、类型、默认值、版本、是否可逆。
7. 对重新生成的文件做真实安装测试。
8. 记录百度对第三方生成和分发的答复。
9. 召开 Gate 0 评审，选择“完整 BPS 导出”或“素材包降级方案”。
10. Commit: `docs: establish BPS compatibility baseline`

### Task 1: 创建最小 macOS 文档应用（2 天）

**Files:**
- Create: `BaiduSkinStudio.xcodeproj`
- Create: `App/BaiduSkinStudioApp.swift`
- Create: `App/Document/SkinDocument.swift`
- Create: `Packages/SkinDomain/Sources/SkinDomain/SkinProject.swift`
- Test: `Packages/SkinDomain/Tests/SkinDomainTests/SkinProjectTests.swift`

**Steps:**

1. 创建 SwiftUI macOS App，部署目标设为 macOS 14。
2. 写失败测试：空工程应具有当前 schema 版本和一个默认输入状态。
3. 运行 `xcodebuild test -scheme SkinDomain`，确认测试失败。
4. 实现最小 `SkinProject`、值类型几何模型和枚举。
5. 再运行测试，确认通过。
6. 接入 `DocumentGroup`/`ReferenceFileDocument` 和 `.bdiskin` UTType。
7. 验证新建、另存、关闭、重开。
8. Commit: `feat: scaffold macOS document editor`

### Task 2: 实现可靠的工程包读写（2–3 天）

**Files:**
- Create: `Packages/ProjectIO/Sources/ProjectIO/ProjectPackage.swift`
- Create: `Packages/ProjectIO/Sources/ProjectIO/SchemaMigrator.swift`
- Test: `Packages/ProjectIO/Tests/ProjectIOTests/ProjectPackageTests.swift`
- Test: `Packages/ProjectIO/Tests/ProjectIOTests/SchemaMigrationTests.swift`

**Steps:**

1. 写失败测试：工程写入后再读取应保持模型和素材哈希不变。
2. 写失败测试：损坏 JSON、缺失素材、未来 schema 应返回具体错误。
3. 实现 `FileWrapper` package 读写和素材去重。
4. 实现 v1 schema 与迁移协议，但只加入实际需要的迁移。
5. 加入原子保存和未保存恢复测试。
6. 用 100 MB APNG 工程检查内存峰值和保存时间。
7. Commit: `feat: add versioned project package`

### Task 3: 建立确定性的渲染核心（3–4 天）

**Files:**
- Create: `Packages/SkinRenderer/Sources/SkinRenderer/SkinRenderer.swift`
- Create: `Packages/SkinRenderer/Sources/SkinRenderer/NineSliceRenderer.swift`
- Create: `Packages/SkinRenderer/Sources/SkinRenderer/AnimatedImageDecoder.swift`
- Test: `Packages/SkinRenderer/Tests/SkinRendererTests/RenderingTests.swift`
- Test: `Tests/GoldenImages/`

**Steps:**

1. 为背景、九宫格、文本、候选高亮分别创建黄金图测试。
2. 运行测试并确认因渲染器缺失而失败。
3. 使用 Core Graphics 实现与 UI 无关的纯渲染 API。
4. 用 ImageIO 解码 PNG/APNG，限制帧数、像素量和总内存。
5. 固定颜色空间、scale 和字体回退，使快照结果可重复。
6. 对 1x/2x、浅色/深色预览执行黄金图比较。
7. Commit: `feat: implement deterministic skin renderer`

### Task 4: 完成可用的编辑器外壳（4–5 天）

**Files:**
- Create: `App/Views/EditorSplitView.swift`
- Create: `App/Views/LayersSidebar.swift`
- Create: `App/Views/InspectorView.swift`
- Create: `App/Views/IssuesView.swift`
- Create: `App/Canvas/SkinCanvasView.swift`
- Test: `Tests/AppUITests/DocumentWorkflowUITests.swift`

**Steps:**

1. 写 UI 测试：新建工程、导入素材、移动元素、撤销、保存、重开。
2. 实现三栏界面和错误面板。
3. 用 `NSViewRepresentable` 包装 AppKit 画布。
4. 实现选择、拖动、调整尺寸、缩放、平移和键盘微调。
5. 将所有模型变化接入 `UndoManager`。
6. 实现属性检查器的数值校验与多选共同属性。
7. 验证 VoiceOver 标签、键盘焦点和高对比度模式。
8. Commit: `feat: add visual editing workspace`

### Task 5: 加入素材与状态编辑（3–4 天）

**Files:**
- Create: `App/Views/AssetLibraryView.swift`
- Create: `App/Views/StatePreviewPicker.swift`
- Create: `App/Document/AssetImporter.swift`
- Test: `Tests/AppTests/AssetImporterTests.swift`

**Steps:**

1. 写失败测试：同一素材重复导入只保存一份内容。
2. 实现拖放和文件选择器导入 PNG/APNG。
3. 校验扩展名、真实文件类型、尺寸、帧数和透明度。
4. 实现正常、悬停、按下、候选选中等状态切换。
5. 加入模拟拼音、候选词、页码和中英文状态。
6. 验证源素材删除后工程仍可正常打开。
7. Commit: `feat: add asset and input-state editing`

### Task 6: 实现规则校验和导出前检查（2–3 天）

**Files:**
- Create: `Packages/SkinDomain/Sources/SkinDomain/SkinValidator.swift`
- Create: `Packages/SkinDomain/Sources/SkinDomain/ValidationIssue.swift`
- Test: `Packages/SkinDomain/Tests/SkinDomainTests/SkinValidatorTests.swift`

**Steps:**

1. 为每条规则写独立失败测试：缺素材、越界、非法九宫格、重复角色、过大动画。
2. 实现纯函数验证器，区分 error、warning、info。
3. 为问题提供元素 ID 和可选自动修复。
4. 在问题面板点击后定位画布元素。
5. error 阻止导出，warning 允许用户确认后继续。
6. Commit: `feat: validate skin projects before export`

### Task 7: 隔离实现 `.bps` 适配器（5–10 天，取决于 Gate 0）

**Files:**
- Create: `Packages/BaiduBPSAdapter/Sources/BaiduBPSAdapter/BPSReader.swift`
- Create: `Packages/BaiduBPSAdapter/Sources/BaiduBPSAdapter/BPSWriter.swift`
- Create: `Packages/BaiduBPSAdapter/Sources/BaiduBPSAdapter/BPSMapping.swift`
- Test: `Packages/BaiduBPSAdapter/Tests/BaiduBPSAdapterTests/BPSFixtureTests.swift`
- Modify: `Tests/CompatibilityMatrix.md`

**Steps:**

1. 为每个有授权的 fixture 写读取断言。
2. 实现边界检查严格的 reader；任何长度、路径或压缩异常立即失败。
3. 将读取结果映射到规范化 `SkinProject`。
4. 保存未知但安全的扩展字段以支持无损往返。
5. 为官方基准样本写确定性 writer 测试。
6. 实现 writer，不加入尚未验证的字段。
7. 执行 `BPS → Project → BPS → Project` 语义等价测试。
8. 在目标百度输入法执行安装矩阵并记录结果。
9. 对不支持的版本显示明确说明，不猜测导出。
10. Commit: `feat: add verified BPS import and export`

若 Gate 0 未通过，把本任务替换为 `素材目录 + manifest + 校验报告` 导出器。

### Task 8: 打磨预览、性能和崩溃恢复（3–4 天）

**Files:**
- Create: `App/Views/DetachedPreviewWindow.swift`
- Create: `Tests/PerformanceTests/RendererPerformanceTests.swift`
- Create: `Tests/PerformanceTests/LargeProjectTests.swift`
- Modify: `App/Document/SkinDocument.swift`

**Steps:**

1. 增加独立 1x/2x 预览窗口和 APNG 播放控制。
2. 为 60 帧动画、100 个元素和 100 MB 工程建立性能基准。
3. 后台执行解码和缩略图生成，仅在主线程更新 UI。
4. 实现取消、进度和低内存降级。
5. 强制终止应用，验证自动保存恢复。
6. Commit: `perf: harden preview and large-project handling`

### Task 9: 发布工程与用户文档（3–5 天）

**Files:**
- Create: `docs/user-guide.md`
- Create: `docs/privacy.md`
- Create: `docs/release-checklist.md`
- Create: `scripts/verify-release.sh`
- Modify: `BaiduSkinStudio.xcodeproj`

**Steps:**

1. 配置 Developer ID、Hardened Runtime、沙盒和最小文件访问权限。
2. 不申请网络、通讯录、麦克风等首版不需要的权限。
3. 编写首次使用、素材规范、导出和故障排查文档。
4. 脚本化执行单测、UI 测试、静态分析和 archive。
5. 对 archive 做签名验证、notarization 和 Gatekeeper 测试。
6. 在干净的 macOS 14/15/26 测试机安装并完成冒烟测试。
7. 用目标百度输入法版本执行最终兼容矩阵。
8. Commit: `release: prepare notarized macOS beta`

## 6. 测试策略

- **领域单测：** 模型、几何、迁移、校验规则；
- **往返测试：** `.bdiskin` 和经过验证的 `.bps`；
- **黄金图测试：** 不同状态、scale、九宫格和 APNG 帧；
- **模糊测试：** 损坏容器、超长路径、压缩炸弹、非法尺寸；
- **UI 测试：** 创建到导出的主流程、撤销/重做、恢复；
- **真实兼容测试：** 每个支持的百度输入法版本都必须实际加载；
- **性能门槛：** 普通工程操作保持交互流畅，渲染不得阻塞主线程超过 16 ms；大型导入可异步但必须可取消。

## 7. 里程碑与人力预估

以 1 名熟悉 Swift/macOS 的工程师估算：

| 里程碑 | 时间 | 可交付结果 |
|---|---:|---|
| M0 兼容性验证 | 第 1 周 | Gate 0 决策、格式能力表 |
| M1 工程与渲染 | 第 2–3 周 | 可保存工程、正确静态预览 |
| M2 可视化编辑 MVP | 第 4–5 周 | 可完成一套皮肤设计 |
| M3 BPS/降级导出 | 第 6–7 周 | 目标客户端可加载或输出官方工具素材包 |
| M4 Beta | 第 8 周 | 签名、公证、文档、测试矩阵 |

如果没有可合法使用的 `.bps` 样本或百度确认，M3 的日期不可承诺；其余编辑能力仍可独立完成。

## 8. MVP 完成定义

- 用户能在 10 分钟内从模板创建一套静态皮肤；
- 工程关闭重开后内容与视觉结果一致；
- 撤销/重做覆盖所有编辑动作；
- 校验器能阻止已知无效导出；
- 10 个测试样本达到记录在案的兼容率；
- 导出物在指定百度输入法 macOS 版本真实加载成功，或明确走降级素材包流程；
- 应用通过签名、公证、干净机器安装和基本无障碍检查；
- 无需联网即可完成编辑和导出。

## 9. 后续版本候选

只有在 MVP 获得真实用户反馈后再考虑：模板市场、云同步、AI 辅助素材、批量变体、社区上传、Windows 版本、插件 API。若用户实际需要的是“输入方案/词库编辑器”或“完整输入法”，应另立项目：前者重点是词库 schema 和导入导出，后者必须增加独立 InputMethodKit target、候选窗口、组合态管理与输入引擎，不能复用本计划的产品边界。
