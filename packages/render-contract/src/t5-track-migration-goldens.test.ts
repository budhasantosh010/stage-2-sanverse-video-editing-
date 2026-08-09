import { describe, expect, it } from 'vitest'
import {
  acceptChangeSet,
  activeTimelineTrackState,
  addAsset,
  effectiveComposition,
  serializeProject,
  type EditProject,
} from '@sanverse/edit-domain'
import {
  changeSetOf,
  ms,
  testBrollAsset,
  testCaptions,
  testFootageMotion,
  testImageAsset,
  testInsertFreeze,
  testMediaOverlay,
  testMultiAssetProject,
  testMusic,
  testProject,
  testSetLinkedAudio,
  testSetTimeTransform,
  testSplit,
  testTransition,
  TEST_ASSET_ID,
} from '@sanverse/edit-domain/test-fixtures'
import { VISUAL_PROPERTIES_PRIMITIVE_ID } from '@sanverse/edit-domain/capabilities'
import { compileProjectToRenderPlan } from './compile-project.ts'

const accept = (project: EditProject, id: string, operations: readonly unknown[]): EditProject => {
  const result = acceptChangeSet(project, changeSetOf(id, project.revision, operations as never))
  if (!result.ok) throw new Error(`accept failed: ${JSON.stringify(result.error)}`)
  return result.value
}

const compile = (project: EditProject) => {
  const result = compileProjectToRenderPlan(project)
  if (!result.ok) throw new Error(`compile failed: ${JSON.stringify(result.error)}`)
  return result.value
}

const animatedOverlayOperation = () => ({
  schemaVersion: 'sanverse.operation/v3' as const,
  operationId: 'operation_t5visual1',
  kind: 'set-visual-properties' as const,
  capabilityId: VISUAL_PROPERTIES_PRIMITIVE_ID,
  visualId: 'broll_0001',
  transform: { translateX: 0, translateY: 0, scale: 1, rotationDegrees: 0, opacity: 1 },
  crop: { top: 0, right: 0, bottom: 0, left: 0 },
  layer: 1,
  mask: { shape: 'none' as const, feather: 0 },
  tracks: [{
    property: 'translate-x' as const,
    keyframes: [
      { at: ms(0), value: 0, easing: { kind: 'linear' as const } },
      { at: ms(2_000), value: 0.2, easing: { kind: 'cubic-bezier' as const, x1: 0.42, y1: 0, x2: 0.58, y2: 1 } },
    ],
  }],
  transition: {
    enter: { kind: 'none' as const, duration: ms(0), easing: { kind: 'linear' as const } },
    exit: { kind: 'none' as const, duration: ms(0), easing: { kind: 'linear' as const } },
  },
  effects: [],
  extensions: {},
})

const projectCases = (): ReadonlyArray<readonly [string, EditProject]> => {
  const single = testProject()

  let multiPrimary = testProject()
  multiPrimary = accept(multiPrimary, 'changeset_t5gold01', [testSplit()])

  let broll = testMultiAssetProject()
  broll = accept(broll, 'changeset_t5gold02', [testMediaOverlay()])

  let image = testMultiAssetProject()
  image = accept(image, 'changeset_t5gold03', [testMediaOverlay({
    operationId: 'operation_t5image01',
    overlayId: 'broll_image001',
    overlayAssetId: 'asset_cccccccc',
    overlaySourceStart: ms(0),
  })])

  let captions = testProject()
  captions = accept(captions, 'changeset_t5gold04', [testCaptions()])

  let jl = testProject()
  jl = accept(jl, 'changeset_t5gold05', [testSetLinkedAudio({ sourceRange: { start: ms(500), duration: ms(28_000) }, compositionOffsetTicks: ms(250).ticks })])

  let music = testMultiAssetProject()
  music = accept(music, 'changeset_t5gold06', [testMusic()])

  let speed = testProject()
  speed = accept(speed, 'changeset_t5gold07', [testSetTimeTransform({ playbackRate: { numerator: 2, denominator: 1 }, direction: 'forward' })])

  let reverse = testProject()
  reverse = accept(reverse, 'changeset_t5gold08', [testSetTimeTransform({ operationId: 'operation_t5reverse', playbackRate: { numerator: 1, denominator: 1 }, direction: 'reverse' })])

  let freeze = testProject()
  freeze = accept(freeze, 'changeset_t5gold09', [testInsertFreeze()])

  let transition = testProject()
  transition = accept(transition, 'changeset_t5gold10a', [testSplit()])
  transition = accept(transition, 'changeset_t5gold10b', [testTransition()])

  let animatedFootage = testProject()
  animatedFootage = accept(animatedFootage, 'changeset_t5gold11', [testFootageMotion({
    tracks: [{
      property: 'translate-x',
      keyframes: [
        { at: ms(0), value: 0, easing: { kind: 'linear' } },
        { at: ms(2_000), value: 0.15, easing: { kind: 'cubic-bezier', x1: 0, y1: 0, x2: 0.58, y2: 1 } },
      ],
    }],
  })])

  let animatedOverlay = testMultiAssetProject()
  animatedOverlay = accept(animatedOverlay, 'changeset_t5gold12a', [testMediaOverlay()])
  animatedOverlay = accept(animatedOverlay, 'changeset_t5gold12b', [animatedOverlayOperation()])

  let groups = testMultiAssetProject()
  groups = accept(groups, 'changeset_t5gold13a', [testMediaOverlay()])
  groups = accept(groups, 'changeset_t5gold13b', [{
    schemaVersion: 'sanverse.operation/v3',
    operationId: 'operation_t5groups1',
    kind: 'set-timeline-groups',
    capabilityId: 'sanverse.timeline.groups.primitive/v1',
    groups: [{ groupId: 'group_t5gold01', memberItemIds: ['clip:clip_aaaaaaaa', 'overlay:broll_0001:0'] }],
    extensions: {},
  }])

  let markers = testProject()
  markers = accept(markers, 'changeset_t5gold14', [{
    schemaVersion: 'sanverse.operation/v3',
    operationId: 'operation_t5marker1',
    kind: 'set-timeline-markers',
    capabilityId: 'sanverse.timeline.markers.primitive/v1',
    markers: [{ markerId: 'marker_t5gold01', startTicks: ms(2_000).ticks, durationTicks: 0, label: 'Beat', note: '', color: 'neutral' }],
    extensions: {},
  }])

  let mixedAspect = testMultiAssetProject()
  const portrait = testBrollAsset({
    assetId: 'asset_portrait1',
    storageRef: 'project/project_aaaaaaaaaaaaaaaa/portrait',
    sha256: 'e'.repeat(64),
    width: 714,
    height: 1280,
  })
  const withPortrait = addAsset(mixedAspect, portrait)
  if (!withPortrait.ok) throw new Error(JSON.stringify(withPortrait.error))
  mixedAspect = withPortrait.value
  mixedAspect = accept(mixedAspect, 'changeset_t5gold15', [testMediaOverlay({
    operationId: 'operation_t5portrait',
    overlayId: 'broll_portrait1',
    overlayAssetId: portrait.assetId,
    sourceInterval: { start: ms(12_000), duration: ms(4_000) },
  })])

  return [
    ['single primary', single],
    ['multi-asset primary sequence', multiPrimary],
    ['V2 B-roll', broll],
    ['image overlay', image],
    ['captions', captions],
    ['dialogue J/L', jl],
    ['A2 music', music],
    ['speed', speed],
    ['reverse', reverse],
    ['freeze', freeze],
    ['transition', transition],
    ['T4 animated footage', animatedFootage],
    ['T4 animated overlay', animatedOverlay],
    ['groups', groups],
    ['markers', markers],
    ['mixed portrait/landscape', mixedAspect],
  ]
}

describe('T5 deterministic migration goldens', () => {
  for (const [name, project] of projectCases()) {
    it(`${name}: projecting stable tracks is pure and leaves compilation byte-structurally identical`, () => {
      const revisionBeforeProjection = project.revision
      const beforeJson = serializeProject(project)
      expect(beforeJson.ok).toBe(true)
      const beforeComposition = effectiveComposition(project)
      const beforePlan = compile(project)
      const firstProjection = activeTimelineTrackState(project)
      const secondProjection = activeTimelineTrackState(project)
      const afterPlan = compile(project)
      const afterJson = serializeProject(project)

      expect(firstProjection).toEqual(secondProjection)
      expect(effectiveComposition(project)).toEqual(beforeComposition)
      expect(afterPlan).toEqual(beforePlan)
      expect(afterJson).toEqual(beforeJson)
      expect(project.revision).toBe(revisionBeforeProjection)
      expect(firstProjection.tracks.filter((track) => track.role === 'primary-video')).toHaveLength(1)
      expect(firstProjection.tracks.filter((track) => track.role === 'dialogue')).toHaveLength(1)
      expect(firstProjection.tracks[0].trackId).toBe(project.composition.tracks.find((track) => track.kind === 'video')?.trackId)
    })
  }

  it('keeps source identity untouched in the mixed-aspect migration case', () => {
    const mixed = projectCases().find(([name]) => name === 'mixed portrait/landscape')?.[1]
    expect(mixed).toBeDefined()
    if (!mixed) return
    expect(mixed.assets.some((asset) => asset.assetId === TEST_ASSET_ID && asset.width === 1920 && asset.height === 1080)).toBe(true)
    expect(mixed.assets.some((asset) => asset.assetId === 'asset_portrait1' && asset.width === 714 && asset.height === 1280)).toBe(true)
  })
})
