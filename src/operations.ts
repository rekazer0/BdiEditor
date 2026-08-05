export function operationError(action: string, error: unknown): string {
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === "string" && error.trim()
        ? error
        : "未知错误"
  return `${action}失败：${detail}`
}
