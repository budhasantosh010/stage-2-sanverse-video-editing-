export const COMPONENT_INGEST_SCHEMA_VERSION = 'sanverse.component-ingest/v1' as const
export const COMPONENT_SNAPSHOT_SCHEMA_VERSION = 'sanverse.component-intake-snapshot/v1' as const
export const COMPONENT_PARITY_SCHEMA_VERSION = 'sanverse.component-parity/v1' as const

export const SANVERSE_COMPONENT_SOURCE_KINDS = Object.freeze(['sdk-native','sdk-custom','procedural','shader','hybrid','foreign'] as const)
export type SanverseComponentSourceKindV1 = (typeof SANVERSE_COMPONENT_SOURCE_KINDS)[number]

export const SANVERSE_INTEGRATION_STRATEGIES = Object.freeze(['materialized','expert-wrapper','hybrid','foreign-adapter'] as const)
export type SanverseIntegrationStrategyV1 = (typeof SANVERSE_INTEGRATION_STRATEGIES)[number]
export type SanverseIntegrationLaneV1 = 'native' | 'expert' | 'foreign'
export type SanverseForeignDecisionV1 = 'lossless-normalization' | 'expert-wrapper' | 'source-adaptation' | 'incompatible' | 'not-applicable'
export type SanverseGateStatusV1 = 'pending' | 'passed' | 'failed'
export type SanverseProductizationStatusV1 = 'pending' | 'ready' | 'blocked'

export interface ApprovedVisualComponentManifestV1 {
  readonly schema: string
  readonly canonicalId: `sanverse.${string}`
  readonly workingName: string
  readonly order?: number
  readonly status?: string
  readonly ownerApproval: boolean
  readonly visualLock: boolean
  readonly approvedAt?: string
  readonly purpose?: string
  readonly canonicalRatio?: string
  readonly supportedRatios?: readonly string[]
  readonly semanticParts?: readonly string[]
  readonly customization?: Readonly<Record<string, unknown>>
  readonly motion?: Readonly<{
    exactTickAuthority?: boolean
    ticksPerSecond?: number
    directSeekSafeByConstruction?: boolean
    reducedMotion?: boolean
  }>
  readonly source?: Readonly<{
    runtime?: string
    renderer?: string
    viewer?: string
  }>
}

export interface VisualApprovalRecordV1 {
  readonly componentId: `sanverse.${string}`
  readonly componentVersion: number
  readonly status: 'owner-approved'
  readonly visualLock: true
  readonly approvedBy: string
  readonly approvedAt: string
  readonly notes?: readonly string[]
}

export interface ComponentDependencyRecordV1 {
  readonly name: string
  readonly version: string
  readonly purpose: 'runtime' | 'development' | 'peer' | 'optional'
  readonly license: string | null
  readonly existingSanverseReplacement: 'unknown' | 'none-needed' | 'possible-lossless' | 'not-lossless'
}

export interface ComponentInspectionIssueV1 {
  readonly code: string
  readonly severity: 'error' | 'warning'
  readonly message: string
}

export interface ComponentInspectionReportV1 {
  readonly schemaVersion: typeof COMPONENT_INGEST_SCHEMA_VERSION
  readonly componentPath: string
  readonly visualWorkspaceRoot: string
  readonly componentId: `sanverse.${string}`
  readonly componentVersion: number
  readonly componentName: string
  readonly sourceKind: SanverseComponentSourceKindV1
  readonly lane: SanverseIntegrationLaneV1
  readonly foreignDecision: SanverseForeignDecisionV1
  readonly recommendedStrategy: SanverseIntegrationStrategyV1
  readonly visualApproval: SanverseGateStatusV1
  readonly determinism: SanverseGateStatusV1
  readonly directSeek: SanverseGateStatusV1
  readonly canonicalTickAuthority: SanverseGateStatusV1
  readonly manifestPath: string
  readonly approvalPath: string
  readonly runtimePath: string | null
  readonly rendererName: string | null
  readonly dependencies: readonly ComponentDependencyRecordV1[]
  readonly semanticParts: readonly string[]
  readonly snapshotSourceFiles: readonly string[]
  readonly issues: readonly ComponentInspectionIssueV1[]
  readonly readyForIntake: boolean
}

export interface ComponentSourceFileHashV1 {
  readonly logicalPath: string
  readonly sha256: string
  readonly bytes: number
}

export interface ComponentIntakeSnapshotV1 {
  readonly schemaVersion: typeof COMPONENT_SNAPSHOT_SCHEMA_VERSION
  readonly componentId: `sanverse.${string}`
  readonly componentVersion: number
  readonly approvedSourceHash: string
  readonly manifestHash: string
  readonly approvalHash: string
  readonly runtimeSourceHash: string | null
  readonly files: readonly ComponentSourceFileHashV1[]
  readonly excludedFromSnapshot: readonly string[]
}

export interface MotionComponentIntegrationRecordV1 {
  readonly schemaVersion: typeof COMPONENT_INGEST_SCHEMA_VERSION
  readonly componentId: `sanverse.${string}`
  readonly componentVersion: number
  readonly visualAuthoringSource: 'external-agent' | 'internal'
  readonly sourceEnvironment: string
  readonly approvedAt: string
  readonly sourceKind: SanverseComponentSourceKindV1
  readonly approvedSourceHash: string
  readonly manifestHash: string
  readonly approvalHash: string
  readonly runtimeSourceHash: string | null
  readonly canonicalVideoHash: string | null
  readonly integrationStrategy: SanverseIntegrationStrategyV1
  readonly canonicalGraphId: string
  readonly visualParityStatus: SanverseGateStatusV1
  readonly productizationStatus: SanverseProductizationStatusV1
  readonly determinismStatus: SanverseGateStatusV1
  readonly directSeekStatus: SanverseGateStatusV1
  readonly semanticMappingStatus: SanverseGateStatusV1
  readonly c3Status: SanverseGateStatusV1
  readonly c4Status: SanverseGateStatusV1
  readonly c5Status: SanverseGateStatusV1
  readonly c6Status: 'not-yet-available' | SanverseGateStatusV1
  readonly aiEditabilityStatus: SanverseGateStatusV1
  readonly libraryStatus: 'not-registered' | 'registered'
  readonly blockingReasons: readonly string[]
}

export interface ComponentParityRecordV1 {
  readonly schemaVersion: typeof COMPONENT_PARITY_SCHEMA_VERSION
  readonly componentId: `sanverse.${string}`
  readonly componentVersion: number
  readonly approvedSourceHash: string
  readonly canonicalVideoHash: string | null
  readonly integratedVideoHash: string | null
  readonly checkpointCount: number
  readonly temporalEventsVerified: boolean
  readonly status: SanverseGateStatusV1
  readonly reviewer: 'owner' | 'engineering-evidence'
  readonly notes: readonly string[]
}

export interface ComponentRegistrationDescriptorV1 {
  readonly componentId: `sanverse.${string}`
  readonly componentVersion: number
  readonly moduleImportPath: string
  readonly moduleExportName: string
  readonly definitionExportName: string
}
