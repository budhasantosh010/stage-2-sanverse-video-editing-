import { describe, expect, it } from 'vitest'
import { PROJECT_TIMESCALE, acceptChangeSet, type EditProject } from '@sanverse/edit-domain'
import { TRACK_OUTPUT_PRIMITIVE_ID } from '@sanverse/edit-domain/capabilities'
import { DEFAULT_CLIP_TIME_TRANSFORM } from '@sanverse/edit-domain/clip-time'
import { compileProjectToRenderPlan } from '@sanverse/render-contract/compile-project'
import { compilePreviewPlan } from './render-plan-preview.ts'
import { playbackSegments, sourceTimeFor } from './segment-playback.ts'
import {
  isIntendedBlack,
  nextPrimaryStartTicks,
  primaryGapMessage,
  resolvePrimarySource,
} from './primary-source.ts'
import { TEST_ASSET_ID, TEST_CLIP_ID, testAsset, testProject } from '../../test-fixtures.ts'

const seconds = (value: number): number => Math.round(value * PROJECT_TIMESCALE)

/**
 * A project holding one healthy 30-second recording plus a second clip whose
 * file is not in the asset list.
 *
 * This is not a contrived shape. It is what a project looks like the moment a
 * file fails to survive a round trip, and it is the shape the owner recorded.
 */
const projectWithOneUnresolvableClip = (): EditProject => {
  const base = testProject()
  const composition = base.composition
  const track = composition.tracks[0]
  return Object.freeze({
    ...base,
    composition: Object.freeze({
      ...composition,
      tracks: Object.freeze([
        Object.freeze({
          ...track,
          clips: Object.freeze([
            ...track.clips,
            Object.freeze({
              clipId: 'clip_bbbbbbbb',
              // A file that is NOT in project.assets.
              assetId: 'asset_bbbbbbbb',
              sourceRange: Object.freeze({
                start: Object.freeze({ ticks: 0, timescale: PROJECT_TIMESCALE }),
                duration: Object.freeze({ ticks: seconds(5), timescale: PROJECT_TIMESCALE }),
              }),
              compositionStart: Object.freeze({ ticks: seconds(30), timescale: PROJECT_TIMESCALE }),
              enabled: true,
              gainDb: 0,
              fadeIn: Object.freeze({ ticks: 0, timescale: PROJECT_TIMESCALE }),
              fadeOut: Object.freeze({ ticks: 0, timescale: PROJECT_TIMESCALE }),
              // Hand-built to sidestep the validator on purpose, so the two
              // fields the validator would have filled in are written out here.
              pan: 0,
              timeTransform: DEFAULT_CLIP_TIME_TRANSFORM,
            }),
          ]),
        }),
      ]),
    }),
  }) as EditProject
}

describe('the defect the owner recorded', () => {
  it('proves the old route reported EVERY moment as a gap because of one bad clip', () => {
    const project = projectWithOneUnresolvableClip()

    // The compiler refuses the WHOLE project for one unresolvable clip.
    const compiled = compileProjectToRenderPlan(project)
    expect(compiled.ok).toBe(false)

    // Which the preview turned into "there are no segments at all"...
    const plan = compilePreviewPlan(project)
    expect(plan).toBeNull()
    const segments = plan ? playbackSegments(plan) : []
    expect(segments).toHaveLength(0)

    // ...and therefore every single moment of thirty seconds of real, present,
    // enabled footage answered "this is a gap".
    for (const second of [0, 5, 10, 15, 20, 25, 29]) {
      expect(sourceTimeFor(segments, seconds(second))).toBeNull()
    }
  })

  it('resolves the same healthy footage correctly, one bad clip costing only its own interval', () => {
    const project = projectWithOneUnresolvableClip()

    for (const second of [0, 5, 10, 15, 20, 25, 29]) {
      const decision = resolvePrimarySource(project, seconds(second))
      expect(decision.kind).toBe('active')
      if (decision.kind !== 'active') throw new Error('unreachable')
      expect(decision.assetId).toBe(TEST_ASSET_ID)
      expect(decision.clipId).toBe(TEST_CLIP_ID)
      expect(decision.sourceTicks).toBe(seconds(second))
    }

    // The one genuinely broken clip is the ONLY interval that reports a problem,
    // and it reports the real one rather than pretending the user left a hole.
    const broken = resolvePrimarySource(project, seconds(32))
    expect(broken).toEqual({
      kind: 'gap',
      compositionTicks: seconds(32),
      reason: 'ASSET_MISSING',
    })
    expect(isIntendedBlack('ASSET_MISSING')).toBe(false)
  })
})

describe('resolvePrimarySource', () => {
  it('maps a moment to the exact tick of the original recording', () => {
    const project = testProject()
    const decision = resolvePrimarySource(project, seconds(12.5))
    expect(decision).toEqual({
      kind: 'active',
      clipId: TEST_CLIP_ID,
      assetId: TEST_ASSET_ID,
      compositionTicks: seconds(12.5),
      sourceTicks: seconds(12.5),
      localTicks: seconds(12.5),
    })
  })

  it('agrees with the compiler about where every clip is', () => {
    const project = testProject()
    const plan = compilePreviewPlan(project)
    if (!plan) throw new Error('a healthy project must compile')
    const segments = playbackSegments(plan)

    // Walked at a half-second step across the whole composition, the resolver
    // and the plan the EXPORTER reads must never disagree about which file and
    // which moment of it is on screen. This is the parity that stops the
    // preview and the finished video being two different videos.
    for (let tick = 0; tick < seconds(30); tick += seconds(0.5)) {
      const decision = resolvePrimarySource(project, tick)
      const target = sourceTimeFor(segments, tick)
      if (decision.kind === 'active') {
        expect(target).not.toBeNull()
        expect(target?.sourceTicks).toBe(decision.sourceTicks)
      } else {
        expect(target).toBeNull()
      }
    }
  })

  it('treats the interval as half-open, so the frame at a cut belongs to one side only', () => {
    const project = testProject()
    expect(resolvePrimarySource(project, seconds(30) - 1).kind).toBe('active')
    const atEnd = resolvePrimarySource(project, seconds(30))
    expect(atEnd).toEqual({
      kind: 'gap',
      compositionTicks: seconds(30),
      reason: 'NO_CLIP_AT_TICK',
    })
    expect(isIntendedBlack('NO_CLIP_AT_TICK')).toBe(true)
  })

  it('reports the whole track being off ahead of the clip being off', () => {
    const project = testProject()
    const off = acceptChangeSet(project, {
      schemaVersion: 'sanverse.change-set/v1',
      changeSetId: 'changeset_trackoutput1',
      baseRevision: project.revision,
      operations: [{
        schemaVersion: 'sanverse.operation/v3',
        operationId: 'operation_trackoff1',
        kind: 'set-track-output',
        capabilityId: TRACK_OUTPUT_PRIMITIVE_ID,
        trackId: 'V1',
        outputEnabled: false,
        extensions: {},
      }],
      provenance: { source: 'direct', requestId: null },
      extensions: {},
    } as never)
    if (!off.ok) throw new Error(`could not switch V1 off: ${JSON.stringify(off.error)}`)

    const decision = resolvePrimarySource(off.value, seconds(10))
    // Turning THIS CLIP back on would still show nothing, so naming the clip
    // would send the user to the wrong switch.
    expect(decision).toEqual({
      kind: 'gap',
      compositionTicks: seconds(10),
      reason: 'V1_OUTPUT_DISABLED',
    })
    expect(isIntendedBlack('V1_OUTPUT_DISABLED')).toBe(false)
  })

  it('refuses a negative or unusable tick without inventing a clip', () => {
    const project = testProject()
    expect(resolvePrimarySource(project, -1).kind).toBe('gap')
    expect(resolvePrimarySource(project, Number.NaN)).toEqual({
      kind: 'gap',
      compositionTicks: 0,
      reason: 'NO_CLIP_AT_TICK',
    })
  })

  it('cannot be told about selection, hover, or any pointer state', () => {
    // The argument list IS the proof: two parameters, a project and a number.
    // There is no third place a pointer could be smuggled in, which is why
    // selecting a clip structurally cannot change whether footage exists.
    expect(resolvePrimarySource).toHaveLength(2)
  })

  it('answers identically however many times it is asked, and never mutates', () => {
    const project = testProject()
    const first = resolvePrimarySource(project, seconds(3))
    const second = resolvePrimarySource(project, seconds(3))
    expect(first).toEqual(second)
    expect(Object.isFrozen(first)).toBe(true)
  })
})

describe('nextPrimaryStartTicks', () => {
  it('finds the next clip even when the project cannot compile at all', () => {
    const project = projectWithOneUnresolvableClip()
    expect(compilePreviewPlan(project)).toBeNull()
    expect(nextPrimaryStartTicks(project, seconds(30))).toBe(seconds(30))
    expect(nextPrimaryStartTicks(project, seconds(31))).toBeNull()
  })
})

describe('primaryGapMessage', () => {
  it('says something a person can act on, with no operation name or code in it', () => {
    for (const reason of ['NO_CLIP_AT_TICK', 'V1_OUTPUT_DISABLED', 'CLIP_DISABLED', 'ASSET_MISSING'] as const) {
      const message = primaryGapMessage(reason)
      expect(message.length).toBeGreaterThan(0)
      expect(message).not.toMatch(/[A-Z]{2,}_/)
      expect(message).not.toMatch(/V1|A1|C1|tick|assetId|clipId/)
    }
  })
})
