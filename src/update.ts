export type UpdateResult =
  | { status: "latest"; currentVersion: string; latestVersion: string }
  | { status: "available"; currentVersion: string; latestVersion: string; url: string }

export const releaseUrl = "https://github.com/rekazer0/BdiEditor/releases"
export const releaseApiUrl = "https://api.github.com/repos/rekazer0/BdiEditor/releases/latest"

function versionParts(value: string): number[] | undefined {
  const match = value.trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)/)
  return match?.slice(1).map(Number)
}

export function compareVersions(left: string, right: string): number {
  const a = versionParts(left) ?? [0, 0, 0]
  const b = versionParts(right) ?? [0, 0, 0]
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1
  }
  return 0
}

export async function checkForUpdate(currentVersion: string, fetcher = fetch): Promise<UpdateResult> {
  const response = await fetcher(releaseApiUrl)
  if (!response.ok) throw new Error(`GitHub 返回 ${response.status}`)
  const body = await response.text()
  let apiVersion: string | undefined
  try {
    const payload = JSON.parse(body) as { tag_name?: unknown }
    if (typeof payload.tag_name === "string") apiVersion = payload.tag_name
  } catch {
    // The desktop bridge returns the releases HTML instead of GitHub API JSON.
  }
  const versions = [
    ...(apiVersion ? [apiVersion] : []),
    ...[...body.matchAll(/\/rekazer0\/BdiEditor\/releases\/tag\/(v?\d+\.\d+\.\d+)(?=["'/?#])/g)]
      .map((match) => match[1].replace(/^v/i, "")),
  ]
    .map((version) => version.replace(/^v/i, ""))
    .filter((version, index, values) => values.indexOf(version) === index && Boolean(versionParts(version)))
  const latestVersion = versions.sort((left, right) => compareVersions(right, left))[0]
  if (!latestVersion) throw new Error("GitHub Release 数据无效")
  const release = `https://github.com/rekazer0/BdiEditor/releases/tag/v${latestVersion}`
  if (compareVersions(latestVersion, currentVersion) <= 0) {
    return { status: "latest", currentVersion, latestVersion }
  }
  return { status: "available", currentVersion, latestVersion, url: release }
}
