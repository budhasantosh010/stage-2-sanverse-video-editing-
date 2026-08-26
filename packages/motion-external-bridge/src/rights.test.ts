import { describe, expect, it } from 'vitest'
import { evaluateExternalRights, validateExternalMotionProvenanceV1, type ExternalMotionProvenanceV1 } from './provenance.ts'

const provenance = (overrides: Partial<ExternalMotionProvenanceV1> = {}): ExternalMotionProvenanceV1 => ({
  schemaVersion: 'sanverse.external-motion-provenance/v1', sourceKind: 'svg', sourceName: 'Fixture', rightsClass: 'permissive-oss',
  attributionRequired: false, reusableLibraryAllowed: true, projectUseAllowed: true, aiModificationAllowed: true, restrictions: Object.freeze([]), ...overrides,
})

describe('A2 external provenance rights gate', () => {
  it('fails unknown rights closed', () => expect(evaluateExternalRights(provenance({ rightsClass: 'unknown' }))).toMatchObject({ decision: 'BLOCKED' }))
  it('keeps commercial stock project-only by default', () => expect(evaluateExternalRights(provenance({ rightsClass: 'commercial-stock', reusableLibraryAllowed: false }))).toMatchObject({ decision: 'PROJECT_ONLY' }))
  it('allows reusable permissive OSS only when declared conditions can be satisfied', () => expect(evaluateExternalRights(provenance())).toMatchObject({ decision: 'REUSABLE_LIBRARY' }))
  it('refuses malformed or unknown schema versions', () => {
    expect(validateExternalMotionProvenanceV1({ ...provenance(), schemaVersion: 'v2' })).toMatchObject({ ok: false })
  })
})
