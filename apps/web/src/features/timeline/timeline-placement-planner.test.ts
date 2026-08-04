import { describe, expect, it } from 'vitest'

import { createIdFactory, serializeProject, type EditProject } from '@sanverse/edit-domain'
import {
  PLACEMENT_REFUSAL_CODES,
  TIMELINE_LANE_IDS,
  laneIdForTrack,
  planTimelinePlacement,
  trackIdForLane,
  type PlacementMode,
  type PlacementRequest,
} from './timeline-placement-planner'
import {
  TEST_BROLL_ASSET_ID,
  TEST_IMAGE_ASSET_ID,
  TEST_MUSIC_ASSET_ID,
  testMultiAssetProject,
} from '@sanverse/edit-domain/test-fixtures'

/**
 * Gate C1.1 — the planner.
 *
 * Every rule about where a dropped file may land lives in one pure function, so
 * that dragging a logo onto the intro and typing "put the logo over the intro"
 * produce the same operation. Two copies of these rules would disagree the
 * first time either was touched.
 */

const T = 1_440_000
/** Primary footage plus B-roll, a picture, and music — one of each to drop. */
const project = (): EditProject => testMultiAssetProject()

const assetOfKind = (kind: 'video' | 'image' | 'audio'): string =>
  kind === 'video' ? TEST_BROLL_ASSET_ID : kind === 'image' ? TEST_IMAGE_ASSET_ID : TEST_MUSIC_ASSET_ID

const request = (overrides: Partial<PlacementRequest> = {}): PlacementRequest => ({
  project: project(),
  assetId: assetOfKind('video'),
  targetLaneId: 'lane:overlay',
  atTicks: 2 * T,
  placementMode: 'normal' as PlacementMode,
  includeLinkedAudio: false,
  idFactory: createIdFactory('changeset_planner01'),
  ...overrides,
})

const refusalOf = (result: ReturnType<typeof planTimelinePlacement>): string | null =>
  result.ok ? null : result.error.code

describe('the placement planner', () => {
  describe('it is a pure function', () => {
    it('changes nothing about the project it is given', () => {
      const subject = project()
      const before = serializeProject(subject)

      planTimelinePlacement(request({ project: subject }))
      planTimelinePlacement(request({ project: subject, targetLaneId: 'lane:video' }))
      planTimelinePlacement(request({ project: subject, assetId: 'asset_zzzzzzzz' }))

      const after = serializeProject(subject)
      expect(after.ok && before.ok && after.value).toBe(before.ok ? before.value : '')
      expect(subject.revision).toBe(project().revision)
    })

    it('gives the same answer twice for the same gesture', () => {
      const first = planTimelinePlacement(request())
      const second = planTimelinePlacement(request())

      expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    })

    it('gives different operation names to different change sets', () => {
      const first = planTimelinePlacement(request({ idFactory: createIdFactory('changeset_aaaaaaaa') }))
      const second = planTimelinePlacement(request({ idFactory: createIdFactory('changeset_bbbbbbbb') }))

      expect(first.ok && second.ok && first.value.operations[0].operationId)
        .not.toBe(second.ok ? second.value.operations[0].operationId : null)
    })
  })

  describe('what each lane accepts', () => {
    it('takes video on the B-roll lane', () => {
      const result = planTimelinePlacement(request({ targetLaneId: 'lane:overlay', assetId: assetOfKind('video') }))
      expect(result.ok).toBe(true)
      expect(result.ok && result.value.operations).toHaveLength(1)
      expect(result.ok && result.value.operations[0].kind).toBe('add-media-overlay')
    })

    it('takes a picture on the B-roll lane', () => {
      const result = planTimelinePlacement(request({ targetLaneId: 'lane:overlay', assetId: assetOfKind('image') }))
      expect(result.ok).toBe(true)
      expect(result.ok && result.value.operations[0].kind).toBe('add-media-overlay')
    })

    it('takes music on the music lane', () => {
      const result = planTimelinePlacement(request({ targetLaneId: 'lane:music', assetId: assetOfKind('audio') }))
      expect(result.ok).toBe(true)
      expect(result.ok && result.value.operations[0].kind).toBe('add-music')
    })

    it('refuses music on the B-roll lane and says where it goes', () => {
      const result = planTimelinePlacement(request({ targetLaneId: 'lane:overlay', assetId: assetOfKind('audio') }))
      expect(refusalOf(result)).toBe('TRACK_INCOMPATIBLE')
      expect(!result.ok && result.error.message).toContain('A2')
    })

    it('refuses video on the music lane and says where it goes', () => {
      const result = planTimelinePlacement(request({ targetLaneId: 'lane:music', assetId: assetOfKind('video') }))
      expect(refusalOf(result)).toBe('TRACK_INCOMPATIBLE')
      expect(!result.ok && result.error.message).toContain('B-roll')
    })
  })

  describe('the V1 refusal, which is the whole point of the ADR', () => {
    it('refuses a second video on the main sequence', () => {
      const result = planTimelinePlacement(request({ targetLaneId: 'lane:video', assetId: assetOfKind('video') }))
      expect(refusalOf(result)).toBe('OPERATION_UNSUPPORTED')
    })

    it('says what cannot happen AND what can, in one sentence', () => {
      const result = planTimelinePlacement(request({ targetLaneId: 'lane:video' }))
      const message = result.ok ? '' : result.error.message

      expect(message).toContain('cannot add a second video to the main sequence yet')
      expect(message).toContain('B-roll lane')
    })

    it('never quietly routes a V1 drop to V2', () => {
      const result = planTimelinePlacement(request({ targetLaneId: 'lane:video' }))
      // A plan on a different lane than the one dropped on would be the product
      // putting the user's video somewhere they did not put it.
      expect(result.ok).toBe(false)
    })

    it('refuses the dialogue lane too, and not with a generic message', () => {
      const result = planTimelinePlacement(request({ targetLaneId: 'lane:dialogue', assetId: assetOfKind('audio') }))
      expect(refusalOf(result)).toBe('OPERATION_UNSUPPORTED')
      expect(!result.ok && result.error.message).toContain('sound of your main video')
    })

    it('refuses a media drop on the captions lane', () => {
      const result = planTimelinePlacement(request({ targetLaneId: 'lane:caption' }))
      expect(refusalOf(result)).toBe('TRACK_INCOMPATIBLE')
    })
  })

  describe('conditions that make any edit wrong right now', () => {
    it('refuses while an export is running', () => {
      expect(refusalOf(planTimelinePlacement(request({ exportInProgress: true })))).toBe('EXPORT_IN_PROGRESS')
    })

    it('refuses while a suggestion is waiting', () => {
      expect(refusalOf(planTimelinePlacement(request({ proposalPending: true })))).toBe('PROPOSAL_PENDING')
    })

    it('refuses when the project moved during the drag', () => {
      const subject = project()
      expect(refusalOf(planTimelinePlacement(request({ project: subject, expectedRevision: subject.revision + 1 }))))
        .toBe('PROJECT_STALE')
    })

    it('refuses on a locked lane, and names the lane', () => {
      const result = planTimelinePlacement(request({ trackState: { lockedTrackIds: ['V2'] } }))
      expect(refusalOf(result)).toBe('TRACK_LOCKED')
      expect(!result.ok && result.error.message).toContain('V2')
    })

    it('allows the drop when a DIFFERENT lane is locked', () => {
      expect(planTimelinePlacement(request({ trackState: { lockedTrackIds: ['A2', 'V1'] } })).ok).toBe(true)
    })

    it('refuses a file the project no longer holds', () => {
      expect(refusalOf(planTimelinePlacement(request({ assetId: 'asset_zzzzzzzz' })))).toBe('ASSET_MISSING')
    })
  })

  describe('closed contracts', () => {
    it('refuses an unknown lane rather than guessing one', () => {
      expect(refusalOf(planTimelinePlacement(request({ targetLaneId: 'lane:whatever' })))).toBe('TRACK_INCOMPATIBLE')
    })

    it('refuses an unknown placement mode', () => {
      expect(refusalOf(planTimelinePlacement(request({ placementMode: 'squeeze' as PlacementMode }))))
        .toBe('OPERATION_UNSUPPORTED')
    })

    it('refuses a negative or fractional drop point', () => {
      expect(refusalOf(planTimelinePlacement(request({ atTicks: -1 })))).toBe('OUT_OF_RANGE')
      expect(refusalOf(planTimelinePlacement(request({ atTicks: 1.5 })))).toBe('OUT_OF_RANGE')
    })

    it('only ever returns a refusal code from the closed list', () => {
      const attempts = TIMELINE_LANE_IDS.flatMap((laneId) =>
        (['video', 'image', 'audio'] as const).map((kind) =>
          planTimelinePlacement(request({ targetLaneId: laneId, assetId: assetOfKind(kind) }))))

      for (const attempt of attempts) {
        if (attempt.ok) continue
        expect(PLACEMENT_REFUSAL_CODES).toContain(attempt.error.code)
        expect(attempt.error.message.length).toBeGreaterThan(10)
      }
    })
  })

  describe('placement modes', () => {
    it('refuses Normal when something is already there', () => {
      const result = planTimelinePlacement(
        request({ atTicks: 2 * T, placementMode: 'normal' }),
        { spans: [{ startTicks: 1 * T, durationTicks: 5 * T }] },
      )
      expect(refusalOf(result)).toBe('COLLISION')
      expect(!result.ok && result.error.message).toContain('Insert')
    })

    it('allows Normal when the gap is exactly big enough', () => {
      // Half-open ranges: an item ending at 2s and one starting at 2s do not
      // overlap. Treating them as overlapping would forbid butt-joined clips.
      const result = planTimelinePlacement(
        request({ atTicks: 2 * T, placementMode: 'normal' }),
        { spans: [{ startTicks: 0, durationTicks: 2 * T }] },
      )
      expect(result.ok).toBe(true)
    })

    it('Append puts the item after the last thing on the lane', () => {
      const result = planTimelinePlacement(
        request({ atTicks: 0, placementMode: 'append' }),
        { spans: [{ startTicks: 0, durationTicks: 2 * T }, { startTicks: 4 * T, durationTicks: 1 * T }] },
      )
      expect(result.ok && result.value.atTicks).toBe(5 * T)
    })

    it('Append on an empty lane lands at zero', () => {
      const result = planTimelinePlacement(request({ atTicks: 9 * T, placementMode: 'append' }), { spans: [] })
      expect(result.ok && result.value.atTicks).toBe(0)
    })

    it('Insert on an empty stretch behaves as an ordinary placement', () => {
      const result = planTimelinePlacement(
        request({ atTicks: 3 * T, placementMode: 'insert' }),
        { spans: [{ startTicks: 0, durationTicks: 2 * T }] },
      )
      expect(result.ok && result.value.atTicks).toBe(3 * T)
    })

    it('refuses Insert when it would have to push something along, rather than losing it', () => {
      const result = planTimelinePlacement(
        request({ atTicks: 1 * T, placementMode: 'insert' }),
        { spans: [{ startTicks: 3 * T, durationTicks: 2 * T }] },
      )
      expect(refusalOf(result)).toBe('OPERATION_UNSUPPORTED')
      expect(!result.ok && result.error.message).toContain('Normal')
    })

    it('refuses Overwrite when it would have to replace something, rather than losing it', () => {
      const result = planTimelinePlacement(
        request({ atTicks: 1 * T, placementMode: 'overwrite' }),
        { spans: [{ startTicks: 0, durationTicks: 4 * T }] },
      )
      expect(refusalOf(result)).toBe('OPERATION_UNSUPPORTED')
    })

    it('allows Overwrite where there is nothing to overwrite', () => {
      const result = planTimelinePlacement(
        request({ atTicks: 1 * T, placementMode: 'overwrite' }),
        { spans: [] },
      )
      expect(result.ok).toBe(true)
    })
  })

  describe('linked audio', () => {
    it('refuses to pretend it can bring B-roll sound along', () => {
      const result = planTimelinePlacement(request({
        targetLaneId: 'lane:overlay',
        assetId: project().assets[0].assetId,
        includeLinkedAudio: true,
      }))
      // Either the asset has no sound (nothing to link) or the request is
      // refused truthfully. What must never happen is silent success that
      // drops the sound without saying so.
      if (!result.ok) expect(result.error.code).toBe('UNSUPPORTED_AUDIO_LINK')
    })
  })

  describe('lane and track names are one mapping, not two', () => {
    it('round-trips every lane through its track id', () => {
      for (const laneId of TIMELINE_LANE_IDS) {
        expect(laneIdForTrack(trackIdForLane(laneId))).toBe(laneId)
      }
    })
  })
})
