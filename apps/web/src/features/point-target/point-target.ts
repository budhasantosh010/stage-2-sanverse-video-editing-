export type ElementBox = {
  left: number
  top: number
  width: number
  height: number
}

export type CapturedPointTarget = {
  x: number
  y: number
  timeMs: number
}

type CapturePointTargetInput = {
  clientX: number
  clientY: number
  elementBox: ElementBox
  videoWidth: number
  videoHeight: number
  currentTimeSeconds: number
}

type CapturePointTargetResult =
  | { ok: true; value: CapturedPointTarget }
  | { ok: false; error: string }

function isPositiveFinite(value: number) {
  return Number.isFinite(value) && value > 0
}

export function getRenderedVideoContentBox(
  elementBox: ElementBox,
  videoWidth: number,
  videoHeight: number,
): ElementBox | null {
  if (
    !Number.isFinite(elementBox.left) ||
    !Number.isFinite(elementBox.top) ||
    !isPositiveFinite(elementBox.width) ||
    !isPositiveFinite(elementBox.height) ||
    !isPositiveFinite(videoWidth) ||
    !isPositiveFinite(videoHeight)
  ) {
    return null
  }

  const elementAspect = elementBox.width / elementBox.height
  const videoAspect = videoWidth / videoHeight

  if (elementAspect > videoAspect) {
    const width = elementBox.height * videoAspect
    return {
      left: elementBox.left + (elementBox.width - width) / 2,
      top: elementBox.top,
      width,
      height: elementBox.height,
    }
  }

  const height = elementBox.width / videoAspect
  return {
    left: elementBox.left,
    top: elementBox.top + (elementBox.height - height) / 2,
    width: elementBox.width,
    height,
  }
}

export function capturePointTarget(input: CapturePointTargetInput): CapturePointTargetResult {
  if (!Number.isFinite(input.currentTimeSeconds) || input.currentTimeSeconds < 0) {
    return { ok: false, error: 'The current video time is unavailable.' }
  }
  if (!isPositiveFinite(input.videoWidth) || !isPositiveFinite(input.videoHeight)) {
    return { ok: false, error: 'The visible video bounds are unavailable.' }
  }

  const timeMs = Math.round(input.currentTimeSeconds * 1000)
  if (!Number.isFinite(timeMs) || timeMs < 0) {
    return { ok: false, error: 'The current video time is unavailable.' }
  }

  const contentBox = getRenderedVideoContentBox(
    input.elementBox,
    input.videoWidth,
    input.videoHeight,
  )
  if (!contentBox) {
    return { ok: false, error: 'The visible video bounds are unavailable.' }
  }

  const isInside =
    Number.isFinite(input.clientX) &&
    Number.isFinite(input.clientY) &&
    input.clientX >= contentBox.left &&
    input.clientX <= contentBox.left + contentBox.width &&
    input.clientY >= contentBox.top &&
    input.clientY <= contentBox.top + contentBox.height

  if (!isInside) {
    return { ok: false, error: 'Choose a point inside the visible video.' }
  }

  return {
    ok: true,
    value: {
      x: (input.clientX - contentBox.left) / contentBox.width,
      y: (input.clientY - contentBox.top) / contentBox.height,
      timeMs,
    },
  }
}

export function formatPointTargetTime(timeMs: number) {
  const wholeMilliseconds = Number.isFinite(timeMs) ? Math.max(0, Math.round(timeMs)) : 0
  const hours = Math.floor(wholeMilliseconds / 3_600_000)
  const minutes = Math.floor((wholeMilliseconds % 3_600_000) / 60_000)
  const seconds = Math.floor((wholeMilliseconds % 60_000) / 1000)
  const milliseconds = wholeMilliseconds % 1000
  const minuteText = String(minutes).padStart(2, '0')
  const time = `${minuteText}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`

  return hours > 0 ? `${hours}:${time}` : time
}
