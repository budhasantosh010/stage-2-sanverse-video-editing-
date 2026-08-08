import type { MotionComponentCapabilitiesV1 } from '@sanverse/motion-contract'
import type { MotionGroupNodeV1, MotionLayoutMetadataV1, MotionPathNodeV1, MotionShapeNodeV1, MotionTextNodeV1 } from '@sanverse/motion-graph'
import { constant, nodeBase } from '@sanverse/motion-graph'

export const FULL_NATIVE_GRAPH_CAPABILITIES: MotionComponentCapabilitiesV1 = Object.freeze({
  semanticParts: true,
  orderedEffects: true,
  masks: true,
  blendModes: true,
  responsiveLayout: true,
  formatOverrides: true,
  keyframeReady: true,
  bindingReady: true,
})

export const responsiveGraphLayout = (): MotionLayoutMetadataV1 => Object.freeze({ mode: 'responsive', ownership: Object.freeze([]), formatOverrides: Object.freeze([]) })

export const graphGroup = (id: string, name: string, parentId: string | null, childIds: readonly string[]): MotionGroupNodeV1 => Object.freeze({
  ...nodeBase(id, name, parentId),
  type: 'group',
  childIds: Object.freeze([...childIds]),
})

export const graphText = (input: Readonly<{
  id: string
  name: string
  parentId: string
  text: string
  color: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  textAlign?: 'left' | 'center' | 'right'
}>): MotionTextNodeV1 => Object.freeze({
  ...nodeBase(input.id, input.name, input.parentId),
  type: 'text',
  text: constant(input.text),
  fillColor: constant(input.color),
  fontFamily: input.fontFamily,
  fontSize: constant(input.fontSize),
  fontWeight: constant(input.fontWeight),
  textAlign: input.textAlign ?? 'left',
})

export const graphShape = (input: Readonly<{
  id: string
  name: string
  parentId: string
  shape?: 'rectangle' | 'rounded-rectangle' | 'ellipse'
  width: number
  height: number
  fillColor: string
  strokeColor: string
  strokeWidth: number
  radius: number
}>): MotionShapeNodeV1 => Object.freeze({
  ...nodeBase(input.id, input.name, input.parentId),
  type: 'shape',
  shape: input.shape ?? 'rounded-rectangle',
  width: constant(input.width),
  height: constant(input.height),
  fillColor: constant(input.fillColor),
  strokeColor: constant(input.strokeColor),
  strokeWidth: constant(input.strokeWidth),
  radius: constant(input.radius),
})

export const graphPath = (input: Readonly<{
  id: string
  name: string
  parentId: string
  pathData: string
  fillColor: string
  strokeColor: string
  strokeWidth: number
}>): MotionPathNodeV1 => Object.freeze({
  ...nodeBase(input.id, input.name, input.parentId),
  type: 'path',
  pathData: input.pathData,
  fillColor: constant(input.fillColor),
  strokeColor: constant(input.strokeColor),
  strokeWidth: constant(input.strokeWidth),
  trimProgress: constant(1),
})

export const stableWordNodeIds = (prefix: string, words: readonly string[]): readonly string[] => {
  const counts = new Map<string, number>()
  return Object.freeze(words.map((word) => {
    const slug = word.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') || 'word'
    const occurrence = (counts.get(slug) ?? 0) + 1
    counts.set(slug, occurrence)
    return `${prefix}.word:${slug}:${occurrence}`
  }))
}
