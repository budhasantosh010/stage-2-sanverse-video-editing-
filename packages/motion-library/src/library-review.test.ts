import { describe, expect, it } from 'vitest'
import { MOTION_COMPONENT_CATALOG } from './catalog.ts'
import {
  emptyMotionLibraryReviewDocument,
  parseMotionLibraryReviewDocument,
  serializeMotionLibraryReviewDocument,
  validateMotionLibraryReviewDocument,
  validateMotionQualityReview,
} from './library-review.ts'

const scores = Object.freeze({
  entrance: 4, pacing: 4, easing: 4, rhythm: 4, readability: 5, hold: 4,
  payoff: 4, exit: 4, competingMotion: 5, footageCompatibility: 4, professionalFeel: 4, overall: 4,
})

const validReview = Object.freeze({
  componentId: MOTION_COMPONENT_CATALOG[0]!.id,
  fixtureId: 'default',
  status: 'passed',
  qualityTier: 'A',
  scores,
  notes: Object.freeze(['Canonical 16:9 watched start to finish at 1×.']),
  reviewedAt: '2026-08-11T00:00:00.000Z',
  reviewer: 'sanverse-l1-review',
  fullPlaybackVerified: true,
  playbackSpeed: 1,
  canonicalDurationTicks: MOTION_COMPONENT_CATALOG[0]!.defaultDurationTicks,
})

describe('L1 Motion quality review contract', () => {
  it('round-trips a valid durable review document', () => {
    const document = Object.freeze({ schemaVersion: 'sanverse.motion-library-reviews/v1' as const, reviews: Object.freeze([validReview]) })
    const serialized = serializeMotionLibraryReviewDocument(document)
    expect(parseMotionLibraryReviewDocument(serialized)).toEqual(document)
  })

  it('rejects invalid scores, statuses, unknown components and non-1x playback', () => {
    expect(validateMotionQualityReview({ ...validReview, scores: { ...scores, pacing: 6 } }).ok).toBe(false)
    expect(validateMotionQualityReview({ ...validReview, status: 'looks-good' }).ok).toBe(false)
    expect(validateMotionQualityReview({ ...validReview, componentId: 'sanverse.not-real' }).ok).toBe(false)
    expect(validateMotionQualityReview({ ...validReview, playbackSpeed: 2 }).ok).toBe(false)
  })

  it('refuses passed status unless a complete canonical playback was verified', () => {
    const result = validateMotionQualityReview({ ...validReview, fullPlaybackVerified: false })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((issue) => issue.message.includes('complete canonical 1× playback'))).toBe(true)
  })

  it('rejects duplicate review identities and malformed persistence payloads', () => {
    const duplicate = validateMotionLibraryReviewDocument({ schemaVersion: 'sanverse.motion-library-reviews/v1', reviews: [validReview, validReview] })
    expect(duplicate.ok).toBe(false)
    expect(() => parseMotionLibraryReviewDocument('{nope')).toThrow(/malformed/u)
  })

  it('creates an empty durable document with the closed schema', () => {
    expect(emptyMotionLibraryReviewDocument()).toEqual({ schemaVersion: 'sanverse.motion-library-reviews/v1', reviews: [] })
  })
})
