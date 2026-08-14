export type DeviceSpec = {
  width: number
  height: number
  family: "iphone" | "android"
  frame?: {
    width: number
    height: number
    screenWidth: number
    screenHeight: number
    viewportWidth: number
    viewportHeight: number
  }
}

const DEVICES: Record<string, DeviceSpec> = {
  "iphone-17-pro": {
    width: 1206,
    height: 2622,
    family: "iphone",
    frame: { width: 68.98, height: 150.01, screenWidth: 66.67, screenHeight: 147.61, viewportWidth: 402, viewportHeight: 874 },
  },
  "iphone-17-pro-max": {
    width: 1320,
    height: 2868,
    family: "iphone",
    frame: { width: 74.86, height: 163.43, screenWidth: 72.56, screenHeight: 161.03, viewportWidth: 440, viewportHeight: 956 },
  },
  "xiaomi-17": { width: 1220, height: 2656, family: "android" },
  "pixel-10-pro": { width: 1280, height: 2856, family: "android" },
  "galaxy-s25-ultra": { width: 1440, height: 3120, family: "android" },
}

export function deviceSpec(id: string): DeviceSpec | undefined {
  return DEVICES[id]
}

export function showsKeyboardAccessories(
  device: DeviceSpec | undefined,
  orientation: "port" | "land",
): boolean {
  return device?.family === "iphone" && orientation === "port"
}

export function candidateBackgroundLogicalHeight(
  device: DeviceSpec | undefined,
  orientation: "port" | "land",
  contentHeight: number,
  composing = false,
): number {
  if (orientation !== "port") return contentHeight
  if (device?.family === "iphone") return contentHeight + (composing ? 95 : 66)
  return contentHeight + (!device && composing ? 95 : 0)
}

export function keyboardPreviewGeometry(
  device: DeviceSpec,
  orientation: "port" | "land",
  skinWidth: number,
  panelLogicalHeight: number,
  candidateLogicalHeight: number,
  composing = false,
): {
  candidateHeight: number
  candidateInsetHeight: number
  candidateContentHeight: number
  panelHeight: number
  safeBottomHeight: number
  totalHeight: number
} {
  const screenWidth = orientation === "port" ? device.width : device.height
  const screenHeight = orientation === "port" ? device.height : device.width
  const iphonePortrait = orientation === "port" && device.family === "iphone"
  const androidPortrait = orientation === "port" && device.family === "android"
  const candidateBackgroundHeight = candidateBackgroundLogicalHeight(
    device,
    orientation,
    candidateLogicalHeight,
    composing,
  )
  const candidateInsetLogicalHeight = candidateBackgroundHeight - candidateLogicalHeight
  const safeLogicalHeight = iphonePortrait
    ? device.width * (236 / 1206)
    : androidPortrait
      ? device.width * 0.06
      : 0
  const totalLogicalHeight = candidateBackgroundHeight + panelLogicalHeight
  const widthScale = screenWidth / skinWidth
  const heightScale = (screenHeight - safeLogicalHeight) / totalLogicalHeight
  const scale = Math.min(widthScale, heightScale)
  const candidateInsetHeight = candidateInsetLogicalHeight * scale
  const candidateContentHeight = candidateLogicalHeight * scale
  const candidateHeight = candidateInsetHeight + candidateContentHeight
  const panelHeight = panelLogicalHeight * scale
  const safeBottomHeight = safeLogicalHeight
  return {
    candidateHeight,
    candidateInsetHeight,
    candidateContentHeight,
    panelHeight,
    safeBottomHeight,
    totalHeight: candidateHeight + panelHeight + safeBottomHeight,
  }
}
