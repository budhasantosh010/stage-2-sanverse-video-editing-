import type { CanvasGuide, CanvasRect } from './canvas-contract'

export type CanvasSnapResult = Readonly<{
  deltaX: number
  deltaY: number
  guides: readonly CanvasGuide[]
}>

type Candidate = Readonly<{ delta: number; positionPx: number; label: CanvasGuide['label'] }>

const bestCandidate = (candidates: readonly Candidate[], thresholdPx: number): Candidate | null => {
  const eligible = candidates.filter((candidate) => Math.abs(candidate.delta) <= thresholdPx)
  if (eligible.length === 0) return null
  return eligible.slice().sort((left, right) =>
    Math.abs(left.delta) - Math.abs(right.delta) || left.positionPx - right.positionPx,
  )[0]
}

export const snapCanvasRect = (input: Readonly<{
  rect: CanvasRect
  frame: CanvasRect
  thresholdPx?: number
  safeMarginFraction?: number
  disabled?: boolean
}>): CanvasSnapResult => {
  if (input.disabled) return Object.freeze({ deltaX: 0, deltaY: 0, guides: Object.freeze([]) })
  const threshold = input.thresholdPx ?? 6
  const safe = input.safeMarginFraction ?? 0.1
  if (![input.rect.x, input.rect.y, input.rect.width, input.rect.height, input.frame.x, input.frame.y, input.frame.width, input.frame.height, threshold, safe].every(Number.isFinite)) {
    return Object.freeze({ deltaX: 0, deltaY: 0, guides: Object.freeze([]) })
  }

  const rectX = [input.rect.x, input.rect.x + input.rect.width / 2, input.rect.x + input.rect.width]
  const rectY = [input.rect.y, input.rect.y + input.rect.height / 2, input.rect.y + input.rect.height]
  const frameX = [
    { value: input.frame.x, label: 'Frame edge' as const },
    { value: input.frame.x + input.frame.width * safe, label: 'Safe area' as const },
    { value: input.frame.x + input.frame.width / 2, label: 'Frame center' as const },
    { value: input.frame.x + input.frame.width * (1 - safe), label: 'Safe area' as const },
    { value: input.frame.x + input.frame.width, label: 'Frame edge' as const },
  ]
  const frameY = [
    { value: input.frame.y, label: 'Frame edge' as const },
    { value: input.frame.y + input.frame.height * safe, label: 'Safe area' as const },
    { value: input.frame.y + input.frame.height / 2, label: 'Frame center' as const },
    { value: input.frame.y + input.frame.height * (1 - safe), label: 'Safe area' as const },
    { value: input.frame.y + input.frame.height, label: 'Frame edge' as const },
  ]
  const x = bestCandidate(frameX.flatMap((target) => rectX.map((value) => ({
    delta: target.value - value,
    positionPx: target.value,
    label: target.label,
  }))), threshold)
  const y = bestCandidate(frameY.flatMap((target) => rectY.map((value) => ({
    delta: target.value - value,
    positionPx: target.value,
    label: target.label,
  }))), threshold)
  const guides: CanvasGuide[] = []
  if (x) guides.push(Object.freeze({ axis: 'x', positionPx: x.positionPx, label: x.label }))
  if (y) guides.push(Object.freeze({ axis: 'y', positionPx: y.positionPx, label: y.label }))
  return Object.freeze({
    deltaX: x?.delta ?? 0,
    deltaY: y?.delta ?? 0,
    guides: Object.freeze(guides),
  })
}
