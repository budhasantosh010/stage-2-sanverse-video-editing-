import { describe, expect, it } from 'vitest'

import { DEFAULT_CLIP_TIME_TRANSFORM } from './clip-time.ts'
import { type Clip } from './composition.ts'
import {
  animationCapabilitiesForTarget,
  animationKeyframesVisibleInPlacement,
  animationVisibleRangeForPlacement,
  compositionTicksToAnimationKeyframeTicks,
  createEditorKeyframeClipboard,
  editorAnimationStateFromFootageMotion,
  editorAnimationStateFromVisualProperties,
  planAddEditorKeyframe,
  planDeleteEditorKeyframes,
  planMoveEditorKeyframes,
  planPasteEditorKeyframes,
  planRemoveAnimationTrack,
  planSetEditorKeyframeEasing,
  planSetEditorKeyframeValues,
  projectAnimationKeyframeToCompositionTicks,
  rebuildFootageMotionOperationWithAnimation,
  rebuildVisualPropertiesOperationWithAnimation,
} from './editor-animation.ts'
import { FOOTAGE_MOTION_CAPABILITY_ID, type SetFootageMotionOperation } from './footage-motion.ts'
import { emptyExtensions } from './json.ts'
import { mediaTime, PROJECT_TIMESCALE } from './time.ts'
import {
  DEFAULT_VISUAL_PROPERTIES,
  VISUAL_PROPERTIES_OPERATION_KIND,
  type SetVisualPropertiesOperation,
  type VisualEasing,
  type VisualPropertyTrack,
} from './visual-properties.ts'
import { VISUAL_PROPERTIES_PRIMITIVE_ID } from './capabilities.ts'

const S = PROJECT_TIMESCALE
const linear: VisualEasing = Object.freeze({ kind: 'linear' })
const ease: VisualEasing = Object.freeze({ kind: 'cubic-bezier', x1: 0.2, y1: 0, x2: 0.8, y2: 1 })

const clip = (overrides: Partial<Clip> = {}): Clip => Object.freeze({
  clipId: 'clip_animation01',
  assetId: 'asset_animation01',
  sourceRange: Object.freeze({ start: mediaTime(10 * S), duration: mediaTime(8 * S) }),
  compositionStart: mediaTime(20 * S),
  enabled: true,
  segmentKind: 'video',
  freezeDuration: null,
  linkedAudio: null,
  timeTransform: DEFAULT_CLIP_TIME_TRANSFORM,
  gainDb: 0,
  fadeIn: mediaTime(0),
  fadeOut: mediaTime(0),
  pan: 0,
  ...overrides,
})

const track = (property: 'scale' | 'translate-x' | 'opacity', frames: readonly [number, number][]): VisualPropertyTrack => Object.freeze({
  property,
  keyframes: Object.freeze(frames.map(([at, value]) => Object.freeze({ at: mediaTime(at), value, easing: linear }))),
})

const motion = (tracks: readonly VisualPropertyTrack[] = Object.freeze([])): SetFootageMotionOperation => Object.freeze({
  schemaVersion: 'sanverse.operation/v3',
  operationId: 'operation_animationmotion01',
  kind: 'set-footage-motion',
  capabilityId: FOOTAGE_MOTION_CAPABILITY_ID,
  motionId: 'motion_animation01',
  assetId: 'asset_animation01',
  sourceInterval: Object.freeze({ start: mediaTime(10 * S), duration: mediaTime(8 * S) }),
  transform: DEFAULT_VISUAL_PROPERTIES.transform,
  crop: DEFAULT_VISUAL_PROPERTIES.crop,
  tracks,
  extensions: emptyExtensions(),
})

const visual = (tracks: readonly VisualPropertyTrack[] = Object.freeze([])): SetVisualPropertiesOperation => Object.freeze({
  schemaVersion: 'sanverse.operation/v3',
  operationId: 'operation_animationvisual01',
  kind: VISUAL_PROPERTIES_OPERATION_KIND,
  capabilityId: VISUAL_PROPERTIES_PRIMITIVE_ID,
  visualId: 'title_animation01',
  transform: Object.freeze({ ...DEFAULT_VISUAL_PROPERTIES.transform, translateX: 0.25, opacity: 0.8 }),
  crop: Object.freeze({ ...DEFAULT_VISUAL_PROPERTIES.crop, left: 0.1 }),
  layer: 4,
  mask: Object.freeze({ shape: 'ellipse', feather: 0.15 }),
  tracks,
  transition: Object.freeze({
    enter: Object.freeze({ kind: 'fade', duration: mediaTime(S / 2), easing: ease }),
    exit: Object.freeze({ kind: 'zoom', duration: mediaTime(S / 2), easing: linear }),
  }),
  effects: Object.freeze([{ kind: 'blur' as const, amount: 0.02 }]),
  extensions: Object.freeze({ vendor: 'kept' }),
})

describe('editor animation capability matrix', () => {
  it('exposes eight truthful primary properties and refuses opacity', () => {
    const properties = animationCapabilitiesForTarget('primary-footage').map((entry) => entry.property)
    expect(properties).toEqual([
      'translate-x', 'translate-y', 'scale', 'rotation',
      'crop-top', 'crop-right', 'crop-bottom', 'crop-left',
    ])
    expect(properties).not.toContain('opacity')
    expect(animationCapabilitiesForTarget('freeze')).toEqual([])
    expect(animationCapabilitiesForTarget('dialogue')).toEqual([])
    expect(animationCapabilitiesForTarget('music')).toEqual([])
  })

  it.each(['caption', 'nameplate', 'title', 'callout', 'media-overlay'] as const)(
    'exposes the existing visual property union for %s',
    (kind) => {
      expect(animationCapabilitiesForTarget(kind).map((entry) => entry.property)).toHaveLength(9)
      expect(animationCapabilitiesForTarget(kind).find((entry) => entry.property === 'opacity')?.maximum).toBe(1)
    },
  )
})

describe('editor animation time projection', () => {
  it('maps primary source-relative ticks onto a normal placement and back', () => {
    const context = { kind: 'primary-footage-motion' as const, clip: clip(), motionSourceInterval: motion().sourceInterval }
    expect(projectAnimationKeyframeToCompositionTicks(context, 3 * S)).toBe(23 * S)
    expect(compositionTicksToAnimationKeyframeTicks(context, 23 * S)).toBe(3 * S)
  })

  it('uses the existing rational speed mapping without rewriting canonical source ticks', () => {
    const fast = clip({
      timeTransform: Object.freeze({ ...DEFAULT_CLIP_TIME_TRANSFORM, playbackRate: Object.freeze({ numerator: 2, denominator: 1 }) }),
    })
    const context = { kind: 'primary-footage-motion' as const, clip: fast, motionSourceInterval: motion().sourceInterval }
    expect(projectAnimationKeyframeToCompositionTicks(context, 4 * S)).toBe(22 * S)
    expect(compositionTicksToAnimationKeyframeTicks(context, 22 * S)).toBe(4 * S)
  })

  it('reverses the composition projection without reversing canonical source order', () => {
    const backwards = clip({
      timeTransform: Object.freeze({ ...DEFAULT_CLIP_TIME_TRANSFORM, direction: 'reverse' as const }),
    })
    const context = { kind: 'primary-footage-motion' as const, clip: backwards, motionSourceInterval: motion().sourceInterval }
    expect(projectAnimationKeyframeToCompositionTicks(context, 2 * S)).toBe(26 * S)
    expect(projectAnimationKeyframeToCompositionTicks(context, 6 * S)).toBe(22 * S)
    expect(compositionTicksToAnimationKeyframeTicks(context, 22 * S)).toBe(6 * S)
  })

  it('projects a slipped visible source window without moving the source animation', () => {
    const slipped = clip({
      sourceRange: Object.freeze({ start: mediaTime(12 * S), duration: mediaTime(4 * S) }),
    })
    const context = { kind: 'primary-footage-motion' as const, clip: slipped, motionSourceInterval: motion().sourceInterval }
    expect(animationVisibleRangeForPlacement(context)).toEqual({ startTicks: 2 * S, endTicks: 6 * S })
    expect(projectAnimationKeyframeToCompositionTicks(context, S)).toBeNull()
    expect(projectAnimationKeyframeToCompositionTicks(context, 4 * S)).toBe(22 * S)
  })

  it('uses visual-relative composition time for overlays', () => {
    const context = { kind: 'visual-properties' as const, compositionStartTicks: 7 * S, durationTicks: 5 * S }
    expect(projectAnimationKeyframeToCompositionTicks(context, 2 * S)).toBe(9 * S)
    expect(compositionTicksToAnimationKeyframeTicks(context, 9 * S)).toBe(2 * S)
    expect(projectAnimationKeyframeToCompositionTicks(context, 6 * S)).toBeNull()
  })

  it('returns only visible projected keyframes', () => {
    const context = {
      kind: 'primary-footage-motion' as const,
      clip: clip({ sourceRange: Object.freeze({ start: mediaTime(12 * S), duration: mediaTime(4 * S) }) }),
      motionSourceInterval: motion().sourceInterval,
    }
    const projected = animationKeyframesVisibleInPlacement(context, track('scale', [[S, 1], [3 * S, 1.2], [7 * S, 1.4]]))
    expect(projected.map((entry) => entry.keyframe.at.ticks)).toEqual([3 * S])
  })
})

describe('pure keyframe planners', () => {
  it('creates a valid equal-value anchor pair plus a middle playhead keyframe without a visible jump', () => {
    const state = editorAnimationStateFromFootageMotion(motion())
    const planned = planAddEditorKeyframe({ state, property: 'scale', canonicalAtTicks: 3 * S })
    expect(planned.ok).toBe(true)
    if (!planned.ok) return
    const frames = planned.state.tracks[0].keyframes
    expect(frames.map((frame) => frame.at.ticks)).toEqual([0, 3 * S, 8 * S])
    expect(frames.map((frame) => frame.value)).toEqual([1, 1, 1])
  })

  it('creates the valid two-anchor track when the first keyframe is added at start or end', () => {
    for (const at of [0, 8 * S]) {
      const planned = planAddEditorKeyframe({ state: editorAnimationStateFromFootageMotion(motion()), property: 'scale', canonicalAtTicks: at })
      expect(planned.ok).toBe(true)
      if (!planned.ok) continue
      expect(planned.state.tracks[0].keyframes.map((frame) => frame.at.ticks)).toEqual([0, 8 * S])
      expect(planned.selectedTicks).toEqual([at])
    }
  })

  it('refuses unsupported primary opacity and locked targets', () => {
    const state = editorAnimationStateFromFootageMotion(motion())
    expect(planAddEditorKeyframe({ state, property: 'opacity', canonicalAtTicks: S })).toMatchObject({ ok: false, refusal: { code: 'PROPERTY_NOT_ANIMATABLE' } })
    expect(planAddEditorKeyframe({ state: { ...state, locked: true }, property: 'scale', canonicalAtTicks: S })).toMatchObject({ ok: false, refusal: { code: 'TARGET_LOCKED' } })
  })

  it('refuses ordinary deletion that would leave one keyframe and removes animation only explicitly', () => {
    const state = editorAnimationStateFromFootageMotion(motion([track('scale', [[0, 1], [8 * S, 1.2]])]))
    expect(planDeleteEditorKeyframes({ state, property: 'scale', canonicalAtTicks: [0] })).toMatchObject({ ok: false, refusal: { code: 'MINIMUM_KEYFRAMES_REQUIRED' } })
    const removed = planRemoveAnimationTrack({ state, property: 'scale' })
    expect(removed.ok).toBe(true)
    if (removed.ok) expect(removed.state.tracks).toEqual([])
  })

  it('moves multiple keyframes atomically and preserves relative spacing', () => {
    const state = editorAnimationStateFromFootageMotion(motion([track('scale', [[0, 1], [2 * S, 1.2], [4 * S, 1.4], [8 * S, 1]])]))
    const planned = planMoveEditorKeyframes({ state, moves: [
      { property: 'scale', fromTicks: 2 * S, toTicks: 3 * S },
      { property: 'scale', fromTicks: 4 * S, toTicks: 5 * S },
    ] })
    expect(planned.ok).toBe(true)
    if (planned.ok) expect(planned.state.tracks[0].keyframes.map((frame) => frame.at.ticks)).toEqual([0, 3 * S, 5 * S, 8 * S])
  })

  it('refuses an entire multi-move when one destination collides', () => {
    const state = editorAnimationStateFromFootageMotion(motion([track('scale', [[0, 1], [2 * S, 1.2], [4 * S, 1.4], [8 * S, 1]])]))
    const planned = planMoveEditorKeyframes({ state, moves: [
      { property: 'scale', fromTicks: 2 * S, toTicks: 4 * S },
    ] })
    expect(planned).toMatchObject({ ok: false, refusal: { code: 'KEYFRAME_MOVE_COLLISION' } })
    expect(state.tracks[0].keyframes.map((frame) => frame.at.ticks)).toEqual([0, 2 * S, 4 * S, 8 * S])
  })

  it('changes values with property bounds and no partial update', () => {
    const state = editorAnimationStateFromFootageMotion(motion([track('scale', [[0, 1], [4 * S, 1.2], [8 * S, 1]])]))
    const bad = planSetEditorKeyframeValues({ state, updates: [
      { property: 'scale', canonicalAtTicks: 4 * S, value: 2 },
      { property: 'scale', canonicalAtTicks: 8 * S, value: 25 },
    ] })
    expect(bad).toMatchObject({ ok: false, refusal: { code: 'KEYFRAME_VALUE_OUT_OF_RANGE' } })
    expect(state.tracks[0].keyframes[1].value).toBe(1.2)
  })

  it('applies easing to the selected outgoing segment and refuses the last keyframe', () => {
    const state = editorAnimationStateFromFootageMotion(motion([track('scale', [[0, 1], [4 * S, 1.2], [8 * S, 1]])]))
    const good = planSetEditorKeyframeEasing({ state, property: 'scale', canonicalAtTicks: [4 * S], easing: ease })
    expect(good.ok).toBe(true)
    if (good.ok) expect(good.state.tracks[0].keyframes[1].easing).toEqual(ease)
    expect(planSetEditorKeyframeEasing({ state, property: 'scale', canonicalAtTicks: [8 * S], easing: ease })).toMatchObject({ ok: false, refusal: { code: 'EASING_NOT_SUPPORTED' } })
  })
})

describe('closed keyframe clipboard', () => {
  const state = editorAnimationStateFromFootageMotion(motion([track('scale', [[0, 1], [2 * S, 1.2], [4 * S, 1.4], [8 * S, 1]])]))

  it('copies only relative ticks, values and easing', () => {
    const clipboard = createEditorKeyframeClipboard({ track: state.tracks[0], canonicalAtTicks: [2 * S, 4 * S] })
    expect(clipboard).toEqual({
      schemaVersion: 'sanverse.editor-keyframe-clipboard/v1',
      sourceProperty: 'scale',
      keyframes: [
        { offsetTicks: 0, value: 1.2, easing: linear },
        { offsetTicks: 2 * S, value: 1.4, easing: linear },
      ],
    })
    expect(JSON.stringify(clipboard)).not.toMatch(/project|file|url|operation|motionId/i)
  })

  it('pastes at an exact anchor and replaces exact-time collisions deterministically', () => {
    const clipboard = createEditorKeyframeClipboard({ track: state.tracks[0], canonicalAtTicks: [2 * S, 4 * S] })!
    const planned = planPasteEditorKeyframes({ state, property: 'scale', clipboard, anchorTicks: 4 * S })
    expect(planned.ok).toBe(true)
    if (!planned.ok) return
    expect(planned.state.tracks[0].keyframes.map((frame) => [frame.at.ticks, frame.value])).toEqual([
      [0, 1], [2 * S, 1.2], [4 * S, 1.2], [6 * S, 1.4], [8 * S, 1],
    ])
  })

  it('refuses incompatible-property and out-of-range paste atomically', () => {
    const clipboard = createEditorKeyframeClipboard({ track: state.tracks[0], canonicalAtTicks: [2 * S, 4 * S] })!
    expect(planPasteEditorKeyframes({ state, property: 'translate-x', clipboard, anchorTicks: 0 })).toMatchObject({ ok: false, refusal: { code: 'PASTE_PROPERTY_INCOMPATIBLE' } })
    expect(planPasteEditorKeyframes({ state, property: 'scale', clipboard, anchorTicks: 7 * S })).toMatchObject({ ok: false, refusal: { code: 'PASTE_TIME_OUT_OF_RANGE' } })
  })
})

describe('full-state operation rebuilds', () => {
  it('changes only animation fields on footage motion', () => {
    const original = motion([track('scale', [[0, 1], [8 * S, 1.2]])])
    const changed = planSetEditorKeyframeValues({
      state: editorAnimationStateFromFootageMotion(original),
      updates: [{ property: 'scale', canonicalAtTicks: 8 * S, value: 1.5 }],
    })
    expect(changed.ok).toBe(true)
    if (!changed.ok) return
    const rebuilt = rebuildFootageMotionOperationWithAnimation({ operation: original, nextState: changed.state, operationId: 'operation_animationmotion02' })
    expect(rebuilt.operationId).toBe('operation_animationmotion02')
    expect(rebuilt.motionId).toBe(original.motionId)
    expect(rebuilt.assetId).toBe(original.assetId)
    expect(rebuilt.sourceInterval).toEqual(original.sourceInterval)
    expect(rebuilt.transform).toEqual(original.transform)
    expect(rebuilt.crop).toEqual(original.crop)
    expect(rebuilt.extensions).toEqual(original.extensions)
  })

  it('preserves layer, mask, transition, effects and untouched tracks on visual edits', () => {
    const original = visual([
      track('scale', [[0, 1], [4 * S, 1.2]]),
      track('opacity', [[0, 0.5], [4 * S, 1]]),
    ])
    const changed = planSetEditorKeyframeValues({
      state: editorAnimationStateFromVisualProperties('title', original, 4 * S),
      updates: [{ property: 'scale', canonicalAtTicks: 4 * S, value: 1.5 }],
    })
    expect(changed.ok).toBe(true)
    if (!changed.ok) return
    const rebuilt = rebuildVisualPropertiesOperationWithAnimation({ operation: original, nextState: changed.state, operationId: 'operation_animationvisual02' })
    expect(rebuilt.layer).toBe(original.layer)
    expect(rebuilt.mask).toEqual(original.mask)
    expect(rebuilt.transition).toEqual(original.transition)
    expect(rebuilt.effects).toEqual(original.effects)
    expect(rebuilt.transform.translateX).toBe(original.transform.translateX)
    expect(rebuilt.crop.left).toBe(original.crop.left)
    expect(rebuilt.tracks.find((candidate) => candidate.property === 'opacity')).toEqual(original.tracks[1])
    expect(rebuilt.extensions).toEqual(original.extensions)
  })
})
