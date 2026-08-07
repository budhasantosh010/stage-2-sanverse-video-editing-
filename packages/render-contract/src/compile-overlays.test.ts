import { describe, expect, it } from 'vitest'

import { acceptChangeSet, type EditProject } from '@sanverse/edit-domain'
import { OVERLAY_REMOVE_PRIMITIVE_ID } from '@sanverse/edit-domain/capabilities'
import {
  changeSetOf,
  ms,
  testCallout,
  testCaptions,
  testMediaOverlay,
  testMultiAssetProject,
  testMusic,
  testOperation,
  testRemove,
  testSplit,
  testTransition,
  testTitle,
} from '@sanverse/edit-domain/test-fixtures'

import { compileProjectToRenderPlan } from './compile-project.ts'
import { validateRenderPlan, type RenderPlan } from './render-plan.ts'

const accept = (project: EditProject, id: string, operations: readonly unknown[]): EditProject => {
  const result = acceptChangeSet(project, changeSetOf(id, project.revision, operations as never))
  if (!result.ok) throw new Error(`accept failed: ${JSON.stringify(result.error)}`)
  return result.value
}

const compile = (project: EditProject): RenderPlan => {
  const compiled = compileProjectToRenderPlan(project)
  if (!compiled.ok) throw new Error(`compile failed: ${JSON.stringify(compiled.error)}`)
  return compiled.value
}

const kinds = (plan: RenderPlan) => plan.overlays.map((node) => node.kind)

describe('compiling the new families', () => {
  it('lists every file the renderer must open, footage first', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_broll001', [testMediaOverlay()])
    project = accept(project, 'changeset_music001', [testMusic()])

    const plan = compile(project)
    expect(plan.sources[0]).toEqual({ assetId: 'asset_aaaaaaaa', mediaKind: 'video' })
    expect(plan.sources.map((source) => source.assetId)).toEqual([
      'asset_aaaaaaaa',
      'asset_bbbbbbbb',
      'asset_dddddddd',
    ])
  })

  it('names no file it does not also list as a source', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_broll001', [testMediaOverlay()])
    project = accept(project, 'changeset_music001', [testMusic()])
    const plan = compile(project)

    const listed = new Set(plan.sources.map((source) => source.assetId))
    for (const segment of plan.segments) expect(listed.has(segment.assetId)).toBe(true)
    for (const node of plan.overlays) {
      if (node.kind === 'media-overlay') expect(listed.has(node.assetId)).toBe(true)
    }
    for (const node of plan.music) expect(listed.has(node.assetId)).toBe(true)
  })

  it('does not list a file the project holds but no edit uses', () => {
    // The picture is on the shelf and nothing puts it on screen, so the
    // renderer is never told to open it.
    const plan = compile(accept(testMultiAssetProject(), 'changeset_title001', [testTitle()]))
    expect(plan.sources).toHaveLength(1)
  })

  it('turns each family into its own node kind', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_title001', [testTitle()])
    project = accept(project, 'changeset_call0001', [testCallout()])
    project = accept(project, 'changeset_broll001', [testMediaOverlay()])
    project = accept(project, 'changeset_music001', [testMusic()])

    const plan = compile(project)
    expect(kinds(plan).sort()).toEqual(['callout-overlay', 'media-overlay', 'title-overlay'])
    expect(plan.music).toHaveLength(1)
    expect(validateRenderPlan(plan).ok).toBe(true)
  })

  it('keeps music out of the drawn list, because music is not drawn', () => {
    const plan = compile(accept(testMultiAssetProject(), 'changeset_music001', [testMusic()]))
    expect(plan.overlays).toHaveLength(0)
    expect(plan.music[0].kind).toBe('music')
  })
})

describe('drawing order', () => {
  it('puts B-roll underneath the words that start at the same moment', () => {
    // A clip dropped over a caption must not hide it.
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_broll001', [
      testMediaOverlay({ sourceInterval: { start: ms(1_000), duration: ms(1_000) } }),
    ])
    project = accept(project, 'changeset_caption1', [testCaptions()])

    const plan = compile(project)
    const atOneSecond = plan.overlays.filter((node) => node.interval.start.ticks === ms(1_000).ticks)
    expect(atOneSecond[0].kind).toBe('media-overlay')
    expect(atOneSecond.some((node) => node.kind === 'caption-overlay')).toBe(true)
  })
})

describe('render-plan v6 visual properties', () => {
  it('binds one transform and motion contract to every concrete node made from its visual', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_title001', [testTitle({ titleId: 'title_visual01' })])
    project = accept(project, 'changeset_visual01', [{
      schemaVersion: 'sanverse.operation/v3',
      operationId: 'operation_visual01',
      kind: 'set-visual-properties',
      capabilityId: 'sanverse.visual.properties.primitive/v1',
      visualId: 'title_visual01',
      transform: { translateX: 0.1, translateY: 0, scale: 1.2, rotationDegrees: 8, opacity: 0.9 },
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      layer: 3,
      mask: { shape: 'none', feather: 0 },
      tracks: [{
        property: 'scale',
        keyframes: [
          { at: ms(0), value: 0.8, easing: { kind: 'spring', mass: 1, stiffness: 180, damping: 12, velocity: 0 } },
          { at: ms(500), value: 1.2, easing: { kind: 'linear' } },
        ],
      }],
      transition: {
        enter: { kind: 'fade', duration: ms(250), easing: { kind: 'linear' } },
        exit: { kind: 'none', duration: ms(0), easing: { kind: 'linear' } },
      },
      effects: [{ kind: 'saturation', amount: 0.8 }],
      extensions: {},
    }])

    const plan = compile(project)
    expect(plan.schemaVersion).toBe('sanverse.render-plan/v8')
    expect(plan.visuals).toHaveLength(1)
    expect(plan.visuals[0]).toMatchObject({
      visualId: 'title_visual01',
      nodeIds: ['title_visual01'],
      transform: { translateX: 0.1, scale: 1.2, rotationDegrees: 8, opacity: 0.9 },
      layer: 3,
      tracks: [{ property: 'scale' }],
      transition: { enter: { kind: 'fade' } },
      effects: [{ kind: 'saturation', amount: 0.8 }],
    })
    expect(validateRenderPlan(plan).ok).toBe(true)
  })
})

describe('what a cut does to each family', () => {
  it('compiles an adjacent dip-to-black as one closed transition edge', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_split001', [testSplit({ atClipTime: ms(10_000) })])
    project = accept(project, 'changeset_trans001', [testTransition()])
    const plan = compile(project)
    expect(plan.transitions).toEqual([
      expect.objectContaining({
        kind: 'transition-edge',
        fromSegmentId: plan.segments[0].nodeId,
        toSegmentId: plan.segments[1].nodeId,
        style: 'dip-to-black',
        durationTicks: ms(500).ticks,
        audio: 'fade-through-silence',
      }),
    ])
  })

  it('moves a title with the footage it was pinned to', () => {
    let project = testMultiAssetProject()
    // A title over source seconds 10-13.
    project = accept(project, 'changeset_title001', [
      testTitle({ sourceInterval: { start: ms(10_000), duration: ms(3_000) } }),
    ])
    const before = compile(project)
    expect(before.overlays[0].interval.start.ticks).toBe(ms(10_000).ticks)

    // Cut at 4 s and delete the opening.
    project = accept(project, 'changeset_split001', [testSplit({ atClipTime: ms(4_000) })])
    project = accept(project, 'changeset_remove01', [testRemove()])

    const after = compile(project)
    // 10 s of footage, minus the 4 s removed, is 6 s of finished video.
    expect(after.overlays[0].interval.start.ticks).toBe(ms(6_000).ticks)
  })

  it('resumes a B-roll clip where the cut interrupted it, instead of restarting it', () => {
    let project = testMultiAssetProject()
    // B-roll over source seconds 8-12, starting 1 s into the B-roll clip.
    project = accept(project, 'changeset_broll001', [testMediaOverlay()])
    // Cut at 10 s: the B-roll is split across the two halves.
    project = accept(project, 'changeset_split001', [testSplit({ atClipTime: ms(10_000) })])

    const plan = compile(project)
    const media = plan.overlays.filter((node) => node.kind === 'media-overlay')
    expect(media).toHaveLength(2)
    if (media[0].kind !== 'media-overlay' || media[1].kind !== 'media-overlay') return
    // First half starts 1 s into the B-roll, as asked.
    expect(media[0].sourceStartTicks).toBe(ms(1_000).ticks)
    // Second half picks up 2 s later, because 2 s of it played before the cut.
    expect(media[1].sourceStartTicks).toBe(ms(3_000).ticks)
  })

  it('always starts a still picture at zero, because a picture has nowhere to seek to', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_broll001', [
      testMediaOverlay({ overlayAssetId: 'asset_cccccccc', overlaySourceStart: ms(0) }),
    ])
    project = accept(project, 'changeset_split001', [testSplit({ atClipTime: ms(10_000) })])

    const plan = compile(project)
    for (const node of plan.overlays) {
      if (node.kind === 'media-overlay') expect(node.sourceStartTicks).toBe(0)
    }
  })

  it('keeps music playing straight through a cut, at the finished video length', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_music001', [testMusic()])
    project = accept(project, 'changeset_split001', [testSplit({ atClipTime: ms(10_000) })])
    project = accept(project, 'changeset_remove01', [testRemove()])

    const plan = compile(project)
    // 30 s of footage minus the 10 s removed is 20 s of finished video, and the
    // music covers all of it — no gap where the cut was.
    expect(plan.durationTicks).toBe(ms(20_000).ticks)
    expect(plan.music[0].interval.start.ticks).toBe(0)
    expect(plan.music[0].interval.duration.ticks).toBe(ms(20_000).ticks)
  })

  it('stops the music when the song runs out, rather than looping it', () => {
    // A loop point nobody chose is audible. The bed simply ends.
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_music001', [
      // The song is 120 s; starting 118 s in leaves 2 s of music for a 30 s video.
      testMusic({ sourceStart: ms(118_000) }),
    ])
    const plan = compile(project)
    expect(plan.durationTicks).toBe(ms(30_000).ticks)
    expect(plan.music[0].interval.duration.ticks).toBe(ms(2_000).ticks)
  })

  it('shortens the fades rather than letting them overrun a short piece of music', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_music001', [
      testMusic({ sourceStart: ms(119_500), fadeIn: ms(1_000), fadeOut: ms(2_000) }),
    ])
    const plan = compile(project)
    const node = plan.music[0]
    expect(node.interval.duration.ticks).toBe(ms(500).ticks)
    expect(node.fadeInTicks + node.fadeOutTicks).toBeLessThanOrEqual(node.interval.duration.ticks)
    expect(validateRenderPlan(plan).ok).toBe(true)
  })
})

describe('everything at once', () => {
  // G5C-06 — a cut, captions, a nameplate, a title, a callout, B-roll, and
  // music in one project, compiled to one plan a renderer can execute.
  it('compiles a project using every family together', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_split001', [testSplit({ atClipTime: ms(4_000) })])
    project = accept(project, 'changeset_remove01', [testRemove()])
    project = accept(project, 'changeset_caption1', [
      testCaptions({
        cues: [
          { cueId: 'cue_0001', sourceInterval: { start: ms(5_000), duration: ms(2_000) }, lines: ['first line'] },
          { cueId: 'cue_0002', sourceInterval: { start: ms(8_000), duration: ms(2_000) }, lines: ['second line'] },
        ],
      }),
    ])
    project = accept(project, 'changeset_aaaaaaaa', [
      testOperation({ sourceInterval: { start: ms(5_000), duration: ms(3_000) } }),
    ])
    project = accept(project, 'changeset_title001', [
      testTitle({ sourceInterval: { start: ms(4_000), duration: ms(3_000) } }),
    ])
    project = accept(project, 'changeset_call0001', [
      testCallout({ sourceInterval: { start: ms(12_000), duration: ms(3_000) } }),
    ])
    project = accept(project, 'changeset_broll001', [testMediaOverlay()])
    project = accept(project, 'changeset_music001', [testMusic()])

    const plan = compile(project)

    expect(plan.durationTicks).toBe(ms(26_000).ticks)
    expect(new Set(kinds(plan))).toEqual(new Set([
      'caption-overlay',
      'text-overlay',
      'title-overlay',
      'callout-overlay',
      'media-overlay',
    ]))
    expect(plan.music).toHaveLength(1)
    expect(plan.sources.map((source) => source.assetId)).toEqual([
      'asset_aaaaaaaa',
      'asset_bbbbbbbb',
      'asset_dddddddd',
    ])

    // Nothing may claim a moment outside the finished video, and the plan that
    // reaches a renderer is the same one this compiler produced.
    for (const node of [...plan.overlays, ...plan.music]) {
      expect(node.interval.start.ticks).toBeGreaterThanOrEqual(0)
      expect(node.interval.start.ticks + node.interval.duration.ticks).toBeLessThanOrEqual(plan.durationTicks)
    }
    expect(validateRenderPlan(plan).ok).toBe(true)
  })
})

/**
 * The owner recorded the monitor saying "No media at this time" over footage
 * that was plainly on screen. The trigger was here.
 *
 * The preview asks THIS compiler whether footage exists at a moment. A compile
 * that refuses returns no plan, the preview reads that as "there are no
 * segments anywhere", and every second of a healthy project reports a gap.
 *
 * So a refusal in this function is never local: it erases the user's entire
 * video from the preview and blocks Export at the same time. It has to be
 * reserved for projects that genuinely cannot be rendered.
 */
describe('an adjustment left pointing at nothing', () => {
  const adjustment = (visualId: string, operationId = 'operation_dangling1') => ({
    schemaVersion: 'sanverse.operation/v3',
    operationId,
    kind: 'set-visual-properties',
    capabilityId: 'sanverse.visual.properties.primitive/v1',
    visualId,
    transform: { translateX: 0, translateY: 0, scale: 1.2, rotationDegrees: 0, opacity: 1 },
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    layer: 3,
    mask: { shape: 'none', feather: 0 },
    tracks: [],
    transition: {
      enter: { kind: 'none', duration: ms(0), easing: { kind: 'linear' } },
      exit: { kind: 'none', duration: ms(0), easing: { kind: 'linear' } },
    },
    effects: [],
    extensions: {},
  })

  const removeOverlay = (overlayId: string, operationId = 'operation_removeov1') => ({
    schemaVersion: 'sanverse.operation/v3',
    operationId,
    kind: 'remove-overlay',
    capabilityId: OVERLAY_REMOVE_PRIMITIVE_ID,
    overlayId,
    extensions: {},
  })

  it('draws nothing, rather than erasing the whole video', () => {
    let project = testMultiAssetProject()
    // The owner's exact sequence: add a title, move or scale it, then DELETE it.
    // The adjustment was perfectly valid when it was accepted, and the domain
    // still considers the id known, so nothing blocks it. It simply now names
    // something that is no longer drawn.
    project = accept(project, 'changeset_title001', [testTitle({ titleId: 'title_deleted01' })])
    project = accept(project, 'changeset_dangling1', [adjustment('title_deleted01')])
    project = accept(project, 'changeset_removeov1', [removeOverlay('title_deleted01')])

    const compiled = compileProjectToRenderPlan(project)
    expect(compiled.ok).toBe(true)

    const plan = compile(project)
    // The footage is all still there. This is the assertion that matters: one
    // stale adjustment must not cost the user a single second of their video.
    expect(plan.segments.length).toBeGreaterThan(0)
    expect(plan.durationTicks).toBeGreaterThan(0)
    // And the adjustment itself contributes nothing, because it adjusts nothing.
    expect(plan.visuals.map((visual) => visual.visualId)).not.toContain('title_deleted01')
    expect(validateRenderPlan(plan).ok).toBe(true)
  })

  it('still binds every adjustment that DOES name something on screen', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_title002', [
      testTitle({ titleId: 'title_present01', operationId: 'operation_title002' }),
    ])
    project = accept(project, 'changeset_dangling2', [
      adjustment('title_present01', 'operation_present01'),
    ])
    project = accept(project, 'changeset_title003', [
      testTitle({ titleId: 'title_deleted02', operationId: 'operation_title003' }),
    ])
    project = accept(project, 'changeset_dangling3', [
      adjustment('title_deleted02', 'operation_deleted02'),
    ])
    project = accept(project, 'changeset_removeov2', [
      removeOverlay('title_deleted02', 'operation_removeov2'),
    ])

    const plan = compile(project)
    // The live one survives, the dead one is dropped. Dropping BOTH would be a
    // different bug wearing the same green test.
    expect(plan.visuals.map((visual) => visual.visualId)).toEqual(['title_present01'])
  })
})
