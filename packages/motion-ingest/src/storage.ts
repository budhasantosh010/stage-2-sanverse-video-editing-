import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { basename, join, relative, resolve } from 'node:path'
import type { ComponentInspectionReportV1, ComponentIntakeSnapshotV1, ComponentSourceFileHashV1, MotionComponentIntegrationRecordV1 } from './contracts.ts'
import { COMPONENT_INGEST_SCHEMA_VERSION, COMPONENT_SNAPSHOT_SCHEMA_VERSION } from './contracts.ts'

const sha256 = (buffer: Buffer | string): string => createHash('sha256').update(buffer).digest('hex')
export const sha256File = (path: string): string => sha256(readFileSync(path))
const stablePackageHash = (files: readonly ComponentSourceFileHashV1[]): string => sha256(files.map((file) => `${file.logicalPath}\0${file.sha256}\0${file.bytes}`).sort().join('\n'))
const safeId = (componentId: string): string => componentId.replace(/[^a-z0-9._-]+/giu, '_')

const logicalPathFor = (inspection: ComponentInspectionReportV1, sourcePath: string): string => {
  if (sourcePath === inspection.manifestPath) return 'component/component.json'
  if (sourcePath === inspection.approvalPath) return 'component/review/approval.json'
  if (sourcePath.startsWith(inspection.componentPath)) return `component/${relative(inspection.componentPath, sourcePath).replaceAll('\\','/')}`
  return `shared/${relative(inspection.visualWorkspaceRoot, sourcePath).replaceAll('\\','/')}`
}

export interface CreateSnapshotResultV1 {
  readonly intakeRoot: string
  readonly snapshot: ComponentIntakeSnapshotV1
  readonly integrationRecord: MotionComponentIntegrationRecordV1
}

export const createImmutableIntakeSnapshot = (inspection: ComponentInspectionReportV1, repositoryRoot: string, sourceEnvironment = 'external-agent'): CreateSnapshotResultV1 => {
  if (!inspection.readyForIntake) throw new Error(`INGEST_BLOCKED: ${inspection.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.code).join(', ') || 'approval/determinism gate failed'}`)
  const intakeRoot = join(resolve(repositoryRoot), 'motion', 'component-intake', safeId(inspection.componentId))
  const originalRoot = join(intakeRoot, 'original')
  const reportsRoot = join(intakeRoot, 'reports')
  mkdirSync(originalRoot, { recursive: true })
  mkdirSync(reportsRoot, { recursive: true })
  const copied: ComponentSourceFileHashV1[] = []
  for (const sourcePath of inspection.snapshotSourceFiles) {
    const logicalPath = logicalPathFor(inspection, sourcePath)
    const destination = join(originalRoot, ...logicalPath.split('/'))
    mkdirSync(join(destination, '..'), { recursive: true })
    const hash = sha256File(sourcePath)
    if (existsSync(destination)) {
      if (sha256File(destination) !== hash) throw new Error(`IMMUTABLE_SNAPSHOT_CONFLICT: ${logicalPath} already exists with different bytes.`)
    } else {
      copyFileSync(sourcePath, destination)
      try { chmodSync(destination, 0o444) } catch { /* Windows read-only semantics are also protected by hashes below. */ }
    }
    copied.push(Object.freeze({ logicalPath, sha256: hash, bytes: readFileSync(sourcePath).byteLength }))
  }
  const sorted = Object.freeze(copied.sort((a,b) => a.logicalPath.localeCompare(b.logicalPath)))
  const findHash = (logicalPath: string): string => sorted.find((file) => file.logicalPath === logicalPath)?.sha256 ?? ''
  const runtimeLogical = inspection.runtimePath ? logicalPathFor(inspection, inspection.runtimePath) : null
  const snapshot: ComponentIntakeSnapshotV1 = Object.freeze({
    schemaVersion: COMPONENT_SNAPSHOT_SCHEMA_VERSION,
    componentId: inspection.componentId,
    componentVersion: inspection.componentVersion,
    approvedSourceHash: stablePackageHash(sorted),
    manifestHash: findHash('component/component.json'),
    approvalHash: findHash('component/review/approval.json') || findHash('component/approval.json'),
    runtimeSourceHash: runtimeLogical ? findHash(runtimeLogical) || null : null,
    files: sorted,
    excludedFromSnapshot: Object.freeze(['third-party reference video', 'reference frame extraction', 'temporary browser/render artifacts']),
  })
  const snapshotPath = join(originalRoot, 'snapshot.json')
  const snapshotJson = `${JSON.stringify(snapshot, null, 2)}\n`
  if (existsSync(snapshotPath) && readFileSync(snapshotPath, 'utf8') !== snapshotJson) throw new Error('IMMUTABLE_SNAPSHOT_CONFLICT: snapshot.json differs from the existing approved intake snapshot.')
  if (!existsSync(snapshotPath)) writeFileSync(snapshotPath, snapshotJson, 'utf8')
  const integrationRecord: MotionComponentIntegrationRecordV1 = Object.freeze({
    schemaVersion: COMPONENT_INGEST_SCHEMA_VERSION,
    componentId: inspection.componentId,
    componentVersion: inspection.componentVersion,
    visualAuthoringSource: 'external-agent',
    sourceEnvironment,
    approvedAt: JSON.parse(readFileSync(inspection.approvalPath, 'utf8')).approvedAt as string,
    sourceKind: inspection.sourceKind,
    approvedSourceHash: snapshot.approvedSourceHash,
    manifestHash: snapshot.manifestHash,
    approvalHash: snapshot.approvalHash,
    runtimeSourceHash: snapshot.runtimeSourceHash,
    canonicalVideoHash: null,
    integrationStrategy: inspection.recommendedStrategy,
    canonicalGraphId: inspection.componentId,
    visualParityStatus: 'pending',
    productizationStatus: 'pending',
    determinismStatus: inspection.determinism,
    directSeekStatus: inspection.directSeek,
    semanticMappingStatus: 'pending',
    c3Status: 'pending',
    c4Status: 'pending',
    c5Status: 'pending',
    c6Status: 'not-yet-available',
    aiEditabilityStatus: 'pending',
    libraryStatus: 'not-registered',
    blockingReasons: Object.freeze(['CANONICAL_GOLDEN_VIDEO_REQUIRED', 'PRODUCTIZATION_REQUIRED', 'VISUAL_PARITY_REQUIRED', 'OWNER_INTEGRATED_PARITY_APPROVAL_REQUIRED']),
  })
  const inspectionPath = join(reportsRoot, 'inspection.json')
  writeFileSync(inspectionPath, `${JSON.stringify({ ...inspection, componentPath: basename(inspection.componentPath), visualWorkspaceRoot: basename(inspection.visualWorkspaceRoot), manifestPath: 'original/component/component.json', approvalPath: 'original/component/review/approval.json', runtimePath: runtimeLogical ? `original/${runtimeLogical}` : null }, null, 2)}\n`, 'utf8')
  const recordPath = join(reportsRoot, 'integration-record.json')
  if (!existsSync(recordPath)) writeFileSync(recordPath, `${JSON.stringify(integrationRecord, null, 2)}\n`, 'utf8')
  return Object.freeze({ intakeRoot, snapshot, integrationRecord })
}

export const readIntegrationRecord = (repositoryRoot: string, componentId: string): MotionComponentIntegrationRecordV1 => JSON.parse(readFileSync(join(resolve(repositoryRoot), 'motion', 'component-intake', safeId(componentId), 'reports', 'integration-record.json'), 'utf8')) as MotionComponentIntegrationRecordV1

export const writeIntegrationRecord = (repositoryRoot: string, record: MotionComponentIntegrationRecordV1): void => {
  const path = join(resolve(repositoryRoot), 'motion', 'component-intake', safeId(record.componentId), 'reports', 'integration-record.json')
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
}
