import { beforeEach, describe, expect, it } from 'vitest'
import type { EditorKeyframeAddressV1 } from '@sanverse/edit-domain'

import {
  DEFAULT_TIMELINE_ANIMATION_PRESENTATION,
  animationPresentationForTarget,
  animationTargetExpanded,
  clearEditorKeyframeSelection,
  extendEditorKeyframeSelection,
  readTimelineAnimationPresentation,
  reconcileEditorKeyframeSelection,
  selectAllEditorKeyframesInProperty,
  selectOnlyEditorKeyframe,
  toggleEditorKeyframeSelection,
  validateTimelineAnimationPresentation,
  writeTimelineAnimationPresentation,
  type TimelineAnimationSubjectV1,
} from './timeline-animation-presentation'
import { DEFAULT_VISUAL_PROPERTIES, mediaTime } from '@sanverse/edit-domain'

const target = Object.freeze({ kind: 'visual-properties' as const, visualId: 'title_animation01' })
const address = (ticks: number): EditorKeyframeAddressV1 => Object.freeze({ target, property: 'scale', canonicalAtTicks: ticks })

const subject = (): TimelineAnimationSubjectV1 => Object.freeze({
  itemId: 'title_animation01',
  laneId: 'overlay',
  label: 'Title',
  target,
  state: Object.freeze({
    targetKind: 'title',
    durationTicks: 100,
    transform: DEFAULT_VISUAL_PROPERTIES.transform,
    crop: DEFAULT_VISUAL_PROPERTIES.crop,
    tracks: Object.freeze([Object.freeze({
      property: 'scale' as const,
      keyframes: Object.freeze([
        Object.freeze({ at: mediaTime(0), value: 1, easing: Object.freeze({ kind: 'linear' as const }) }),
        Object.freeze({ at: mediaTime(50), value: 1.2, easing: Object.freeze({ kind: 'linear' as const }) }),
        Object.freeze({ at: mediaTime(100), value: 1, easing: Object.freeze({ kind: 'linear' as const }) }),
      ]),
    })]),
  }),
  timeContext: Object.freeze({ kind: 'visual-properties' as const, compositionStartTicks: 200, durationTicks: 100 }),
  sourceAnchored: false,
})

describe('one keyframe selection authority', () => {
  it('supports single, additive/toggle and clear without project data', () => {
    const one = selectOnlyEditorKeyframe(address(0))
    expect(one.addresses).toEqual([address(0)])
    const two = toggleEditorKeyframeSelection(one, address(50))
    expect(two.addresses.map((entry) => entry.canonicalAtTicks)).toEqual([0, 50])
    const back = toggleEditorKeyframeSelection(two, address(0))
    expect(back.addresses.map((entry) => entry.canonicalAtTicks)).toEqual([50])
    expect(clearEditorKeyframeSelection().addresses).toEqual([])
  })

  it('Shift-selects a compatible range and falls back to one item across incompatible lanes', () => {
    const one = selectOnlyEditorKeyframe(address(0))
    const range = extendEditorKeyframeSelection(one, address(100), [0, 50, 100])
    expect(range.addresses.map((entry) => entry.canonicalAtTicks)).toEqual([0, 50, 100])
    const incompatible = Object.freeze({ ...address(50), property: 'rotation' as const })
    expect(extendEditorKeyframeSelection(one, incompatible, [0, 50, 100]).addresses).toEqual([incompatible])
  })

  it('selects all in one property and reconciles stale timestamps against the subject', () => {
    const selection = selectAllEditorKeyframesInProperty(target, 'scale', [0, 25, 50, 100])
    const reconciled = reconcileEditorKeyframeSelection(selection, subject())
    expect(reconciled.addresses.map((entry) => entry.canonicalAtTicks)).toEqual([0, 50, 100])
    expect(reconcileEditorKeyframeSelection(selection, null).addresses).toEqual([])
  })
})

describe('animation presentation persistence', () => {
  beforeEach(() => localStorage.clear())

  it('expands/collapses a target without mutating another presentation field', () => {
    const expanded = animationPresentationForTarget(DEFAULT_TIMELINE_ANIMATION_PRESENTATION, target, true)
    expect(animationTargetExpanded(expanded, target)).toBe(true)
    expect(expanded.graphHeightPx).toBe(DEFAULT_TIMELINE_ANIMATION_PRESENTATION.graphHeightPx)
    expect(animationTargetExpanded(animationPresentationForTarget(expanded, target, false), target)).toBe(false)
  })

  it('round-trips a closed valid state and refuses extra, old, malformed and unsafe fields', () => {
    const value = Object.freeze({
      ...DEFAULT_TIMELINE_ANIMATION_PRESENTATION,
      expandedTargetKeys: Object.freeze(['visual:title_animation01']),
      visibleMode: 'all' as const,
      activeProperty: 'scale' as const,
      graphOpen: true,
      graphHeightPx: 280,
      graphViewport: Object.freeze({ panX: 12, panY: -4, zoomX: 2, zoomY: 1.5 }),
    })
    expect(validateTimelineAnimationPresentation(value)).toEqual(value)
    expect(validateTimelineAnimationPresentation({ ...value, schemaVersion: 'old' })).toBeNull()
    expect(validateTimelineAnimationPresentation({ ...value, surprise: true })).toBeNull()
    expect(validateTimelineAnimationPresentation({ ...value, graphHeightPx: Number.NaN })).toBeNull()
    expect(validateTimelineAnimationPresentation({ ...value, graphViewport: { ...value.graphViewport, zoomX: 100 } })).toBeNull()
  })

  it('persists outside project state and safely restores defaults after corrupt storage', () => {
    const value = Object.freeze({ ...DEFAULT_TIMELINE_ANIMATION_PRESENTATION, graphOpen: true, activeProperty: 'rotation' as const })
    writeTimelineAnimationPresentation('project_animation01', value)
    expect(readTimelineAnimationPresentation('project_animation01')).toEqual(value)
    localStorage.setItem('sanverse.timeline-animation-presentation:project_animation01', '{broken')
    expect(readTimelineAnimationPresentation('project_animation01')).toEqual(DEFAULT_TIMELINE_ANIMATION_PRESENTATION)
  })
})
