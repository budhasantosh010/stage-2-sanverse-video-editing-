import { readFileSync, existsSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import type { ApprovedVisualComponentManifestV1, ComponentDependencyRecordV1, ComponentInspectionIssueV1, ComponentInspectionReportV1, SanverseComponentSourceKindV1, SanverseForeignDecisionV1, SanverseIntegrationLaneV1, SanverseIntegrationStrategyV1, VisualApprovalRecordV1 } from './contracts.ts'
import { COMPONENT_INGEST_SCHEMA_VERSION, SANVERSE_COMPONENT_SOURCE_KINDS } from './contracts.ts'

const CANONICAL_TICKS_PER_SECOND = 1_440_000
const forbiddenRendererAuthorities = Object.freeze(['Date.now(', 'performance.now(', 'Math.random(', 'setInterval(', 'setTimeout(', 'requestAnimationFrame('])
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const parseJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8')) as unknown
const isInside = (candidate: string, root: string): boolean => {
  const relation = relative(resolve(root), resolve(candidate))
  return relation === '' || (!relation.startsWith('..') && !isAbsolute(relation))
}

const parseManifest = (path: string, issues: ComponentInspectionIssueV1[]): ApprovedVisualComponentManifestV1 | null => {
  let raw: unknown
  try { raw = parseJson(path) } catch (error) { issues.push({ code: 'MANIFEST_INVALID_JSON', severity: 'error', message: error instanceof Error ? error.message : 'Manifest JSON could not be read.' }); return null }
  if (!isRecord(raw)) { issues.push({ code: 'MANIFEST_TYPE_INVALID', severity: 'error', message: 'component.json must contain an object.' }); return null }
  if (typeof raw.canonicalId !== 'string' || !raw.canonicalId.startsWith('sanverse.')) issues.push({ code: 'COMPONENT_ID_INVALID', severity: 'error', message: 'canonicalId must be a sanverse.* component ID.' })
  if (typeof raw.workingName !== 'string' || !raw.workingName.trim()) issues.push({ code: 'COMPONENT_NAME_INVALID', severity: 'error', message: 'workingName must be a non-empty string.' })
  if (raw.ownerApproval !== true) issues.push({ code: 'OWNER_APPROVAL_MISSING', severity: 'error', message: 'component.json must record ownerApproval=true.' })
  if (raw.visualLock !== true) issues.push({ code: 'VISUAL_LOCK_MISSING', severity: 'error', message: 'component.json must record visualLock=true.' })
  return raw as unknown as ApprovedVisualComponentManifestV1
}

const parseApproval = (path: string, issues: ComponentInspectionIssueV1[]): VisualApprovalRecordV1 | null => {
  let raw: unknown
  try { raw = parseJson(path) } catch (error) { issues.push({ code: 'APPROVAL_INVALID_JSON', severity: 'error', message: error instanceof Error ? error.message : 'Approval JSON could not be read.' }); return null }
  if (!isRecord(raw)) { issues.push({ code: 'APPROVAL_TYPE_INVALID', severity: 'error', message: 'approval.json must contain an object.' }); return null }
  if (raw.status !== 'owner-approved') issues.push({ code: 'APPROVAL_STATUS_INVALID', severity: 'error', message: 'approval.json status must be owner-approved.' })
  if (raw.visualLock !== true) issues.push({ code: 'APPROVAL_VISUAL_LOCK_MISSING', severity: 'error', message: 'approval.json visualLock must be true.' })
  if (typeof raw.componentVersion !== 'number' || !Number.isSafeInteger(raw.componentVersion) || raw.componentVersion < 1) issues.push({ code: 'COMPONENT_VERSION_INVALID', severity: 'error', message: 'approval.json componentVersion must be a positive integer.' })
  return raw as unknown as VisualApprovalRecordV1
}

const sourceClassification = (manifest: ApprovedVisualComponentManifestV1): Readonly<{ sourceKind: SanverseComponentSourceKindV1; lane: SanverseIntegrationLaneV1; decision: SanverseForeignDecisionV1; strategy: SanverseIntegrationStrategyV1 }> => {
  const manifestKind = (manifest as unknown as { sourceKind?: unknown }).sourceKind
  const sourceKind: SanverseComponentSourceKindV1 = manifest.schema.startsWith('sanverse.visual-component-prototype/')
    ? 'foreign'
    : typeof manifestKind === 'string' && SANVERSE_COMPONENT_SOURCE_KINDS.includes(manifestKind as SanverseComponentSourceKindV1)
      ? manifestKind as SanverseComponentSourceKindV1
      : 'foreign'
  if (sourceKind === 'sdk-native') return { sourceKind, lane: 'native', decision: 'not-applicable', strategy: 'materialized' }
  if (sourceKind === 'sdk-custom' || sourceKind === 'procedural' || sourceKind === 'shader') return { sourceKind, lane: 'expert', decision: 'expert-wrapper', strategy: 'expert-wrapper' }
  if (sourceKind === 'hybrid') return { sourceKind, lane: 'expert', decision: 'expert-wrapper', strategy: 'hybrid' }
  const deterministic = manifest.motion?.exactTickAuthority === true && manifest.motion?.directSeekSafeByConstruction === true && manifest.motion?.ticksPerSecond === CANONICAL_TICKS_PER_SECOND
  return { sourceKind, lane: 'foreign', decision: deterministic ? 'lossless-normalization' : 'source-adaptation', strategy: 'foreign-adapter' }
}

const locateVisualWorkspaceRoot = (componentPath: string): string => {
  const parent = dirname(componentPath)
  return basename(parent).toLocaleLowerCase('en-US') === 'components' ? dirname(parent) : parent
}

const dependencyRecords = (visualRoot: string): readonly ComponentDependencyRecordV1[] => {
  const packagePath = join(visualRoot, 'package.json')
  if (!existsSync(packagePath)) return Object.freeze([])
  const raw = parseJson(packagePath)
  if (!isRecord(raw)) return Object.freeze([])
  const groups = [['dependencies','runtime'],['devDependencies','development'],['peerDependencies','peer'],['optionalDependencies','optional']] as const
  const output: ComponentDependencyRecordV1[] = []
  for (const [field, purpose] of groups) {
    const group = raw[field]
    if (!isRecord(group)) continue
    for (const [name, version] of Object.entries(group)) if (typeof version === 'string') output.push(Object.freeze({ name, version, purpose, license: null, existingSanverseReplacement: 'unknown' as const }))
  }
  return Object.freeze(output.sort((a,b) => a.name.localeCompare(b.name)))
}

export interface InspectApprovedComponentOptionsV1 {
  readonly knownPublicComponentIds?: ReadonlySet<string>
}

export const inspectApprovedComponentPackage = (componentPathInput: string, options: InspectApprovedComponentOptionsV1 = {}): ComponentInspectionReportV1 => {
  const componentPath = resolve(componentPathInput)
  const visualWorkspaceRoot = locateVisualWorkspaceRoot(componentPath)
  const issues: ComponentInspectionIssueV1[] = []
  const manifestPath = join(componentPath, 'component.json')
  const approvalCandidates = [join(componentPath, 'approval.json'), join(componentPath, 'review', 'approval.json')]
  const approvalPath = approvalCandidates.find((path) => existsSync(path)) ?? approvalCandidates[1]!
  if (!existsSync(manifestPath)) issues.push({ code: 'MANIFEST_MISSING', severity: 'error', message: 'component.json is required.' })
  if (!existsSync(approvalPath)) issues.push({ code: 'APPROVAL_MISSING', severity: 'error', message: 'approval.json is required either at component root or review/approval.json.' })
  const manifest = existsSync(manifestPath) ? parseManifest(manifestPath, issues) : null
  const approval = existsSync(approvalPath) ? parseApproval(approvalPath, issues) : null
  const componentId = manifest?.canonicalId ?? 'sanverse.invalid'
  if (approval && approval.componentId !== componentId) issues.push({ code: 'APPROVAL_COMPONENT_MISMATCH', severity: 'error', message: `approval.json names ${approval.componentId} but manifest names ${componentId}.` })
  if (options.knownPublicComponentIds?.has(componentId)) issues.push({ code: 'DUPLICATE_PUBLIC_COMPONENT_ID', severity: 'error', message: `${componentId} already exists in the public Motion registry.` })
  const classification = manifest ? sourceClassification(manifest) : { sourceKind: 'foreign' as const, lane: 'foreign' as const, decision: 'source-adaptation' as const, strategy: 'foreign-adapter' as const }
  let runtimePath: string | null = null
  if (manifest?.source?.runtime) {
    runtimePath = resolve(componentPath, manifest.source.runtime)
    if (!isInside(runtimePath, visualWorkspaceRoot)) issues.push({ code: 'RUNTIME_PATH_ESCAPES_WORKSPACE', severity: 'error', message: 'Manifest runtime path escapes the external visual workspace.' })
    else if (!existsSync(runtimePath)) issues.push({ code: 'RUNTIME_MISSING', severity: 'error', message: `Referenced runtime does not exist: ${manifest.source.runtime}` })
  }
  if (runtimePath && existsSync(runtimePath)) {
    const runtime = readFileSync(runtimePath, 'utf8')
    for (const token of forbiddenRendererAuthorities) if (runtime.includes(token)) issues.push({ code: 'NON_DETERMINISTIC_RENDER_AUTHORITY', severity: 'error', message: `Visual runtime contains forbidden render authority ${token}` })
  }
  const canonicalTickAuthority = manifest?.motion?.ticksPerSecond === CANONICAL_TICKS_PER_SECOND ? 'passed' as const : 'failed' as const
  const determinism = manifest?.motion?.exactTickAuthority === true && !issues.some((issue) => issue.code === 'NON_DETERMINISTIC_RENDER_AUTHORITY') ? 'passed' as const : 'failed' as const
  const directSeek = manifest?.motion?.directSeekSafeByConstruction === true ? 'passed' as const : 'failed' as const
  if (canonicalTickAuthority === 'failed') issues.push({ code: 'TICK_AUTHORITY_INVALID', severity: 'error', message: `Component must use ${CANONICAL_TICKS_PER_SECOND} ticks/second.` })
  if (determinism === 'failed' && !issues.some((issue) => issue.code === 'NON_DETERMINISTIC_RENDER_AUTHORITY')) issues.push({ code: 'DETERMINISM_UNPROVEN', severity: 'error', message: 'Manifest does not prove exact-tick render authority.' })
  if (directSeek === 'failed') issues.push({ code: 'DIRECT_SEEK_UNPROVEN', severity: 'error', message: 'Manifest does not prove direct-seek safety.' })
  const visualApproval = manifest?.ownerApproval === true && manifest.visualLock === true && approval?.status === 'owner-approved' && approval.visualLock === true ? 'passed' as const : 'failed' as const
  const snapshotFiles = [manifestPath, approvalPath, join(componentPath, 'README.md'), runtimePath, join(visualWorkspaceRoot, 'styles.css'), join(visualWorkspaceRoot, 'review.js'), join(visualWorkspaceRoot, 'deep-editor.js'), join(visualWorkspaceRoot, 'index.html')].filter((value): value is string => Boolean(value && existsSync(value)))
  return Object.freeze({
    schemaVersion: COMPONENT_INGEST_SCHEMA_VERSION,
    componentPath,
    visualWorkspaceRoot,
    componentId,
    componentVersion: approval?.componentVersion ?? 1,
    componentName: manifest?.workingName ?? componentId,
    sourceKind: classification.sourceKind,
    lane: classification.lane,
    foreignDecision: classification.decision,
    recommendedStrategy: classification.strategy,
    visualApproval,
    determinism,
    directSeek,
    canonicalTickAuthority,
    manifestPath,
    approvalPath,
    runtimePath,
    rendererName: manifest?.source?.renderer ?? null,
    dependencies: dependencyRecords(visualWorkspaceRoot),
    semanticParts: Object.freeze([...(manifest?.semanticParts ?? [])]),
    snapshotSourceFiles: Object.freeze(snapshotFiles),
    issues: Object.freeze(issues),
    readyForIntake: visualApproval === 'passed' && determinism === 'passed' && directSeek === 'passed' && canonicalTickAuthority === 'passed' && !issues.some((issue) => issue.severity === 'error'),
  })
}
