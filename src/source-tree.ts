export function sourceFolderDescription(path: string): string {
  const name = path.split("/").filter(Boolean).pop() ?? ""
  if (name === "light") return "浅色主题"
  if (name === "dark") return "深色主题"
  if (name === "skin") return "皮肤配置"
  if (name === "port") return "竖屏布局与组件"
  if (name === "land") return "横屏布局与组件"
  if (name === "res") return "共享图片、图集与样式"
  if (name === "logo") return "输入法工具栏资源"
  return "资源文件夹"
}

export function resolveSourceArchivePath(
  path: string,
  workspacePrefix: string,
  archivePaths: readonly string[],
): string {
  const rootMetadata = /^(?:info\.txt|demo\.png)$/i.test(path)
  const candidate = workspacePrefix && !rootMetadata ? `${workspacePrefix}${path}` : path
  const normalized = candidate.toLowerCase()
  return archivePaths.find((existing) => existing.toLowerCase() === normalized) ?? candidate
}

export type SourceWriteSnapshot = Uint8Array | null

export function consumeSourceWriteSnapshot(
  snapshots: Map<string, SourceWriteSnapshot[]>,
  path: string,
  data: SourceWriteSnapshot,
): boolean {
  const candidates = snapshots.get(path)
  const index = candidates?.findIndex((candidate) =>
    candidate === null || data === null
      ? candidate === data
      : candidate.length === data.length && candidate.every((byte, offset) => byte === data[offset]),
  ) ?? -1
  if (index < 0 || !candidates) return false
  candidates.splice(0, index + 1)
  if (!candidates.length) snapshots.delete(path)
  return true
}

export async function writePendingSourcePaths(
  pending: Set<string>,
  write: (paths: string[]) => Promise<void>,
): Promise<void> {
  const paths = [...pending]
  if (!paths.length) return
  pending.clear()
  try {
    await write(paths)
  } catch (error) {
    for (const path of paths) pending.add(path)
    throw error
  }
}
