/** Stage only settings keys, never unrelated editor state or model credentials. */
export function createSettingsDraft(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, keys: string[]) {
  let baseline = new Map<string, string | null>()
  const pending = new Map<string, string | null>()
  const write = (key: string, value: string | null) => {
    if (value === null) storage.removeItem(key)
    else storage.setItem(key, value)
  }
  return {
    begin() {
      baseline = new Map(keys.map(key => [key, storage.getItem(key)]))
      pending.clear()
    },
    capture(changedKeys: string[]) {
      for (const key of changedKeys) {
        if (!baseline.has(key)) continue
        pending.set(key, storage.getItem(key))
        write(key, baseline.get(key)!)
      }
    },
    commit() {
      for (const [key, value] of pending) write(key, value)
      pending.clear()
    },
    cancel() {
      for (const [key, value] of baseline) write(key, value)
      pending.clear()
    },
  }
}
