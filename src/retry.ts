export type RetryOptions = {
  attempts: number
  delayMs: number
}

export async function retryAsync<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const attempts = Math.max(1, Math.floor(options.attempts))
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      if (attempt >= attempts) throw error
      if (options.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs * attempt))
      }
    }
  }
}
