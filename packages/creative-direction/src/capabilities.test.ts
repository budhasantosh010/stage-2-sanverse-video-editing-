import { describe, expect, it } from 'vitest'
import type { CapabilityCatalogItemV1 } from './capabilities.ts'
import { buildCapabilityCatalogV1, rankCapabilitiesV1 } from './capabilities.ts'

const sanverseStat: CapabilityCatalogItemV1 = Object.freeze({
  id: 'sanverse.stat', kind: 'sanverse-component', title: 'Stat', description: 'Stat',
  semanticTags: Object.freeze(['statistic']), communicationGoals: Object.freeze(['statistic']),
  supportedPresentationModes: ['overlay'] as const, supportedRatios: ['16:9'] as const,
  styleTraits: Object.freeze(['clean']), motionTraits: Object.freeze(['count']), editability: 'full', libraryScope: 'sanverse',
  requiredCapabilities: Object.freeze([]), qualityStatus: 'passed', ownerApprovalStatus: 'not-required', performanceClass: 'light',
})

describe('B2 capability catalog', () => {
  it('exposes Sanverse, external and generated candidates through one typed catalog', () => {
    const catalog = buildCapabilityCatalogV1({
      sanverse: [sanverseStat],
      external: [Object.freeze({ id: 'external.fixture', kind: 'external-component', title: 'External Fixture', description: 'External fixture', semanticTags: Object.freeze(['statistic']), communicationGoals: Object.freeze(['statistic']), supportedPresentationModes: ['overlay'] as const, supportedRatios: ['16:9'] as const, styleTraits: Object.freeze(['clean']), motionTraits: Object.freeze(['fade']), editability: 'high', libraryScope: 'external', requiredCapabilities: Object.freeze([]), qualityStatus: 'preview-ready', ownerApprovalStatus: 'not-required', performanceClass: 'light' })],
      generatedFallback: true,
    })
    expect(catalog.some((item) => item.kind === 'sanverse-component')).toBe(true)
    expect(catalog.some((item) => item.id === 'external.fixture' && item.libraryScope === 'external')).toBe(true)
    expect(catalog.some((item) => item.kind === 'generated-scene')).toBe(true)
  })

  it('ranks deterministically and explains every non-zero result', () => {
    const query = { communicationGoal: 'statistic', presentationMode: 'overlay' as const, ratio: '16:9' as const, allowedLibraryScopes: ['sanverse', 'generated'] as const }
    const catalog = buildCapabilityCatalogV1({ sanverse: [sanverseStat], generatedFallback: true })
    const ranked = rankCapabilitiesV1(catalog, query)
    expect(ranked.length).toBeGreaterThan(0)
    expect(ranked.every((item) => Number.isFinite(item.score) && item.reasons.length > 0)).toBe(true)
    expect(rankCapabilitiesV1(catalog, query)).toEqual(ranked)
  })

  it('retrieves promoted generated capabilities contextually, explains reuse, handles mismatches, and keeps bespoke generation fallback available', () => {
    const promoted: CapabilityCatalogItemV1 = Object.freeze({
      id: 'promoted.metric-story', kind: 'generated-scene', title: 'Promoted Metric Story', description: 'Reusable generated metric story',
      semanticTags: Object.freeze(['statistic','metric-payoff']), communicationGoals: Object.freeze(['statistic']),
      supportedPresentationModes: ['overlay','full-screen-motion'] as const, supportedRatios: ['16:9','9:16'] as const,
      styleTraits: Object.freeze(['clean','structured']), motionTraits: Object.freeze(['sequential','hold']), editability: 'full', libraryScope: 'generated',
      origin: 'generated', reuseStatus: 'promoted-reusable', lineage: Object.freeze({ sourceProjectId: 'project:a' }),
      requiredCapabilities: Object.freeze(['masks']), qualityStatus: 'passed', ownerApprovalStatus: 'owner-approved', performanceClass: 'light',
    })
    const catalog = buildCapabilityCatalogV1({ sanverse: [sanverseStat], external: [promoted], generatedFallback: true })
    const query = { communicationGoal: 'statistic', presentationMode: 'overlay' as const, ratio: '16:9' as const, allowedLibraryScopes: ['sanverse','generated'] as const, requiredCapabilities: ['masks'] as const }
    const ranked = rankCapabilitiesV1(catalog, query)
    expect(ranked[0]?.capabilityId).toBe('promoted.metric-story')
    expect(ranked[0]?.reasons.some(reason => reason.includes('promoted capability'))).toBe(true)
    expect(rankCapabilitiesV1(catalog, { ...query, ratio: '4:5' as const }).some(item => item.capabilityId === 'promoted.metric-story')).toBe(false)
    expect(rankCapabilitiesV1(catalog, { ...query, presentationMode: 'split' as const }).some(item => item.capabilityId === 'promoted.metric-story')).toBe(false)
    const missingCapability = rankCapabilitiesV1(catalog, { ...query, requiredCapabilities: ['tracking'] as const }).find(item => item.capabilityId === 'promoted.metric-story')
    expect(missingCapability?.score).toBeLessThan(ranked[0]!.score)
    expect(missingCapability?.warnings[0]).toContain('tracking')
    expect(catalog.some(item => item.id === 'generated.scene.v1')).toBe(true)
  })
})
