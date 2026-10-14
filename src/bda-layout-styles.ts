import { type BdaStyleRef, type BdaKey, type BdaPanel } from "./bda.ts"
import { type BdaLayoutScope, bdaEntryLabel } from "./bda-editor.ts"

// label 是中文说明，field 是 BDA appearanceConfig 解码源码里的真实字段名，
// path 指向单个样式引用；多选时 paths 汇总所有同步写回位置。
export type BdaLayoutStyleItem = {
  ref: BdaStyleRef
  label: string
  field: string
  path: string[]
  paths?: string[][]
  owner?: string
}

export type BdaLayoutStyleGroup = { key: string; title: string; items: BdaLayoutStyleItem[] }

export function uniqueStyleItems(items: BdaLayoutStyleItem[]): BdaLayoutStyleItem[] {
  return [...new Map(items.map((item) => [item.path.join("."), item])).values()]
}

export function keyStyleItems(name: string, key: BdaKey, path: string[]): BdaLayoutStyleItem[] {
  return [
    ...(key.backStyle ? [{ ref: key.backStyle, label: "背景样式", field: "backStyle", path: [...path, "backStyle"], owner: name }] : []),
    ...key.foreStyles.map((ref, index) => ({
      ref,
      label: `前景样式 ${index + 1}`,
      field: `foreStyles[${index}]`,
      path: [...path, "foreStyles", String(index)],
      owner: name,
    })),
    ...(key.backStyleState ? [{ ref: key.backStyleState, label: "状态背景样式", field: "backStyleState", path: [...path, "backStyleState"], owner: name }] : []),
  ]
}

export function bdaLayoutStyleGroups(
  panel: BdaPanel,
  keys: Array<{ name: string; key: BdaKey }>,
  scope: BdaLayoutScope = "panel",
): BdaLayoutStyleGroup[] {
  const group = (key: string, title: string, items: BdaLayoutStyleItem[]): BdaLayoutStyleGroup | undefined => {
    const unique = uniqueStyleItems(items)
    return unique.length ? { key, title, items: unique } : undefined
  }
  if (keys.length) {
    const items = keys.flatMap(({ name, key }) => keyStyleItems(name, key, ["keys", name]))
    const merged = keys.length === 1 ? items : [...items.reduce((result, item) => {
      const current = result.get(item.field)
      if (current) current.paths!.push(item.path)
      else result.set(item.field, { ...item, owner: undefined, paths: [item.path] })
      return result
    }, new Map<string, BdaLayoutStyleItem>()).values()]
    const selection = group("selection", `已选按键（${keys.length}）`, merged)
    return selection ? [selection] : []
  }

  // 候选栏样式属于候选栏对象，不混入面板整体设置。
  if (scope === "candidate") {
    const candidate: BdaLayoutStyleItem[] = []
    const cand = panel.cand
    if (!cand) return []
    for (const [ref, label, field] of [
      [cand.candBarStyle, "候选栏背景", "candBarStyle"], [cand.candOnBarStyle, "候选上屏状态", "candOnBarStyle"],
      [cand.cellBackStyle, "候选单元背景", "cellBackStyle"], [cand.cellForeStyle, "候选文字", "cellForeStyle"],
      [cand.firstCellBackStyle, "首候选背景", "firstCellBackStyle"], [cand.firstCellForeStyle, "首候选文字", "firstCellForeStyle"],
      [cand.subCandBackStyle, "子候选栏背景", "subCandBackStyle"], [cand.subCandCellBackStyle, "子候选单元背景", "subCandCellBackStyle"],
      [cand.subCandCellForeStyle, "子候选文字", "subCandCellForeStyle"], [cand.accessoryBackStyle, "候选附件背景", "accessoryBackStyle"],
      [cand.gridLeftForeStyle, "候选网格左图标", "gridLeftForeStyle"], [cand.gridRightForeStyle, "候选网格右图标", "gridRightForeStyle"],
    ] as const) if (ref) candidate.push({ ref, label, field, path: ["cand", field] })
    const switchItems: BdaLayoutStyleItem[] = []
    if (cand.switch) {
      for (const [ref, label, field] of [
        [cand.switch.normalBack, "候选切换 · 正常背景", "normalBack"], [cand.switch.selectBack, "候选切换 · 选中背景", "selectBack"],
        [cand.switch.normalFore, "候选切换 · 正常前景", "normalFore"], [cand.switch.selectFore, "候选切换 · 选中前景", "selectFore"],
      ] as const) if (ref) switchItems.push({ ref, label, field: `switch.${field}`, path: ["cand", "switch", field] })
    }
    const candKeys = [...cand.candKeys].flatMap(([name, value]) =>
      keyStyleItems(`候选键 ${name}`, value, ["cand", "candKeys", name]))
    const menuKeys = [...cand.menuKeys].flatMap(([name, value]) =>
      keyStyleItems(`候选菜单 ${name}`, value, ["cand", "menuKeys", name]))
    const aiIcon = cand.aiIcon ? keyStyleItems("AI 图标", cand.aiIcon, ["cand", "aiIcon"]) : []
    return [
      group("candidate", "候选栏", candidate),
      group("candidateSwitch", "候选切换", switchItems),
      group("candidateKeys", "候选键", candKeys),
      group("candidateMenu", "候选菜单", [...menuKeys, ...aiIcon]),
    ].filter((value): value is BdaLayoutStyleGroup => Boolean(value))
  }

  const groups = [
    group("panel", "面板", [
      ...(panel.wholeBackStyle ? [{ ref: panel.wholeBackStyle, label: "面板整体背景", field: "wholeBackStyle", path: ["wholeBackStyle"] }] : []),
      ...(panel.backStyle ? [{ ref: panel.backStyle, label: "面板背景", field: "backStyle", path: ["backStyle"] }] : []),
      ...(panel.inputRegionBackStyle ? [{ ref: panel.inputRegionBackStyle, label: "输入区整体背景", field: "inputRegionBackStyle", path: ["inputRegionBackStyle"] }] : []),
    ]),
    group("input", "输入区", [
      ...(panel.input?.backStyle ? [{ ref: panel.input.backStyle, label: "输入区背景", field: "input.backStyle", path: ["input", "backStyle"] }] : []),
      ...(panel.input?.textStyle ? [{ ref: panel.input.textStyle, label: "输入区文字", field: "input.textStyle", path: ["input", "textStyle"] }] : []),
    ]),
    group("more", "更多面板", [
      ...(panel.more?.backStyle ? [{ ref: panel.more.backStyle, label: "更多面板背景", field: "more.backStyle", path: ["more", "backStyle"] }] : []),
      ...(panel.more?.cellBackStyle ? [{ ref: panel.more.cellBackStyle, label: "更多面板单元背景", field: "more.cellBackStyle", path: ["more", "cellBackStyle"] }] : []),
      ...(panel.more?.cellForeStyle ? [{ ref: panel.more.cellForeStyle, label: "更多面板单元前景", field: "more.cellForeStyle", path: ["more", "cellForeStyle"] }] : []),
    ]),
    group("hints", "按键提示", [...panel.hints].flatMap(([key, hint]) => { const name = bdaEntryLabel(key); return [
      ...(hint.backStyle ? [{ ref: hint.backStyle, label: `${name} · 背景`, field: "backStyle", path: ["hints", key, "backStyle"] }] : []),
      ...(hint.barStyle ? [{ ref: hint.barStyle, label: `${name} · 提示条`, field: "barStyle", path: ["hints", key, "barStyle"] }] : []),
      ...(hint.foreStyle ? [{ ref: hint.foreStyle, label: `${name} · 前景`, field: "foreStyle", path: ["hints", key, "foreStyle"] }] : []),
      ...(hint.cellStyle ? [{ ref: hint.cellStyle, label: `${name} · 单元背景`, field: "cellStyle", path: ["hints", key, "cellStyle"] }] : []),
    ] })),
    group("lists", "列表", [...panel.lists].flatMap(([key, list]) => { const name = bdaEntryLabel(key); return [
      ...(list.backStyle ? [{ ref: list.backStyle, label: `${name} · 背景`, field: "backStyle", path: ["lists", key, "backStyle"] }] : []),
      ...(list.cellBackStyle ? [{ ref: list.cellBackStyle, label: `${name} · 单元背景`, field: "cellBackStyle", path: ["lists", key, "cellBackStyle"] }] : []),
      ...(list.cellForeStyle ? [{ ref: list.cellForeStyle, label: `${name} · 单元文字`, field: "cellForeStyle", path: ["lists", key, "cellForeStyle"] }] : []),
      ...list.foreStyles.map((ref, index) => ({
        ref,
        label: `${name} · 前景 ${index + 1}`,
        field: `foreStyles[${index}]`,
        path: ["lists", key, "foreStyles", String(index)],
      })),
    ] })),
  ]
  return groups.filter((value): value is BdaLayoutStyleGroup => Boolean(value))
}
