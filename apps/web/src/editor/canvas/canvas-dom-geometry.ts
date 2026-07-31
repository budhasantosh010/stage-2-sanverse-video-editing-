import type { CanvasRect } from './canvas-contract'

const rectFromDom = (rect: DOMRect | DOMRectReadOnly): CanvasRect => Object.freeze({
  x: rect.left,
  y: rect.top,
  width: rect.width,
  height: rect.height,
})

const union = (rects: readonly CanvasRect[]): CanvasRect | null => {
  const usable = rects.filter((rect) => rect.width > 0 && rect.height > 0 && [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite))
  if (usable.length === 0) return null
  const left = Math.min(...usable.map((rect) => rect.x))
  const top = Math.min(...usable.map((rect) => rect.y))
  const right = Math.max(...usable.map((rect) => rect.x + rect.width))
  const bottom = Math.max(...usable.map((rect) => rect.y + rect.height))
  return Object.freeze({ x: left, y: top, width: right - left, height: bottom - top })
}

const textRect = (element: HTMLElement): CanvasRect | null => {
  if (typeof document === 'undefined' || typeof document.createRange !== 'function') return rectFromDom(element.getBoundingClientRect())
  const range = document.createRange()
  range.selectNodeContents(element)
  const measured = typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : element.getBoundingClientRect()
  const style = typeof getComputedStyle === 'function' ? getComputedStyle(element) : null
  const left = Number.parseFloat(style?.paddingLeft ?? '0') || 0
  const right = Number.parseFloat(style?.paddingRight ?? '0') || 0
  const top = Number.parseFloat(style?.paddingTop ?? '0') || 0
  const bottom = Number.parseFloat(style?.paddingBottom ?? '0') || 0
  return Object.freeze({
    x: measured.left - left,
    y: measured.top - top,
    width: measured.width + left + right,
    height: measured.height + top + bottom,
  })
}

const partsFor = (root: HTMLElement): readonly CanvasRect[] => {
  if (root.classList.contains('media-overlay')) return [rectFromDom(root.getBoundingClientRect())]
  if (root.classList.contains('callout-overlay')) {
    const box = root.querySelector<HTMLElement>('.callout-overlay__box')
    return box ? [rectFromDom(box.getBoundingClientRect())] : []
  }
  if (root.classList.contains('nameplate-overlay')) {
    return [...root.querySelectorAll<HTMLElement>('.nameplate-overlay__primary, .nameplate-overlay__secondary')]
      .map((element) => rectFromDom(element.getBoundingClientRect()))
  }
  if (root.classList.contains('caption-overlay')) {
    return [...root.querySelectorAll<HTMLElement>('.caption-overlay__line')]
      .map((element) => rectFromDom(element.getBoundingClientRect()))
  }
  if (root.classList.contains('title-overlay')) {
    return [...root.querySelectorAll<HTMLElement>('.title-overlay__headline, .title-overlay__subhead')]
      .map(textRect)
      .filter((rect): rect is CanvasRect => rect !== null)
  }
  return [rectFromDom(root.getBoundingClientRect())]
}

export const measureCanvasNode = (
  contentLayer: HTMLElement,
  nodeId: string,
): CanvasRect | null => {
  const root = [...contentLayer.querySelectorAll<HTMLElement>('[data-node-id]')]
    .find((candidate) => candidate.dataset.nodeId === nodeId)
  if (!root) return null
  const measured = union(partsFor(root))
  if (!measured) return null
  const layerRect = contentLayer.getBoundingClientRect()
  return Object.freeze({
    x: measured.x - layerRect.left,
    y: measured.y - layerRect.top,
    width: measured.width,
    height: measured.height,
  })
}
