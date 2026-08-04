import { describe, expect, it } from 'vitest'

import { TIMELINE_LANE_IDS, acceptsMediaKind, planTimelinePlacement } from './timeline-placement-planner'
import { MEDIA_DRAG_KINDS } from '../media/media-drag-contract'
import { createIdFactory } from '@sanverse/edit-domain'
import {
  TEST_BROLL_ASSET_ID,
  TEST_IMAGE_ASSET_ID,
  TEST_MUSIC_ASSET_ID,
  testMultiAssetProject,
} from '@sanverse/edit-domain/test-fixtures'

/**
 * Gate C1.2 — the lane highlight and the outcome are one decision.
 *
 * A lane that lights up green under the pointer and then refuses when the user
 * lets go is the product changing its mind after they have committed to the
 * gesture. So the highlight is not a separate table of rules; it asks the same
 * planner, and this file proves the two can never drift apart.
 */

const assetFor = (kind: 'video' | 'image' | 'audio'): string =>
  kind === 'video' ? TEST_BROLL_ASSET_ID : kind === 'image' ? TEST_IMAGE_ASSET_ID : TEST_MUSIC_ASSET_ID

describe('what a lane says before the drop, and what it does on the drop', () => {
  it('agrees with the planner for every lane and every kind of file', () => {
    const project = testMultiAssetProject()
    const disagreements: string[] = []

    for (const laneId of TIMELINE_LANE_IDS) {
      for (const mediaKind of MEDIA_DRAG_KINDS) {
        const highlighted = acceptsMediaKind(laneId, mediaKind)
        const planned = planTimelinePlacement({
          project,
          assetId: assetFor(mediaKind),
          targetLaneId: laneId,
          atTicks: 2 * 1_440_000,
          placementMode: 'normal',
          includeLinkedAudio: false,
          idFactory: createIdFactory('changeset_droptest1'),
        })
        if (highlighted !== planned.ok) {
          disagreements.push(`${laneId} + ${mediaKind}: highlight=${highlighted} plan=${planned.ok}`)
        }
      }
    }

    expect(disagreements).toEqual([])
  })

  it('never highlights a lane that has no drop of its own', () => {
    for (const mediaKind of MEDIA_DRAG_KINDS) {
      expect(acceptsMediaKind('lane:video', mediaKind)).toBe(false)
      expect(acceptsMediaKind('lane:dialogue', mediaKind)).toBe(false)
      expect(acceptsMediaKind('lane:caption', mediaKind)).toBe(false)
    }
  })

  it('highlights exactly the two lanes that can take something', () => {
    expect(acceptsMediaKind('lane:overlay', 'video')).toBe(true)
    expect(acceptsMediaKind('lane:overlay', 'image')).toBe(true)
    expect(acceptsMediaKind('lane:overlay', 'audio')).toBe(false)
    expect(acceptsMediaKind('lane:music', 'audio')).toBe(true)
    expect(acceptsMediaKind('lane:music', 'video')).toBe(false)
  })

  it('does not highlight a lane that does not exist', () => {
    expect(acceptsMediaKind('lane:whatever', 'video')).toBe(false)
    expect(acceptsMediaKind('', 'video')).toBe(false)
  })

  it('leaves room for a refusal the highlight could not have known about', () => {
    // A locked lane still highlights on kind — the padlock is not about what
    // sort of file it is — and refuses on release with a reason. That is the
    // one direction of disagreement that is allowed, and it is allowed because
    // the release always explains itself.
    const project = testMultiAssetProject()
    expect(acceptsMediaKind('lane:overlay', 'video')).toBe(true)

    const planned = planTimelinePlacement({
      project,
      assetId: TEST_BROLL_ASSET_ID,
      targetLaneId: 'lane:overlay',
      atTicks: 2 * 1_440_000,
      placementMode: 'normal',
      includeLinkedAudio: false,
      trackState: { lockedTrackIds: ['V2'] },
      idFactory: createIdFactory('changeset_droptest2'),
    })
    expect(planned.ok).toBe(false)
    expect(!planned.ok && planned.error.message.length).toBeGreaterThan(10)
  })
})
