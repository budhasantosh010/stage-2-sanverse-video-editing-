import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { createImmutableIntakeSnapshot, inspectApprovedComponentPackage, registerProductizedComponent } from './index.ts'

const createPackage = (options: Readonly<{ approved?: boolean; random?: boolean }> = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'sanverse-ingest-'))
  const component = join(root, 'components', '01-proof')
  mkdirSync(join(component, 'review'), { recursive: true })
  writeFileSync(join(root, 'components.js'), `(() => { const value = ${options.random ? 'Math.random()' : '1'}; window.PROOF = value })();`)
  writeFileSync(join(root, 'styles.css'), '.proof{display:block}')
  writeFileSync(join(root, 'review.js'), 'window.REVIEW=true')
  writeFileSync(join(root, 'deep-editor.js'), 'window.DEEP=true')
  writeFileSync(join(root, 'index.html'), '<!doctype html>')
  writeFileSync(join(component, 'README.md'), '# Proof')
  writeFileSync(join(component, 'component.json'), JSON.stringify({ schema: 'sanverse.visual-component-prototype/v1', canonicalId: 'sanverse.ingest-proof', workingName: 'Proof', ownerApproval: options.approved !== false, visualLock: options.approved !== false, semanticParts: ['proof.root'], motion: { exactTickAuthority: true, ticksPerSecond: 1440000, directSeekSafeByConstruction: true }, source: { runtime: '../../components.js', renderer: 'renderProof' } }))
  writeFileSync(join(component, 'review', 'approval.json'), JSON.stringify({ componentId: 'sanverse.ingest-proof', componentVersion: 1, status: options.approved === false ? 'draft' : 'owner-approved', visualLock: options.approved !== false, approvedBy: 'owner', approvedAt: '2026-08-14' }))
  return { root, component }
}

describe('Component Ingest V1', () => {
  it('classifies deterministic CH1-shaped visual prototypes as foreign lossless-normalization candidates', () => {
    const fixture = createPackage()
    const report = inspectApprovedComponentPackage(fixture.component)
    expect(report.sourceKind).toBe('foreign')
    expect(report.lane).toBe('foreign')
    expect(report.foreignDecision).toBe('lossless-normalization')
    expect(report.visualApproval).toBe('passed')
    expect(report.determinism).toBe('passed')
    expect(report.directSeek).toBe('passed')
    expect(report.readyForIntake).toBe(true)
  })

  it('fails closed for an unapproved visual or a runtime with random render authority', () => {
    const unapproved = inspectApprovedComponentPackage(createPackage({ approved: false }).component)
    expect(unapproved.readyForIntake).toBe(false)
    expect(unapproved.issues.some((issue) => issue.code.includes('APPROVAL') || issue.code.includes('VISUAL_LOCK'))).toBe(true)
    const random = inspectApprovedComponentPackage(createPackage({ random: true }).component)
    expect(random.readyForIntake).toBe(false)
    expect(random.issues.some((issue) => issue.code === 'NON_DETERMINISTIC_RENDER_AUTHORITY')).toBe(true)
  })

  it('creates an immutable source-hashed intake snapshot without copying media', () => {
    const fixture = createPackage()
    const report = inspectApprovedComponentPackage(fixture.component)
    const repo = mkdtempSync(join(tmpdir(), 'sanverse-repo-'))
    const first = createImmutableIntakeSnapshot(report, repo, 'test-agent')
    const second = createImmutableIntakeSnapshot(report, repo, 'test-agent')
    expect(first.snapshot.approvedSourceHash).toBe(second.snapshot.approvedSourceHash)
    expect(first.snapshot.files.some((file) => file.logicalPath === 'shared/components.js')).toBe(true)
    expect(first.integrationRecord.visualParityStatus).toBe('pending')
    expect(first.integrationRecord.libraryStatus).toBe('not-registered')
    const snapshot = JSON.parse(readFileSync(join(first.intakeRoot, 'original', 'snapshot.json'), 'utf8'))
    expect(snapshot.excludedFromSnapshot).toContain('third-party reference video')
  })

  it('keeps registration atomic and only generates public registry code after every gate including owner parity passes', () => {
    const repo = mkdtempSync(join(tmpdir(), 'sanverse-registration-'))
    mkdirSync(join(repo, 'packages', 'motion-library', 'src', 'ingested'), { recursive: true })
    const descriptor = { componentId:'sanverse.ingest-proof', componentVersion:1, moduleImportPath:'./ingest-proof.tsx', moduleExportName:'IngestProofModule', definitionExportName:'INGEST_PROOF_DEFINITION' } as const
    const record = { schemaVersion:'sanverse.component-ingest/v1', componentId:'sanverse.ingest-proof', componentVersion:1, visualAuthoringSource:'external-agent', sourceEnvironment:'test', approvedAt:'2026-08-14', sourceKind:'foreign', approvedSourceHash:'source', manifestHash:'manifest', approvalHash:'approval', runtimeSourceHash:'runtime', canonicalVideoHash:'video', integrationStrategy:'foreign-adapter', canonicalGraphId:'sanverse.ingest-proof', visualParityStatus:'passed', productizationStatus:'ready', determinismStatus:'passed', directSeekStatus:'passed', semanticMappingStatus:'passed', c3Status:'passed', c4Status:'passed', c5Status:'passed', c6Status:'not-yet-available', aiEditabilityStatus:'passed', libraryStatus:'not-registered', blockingReasons:[] } as const
    const parity = { schemaVersion:'sanverse.component-parity/v1', componentId:'sanverse.ingest-proof', componentVersion:1, approvedSourceHash:'source', canonicalVideoHash:'video', integratedVideoHash:'integrated', checkpointCount:7, temporalEventsVerified:true, status:'passed', reviewer:'owner', notes:[] } as const
    const productization = { componentId:'sanverse.ingest-proof', componentVersion:1, status:'ready', determinism:'passed', directSeek:'passed', semanticMapping:'passed', c3:'passed', c4:'passed', c5:'passed', c6:'not-yet-available', aiEditability:'passed', ratios:{'16:9':'passed','9:16':'passed','1:1':'passed','4:5':'passed'}, semanticNodeCount:3, exposureCount:3, editableCurveTrackCount:1, blockingReasons:[] } as const
    expect(() => registerProductizedComponent(repo, { ...descriptor, moduleImportPath:'../../escape.tsx' }, record, parity, productization)).toThrow('REGISTRATION_MODULE_IMPORT_INVALID')
    const ledger = registerProductizedComponent(repo, descriptor, record, parity, productization)
    expect(ledger.components).toHaveLength(1)
    const generated = readFileSync(join(repo, 'packages', 'motion-library', 'src', 'ingested', 'registry.generated.ts'), 'utf8')
    expect(generated).toContain("from './ingest-proof.tsx'")
    expect(generated).toContain('IngestProofModule.definition.id')
  })
})
