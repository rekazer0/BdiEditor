import { IniDocument } from "./ini.ts"

const functionCodeDescriptions: Record<string, string> = {
  F1: "切换到符号面板", F3: "切换到拇指/全键盘", F4: "返回", F5: "切换到软键盘",
  F6: "切换到数字面板", F7: "切换到表情面板", F8: "隐藏面板", F9: "查看更多候选字",
  F10: "切换小写和首字母大写", F11: "切换小写和大写锁定", F12: "切换到网络面板",
  F13: "一键换皮肤", F14: "面板切换功能容器", F15: "切换到中文输入状态",
  F16: "切换到英文输入状态", F17: "切换到拨号界面", F21: "菜单", F22: "候选字上翻",
  F23: "候选字下翻", F24: "中文输入方式选择菜单", F25: "切换字母/联想",
  F26: "候选字单字/全部切换", F27: "锁定符号面板", F28: "修改英文排序",
  F29: "候选条上翻页", F30: "候选条下翻页", F31: "熊头 Logo 菜单", F32: "弹出预备的列表",
  F36: "退格", F37: "DEL", F38: "空格", F39: "回车换行", F40: "清空输入码",
  F41: "TAB", F42: "HOME", F43: "END", F44: "剪切", F45: "复制", F46: "剪贴",
  F47: "全选", F48: "清空文本框", F49: "光标上移", F50: "光标下移", F51: "光标左移",
  F52: "光标右移", F53: "手写区所在区域", F54: "结束联想", F55: "候选字所在区域",
  F56: "遮罩效果", F61: "启动选字模式", F62: "切换其他输入法（地球）",
  F63: "输入法选择菜单", F64: "右上角关闭（X 或 OK）", F65: "Win", F66: "恢复",
  F67: "撤销", F68: "调起应用-搜索", F69: "调起应用-短信", F70: "调起应用-Email 邮箱",
  F71: "启用表情符号功能", F72: "启用语音", F73: "启用多媒体输入",
  F74: "启用颜文字面板（iOS）", F75: "换行（iOS，插入 \\r\\n）", F76: "剪贴板",
  F77: "懒人短语/筛选过程中切换过滤（iOS）", F78: "手写模式标识", F79: "进入语音输入",
  F80: "语音绘制区域", F81: "速成仓颉切换", F82: "搜索面板", F83: "编辑面板",
  F84: "输入法选择菜单（图形版）", F85: "板面语音词切片",
  F86: "板面语音切换到游戏键盘", F87: "板面语音和拼开关", F88: "游戏键盘短语开关",
  F89: "符号快捷输入面板", F90: "切换面板态符号面板", F91: "面板态符号面板首屏和更多屏互换",
  F92: "关闭联想状态", F93: "长按的符号", F94: "国际化输入空格键左划",
  F95: "国际化输入空格键右划", F96: "悬浮键盘（待定）", F97: "通知中心（待定）",
  F99: "快速编辑（待定）",
}

export const knownFunctionCodes = Object.keys(functionCodeDescriptions)

const skinStateDescriptions: Record<number, string> = {
  1: "首字母自动大写",
  2: "大写锁定",
  3: "英文联想开启",
  4: "存在输入编码",
  5: "候选单字/全部切换",
  6: "符号面板锁定",
  7: "候选已到页首",
  8: "候选已到页尾",
  9: "候选栏展开",
  11: "输入中回车键",
  14: "Shift 按下",
  17: "回车键：下一项",
  21: "回车键：搜索",
  23: "回车键：前往",
  27: "回车键：发送",
  30: "输入码清除键",
  32: "语音入口",
  34: "普通空格键",
  35: "仓颉模式",
  36: "空格语音开启",
  37: "多语言空格键",
  38: "符号面板更多页",
  57: "语音面板英文切换",
  63: "Pad 符号扩展页",
  94: "AI 输入返回键第一态",
  95: "AI 输入返回键第二态",
}

export const MIN_SKIN_STATE = 1
export const MAX_SKIN_STATE = 122
export const knownSkinStates = Array.from(
  { length: MAX_SKIN_STATE - MIN_SKIN_STATE + 1 },
  (_, index) => index + MIN_SKIN_STATE,
)

const skinStateFallbackTexts: Record<number, string> = {
  11: "换行",
  17: "下一项",
  21: "搜索",
  23: "前往",
  27: "发送",
}

export function skinStateDescription(state: number): string | undefined {
  return skinStateDescriptions[state]
}

export function skinStateFallbackText(state: number | undefined): string | undefined {
  return state === undefined ? undefined : skinStateFallbackTexts[state]
}

export function skinStateForcesComposition(state: number | undefined): boolean {
  return state === 4
}

export function skinStateLabel(state: number): string {
  const description = skinStateDescriptions[state]
  return description ? `S${state}（${description}）` : `S${state}`
}

export function actionDescription(value: string): string {
  if (!value) return "未配置"
  if (functionCodeDescriptions[value]) return functionCodeDescriptions[value]
  if (/^F\d+$/.test(value)) return `百度功能码 ${value}`
  const state = previewStateFromAction(value)
  if (state !== undefined) return `百度状态码 ${skinStateLabel(state)}`
  return ""
}

export function shouldSuggestActionCodes(value: string): boolean {
  return !value.trim() || /^F\d*$/i.test(value.trim())
}

export function previewStateFromAction(code: string): number | undefined {
  const match = code.trim().match(/^S(\d+)(?:_\d+)?$/)
  if (!match) return
  const state = Number(match[1])
  return state >= MIN_SKIN_STATE && state <= MAX_SKIN_STATE ? state : undefined
}

export function isConfiguredSymbolLayout(path: string, general: IniDocument | undefined): boolean {
  const current = path.split("/").pop()?.replace(/\.ini$/i, "").toLowerCase()
  const configured = (general?.get("MORE", "SYM_LAYOUT")?.trim() || "symbol")
    .replace(/\.ini$/i, "")
    .toLowerCase()
  return Boolean(current && current === configured)
}

function symbolPageTarget(
  currentName: string,
  symbolLayout: string,
  existing: (name: string) => string | undefined,
  available: Map<string, string> | undefined,
): string | undefined {
  const current = currentName.split("/").pop()?.replace(/\.ini$/i, "").toLowerCase() ?? ""
  const configured = symbolLayout.replace(/\.ini$/i, "").toLowerCase()
  const preferred = current === configured
    ? ["symbol"]
    : current === "symbol"
      ? [configured]
      : ["symbol", configured]
  for (const name of preferred) {
    const match = existing(name)
    if (match && match.toLowerCase() !== `${current}.ini`) return match
  }
  if (!available) return
  const matches = [...available.values()].filter((name) => {
    const base = name.replace(/\.ini$/i, "")
    return /^(?:sym|symbol)(?:[_-]|$)/i.test(base) || /(?:^|[_-])symbol(?:[_-]|$)/i.test(base)
  })
  return matches.find((name) => name.toLowerCase() !== `${current}.ini`)
}

export function previewPageTarget(
  code: string,
  currentName: string,
  baseName = "py_9.ini",
  availableNames?: Iterable<string>,
  symbolLayout = "symbol",
): string | undefined {
  const value = code.trim()
  const available = availableNames ? new Map(
    [...availableNames].map((name) => [name.toLowerCase(), name]),
  ) : undefined
  const existing = (name: string): string | undefined => {
    const filename = name.replace(/\.ini$/i, "") + ".ini"
    return available ? available.get(filename.toLowerCase()) : filename
  }
  const firstMatching = (preferred: string[], pattern: RegExp): string | undefined => {
    for (const name of preferred) {
      const match = existing(name)
      if (match) return match
    }
    return available && [...available.values()].find((name) => pattern.test(name.replace(/\.ini$/i, "")))
  }
  const suffix = currentName.match(/(?:^|[_-])(9|14|26)(?:\.ini)?$/i)?.[1]
  const explicit = value.match(/^Z\+([A-Za-z0-9_-]+)$/)
  if (explicit) return existing(explicit[1])
  if (value === "F4" || value === "F15") return existing(baseName)
  if (value === "F6") return firstMatching(
    suffix ? [`num_${suffix}`] : ["num_9", "num_26"],
    /^(?:num|numbers?|numeric)(?:[_-]|$)/i,
  )
  if (value === "F1") return firstMatching(
    [symbolLayout, "symbol", suffix ? `sym_${suffix}_cn` : ""].filter(Boolean),
    /^(?:sym|symbol)(?:[_-]|$)|(?:^|[_-])symbol(?:[_-]|$)/i,
  )
  if (value === "F90" || value === "F91") return symbolPageTarget(currentName, symbolLayout, existing, available)
  if (value === "F16") return firstMatching(
    suffix ? [`en_${suffix}`] : ["en_26", "en_9"],
    /^(?:en|english|letter|letters)(?:[_-]|$)/i,
  )
}

export function previewPageTransition(
  code: string,
  currentName: string,
  returnName: string,
  availableNames?: Iterable<string>,
  symbolLayout = "symbol",
): { target: string | undefined; returnName: string } {
  const value = code.trim()
  const requestedTarget = previewPageTarget(
    value,
    currentName,
    returnName,
    availableNames,
    symbolLayout,
  )
  const returnsToOrigin =
    value === "F4" ||
    value === "F15" ||
    ((value === "F6" || value === "F16") &&
      requestedTarget?.toLowerCase() === currentName.toLowerCase())
  const switchingSymbolPage = value === "F90" || value === "F91"
  const enteringTransientPage =
    !returnsToOrigin && !switchingSymbolPage && Boolean(requestedTarget)
  const nextReturnName = enteringTransientPage ? currentName : returnName
  return {
    target: returnsToOrigin
      ? previewPageTarget(value, currentName, nextReturnName, availableNames, symbolLayout)
      : requestedTarget,
    returnName: returnsToOrigin ? returnName : nextReturnName,
  }
}

export function layoutLetterKeyCount(document: IniDocument): number {
  return document.sections().filter((section) => {
    if (!/^KEY\d+$/.test(section)) return false
    return /^[A-Za-z]+$/.test(document.get(section, "CENTER")?.trim() ?? "")
  }).length
}
