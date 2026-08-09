export function operationError(action: string, error: unknown): string {
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === "string" && error.trim()
        ? error
        : "未知错误"
  return `${action}失败：${detail}`
}

type ProjectTemplateFetcher = (
  path: string,
) => Promise<{ readonly ok: boolean; arrayBuffer(): Promise<ArrayBuffer> }>

const builtInProjectTemplatePaths: Record<string, string> = {
  "default-android": "/default-template.bda",
  "official-android-bds": "/default-template.bds",
  "imitation-ios-15": "/templates/imitation-ios-15.bdi",
  "dust-ios-14": "/templates/dust-ios-14.bdi",
  "dust-android-26-9": "/templates/dust-android-26-9.bds",
  "dust-ios-26-9": "/templates/dust-ios-26-9.bdi",
  "dust-ios-18": "/templates/dust-ios-18.bdi",
}

export async function loadBuiltInProjectTemplate(
  id: string,
  fetcher: ProjectTemplateFetcher = (path) => fetch(path),
): Promise<Uint8Array> {
  const path = builtInProjectTemplatePaths[id]
  if (!path) throw new Error(`未知的内置项目模板：${id}`)
  const response = await fetcher(path)
  if (!response.ok) throw new Error("无法加载内置默认皮肤模板")
  return new Uint8Array(await response.arrayBuffer())
}
