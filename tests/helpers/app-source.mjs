// 编辑器源码分布在 src/main.ts 与 src/app/*.ts：测试按名字找声明、按文本断言时都从这里取。
import { readFileSync, readdirSync } from "node:fs"
import vm from "node:vm"
import ts from "typescript"

const root = new URL("../../", import.meta.url)
const files = ["src/main.ts", ...readdirSync(new URL("src/app/", root), { recursive: true }).filter((f) => f.endsWith(".ts")).map((f) => `src/app/${f}`)]
const parsed = files.map((file) => ts.createSourceFile(file, readFileSync(new URL(file, root), "utf8"), ts.ScriptTarget.Latest, true))

/** main.ts 与 src/app/*.ts 的全部源码，用于文本断言。 */
export const appSource = () => parsed.map((sf) => sf.getFullText()).join("\n")

/** 按名字取顶层声明（函数、变量）的源码，去掉 export。 */
export function declarations(...names) {
  return parsed.flatMap((sf) => sf.statements.filter((n) =>
    (ts.isFunctionDeclaration(n) && names.includes(n.name?.text)) ||
    (ts.isVariableStatement(n) && n.declarationList.declarations.some((d) => names.includes(d.name.getText(sf))))
  ).map((n) => n.getText(sf).replace(/^export /, ""))).join("\n")
}

/**
 * 在 vm 里运行截取的源码。源码里的 appState.x 读写映射到注入的同名全局 x，
 * 测试照旧用全局变量提供 / 观察状态。
 */
export function run(code, globals = {}) {
  const context = vm.createContext({ exports: {}, ...globals })
  context.appState = new Proxy({}, { get: (_, key) => context[key], set: (_, key, value) => { context[key] = value; return true }, has: (_, key) => key in context })
  vm.runInContext(ts.transpile(code, { target: ts.ScriptTarget.ES2022 }), context)
  return context
}

/** main.ts 与 src/app/*.ts 合成一个 SourceFile（去掉 export），按语句查找时与原来单文件的写法一致。 */
export const combinedSource = () => ts.createSourceFile("app.ts", appSource().replace(/^export /gm, ""), ts.ScriptTarget.Latest, true)

/** 给已有的 vm 上下文挂上 appState 代理（见 run）。 */
export function withAppState(context) {
  context.appState = new Proxy({}, { get: (_, key) => context[key], set: (_, key, value) => { context[key] = value; return true }, has: (_, key) => key in context })
  return context
}
