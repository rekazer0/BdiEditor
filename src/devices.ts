export type DeviceSpec = {
  width: number
  height: number
  family: "iphone" | "android"
}

const DEVICES: Record<string, DeviceSpec> = {
  "iphone-17-pro": { width: 1206, height: 2622, family: "iphone" },
  "iphone-17-pro-max": { width: 1320, height: 2868, family: "iphone" },
  "xiaomi-17": { width: 1220, height: 2656, family: "android" },
  "pixel-10-pro": { width: 1280, height: 2856, family: "android" },
  "galaxy-s25-ultra": { width: 1440, height: 3120, family: "android" },
}

export function deviceSpec(id: string): DeviceSpec | undefined {
  return DEVICES[id]
}

export function keyboardPreviewGeometry(
  device: DeviceSpec,
  orientation: "port" | "land",
  skinWidth: number,
  panelLogicalHeight: number,
  candidateLogicalHeight: number,
  _composing = false,
): {
  candidateHeight: number
  candidateInsetHeight: number
  candidateContentHeight: number
  panelHeight: number
  safeBottomHeight: number
  totalHeight: number
} {
  const screenWidth = orientation === "port" ? device.width : device.height
  const scale = screenWidth / skinWidth
  const iphonePortrait = orientation === "port" && device.family === "iphone"
  const candidateInsetHeight = (iphonePortrait ? 95 : 0) * scale
  const candidateContentHeight = candidateLogicalHeight * scale
  const candidateHeight = candidateInsetHeight + candidateContentHeight
  const panelHeight = panelLogicalHeight * scale
  const safeBottomHeight = iphonePortrait
    ? device.width * (236 / 1206)
    : 0
  return {
    candidateHeight,
    candidateInsetHeight,
    candidateContentHeight,
    panelHeight,
    safeBottomHeight,
    totalHeight: candidateHeight + panelHeight + safeBottomHeight,
  }
}
