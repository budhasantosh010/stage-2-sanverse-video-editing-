import type { CreativeEditabilityV1, LibraryScopeV1, MotionAspectRatio, MotionPerformanceClass, MotionPresentationModeV1 } from '@sanverse/motion-contract'

export type CapabilityKindV1 = 'sanverse-component' | 'external-component' | 'generated-scene' | 'motion-recipe' | 'effect'

export interface CapabilityCatalogItemV1 {
  readonly id: string
  readonly kind: CapabilityKindV1
  readonly title: string
  readonly description: string
  readonly semanticTags: readonly string[]
  readonly communicationGoals: readonly string[]
  readonly supportedPresentationModes: readonly MotionPresentationModeV1[]
  readonly supportedRatios: readonly MotionAspectRatio[]
  readonly styleTraits: readonly string[]
  readonly motionTraits: readonly string[]
  readonly editability: CreativeEditabilityV1
  readonly libraryScope: LibraryScopeV1
  readonly requiredCapabilities: readonly string[]
  readonly qualityStatus: 'unreviewed' | 'preview-ready' | 'passed' | 'needs-polish'
  readonly ownerApprovalStatus: 'owner-approved' | 'batch-authorized' | 'not-required' | 'unapproved'
  readonly performanceClass: MotionPerformanceClass
  readonly provenance?: unknown
}

export interface BuildCapabilityCatalogInputV1 {
  readonly sanverse?: readonly CapabilityCatalogItemV1[]
  readonly external?: readonly CapabilityCatalogItemV1[]
  readonly generatedFallback?: boolean
}

export const buildCapabilityCatalogV1 = (input: BuildCapabilityCatalogInputV1 = {}): readonly CapabilityCatalogItemV1[] => {
  const generated: readonly CapabilityCatalogItemV1[] = input.generatedFallback ? [Object.freeze({
    id: 'generated.scene.v1',
    kind: 'generated-scene' as const,
    title: 'SDK Generated Scene',
    description: 'Build an editable scene from canonical Sanverse primitives.',
    semanticTags: Object.freeze(['generated', 'fallback']),
    communicationGoals: Object.freeze(['custom']),
    supportedPresentationModes: Object.freeze<MotionPresentationModeV1[]>(['overlay', 'split', 'picture-in-picture', 'full-screen-motion', 'bridge-takeover']),
    supportedRatios: Object.freeze<MotionAspectRatio[]>(['16:9', '9:16', '1:1', '4:5']),
    styleTraits: Object.freeze(['custom']),
    motionTraits: Object.freeze(['custom']),
    editability: 'full' as const,
    libraryScope: 'generated' as const,
    requiredCapabilities: Object.freeze([]),
    qualityStatus: 'unreviewed' as const,
    ownerApprovalStatus: 'not-required' as const,
    performanceClass: 'medium' as const,
  })] : Object.freeze([])
  return Object.freeze([...(input.sanverse ?? []), ...(input.external ?? []), ...generated])
}

export interface CapabilityRetrievalQueryV1 {
  readonly communicationGoal: string
  readonly presentationMode: MotionPresentationModeV1
  readonly ratio: MotionAspectRatio
  readonly styleTraits?: readonly string[]
  readonly requiredEditability?: CreativeEditabilityV1
  readonly allowedLibraryScopes: readonly LibraryScopeV1[]
  readonly requiredCapabilities?: readonly string[]
}

export interface RankedCapabilityV1 {
  readonly capabilityId: string
  readonly score: number
  readonly reasons: readonly string[]
  readonly warnings: readonly string[]
}

const editabilityRank: Readonly<Record<CreativeEditabilityV1, number>> = Object.freeze({ full: 5, high: 4, medium: 3, partial: 2, flattened: 1 })

export const rankCapabilitiesV1 = (catalog: readonly CapabilityCatalogItemV1[], query: CapabilityRetrievalQueryV1): readonly RankedCapabilityV1[] => Object.freeze(catalog
  .filter((item) => query.allowedLibraryScopes.includes(item.libraryScope)
    && item.supportedRatios.includes(query.ratio)
    && item.supportedPresentationModes.includes(query.presentationMode)
    && (!query.requiredEditability || editabilityRank[item.editability] >= editabilityRank[query.requiredEditability]))
  .map((item): RankedCapabilityV1 => {
    let score = 10
    const reasons: string[] = ['Allowed Library scope, ratio and presentation mode match.']
    const warnings: string[] = []
    const goal = query.communicationGoal.toLowerCase()
    if (item.communicationGoals.some((candidate) => candidate.toLowerCase() === goal) || item.semanticTags.some((tag) => tag.toLowerCase() === goal)) {
      score += 50
      reasons.push(`Communication goal matches ${query.communicationGoal}.`)
    }
    const styleMatches = (query.styleTraits ?? []).filter((trait) => item.styleTraits.includes(trait)).length
    if (styleMatches > 0) {
      score += styleMatches * 5
      reasons.push(`${styleMatches} requested style trait(s) match.`)
    }
    const missing = (query.requiredCapabilities ?? []).filter((capability) => !item.requiredCapabilities.includes(capability))
    if (missing.length > 0) warnings.push(`Candidate does not declare required capability metadata: ${missing.join(', ')}.`)
    if (item.qualityStatus === 'passed') {
      score += 10
      reasons.push('Existing quality review passed.')
    }
    if (item.kind === 'generated-scene') {
      score -= 2
      reasons.push('Generated fallback is ranked after reusable matches when scores are otherwise similar.')
    }
    return Object.freeze({ capabilityId: item.id, score, reasons: Object.freeze(reasons), warnings: Object.freeze(warnings) })
  })
  .sort((a, b) => b.score - a.score || a.capabilityId.localeCompare(b.capabilityId)))
