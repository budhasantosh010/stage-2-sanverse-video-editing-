import type { LibraryScopeV1, MotionPerformanceClass } from '@sanverse/motion-contract'
import type {
  MotionFormatUseV1,
  MotionLibraryCatalogEntryV1,
  MotionLibraryCategoryV1,
  MotionLibraryMilestoneV1,
  MotionLibrarySearchOptionsV1,
  MotionUseContextV1,
} from './library-catalog.ts'
import type { MotionLibraryQualityTierV1, MotionLibraryReviewStatusV1 } from './library-review.ts'

const normalize = (value: string): string => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/gu, ' ').trim()
const tokens = (entry: MotionLibraryCatalogEntryV1): readonly string[] => Object.freeze([...new Set(normalize([
  entry.componentId,
  entry.displayName,
  entry.shortDescription,
  ...entry.aliases,
  entry.primaryCategory,
  ...entry.secondaryCategories,
  ...entry.communicationIntents,
  ...entry.recommendedContexts,
  ...entry.formats,
  ...entry.visualTraits,
  ...entry.motionTraits,
  entry.introducedInMilestone,
  entry.libraryScope,
  ...entry.referenceLineage,
].join(' ')).split(/\s+/u).filter(Boolean))])

const add = <K,>(map: Map<K, Set<string>>, key: K, id: string): void => {
  const ids = map.get(key) ?? new Set<string>()
  ids.add(id)
  map.set(key, ids)
}
const remove = <K,>(map: Map<K, Set<string>>, key: K, id: string): void => {
  const ids = map.get(key)
  if (!ids) return
  ids.delete(id)
  if (ids.size === 0) map.delete(key)
}

export interface MotionLibraryScaleIndexStatsV15 {
  readonly entries: number
  readonly searchTokens: number
  readonly references: number
}

export interface MotionLibraryScaleIndexV15 {
  readonly upsert: (entry: MotionLibraryCatalogEntryV1) => void
  readonly remove: (componentId: string) => boolean
  readonly get: (componentId: string) => MotionLibraryCatalogEntryV1 | null
  readonly query: (options?: MotionLibrarySearchOptionsV1) => readonly MotionLibraryCatalogEntryV1[]
  readonly stats: () => MotionLibraryScaleIndexStatsV15
}

type EntryIndexes = Readonly<{
  tokens: readonly string[]
  categories: readonly MotionLibraryCategoryV1[]
  contexts: readonly MotionUseContextV1[]
  milestone: MotionLibraryMilestoneV1
  reviewStatus: MotionLibraryReviewStatusV1
  qualityTier: MotionLibraryQualityTierV1
  performanceClass: MotionPerformanceClass
  formats: readonly MotionFormatUseV1[]
  libraryScope: LibraryScopeV1
  references: readonly string[]
}>

const metadataFor = (entry: MotionLibraryCatalogEntryV1): EntryIndexes => Object.freeze({
  tokens: tokens(entry),
  categories: Object.freeze([entry.primaryCategory, ...entry.secondaryCategories]),
  contexts: entry.recommendedContexts,
  milestone: entry.introducedInMilestone,
  reviewStatus: entry.review.status,
  qualityTier: entry.review.qualityTier,
  performanceClass: entry.performanceClass,
  formats: entry.formats,
  libraryScope: entry.libraryScope,
  references: entry.referenceLineage,
})

const milestoneRank = (milestone: MotionLibraryMilestoneV1): number => ({ 'A0-A16': 1, A17: 17, A18: 18, A19: 19, A20: 20, A21: 21, CH1: 22, unknown: 0 })[milestone]
const tierRank = (tier: MotionLibraryQualityTierV1): number => ({ S: 5, A: 4, B: 3, C: 2, Experimental: 1 })[tier]
const queryScore = (entry: MotionLibraryCatalogEntryV1, raw: string): number => {
  const query = normalize(raw)
  if (!query) return 1
  const name = normalize(entry.displayName)
  const id = normalize(entry.componentId)
  const aliases = entry.aliases.map(normalize)
  if (name === query) return 1000
  if (name.startsWith(query)) return 800
  if (aliases.some((alias) => alias === query)) return 700
  if (aliases.some((alias) => alias.startsWith(query))) return 600
  if (entry.communicationIntents.some((intent) => normalize(intent) === query)) return 500
  if (normalize(entry.primaryCategory) === query) return 450
  if (entry.recommendedContexts.some((context) => normalize(context) === query)) return 400
  const searchable = normalize([entry.componentId, entry.displayName, entry.shortDescription, ...entry.aliases, ...entry.communicationIntents, ...entry.recommendedContexts, ...entry.visualTraits, ...entry.motionTraits].join(' '))
  return searchable.includes(query) ? 100 : 0
}

/**
 * Incremental in-memory index for production-scale Library discovery. Registering
 * one promoted/imported capability updates only that capability's postings;
 * the entire catalog is never rebuilt. It is an index over canonical entries,
 * not a second Library registry.
 */
export const createMotionLibraryScaleIndexV15 = (initial: readonly MotionLibraryCatalogEntryV1[] = []): MotionLibraryScaleIndexV15 => {
  const entries = new Map<string, MotionLibraryCatalogEntryV1>()
  const metadata = new Map<string, EntryIndexes>()
  const search = new Map<string, Set<string>>()
  const categories = new Map<MotionLibraryCategoryV1, Set<string>>()
  const contexts = new Map<MotionUseContextV1, Set<string>>()
  const milestones = new Map<MotionLibraryMilestoneV1, Set<string>>()
  const reviewStatuses = new Map<MotionLibraryReviewStatusV1, Set<string>>()
  const qualityTiers = new Map<MotionLibraryQualityTierV1, Set<string>>()
  const performance = new Map<MotionPerformanceClass, Set<string>>()
  const formats = new Map<MotionFormatUseV1, Set<string>>()
  const scopes = new Map<LibraryScopeV1, Set<string>>()
  const lineage = new Map<string, Set<string>>()

  const detach = (id: string): void => {
    const old = metadata.get(id)
    if (!old) return
    old.tokens.forEach((value) => remove(search, value, id))
    old.categories.forEach((value) => remove(categories, value, id))
    old.contexts.forEach((value) => remove(contexts, value, id))
    remove(milestones, old.milestone, id)
    remove(reviewStatuses, old.reviewStatus, id)
    remove(qualityTiers, old.qualityTier, id)
    remove(performance, old.performanceClass, id)
    old.formats.forEach((value) => remove(formats, value, id))
    remove(scopes, old.libraryScope, id)
    old.references.forEach((value) => remove(lineage, value, id))
    metadata.delete(id)
  }
  const upsert = (entry: MotionLibraryCatalogEntryV1): void => {
    if (!entry.componentId.trim()) throw new RangeError('Library scale index requires a componentId.')
    detach(entry.componentId)
    entries.set(entry.componentId, entry)
    const meta = metadataFor(entry)
    metadata.set(entry.componentId, meta)
    meta.tokens.forEach((value) => add(search, value, entry.componentId))
    meta.categories.forEach((value) => add(categories, value, entry.componentId))
    meta.contexts.forEach((value) => add(contexts, value, entry.componentId))
    add(milestones, meta.milestone, entry.componentId)
    add(reviewStatuses, meta.reviewStatus, entry.componentId)
    add(qualityTiers, meta.qualityTier, entry.componentId)
    add(performance, meta.performanceClass, entry.componentId)
    meta.formats.forEach((value) => add(formats, value, entry.componentId))
    add(scopes, meta.libraryScope, entry.componentId)
    meta.references.forEach((value) => add(lineage, value, entry.componentId))
  }
  initial.forEach(upsert)

  const intersect = (candidate: Set<string> | null, source: ReadonlySet<string> | undefined): Set<string> => {
    const incoming = source ?? new Set<string>()
    if (candidate === null) return new Set(incoming)
    for (const id of candidate) if (!incoming.has(id)) candidate.delete(id)
    return candidate
  }
  const query = (options: MotionLibrarySearchOptionsV1 = {}): readonly MotionLibraryCatalogEntryV1[] => {
    let candidate: Set<string> | null = null
    if (options.category) candidate = intersect(candidate, categories.get(options.category))
    if (options.context) candidate = intersect(candidate, contexts.get(options.context))
    if (options.milestone) candidate = intersect(candidate, milestones.get(options.milestone))
    if (options.reviewStatus) candidate = intersect(candidate, reviewStatuses.get(options.reviewStatus))
    if (options.qualityTier) candidate = intersect(candidate, qualityTiers.get(options.qualityTier))
    if (options.performanceClass) candidate = intersect(candidate, performance.get(options.performanceClass))
    if (options.format) candidate = intersect(candidate, formats.get(options.format))
    if (options.libraryScope) candidate = intersect(candidate, scopes.get(options.libraryScope))

    const q = normalize(options.query ?? '')
    if (q) {
      const queryTokens = q.split(/\s+/u).filter(Boolean)
      for (const token of queryTokens) {
        const exact = search.get(token)
        if (exact) candidate = intersect(candidate, exact)
      }
    }

    const ids = candidate ?? new Set(entries.keys())
    const scored = [...ids].map((id) => entries.get(id)).filter((entry): entry is MotionLibraryCatalogEntryV1 => Boolean(entry))
      .map((entry) => ({ entry, score: queryScore(entry, options.query ?? '') }))
      .filter(({ score }) => score > 0)

    const sort = options.sort ?? 'recommended'
    scored.sort((a, b) => {
      if (sort === 'a-z') return a.entry.displayName.localeCompare(b.entry.displayName)
      if (sort === 'recent') return milestoneRank(b.entry.introducedInMilestone) - milestoneRank(a.entry.introducedInMilestone) || a.entry.displayName.localeCompare(b.entry.displayName)
      if (sort === 'milestone') return milestoneRank(a.entry.introducedInMilestone) - milestoneRank(b.entry.introducedInMilestone) || a.entry.displayName.localeCompare(b.entry.displayName)
      if (sort === 'quality') return tierRank(b.entry.review.qualityTier) - tierRank(a.entry.review.qualityTier) || a.entry.displayName.localeCompare(b.entry.displayName)
      return b.score - a.score || Number(b.entry.review.status === 'passed') - Number(a.entry.review.status === 'passed') || milestoneRank(b.entry.introducedInMilestone) - milestoneRank(a.entry.introducedInMilestone) || a.entry.displayName.localeCompare(b.entry.displayName)
    })
    return Object.freeze(scored.map(({ entry }) => entry))
  }

  return Object.freeze({
    upsert,
    remove: (componentId: string) => {
      if (!entries.has(componentId)) return false
      detach(componentId)
      return entries.delete(componentId)
    },
    get: (componentId: string) => entries.get(componentId) ?? null,
    query,
    stats: () => Object.freeze({ entries: entries.size, searchTokens: search.size, references: [...lineage.values()].reduce((sum, ids) => sum + ids.size, 0) }),
  })
}
