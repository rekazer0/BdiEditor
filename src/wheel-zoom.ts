// 按滚动量缩放：触控板捏合 / Cmd+滚轮一次会连发很多小 delta 事件，固定步长会跳得很猛；
// 鼠标滚轮一格约 100px，对应约 1.2 倍。
export function wheelZoomFactor(event: WheelEvent): number {
  const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY
  return Math.exp(-Math.max(-100, Math.min(100, delta)) * 0.002)
}
