import type { MotionCompositionV1, MotionRenderContextV1 } from '@sanverse/motion-contract'
import {
  constant,
  createDefaultMask,
  createMotionScene,
  evaluateScene,
  keyframed,
  motionString,
  nodeBase,
  prepareMotionSceneEvaluatorV15,
  type MotionExpertNodeV1,
  type MotionGroupNodeV1,
  type MotionSceneV1,
  type MotionShapeNodeV1,
  type MotionTextNodeV1,
} from '@sanverse/motion-graph'
import { evaluateMotionExpertAtTickV1 } from '@sanverse/motion-expert-runtime'
import { evaluateMotionTrackV1, type MotionTrackV1 } from '@sanverse/motion-source-aware'
import { renderCameraDepthAtTickV1, type CameraRigV1, type DepthBindingV1 } from '@sanverse/motion-camera-depth'
import type { CreativePerformanceRecorderV15 } from './performance.ts'

export const V15_STRESS_TICKS_PER_SECOND = 1_440_000 as const
export const V15_STRESS_DURATION_TICKS = 14_400_000 as const
export const V15_STRESS_COMPOSITION: MotionCompositionV1 = Object.freeze({ width: 1920, height: 1080, fpsNumerator: 30, fpsDenominator: 1 })

const numericTrack = (id: string, from: number, to: number) => keyframed([
  { id: `${id}:0`, tick: 0, value: from, interpolation: 'linear' },
  { id: `${id}:1`, tick: V15_STRESS_DURATION_TICKS, value: to, interpolation: 'bezier', bezier: { inX: .25, inY: .1, outX: .25, outY: 1 } },
])

const shapeNode = (index: number, parentId: string, animated: boolean, withMask: boolean): MotionShapeNodeV1 => {
  const id = `stress.shape.${index}`
  const base = nodeBase(id, `Stress shape ${index}`, parentId)
  const mask = withMask ? Object.freeze({ ...createDefaultMask(`stress.mask.${index}`, index % 2 === 0 ? 'ellipse' : 'rounded-rectangle'), opacity: numericTrack(`stress.mask.${index}:opacity`, 0, 1) }) : null
  return Object.freeze({
    ...base,
    type: 'shape' as const,
    opacity: animated ? numericTrack(`${id}:opacity`, .15, 1) : constant(1),
    transform: Object.freeze({
      ...base.transform,
      positionX: animated ? numericTrack(`${id}:x`, -0.45 + (index % 16) * .06, -0.2 + (index % 16) * .04) : constant(0),
      positionY: animated ? numericTrack(`${id}:y`, -0.42 + (index % 11) * .07, .35 - (index % 11) * .04) : constant(0),
      scaleX: animated ? numericTrack(`${id}:sx`, .75, 1.05) : constant(1),
      scaleY: animated ? numericTrack(`${id}:sy`, .75, 1.05) : constant(1),
    }),
    masks: mask ? Object.freeze([mask]) : Object.freeze([]),
    shape: index % 3 === 0 ? 'ellipse' : index % 3 === 1 ? 'rounded-rectangle' : 'rectangle',
    width: constant(.08),
    height: constant(.06),
    fillColor: constant(index % 2 === 0 ? '#ffffff' : '#b8b8b8'),
    strokeColor: constant('#111111'),
    strokeWidth: constant(.002),
    radius: constant(.08),
  })
}

const expertNode = (kind: 'procedural' | 'particles' | 'shader', parentId: string, index: number): MotionExpertNodeV1 => {
  const id = `stress.expert.${kind}.${index}`
  const base = nodeBase(id, `Stress expert ${kind}`, parentId)
  const expert = kind === 'procedural'
    ? Object.freeze({ schemaVersion: 'sanverse.motion-expert-node/v1' as const, kind, program: 'orbital-rings' as const, seed: 100 + index, width: 640, height: 360, maxPrimitives: 64, parameters: Object.freeze({ ringCount: 48, radius: 140, thickness: 4, wobble: 18, speed: 1.2 }) })
    : kind === 'particles'
      ? Object.freeze({ schemaVersion: 'sanverse.motion-expert-node/v1' as const, kind, program: 'radial-burst' as const, seed: 200 + index, width: 640, height: 360, maxPrimitives: 256, parameters: Object.freeze({ count: 224, lifetimeTicks: V15_STRESS_DURATION_TICKS, radius: 240, size: 8, speed: 1.4 }) })
      : Object.freeze({ schemaVersion: 'sanverse.motion-expert-node/v1' as const, kind, program: 'plasma-field' as const, seed: 300 + index, width: 640, height: 360, maxPrimitives: 1, parameters: Object.freeze({ frequency: 1.4, amplitude: .8, hueShift: 24, scale: 1.1 }) })
  return Object.freeze({ ...base, type: 'expert' as const, expert })
}

export interface V15StressSceneOptions {
  readonly nativeNodeCount?: number
  readonly animatedNodeCount?: number
  readonly maskedNodeCount?: number
  readonly includeExperts?: boolean
}

/**
 * Canonical deterministic load fixture used by V1.5. Defaults deliberately hit
 * the owner contract: 500+ native nodes, 2,000+ animated properties and 20+
 * animated masks, with bounded expert nodes in the mixed fixture.
 */
export const createV15StressScene = (options: V15StressSceneOptions = {}): MotionSceneV1 => {
  const nativeNodeCount = Math.max(500, options.nativeNodeCount ?? 520)
  const animatedNodeCount = Math.max(500, Math.min(nativeNodeCount, options.animatedNodeCount ?? 500))
  const maskedNodeCount = Math.max(20, Math.min(nativeNodeCount, options.maskedNodeCount ?? 24))
  const rootId = 'stress.root'
  const nodes: Record<string, MotionGroupNodeV1 | MotionShapeNodeV1 | MotionExpertNodeV1> = {}
  const childIds: string[] = []
  for (let index = 0; index < nativeNodeCount; index += 1) {
    const node = shapeNode(index, rootId, index < animatedNodeCount, index < maskedNodeCount)
    nodes[node.id] = node
    childIds.push(node.id)
  }
  if (options.includeExperts !== false) {
    for (const [index, kind] of (['procedural', 'particles', 'shader'] as const).entries()) {
      const node = expertNode(kind, rootId, index)
      nodes[node.id] = node
      childIds.push(node.id)
    }
  }
  nodes[rootId] = Object.freeze({ ...nodeBase(rootId, 'V1.5 stress root', null), type: 'group' as const, childIds: Object.freeze(childIds) })
  return createMotionScene({
    componentId: 'sanverse.v15-stress',
    componentVersion: 1,
    rootNodeId: rootId,
    nodes: Object.freeze(nodes),
    semanticParts: Object.freeze([{ id: 'stress.all', label: 'Stress fixture', role: 'content-group' as const, nodeIds: Object.freeze(childIds) }]),
    exposures: Object.freeze([]),
    layout: Object.freeze({ mode: 'responsive' as const, ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }),
    supportedAspectRatios: Object.freeze(['16:9', '9:16', '1:1', '4:5']),
  })
}

export const v15StressContext = (tick: number, composition: MotionCompositionV1 = V15_STRESS_COMPOSITION): MotionRenderContextV1 => Object.freeze({
  localTicks: tick,
  durationTicks: V15_STRESS_DURATION_TICKS,
  ticksPerSecond: V15_STRESS_TICKS_PER_SECOND,
  composition,
  reducedMotion: false,
})

/** Small text scene used for non-vacuous preview/export text and pixel parity proof. */
export const createV15TextParityScene = (): MotionSceneV1 => {
  const rootId = 'parity.root'
  const root = nodeBase(rootId, 'Parity root', null)
  const headlineBase = nodeBase('parity.headline', 'Parity headline', rootId)
  const metricBase = nodeBase('parity.metric', 'Parity metric', rootId)
  const headline: MotionTextNodeV1 = Object.freeze({
    ...headlineBase,
    type: 'text' as const,
    text: constant('Preview = Export'),
    fillColor: constant('#ffffff'),
    fontFamily: 'Arial',
    fontSize: constant(54),
    fontWeight: constant(700),
    textAlign: 'center' as const,
  })
  const metric: MotionTextNodeV1 = Object.freeze({
    ...metricBase,
    type: 'text' as const,
    text: motionString({ kind: 'compact-number', from: 0, to: 24_000, start: 0, end: 1, easing: 'linear', prefix: '$', suffix: '', decimals: 0, rounding: 'integer', reducedMotionFinal: true }),
    fillColor: constant('#d5d5d5'),
    fontFamily: 'Arial',
    fontSize: constant(44),
    fontWeight: constant(600),
    textAlign: 'center' as const,
  })
  return createMotionScene({
    componentId: 'sanverse.v15-text-parity',
    componentVersion: 1,
    rootNodeId: rootId,
    nodes: Object.freeze({
      [rootId]: Object.freeze({ ...root, type: 'group' as const, childIds: Object.freeze([headline.id, metric.id]) }),
      [headline.id]: headline,
      [metric.id]: metric,
    }),
    semanticParts: Object.freeze([{ id: 'parity.text', label: 'Parity text', role: 'content-group' as const, nodeIds: Object.freeze([headline.id, metric.id]) }]),
    exposures: Object.freeze([]),
    layout: Object.freeze({ mode: 'manual' as const, ownership: Object.freeze([]), formatOverrides: Object.freeze([]) }),
    supportedAspectRatios: Object.freeze(['16:9']),
  })
}

export interface V15SeekStressResult {
  readonly equal: boolean
  readonly nodeCount: number
  readonly ticks: readonly number[]
  readonly baselineMs: number
  readonly preparedMs: number
  readonly speedupRatio: number
  readonly expertChecks: readonly Readonly<{ nodeId: string; directSeekEqual: boolean; primitiveCount: number }>[]
}

const stable = (value: unknown): string => JSON.stringify(value)
const monotonicNow = (): number => globalThis.performance?.now?.() ?? Date.now()

export const runV15SeekStress = (
  scene: MotionSceneV1,
  recorder: CreativePerformanceRecorderV15,
  ticks: readonly number[] = Object.freeze([0, 720_000, 3_600_000, 7_200_000, 12_960_000, 3_600_000, 1_440_000, 12_960_000]),
): V15SeekStressResult => {
  const baselineStart = monotonicNow()
  const baseline = ticks.map((tick) => recorder.measure({ subsystem: 'Motion Graph', operation: 'evaluate-one-shot', tick, nodeCount: Object.keys(scene.nodes).length }, () => evaluateScene(scene, v15StressContext(tick))))
  const baselineMs = monotonicNow() - baselineStart

  const prepared = prepareMotionSceneEvaluatorV15(scene)
  const preparedStart = monotonicNow()
  const preparedFrames = ticks.map((tick) => recorder.measure({ subsystem: 'Motion Graph', operation: 'evaluate-prepared', tick, nodeCount: Object.keys(scene.nodes).length }, () => prepared.evaluate(v15StressContext(tick))))
  const preparedMs = monotonicNow() - preparedStart

  const expertChecks = Object.values(scene.nodes).filter((node): node is MotionExpertNodeV1 => node.type === 'expert').map((node) => {
    const tick = 7_200_000
    const direct = evaluateMotionExpertAtTickV1({ spec: node.expert, tick })
    evaluateMotionExpertAtTickV1({ spec: node.expert, tick: 12_000_000 })
    const backward = evaluateMotionExpertAtTickV1({ spec: node.expert, tick })
    return Object.freeze({ nodeId: node.id, directSeekEqual: stable(direct) === stable(backward), primitiveCount: direct.ok ? direct.value.resourceUsage.primitiveCount : -1 })
  })

  return Object.freeze({
    equal: baseline.every((frame, index) => stable(frame) === stable(preparedFrames[index])),
    nodeCount: Object.keys(scene.nodes).length,
    ticks: Object.freeze([...ticks]),
    baselineMs,
    preparedMs,
    speedupRatio: preparedMs > 0 ? baselineMs / preparedMs : Number.POSITIVE_INFINITY,
    expertChecks: Object.freeze(expertChecks),
  })
}

export interface V15TrackingStressResult {
  readonly trackCount: number
  readonly sampleCount: number
  readonly directSeekEqual: boolean
  readonly durationMs: number
}

export const createV15TrackingStressTracks = (count = 10, samplesPerTrack = 240): readonly MotionTrackV1[] => Object.freeze(Array.from({ length: Math.max(10, count) }, (_, trackIndex) => {
  const sampleCount = Math.max(2, samplesPerTrack)
  const samples = Array.from({ length: sampleCount }, (_, sampleIndex) => {
    const tick = Math.round((sampleIndex / (sampleCount - 1)) * V15_STRESS_DURATION_TICKS)
    const phase = (sampleIndex + trackIndex * 7) / Math.max(1, sampleCount - 1)
    return Object.freeze({
      tick,
      x: .1 + .75 * phase,
      y: .2 + .15 * Math.sin(phase * Math.PI * 2 + trackIndex),
      scaleX: 1 + .08 * Math.sin(phase * Math.PI),
      scaleY: 1 + .06 * Math.cos(phase * Math.PI),
      rotation: -8 + 16 * phase,
      visibility: 1,
      confidence: .96,
    })
  })
  return Object.freeze({
    schemaVersion: 'sanverse.motion-track/v1' as const,
    id: `stress.track.${trackIndex}`,
    sourceId: 'stress.source',
    sourceStartTick: 0,
    sourceEndTick: V15_STRESS_DURATION_TICKS,
    target: Object.freeze({ kind: 'object' as const, label: `Stress target ${trackIndex}` }),
    samples: Object.freeze(samples),
    interpolation: Object.freeze({ mode: 'linear' as const }),
    status: 'valid' as const,
    metadata: Object.freeze({ coordinateSpace: 'normalized-source' as const, provider: 'v15-stress-fixture', materializedAt: 'fixture' }),
  })
}))

export const runV15TrackingStress = (recorder: CreativePerformanceRecorderV15, tracks = createV15TrackingStressTracks()): V15TrackingStressResult => {
  const ticks = [720_000, 3_600_000, 7_200_000, 12_960_000, 3_600_000]
  const start = monotonicNow()
  const first = ticks.map((tick) => tracks.map((track) => recorder.measure({ subsystem: 'Tracking', operation: 'evaluate-track', tick, metadata: { trackId: track.id } }, () => evaluateMotionTrackV1(track, tick))))
  const durationMs = monotonicNow() - start
  const repeated = tracks.map((track) => evaluateMotionTrackV1(track, 3_600_000))
  return Object.freeze({
    trackCount: tracks.length,
    sampleCount: tracks.reduce((sum, track) => sum + track.samples.length, 0),
    directSeekEqual: stable(first.at(-1)) === stable(repeated),
    durationMs,
  })
}

export interface V15CameraStressResult {
  readonly depthBindings: number
  readonly directSeekEqual: boolean
  readonly durationMs: number
}

export const runV15CameraStress = (scene: MotionSceneV1, recorder: CreativePerformanceRecorderV15, bindingCount = 24): V15CameraStressResult => {
  const eligible = Object.values(scene.nodes).filter((node) => node.type === 'shape').slice(0, Math.max(8, bindingCount))
  const bindings: readonly DepthBindingV1[] = Object.freeze(eligible.map((node, index) => Object.freeze({ schemaVersion: 'sanverse.depth-binding/v1' as const, id: `stress.depth.${index}`, nodeId: node.id, depth: .2 + (index % 8) * .2 })))
  const rig: CameraRigV1 = Object.freeze({
    schemaVersion: 'sanverse.camera-rig/v1',
    id: 'stress.camera',
    durationTicks: V15_STRESS_DURATION_TICKS,
    positionX: numericTrack('stress.camera.x', 0, 120),
    positionY: numericTrack('stress.camera.y', 0, -80),
    zoom: numericTrack('stress.camera.zoom', 1, 1.18),
  })
  const ticks = [720_000, 7_200_000, 12_960_000, 7_200_000]
  const start = monotonicNow()
  const frames = ticks.map((tick) => recorder.measure({ subsystem: 'Camera', operation: 'depth-project', tick, nodeCount: bindings.length }, () => renderCameraDepthAtTickV1({ scene, rig, bindings, tick, composition: V15_STRESS_COMPOSITION })))
  const durationMs = monotonicNow() - start
  return Object.freeze({ depthBindings: bindings.length, directSeekEqual: stable(frames[1]) === stable(frames[3]), durationMs })
}
