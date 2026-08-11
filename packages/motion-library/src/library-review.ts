import { MOTION_COMPONENT_CATALOG } from './catalog.ts'

export const MOTION_LIBRARY_REVIEW_STATUSES = Object.freeze(['unreviewed', 'in-review', 'needs-polish', 'passed', 'rejected'] as const)
export type MotionLibraryReviewStatusV1 = (typeof MOTION_LIBRARY_REVIEW_STATUSES)[number]

export const MOTION_LIBRARY_QUALITY_TIERS = Object.freeze(['S', 'A', 'B', 'C', 'Experimental'] as const)
export type MotionLibraryQualityTierV1 = (typeof MOTION_LIBRARY_QUALITY_TIERS)[number]

export const MOTION_LIBRARY_SCORE_DIMENSIONS = Object.freeze([
  'entrance',
  'pacing',
  'easing',
  'rhythm',
  'readability',
  'hold',
  'payoff',
  'exit',
  'competingMotion',
  'footageCompatibility',
  'professionalFeel',
  'overall',
] as const)
export type MotionLibraryScoreDimensionV1 = (typeof MOTION_LIBRARY_SCORE_DIMENSIONS)[number]
export type MotionQualityScoresV1 = Readonly<Record<MotionLibraryScoreDimensionV1, number>>

export interface MotionQualityReviewV1 {
  readonly componentId: `sanverse.${string}`
  readonly fixtureId: string
  readonly status: MotionLibraryReviewStatusV1
  readonly qualityTier: MotionLibraryQualityTierV1
  readonly scores?: MotionQualityScoresV1
  readonly notes: readonly string[]
  readonly reviewedAt?: string
  readonly reviewer?: string
  readonly fullPlaybackVerified: boolean
  readonly playbackSpeed: 1
  readonly canonicalDurationTicks?: number
}

export interface MotionLibraryReviewDocumentV1 {
  readonly schemaVersion: 'sanverse.motion-library-reviews/v1'
  readonly reviews: readonly MotionQualityReviewV1[]
}

export interface MotionLibraryReviewValidationIssueV1 {
  readonly path: string
  readonly message: string
}

export type MotionLibraryReviewValidationResultV1 =
  | Readonly<{ ok: true; value: MotionLibraryReviewDocumentV1 }>
  | Readonly<{ ok: false; issues: readonly MotionLibraryReviewValidationIssueV1[] }>

const componentIds = new Set(MOTION_COMPONENT_CATALOG.map((entry) => entry.id))
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null && !Array.isArray(value)
const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

const validateScores = (scores: unknown, path: string, issues: MotionLibraryReviewValidationIssueV1[]): MotionQualityScoresV1 | undefined => {
  if (scores === undefined) return undefined
  if (!isRecord(scores)) {
    issues.push({ path, message: 'scores must be an object when supplied.' })
    return undefined
  }
  const output = {} as Record<MotionLibraryScoreDimensionV1, number>
  for (const dimension of MOTION_LIBRARY_SCORE_DIMENSIONS) {
    const value = scores[dimension]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 5) {
      issues.push({ path: `${path}.${dimension}`, message: 'review scores must be finite numbers inside [1,5].' })
      continue
    }
    output[dimension] = value
  }
  return MOTION_LIBRARY_SCORE_DIMENSIONS.every((dimension) => Number.isFinite(output[dimension])) ? Object.freeze(output) : undefined
}

export const validateMotionQualityReview = (input: unknown, path = 'review'): Readonly<{ ok: true; value: MotionQualityReviewV1 } | { ok: false; issues: readonly MotionLibraryReviewValidationIssueV1[] }> => {
  const issues: MotionLibraryReviewValidationIssueV1[] = []
  if (!isRecord(input)) return Object.freeze({ ok: false, issues: Object.freeze([{ path, message: 'review must be an object.' }]) })
  const componentId = input.componentId
  const fixtureId = input.fixtureId
  const status = input.status
  const qualityTier = input.qualityTier
  const fullPlaybackVerified = input.fullPlaybackVerified
  const playbackSpeed = input.playbackSpeed
  if (!nonEmptyString(componentId) || !componentIds.has(componentId as `sanverse.${string}`)) issues.push({ path: `${path}.componentId`, message: 'componentId must reference one current public Motion component.' })
  if (!nonEmptyString(fixtureId)) issues.push({ path: `${path}.fixtureId`, message: 'fixtureId must be non-empty.' })
  if (!MOTION_LIBRARY_REVIEW_STATUSES.includes(status as MotionLibraryReviewStatusV1)) issues.push({ path: `${path}.status`, message: 'unknown review status.' })
  if (!MOTION_LIBRARY_QUALITY_TIERS.includes(qualityTier as MotionLibraryQualityTierV1)) issues.push({ path: `${path}.qualityTier`, message: 'unknown quality tier.' })
  if (typeof fullPlaybackVerified !== 'boolean') issues.push({ path: `${path}.fullPlaybackVerified`, message: 'fullPlaybackVerified must be boolean.' })
  if (playbackSpeed !== 1) issues.push({ path: `${path}.playbackSpeed`, message: 'canonical quality review playbackSpeed must be exactly 1.' })
  if (!Array.isArray(input.notes) || input.notes.some((note) => typeof note !== 'string')) issues.push({ path: `${path}.notes`, message: 'notes must be an array of strings.' })
  if (input.reviewedAt !== undefined && !nonEmptyString(input.reviewedAt)) issues.push({ path: `${path}.reviewedAt`, message: 'reviewedAt must be a non-empty ISO-style string when supplied.' })
  if (input.reviewer !== undefined && !nonEmptyString(input.reviewer)) issues.push({ path: `${path}.reviewer`, message: 'reviewer must be non-empty when supplied.' })
  if (input.canonicalDurationTicks !== undefined && (!Number.isSafeInteger(input.canonicalDurationTicks) || Number(input.canonicalDurationTicks) <= 0)) issues.push({ path: `${path}.canonicalDurationTicks`, message: 'canonicalDurationTicks must be a positive safe integer.' })
  const scores = validateScores(input.scores, `${path}.scores`, issues)
  if (status === 'passed' && fullPlaybackVerified !== true) issues.push({ path: `${path}.fullPlaybackVerified`, message: 'passed reviews require a complete canonical 1× playback.' })
  if (issues.length > 0) return Object.freeze({ ok: false, issues: Object.freeze(issues) })
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      componentId: componentId as `sanverse.${string}`,
      fixtureId: fixtureId as string,
      status: status as MotionLibraryReviewStatusV1,
      qualityTier: qualityTier as MotionLibraryQualityTierV1,
      ...(scores ? { scores } : {}),
      notes: Object.freeze([...(input.notes as string[])]),
      ...(input.reviewedAt ? { reviewedAt: input.reviewedAt as string } : {}),
      ...(input.reviewer ? { reviewer: input.reviewer as string } : {}),
      fullPlaybackVerified: fullPlaybackVerified as boolean,
      playbackSpeed: 1,
      ...(input.canonicalDurationTicks !== undefined ? { canonicalDurationTicks: input.canonicalDurationTicks as number } : {}),
    }),
  })
}

export const validateMotionLibraryReviewDocument = (input: unknown): MotionLibraryReviewValidationResultV1 => {
  if (!isRecord(input)) return Object.freeze({ ok: false, issues: Object.freeze([{ path: 'document', message: 'review document must be an object.' }]) })
  const issues: MotionLibraryReviewValidationIssueV1[] = []
  if (input.schemaVersion !== 'sanverse.motion-library-reviews/v1') issues.push({ path: 'schemaVersion', message: 'unsupported review schemaVersion.' })
  if (!Array.isArray(input.reviews)) issues.push({ path: 'reviews', message: 'reviews must be an array.' })
  const reviews: MotionQualityReviewV1[] = []
  const seen = new Set<string>()
  if (Array.isArray(input.reviews)) input.reviews.forEach((candidate, index) => {
    const result = validateMotionQualityReview(candidate, `reviews[${index}]`)
    if (!result.ok) {
      issues.push(...result.issues)
      return
    }
    const identity = `${result.value.componentId}::${result.value.fixtureId}`
    if (seen.has(identity)) issues.push({ path: `reviews[${index}]`, message: `duplicate review identity ${identity}.` })
    else {
      seen.add(identity)
      reviews.push(result.value)
    }
  })
  return issues.length > 0
    ? Object.freeze({ ok: false, issues: Object.freeze(issues) })
    : Object.freeze({ ok: true, value: Object.freeze({ schemaVersion: 'sanverse.motion-library-reviews/v1', reviews: Object.freeze(reviews) }) })
}

export const emptyMotionLibraryReviewDocument = (): MotionLibraryReviewDocumentV1 => Object.freeze({ schemaVersion: 'sanverse.motion-library-reviews/v1', reviews: Object.freeze([]) })

export const motionLibraryReviewByComponent = (document: MotionLibraryReviewDocumentV1): Readonly<Record<string, MotionQualityReviewV1>> => Object.freeze(Object.fromEntries(document.reviews.map((review) => [review.componentId, review])))

export const serializeMotionLibraryReviewDocument = (document: MotionLibraryReviewDocumentV1): string => {
  const validation = validateMotionLibraryReviewDocument(document)
  if (!validation.ok) throw new RangeError(validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'))
  return `${JSON.stringify(validation.value, null, 2)}\n`
}

export const parseMotionLibraryReviewDocument = (source: string): MotionLibraryReviewDocumentV1 => {
  let parsed: unknown
  try { parsed = JSON.parse(source) } catch { throw new RangeError('Review JSON is malformed.') }
  const validation = validateMotionLibraryReviewDocument(parsed)
  if (!validation.ok) throw new RangeError(validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'))
  return validation.value
}
