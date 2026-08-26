import { describe, expect, it } from 'vitest'
import { MOTION_COMPONENT_CATALOG } from './catalog.ts'
import {
  MOTION_LIBRARY_CATALOG,
  filterMotionLibraryCatalog,
  getMotionDiscoveryCatalog,
  getMotionLibraryCapabilityRecordsV1,
  getMotionLibraryCollections,
  validateMotionLibraryCatalog,
  validateMotionLibraryCollections,
} from './library-catalog.ts'

describe('L1 Creative Library catalog authority', () => {
  it('derives exactly one Creative Library entry from every public Motion component', () => {
    expect(MOTION_LIBRARY_CATALOG).toHaveLength(MOTION_COMPONENT_CATALOG.length)
    expect(new Set(MOTION_LIBRARY_CATALOG.map((entry) => entry.componentId)).size).toBe(MOTION_COMPONENT_CATALOG.length)
    expect(validateMotionLibraryCatalog()).toEqual({ ok: true, issues: [] })
  })

  it('rejects invisible components, orphan entries and duplicate catalog entries', () => {
    const missing = validateMotionLibraryCatalog(MOTION_LIBRARY_CATALOG.slice(1))
    expect(missing.ok).toBe(false)
    expect(missing.issues.some((issue) => issue.message.includes('invisible'))).toBe(true)
    const duplicate = validateMotionLibraryCatalog([...MOTION_LIBRARY_CATALOG, MOTION_LIBRARY_CATALOG[0]!])
    expect(duplicate.ok).toBe(false)
    expect(duplicate.issues.some((issue) => issue.message.includes('duplicate'))).toBe(true)
    const orphan = validateMotionLibraryCatalog([{ ...MOTION_LIBRARY_CATALOG[0]!, componentId: 'sanverse.does-not-exist' }])
    expect(orphan.ok).toBe(false)
    expect(orphan.issues.some((issue) => issue.message.includes('no public Motion component'))).toBe(true)
  })

  it('provides complete closed discovery metadata and component-specific poster definitions', () => {
    for (const entry of MOTION_LIBRARY_CATALOG) {
      expect(entry.communicationIntents.length, entry.componentId).toBeGreaterThan(0)
      expect(entry.recommendedContexts.length, entry.componentId).toBeGreaterThan(0)
      expect(entry.formats.length, entry.componentId).toBeGreaterThan(0)
      expect(entry.visualTraits.length, entry.componentId).toBeGreaterThan(0)
      expect(entry.motionTraits.length, entry.componentId).toBeGreaterThan(0)
      expect(entry.introducedInMilestone, entry.componentId).not.toBe('unknown')
      expect(entry.preview.fixtureId, entry.componentId).toBe('default')
      expect(entry.preview.ratio, entry.componentId).toBe('16:9')
      expect(entry.preview.posterTick, entry.componentId).toBeGreaterThanOrEqual(0)
      expect(entry.preview.posterTick, entry.componentId).toBeLessThanOrEqual(entry.preview.durationTicks)
      expect(entry.preview.previewHash.length, entry.componentId).toBeGreaterThan(0)
    }
    expect(new Set(MOTION_LIBRARY_CATALOG.map((entry) => entry.preview.posterTick)).size).toBeGreaterThan(6)
  })

  it('searches deterministic discovery metadata with obvious semantic ranking', () => {
    expect(filterMotionLibraryCatalog(MOTION_LIBRARY_CATALOG, { query: 'toast' })[0]?.componentId).toBe('sanverse.conversation-toast-stack')
    expect(filterMotionLibraryCatalog(MOTION_LIBRARY_CATALOG, { query: 'agent' }).some((entry) => entry.componentId === 'sanverse.agent-work-log')).toBe(true)
    expect(filterMotionLibraryCatalog(MOTION_LIBRARY_CATALOG, { query: 'percentage' }).some((entry) => entry.componentId === 'sanverse.donut-breakdown')).toBe(true)
    expect(filterMotionLibraryCatalog(MOTION_LIBRARY_CATALOG, { query: 'youtube' }).length).toBeGreaterThan(20)
  })

  it('composes category/context/review filters without a second inventory', () => {
    const filtered = filterMotionLibraryCatalog(MOTION_LIBRARY_CATALOG, { category: 'software-product', context: 'youtube-long-form', reviewStatus: 'unreviewed' })
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every((entry) => entry.primaryCategory === 'software-product' || entry.secondaryCategories.includes('software-product'))).toBe(true)
    expect(filtered.every((entry) => entry.recommendedContexts.includes('youtube-long-form'))).toBe(true)
    expect(filtered.every((entry) => entry.review.status === 'unreviewed')).toBe(true)
  })

  it('validates required collections and the Product Storytelling reference lineage', () => {
    const collections = getMotionLibraryCollections()
    expect(validateMotionLibraryCollections(collections)).toEqual({ ok: true, issues: [] })
    const ids = new Set(collections.map((entry) => entry.id))
    for (const required of ['recently-added','youtube-essentials','product-saas','talking-head','shorts-reels','software-demos','explainers','wow-cinematic','needs-motion-review','motion-review-passed','product-storytelling-reference-pack','sanverse-launch-core','milestone-a20','milestone-a21']) expect(ids.has(required), required).toBe(true)
    const productStory = collections.find((entry) => entry.id === 'product-storytelling-reference-pack')!
    for (const componentId of ['sanverse.conversation-toast-stack','sanverse.floating-prompt-composer','sanverse.product-ui-story-scene','sanverse.agent-work-log','sanverse.scoped-access-comparison','sanverse.keyword-brand-lockup','sanverse.kinetic-headline']) expect(productStory.items.some((entry) => entry.componentId === componentId), componentId).toBe(true)
    expect(productStory.items.find((entry) => entry.componentId === 'sanverse.kinetic-headline')?.fixtureId).toBe('semantic-highlight')
  })

  it('exposes pure B2 discovery/capability boundaries without scraping React UI', () => {
    const discovery = getMotionDiscoveryCatalog()
    const capabilities = getMotionLibraryCapabilityRecordsV1()
    expect(discovery).toHaveLength(MOTION_COMPONENT_CATALOG.length)
    expect(capabilities).toHaveLength(MOTION_COMPONENT_CATALOG.length)
    expect(discovery.every((entry) => entry.communicationIntents.length > 0 && entry.recommendedContexts.length > 0 && entry.libraryScope === 'sanverse')).toBe(true)
    expect(capabilities.every((entry) => entry.kind === 'sanverse-component' && entry.libraryScope === 'sanverse' && entry.supportedPresentationModes.length > 0)).toBe(true)
    expect(filterMotionLibraryCatalog(MOTION_LIBRARY_CATALOG, { libraryScope: 'sanverse' })).toHaveLength(MOTION_COMPONENT_CATALOG.length)
    expect(filterMotionLibraryCatalog(MOTION_LIBRARY_CATALOG, { libraryScope: 'external' })).toHaveLength(0)
  })
})
