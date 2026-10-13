// 设计规范的强制执行（规则见 DESIGN.md）。
// 每条规则按文件计数，结果与 tests/design-system.baseline.json 比对：
//   计数上升 → 失败（新代码不得违反规范）；
//   计数下降 → 失败并提示更新基线（棘轮只能往下走，避免回退）。
// 更新基线：npm run design:baseline
import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import test from "node:test"
import postcss from "postcss"

const root = new URL("..", import.meta.url)
const read = (path) => readFileSync(new URL(path, root), "utf8")
const list = (dir, ext) => readdirSync(new URL(dir, root)).filter((name) => name.endsWith(ext)).map((name) => `${dir}${name}`)
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))

const cssFiles = list("src/", ".css")
// 设备模拟按真机还原，数值规则不适用（DESIGN.md §1）
const scaledCss = (files) => Object.fromEntries(Object.entries(files).filter(([file]) => file !== "src/device-preview.css"))
const tsFiles = [...list("src/", ".ts"), ...list("src/app/", ".ts")]
const htmlFiles = list("", ".html")
const css = Object.fromEntries(cssFiles.map((f) => [f, stripComments(read(f))]))
const ts = Object.fromEntries(tsFiles.map((f) => [f, read(f)]))
const html = Object.fromEntries(htmlFiles.map((f) => [f, read(f)]))
const TOKENS = "src/tokens.css"
const ICONS = "src/icons.ts"
// 设备模拟（真机外框与画布背景选项）必须与真机一致，是唯一允许写色值的文件（DESIGN.md §1）
const DEVICE = "src/device-preview.css"

/** Declarations of the given properties: [property, value] pairs. */
function declarations(text, property) {
  return [...text.matchAll(new RegExp(`(?:^|[;{\\s])(${property})\\s*:\\s*([^;{}]+)`, "g"))].map((m) => [m[1], m[2].trim()])
}
const count = (text, pattern) => (text.match(pattern) ?? []).length
const SPACING_SCALE = new Set(["0", "1", "2", "4", "6", "8", "12", "16", "20", "24", "32", "40", "48"])
const onScale = (n) => SPACING_SCALE.has(n) || (Number(n) > 48 && Number(n) % 8 === 0)

/** rule → (file → count). Each rule says what DESIGN.md section it enforces. */
const rules = {
  // §1 颜色：只能引用 tokens.css 中的颜色 token
  "css-color-literal": () => perFile(css, (text, file) => file === TOKENS || file === DEVICE ? 0
    : count(text.replace(/var\([^)]*\)/g, ""), /(?<![\w-])#[0-9a-fA-F]{3,8}(?![\w-])|\b(?:rgba?|hsla?)\(|(?<![-\w])(?:white|black)(?![-\w])/g)),
  // §2 字号：只能用 --font-size-*
  "css-font-size-literal": () => perFile(scaledCss(css), (text, file) => file === TOKENS ? 0
    : declarations(text, "font-size").filter(([, v]) => !/^(var\(--font-size-[a-z]+\)|var\(--source-font-size(, var\(--font-size-[a-z]+\))?\)|inherit|1em|100%|0)(\s*!important)?$/.test(v)).length),
  // §2 font 简写里的字号同样只能用 token
  "css-font-shorthand-literal": () => perFile(scaledCss(css), (text) =>
    declarations(text, "font").filter(([, v]) => /\d*\.?\d+px/.test(v.replace(/var\([^)]*\)/g, ""))).length),
  // §2 字重：400 / 500 / 600
  "css-font-weight-off-scale": () => perFile(scaledCss(css), (text) =>
    declarations(text, "font-weight").filter(([, v]) => !/^(400|500|600|inherit|normal|var\(--font-weight-[a-z]+\))(\s*!important)?$/.test(v)).length),
  // §3 圆角：只能用 --radius-*（0 与 50% 除外）
  "css-radius-literal": () => perFile(scaledCss(css), (text, file) => file === TOKENS ? 0
    : declarations(text, "border(?:-[a-z]+)*-radius").filter(([, v]) => /\d*\.?\d+(px|rem|em)/.test(v.replace(/var\([^)]*\)/g, ""))).length),
  // §4 间距：4px 网格
  "css-spacing-off-scale": () => perFile(scaledCss(css), (text) =>
    declarations(text, "(?:padding|margin|gap|row-gap|column-gap)(?:-[a-z]+)*")
      .flatMap(([, v]) => [...v.replace(/var\([^)]*\)/g, "").matchAll(/-?(\d*\.?\d+)px/g)].map((m) => m[1]))
      .filter((n) => !onScale(n)).length),
  // §6 动效：时长与曲线只能用 --duration-* / --ease-*
  "css-motion-literal": () => perFile(scaledCss(css), (text, file) => file === TOKENS ? 0
    : declarations(text, "(?:transition|animation)(?:-[a-z]+)*")
      // 循环播放的加载 / 提示动画（infinite）不受过渡时长档位限制
      .filter(([p, v]) => !/-(name|property|fill-mode|iteration-count|direction|play-state)$/.test(p) && !/infinite/.test(v)
        && /\d*\.?\d+m?s\b|cubic-bezier|\bease(-in|-out|-in-out)?\b|\blinear\b/.test(v.replace(/var\([^)]*\)/g, ""))).length),
  // §8 层叠：禁止 !important
  "css-important": () => perFile(css, (text) => count(text, /!important/g)),
  // §8 token 只在 tokens.css 定义；组件私有变量以 --_ 开头
  "css-token-outside-tokens": () => perFile(css, (text, file) => file === TOKENS ? 0 : count(text, /(?:^|[;{\s])--(?!_)[a-z][\w-]*\s*:/g)),
  // §8 同一个选择器只在一个文件里定义
  "css-cross-file-selector": () => {
    const owners = new Map()
    for (const file of cssFiles) {
      postcss.parse(read(file)).walkRules((rule) => {
        if (rule.parent?.type === "atrule" && /keyframes/.test(rule.parent.name)) return
        for (const selector of rule.selectors) {
          const key = selector.replace(/\s+/g, " ")
          if (!owners.has(key)) owners.set(key, new Set())
          owners.get(key).add(file)
        }
      })
    }
    const out = {}
    for (const files of owners.values()) if (files.size > 1) for (const file of [...files].slice(1)) out[file] = (out[file] ?? 0) + 1
    return out
  },
  // §5 图标：只从 src/icons.ts 取 Lucide 图标
  "icon-outside-registry": () => ({
    ...perFile(ts, (text, file) => file === ICONS ? 0 : count(text, /from\s+["']lucide["']|<svg\b/g)),
    ...perFile(html, (text) => count(text, /<svg\b/g)),
  }),
  // §8 HTML 不写内联样式
  "html-inline-style": () => perFile(html, (text) => count(text, /\sstyle="/g)),
  // §9 代码：单个 TS 文件不超过 800 行（超出部分计数）
  "ts-file-too-long": () => perFile(ts, (text) => Math.max(0, text.split("\n").length - 800)),
}

function perFile(files, measure) {
  const out = {}
  for (const [file, text] of Object.entries(files)) {
    const n = measure(text, file)
    if (n) out[file] = n
  }
  return out
}

const baselinePath = new URL("tests/design-system.baseline.json", root)
const current = Object.fromEntries(Object.entries(rules).map(([name, measure]) => [name, measure()]))

if (process.env.UPDATE_DESIGN_BASELINE) {
  writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`)
}
const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {}

for (const [name, counts] of Object.entries(current)) {
  test(`design system: ${name}`, () => {
    const allowed = baseline[name] ?? {}
    const worse = [], better = []
    for (const file of new Set([...Object.keys(counts), ...Object.keys(allowed)])) {
      const now = counts[file] ?? 0, was = allowed[file] ?? 0
      if (now > was) worse.push(`${file}: ${was} → ${now}`)
      if (now < was) better.push(`${file}: ${was} → ${now}`)
    }
    assert.deepEqual(worse, [], `违反 DESIGN.md「${name}」：计数上升。改用规范 token / 组件，不要新增违规。`)
    assert.deepEqual(better, [], `「${name}」计数下降了，运行 npm run design:baseline 收紧基线。`)
  })
}

// 绝对规则：没有基线，任何时候都必须成立。
test("design system: every CSS file is loaded somewhere", () => {
  const loaders = [...Object.values(ts), ...Object.values(html), ...Object.values(css)].join("\n")
  const orphans = cssFiles.filter((file) => !loaders.includes(file.replace("src/", "")))
  assert.deepEqual(orphans, [], "未被任何入口引用的 CSS 文件应删除")
})

test("design system: tokens.css is the first stylesheet of every window", () => {
  assert.match(ts["src/main.ts"], /^import "\.\/tokens\.css"$/m)
  const firstImport = ts["src/main.ts"].match(/^import "\.\/[\w-]+\.css"$/m)?.[0]
  assert.equal(firstImport, 'import "./tokens.css"')
  for (const page of ["picker.html", "new-project.html"]) {
    assert.match(html[page].match(/<link rel="stylesheet"[^>]*>/)?.[0] ?? "", /tokens\.css/, `${page} 必须先加载 tokens.css`)
  }
})

test("design system: every var(--x) used in CSS is defined", () => {
  const defined = new Set()
  for (const text of Object.values(css)) for (const m of text.matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1])
  // 运行时由 TS 写入的变量（style.setProperty("--x", …) 等）
  for (const text of Object.values(ts)) for (const m of text.matchAll(/["`](--[\w-]+)["`]/g)) defined.add(m[1])
  const missing = new Set()
  for (const [file, text] of Object.entries(css)) {
    for (const m of text.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) if (!defined.has(m[1]) && !m[2]) missing.add(`${file}: ${m[1]}`)
  }
  assert.deepEqual([...missing], [], "引用了不存在的变量（多半是删掉旧 token 后遗留的引用）")
})
