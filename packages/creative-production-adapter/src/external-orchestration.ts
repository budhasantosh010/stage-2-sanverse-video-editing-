import { createCreativeProductionExternalSessionV1, type CreativeProductionExternalSessionV1 } from './external-session.ts'
import { createCreativeProductionToolCatalogV16 } from './production-tools.ts'
import { createSanverseToolRegistryV1, type SanverseToolDefinitionV1, type SanverseToolRegistryV1, type SanverseToolSummaryV1, type ToolExecutionContextV1 } from '@sanverse/motion-agent-tools'
import { creativeOperationOk, creativeOperationRefusal, creativeValidationOk, type CreativeOperationResultV1, type CreativeValidationResultV1 } from '@sanverse/motion-contract'
import { CREATIVE_SCENE_PRIMITIVE_ID, emptyExtensions, type ChangeSet, type EditProject } from '@sanverse/edit-domain'
import type { MotionOpportunityV1 } from '@sanverse/creative-direction'
import { PROJECT_TIMESCALE, mediaTime } from '@sanverse/edit-domain/time'
import type { OwnerApprovalV1 } from '@sanverse/motion-storyboard'
import {
  DeterministicTranscriptSemanticAnalyzer,
  analyzeVideoUnderstanding,
  parseSrtOrVttTranscript,
  type AnalysisProvenanceRefV1,
  type TranscriptSegmentV1,
} from '@sanverse/video-understanding'
import { planMotionOpportunitiesV1, type MotionOpportunityMapV1 } from './opportunity-planner.ts'
import { createCreativeSceneBatchV1, type CreativeSceneBatchV1, type HostApprovalRequestV1 } from './multi-scene-workflow.ts'
import { buildCreativeSceneArtifactV1, canonicalCreativeArtifactJsonV1, validateCreativeSceneArtifactV1, type CreativeSceneArtifactV1 } from './creative-artifact.ts'
import {
  CREATIVE_REVIEW_SCHEMA_V1,
  CREATIVE_RUN_SCHEMA_V1,
  summarizeCreativeRunV1,
  validateCreativeRunV1,
  type CreativeReviewScopeV1,
  type CreativeReviewV1,
  type CreativeRunV1,
} from './creative-run.ts'

export const EXTERNAL_ORCHESTRATION_SCHEMA_V1 = 'sanverse.external-orchestration/v1' as const
export const SOURCE_TRANSCRIPT_SCHEMA_V1 = 'sanverse.source-transcript/v1' as const
export const SOURCE_UNDERSTANDING_PACKET_SCHEMA_V1 = 'sanverse.source-understanding-packet/v1' as const

export interface ExternalProjectSummaryV1 {
  readonly id: string
  readonly originalFilename?: string
  readonly createdAt?: string
}

export interface ExternalImportSourceResultV1 {
  readonly project: EditProject
  readonly sourceSha256: string
  readonly originalFilename: string
}

export interface ExternalCreativeArtifactRefV1 {
  readonly artifactId: string
  readonly sha256: string
  readonly byteLength: number
}

export interface ExternalProductionExportJobV1 {
  readonly jobId: string
  readonly projectId: string
  readonly projectRevision: number
  readonly exportId: string
  readonly status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  readonly progress: number
  readonly phase?: 'queued' | 'rendering' | 'verifying' | 'done'
  readonly result?: Readonly<{
    readonly id: string
    readonly mediaUrl: string
    readonly sha256: string
    readonly width: number
    readonly height: number
    readonly durationMs: number
    readonly hasAudio: boolean
    readonly projectRevision: number
  }>
  readonly error?: Readonly<{ code: string; message: string }>
}

export interface ExternalWorkspaceInputV1 {
  readonly relativePath: string
  readonly kind: 'video' | 'transcript' | 'image'
  readonly byteLength: number
}

export interface ExternalWorkspaceTextFileV1 {
  readonly relativePath: string
  readonly format: 'plain' | 'srt' | 'vtt'
  readonly contents: string
}

export interface ExternalProductionApiPortV1 {
  readonly listProjects: () => Promise<readonly ExternalProjectSummaryV1[]>
  readonly readProject: (projectId: string) => Promise<EditProject>
  readonly importSourceVideo: (input: Readonly<{ localPath: string; projectLabel?: string; transactionId: string }>) => Promise<ExternalImportSourceResultV1>
  readonly listWorkspaceInputs?: () => Promise<readonly ExternalWorkspaceInputV1[]>
  readonly readWorkspaceTextFile?: (input: Readonly<{ localPath: string }>) => Promise<ExternalWorkspaceTextFileV1>
  readonly listCreativeRuns?: (projectId: string) => Promise<readonly CreativeRunV1[]>
  readonly readCreativeRun?: (input: Readonly<{ projectId: string; runId: string }>) => Promise<CreativeRunV1 | null>
  readonly writeCreativeRun?: (run: CreativeRunV1) => Promise<void>
  readonly readReviewArtifactBytes?: (input: Readonly<{ projectId: string; runId: string; reviewId: string; artifactId: string }>) => Promise<Uint8Array>
  readonly materializeReviewEvidence?: (input: Readonly<{ run: CreativeRunV1; review: CreativeReviewV1; batch: CreativeSceneBatchV1 }>) => Promise<CreativeReviewV1>
  /** Host-only approval issuance. This callback is never exposed as an MCP tool or JSON field. */
  readonly issueOwnerApprovalRef?: (request: HostApprovalRequestV1) => Promise<Readonly<{ approvalRef: string }>>
  readonly sha256Text: (text: string) => Promise<string>
  readonly putCreativeArtifact?: (input: Readonly<{ projectId: string; serialized: string }>) => Promise<Readonly<{ ref: ExternalCreativeArtifactRefV1; artifact: unknown }>>
  readonly readCreativeArtifact?: (input: Readonly<{ projectId: string; artifactId: string }>) => Promise<Readonly<{ ref: ExternalCreativeArtifactRefV1; artifact: unknown }>>
  readonly acceptChangeSet?: (input: Readonly<{ projectId: string; changeSet: ChangeSet }>) => Promise<EditProject>
  readonly undoProject?: (projectId: string) => Promise<EditProject>
  readonly redoProject?: (projectId: string) => Promise<EditProject>
  readonly createExport?: (projectId: string) => Promise<ExternalProductionExportJobV1>
  readonly readExportJob?: (input: Readonly<{ projectId: string; jobId: string }>) => Promise<ExternalProductionExportJobV1>
  readonly cancelExportJob?: (input: Readonly<{ projectId: string; jobId: string }>) => Promise<ExternalProductionExportJobV1>
  readonly resolveOwnerApprovalRef?: (input: Readonly<{ approvalRef: string; request: HostApprovalRequestV1 }>) => Promise<OwnerApprovalV1 | null>
}

export interface SourceTranscriptCueV1 {
  readonly id: string
  readonly startTick: number
  readonly endTick: number
  readonly text: string
}

export interface SourceTranscriptV1 {
  readonly schemaVersion: typeof SOURCE_TRANSCRIPT_SCHEMA_V1
  readonly id: string
  readonly projectId: string
  readonly sourceAssetId: string
  readonly sourceRevision: number
  readonly sha256: string
  readonly format: 'plain' | 'srt' | 'vtt'
  readonly analysisOnly: true
  readonly cues: readonly SourceTranscriptCueV1[]
}

export interface SourceUnderstandingSegmentV1 {
  readonly id: string
  readonly startTick: number
  readonly endTick: number
  readonly transcriptCueIds: readonly string[]
  readonly observationIds: readonly string[]
  readonly confidence: number
}

export interface SourceUnderstandingObservationV1 {
  readonly id: string
  readonly kind: 'semantic-moment' | 'speech-present'
  readonly startTick: number
  readonly endTick: number
  readonly confidence: number
  readonly semanticKind?: string
  readonly transcriptCueIds: readonly string[]
}

export interface SourceUnderstandingPacketV1 {
  readonly schemaVersion: typeof SOURCE_UNDERSTANDING_PACKET_SCHEMA_V1
  readonly id: string
  readonly projectId: string
  readonly projectRevision: number
  readonly sourceAssetId: string
  readonly sourceDurationTicks: number
  readonly transcriptRef?: string
  readonly sourceSegments: readonly SourceUnderstandingSegmentV1[]
  readonly observations: readonly SourceUnderstandingObservationV1[]
  readonly capabilities: readonly string[]
  readonly limitations: readonly string[]
  readonly evidenceHash: string
}

export interface CreativeProductionExternalOrchestrationSessionV1 {
  readonly sessionLabel: string
  readonly registry: SanverseToolRegistryV1
  readonly activeProjectId: () => string | null
  readonly getTranscript: (id: string) => SourceTranscriptV1 | null
  readonly getSourceUnderstanding: (id: string) => SourceUnderstandingPacketV1 | null
  readonly getOpportunityMap: (id: string) => MotionOpportunityMapV1 | null
  readonly getSceneBatch: (id: string) => CreativeSceneBatchV1 | null
}

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const boundedText = (value: unknown, max = 4096): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max
const projectIdPattern = /^project_[a-z0-9]{16,64}$/u
const transactionIdPattern = /^[a-z][a-z0-9:_-]{7,127}$/u
const transcriptRefPattern = /^transcript_[a-z0-9]{8,64}$/u
const sourcePacketRefPattern = /^sourcepkt_[a-z0-9]{8,64}$/u
const opportunityMapRefPattern = /^opmap_[a-z0-9]{8,64}$/u
const sceneBatchRefPattern = /^scenebatch_[a-z0-9]{8,64}$/u
const approvalRequestRefPattern = /^approvalreq_[a-z0-9]{8,64}$/u
const approvalRefPattern = /^approvalref_[a-z0-9:_-]{8,160}$/u
const exportJobRefPattern = /^job_[a-z0-9]{16,64}$/u
const runRefPattern = /^run_[a-z0-9]{8,64}$/u
const reviewRefPattern = /^review_[a-z0-9]{8,64}$/u
const tail = (value: string): string => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619) }
  return (hash >>> 0).toString(36).padStart(8, '0').slice(0, 12)
}
const schema = (properties: Record<string, unknown> = {}, required: readonly string[] = []) => Object.freeze({ type: 'object', additionalProperties: false, properties: Object.freeze(properties), required: Object.freeze([...required]) })
const stringSchema = Object.freeze({ type: 'string' })
const emptySchema = schema()
const outputRecordSchema = Object.freeze({ type: 'object', additionalProperties: true })
const passRecord = (input: unknown): CreativeValidationResultV1<Record<string, unknown>> => record(input)
  ? creativeValidationOk(input)
  : ({ ok: false, refusal: Object.freeze({ code: 'INVALID_TOOL_INPUT', message: 'Tool input must be an object.' }) } as CreativeValidationResultV1<Record<string, unknown>>)

function freezeSummary(summary: ExternalProjectSummaryV1): ExternalProjectSummaryV1 {
  return Object.freeze({ id: summary.id, ...(summary.originalFilename ? { originalFilename: summary.originalFilename } : {}), ...(summary.createdAt ? { createdAt: summary.createdAt } : {}) })
}

const projectContext = (project: EditProject) => {
  const source = project.assets.find((asset) => asset.mediaKind === 'video')
  const primaryClip = project.composition.tracks.flatMap((track) => track.clips).find((clip) => source && clip.assetId === source.assetId)
  return Object.freeze({
    projectId: project.projectId,
    revision: project.revision,
    sourceAssetId: source?.assetId ?? null,
    primaryClipId: primaryClip?.clipId ?? null,
    durationTicks: source?.duration.ticks ?? 0,
    width: source?.mediaKind === 'video' ? source.width : 0,
    height: source?.mediaKind === 'video' ? source.height : 0,
    frameRate: source?.mediaKind === 'video' ? source.frameRate : null,
    hasAudio: source?.mediaKind === 'video' ? source.hasAudio : false,
  })
}

function transcriptSegments(transcript: SourceTranscriptV1): readonly TranscriptSegmentV1[] {
  const provenance: AnalysisProvenanceRefV1 = `provenance:${transcript.id}`
  return Object.freeze(transcript.cues.map((cue) => Object.freeze({
    id: cue.id,
    startTicks: cue.startTick,
    endTicks: cue.endTick,
    text: cue.text,
    provenance,
  })))
}

function compositeRegistry(
  projectRegistry: SanverseToolRegistryV1,
  legacyCatalog: SanverseToolRegistryV1,
  getLegacy: () => CreativeProductionExternalSessionV1 | null,
  hasProject: () => boolean,
): SanverseToolRegistryV1 {
  const merge = (): readonly SanverseToolSummaryV1[] => {
    const byId = new Map<string, SanverseToolSummaryV1>()
    for (const item of projectRegistry.list()) byId.set(item.id, item)
    const legacy = getLegacy()?.registry ?? legacyCatalog
    for (const item of legacy.list()) if (!byId.has(item.id)) byId.set(item.id, item)
    return Object.freeze([...byId.values()].sort((a, b) => a.level.localeCompare(b.level) || a.id.localeCompare(b.id)))
  }
  return Object.freeze({
    register: (definition: SanverseToolDefinitionV1) => projectRegistry.register(definition),
    get: (id: string) => projectRegistry.get(id) ?? getLegacy()?.registry.get(id) ?? legacyCatalog.get(id),
    list: merge,
    invoke: async (id: string, input: unknown, context: ToolExecutionContextV1 = Object.freeze({})) => {
      if (projectRegistry.get(id)) return projectRegistry.invoke(id, input, context)
      const legacy = getLegacy()
      if (legacy?.registry.get(id)) return legacy.registry.invoke(id, input, context)
      if (legacyCatalog.get(id)) {
        return hasProject()
          ? creativeOperationRefusal('CREATIVE_CANDIDATE_UNAVAILABLE', 'The selected project cannot form the legacy V1.6 Creative candidate at its current source moment. Use the raw-video orchestration tools or select a compatible project/source moment.')
          : creativeOperationRefusal('PROJECT_REQUIRED', 'Select or import a Sanverse production project before using this project-specific tool.', Object.freeze({ recovery: 'Call production.list_projects, production.select_project, or production.import_source_video.' }))
      }
      return creativeOperationRefusal('TOOL_NOT_FOUND', `Unknown Sanverse tool: ${id}.`)
    },
  })
}

export async function createCreativeProductionExternalOrchestrationSessionV1(options: Readonly<{
  sessionLabel: string
}> & ExternalProductionApiPortV1): Promise<CreativeProductionExternalOrchestrationSessionV1> {
  const projectRegistry = createSanverseToolRegistryV1()
  const legacyCatalog = createCreativeProductionToolCatalogV16()
  let activeId: string | null = null
  let activeRunId: string | null = null
  let legacySession: CreativeProductionExternalSessionV1 | null = null
  const creativeRuns = new Map<string, CreativeRunV1>()
  const transcripts = new Map<string, SourceTranscriptV1>()
  const transcriptTransactions = new Map<string, SourceTranscriptV1>()
  const sourcePackets = new Map<string, SourceUnderstandingPacketV1>()
  const opportunityMaps = new Map<string, MotionOpportunityMapV1>()
  const sceneBatches = new Map<string, CreativeSceneBatchV1>()
  const sceneBatchTransactions = new Map<string, string>()
  const applyTransactions = new Map<string, Readonly<{ batchId: string; changeSetId: string; projectRevision: number; artifactRefs: readonly ExternalCreativeArtifactRefV1[] }>>()
  const importTransactions = new Map<string, ExternalImportSourceResultV1>()

  const currentProject = async (): Promise<EditProject | null> => activeId ? options.readProject(activeId) : null
  const requireProject = async (): Promise<CreativeOperationResultV1<EditProject>> => {
    const project = await currentProject()
    return project
      ? creativeOperationOk(project, project.revision)
      : creativeOperationRefusal('PROJECT_REQUIRED', 'Select or import a Sanverse production project first.', Object.freeze({ recovery: 'Call production.list_projects, production.select_project, or production.import_source_video.' }))
  }
  const activate = async (projectId: string): Promise<EditProject> => {
    const project = await options.readProject(projectId)
    if (project.projectId !== projectId) throw new Error('Production API returned a different project identity.')
    activeId = projectId
    try {
      legacySession = await createCreativeProductionExternalSessionV1({
        sessionLabel: `${options.sessionLabel}:${projectId}`,
        readProject: () => options.readProject(projectId),
      })
    } catch {
      // Selection/import remains valid even if the legacy V1.6 KineticHeadline
      // candidate cannot be formed at the current source moment. New raw-video
      // project/session tools must never depend on that compatibility adapter.
      legacySession = null
    }
    return project
  }

  const persistRun = async (run: CreativeRunV1): Promise<CreativeRunV1> => {
    const validated = validateCreativeRunV1(run)
    if (!validated.ok) throw new Error(`${validated.code}: ${validated.message}`)
    if (!options.writeCreativeRun) throw new Error('CREATIVE_RUN_STORE_UNAVAILABLE: durable Creative Run storage is unavailable in this host.')
    await options.writeCreativeRun(validated.value)
    creativeRuns.set(validated.value.runId, validated.value)
    activeRunId = validated.value.runId
    return validated.value
  }
  const activeRun = (): CreativeRunV1 | null => activeRunId ? creativeRuns.get(activeRunId) ?? null : null
  const updateActiveRun = async (patch: Partial<CreativeRunV1>): Promise<CreativeRunV1 | null> => {
    const current = activeRun()
    if (!current) return null
    const next = Object.freeze({ ...current, ...patch, schemaVersion: CREATIVE_RUN_SCHEMA_V1, runId: current.runId, projectId: current.projectId, baseProjectRevision: current.baseProjectRevision, sourceAssetId: current.sourceAssetId, createdAt: current.createdAt, updatedAt: new Date().toISOString() }) as CreativeRunV1
    return await persistRun(next)
  }
  const rehydrateRun = async (rawRun: CreativeRunV1): Promise<CreativeRunV1> => {
    const validated = validateCreativeRunV1(rawRun)
    if (!validated.ok) throw new Error(`${validated.code}: ${validated.message}`)
    const run = validated.value
    const project = await activate(run.projectId)
    if (run.sceneBatch && project.revision !== run.baseProjectRevision) throw new Error('CREATIVE_RUN_REHYDRATION_FAILED: current production revision no longer matches the persisted pre-apply Creative Run revision.')
    creativeRuns.set(run.runId, run)
    activeRunId = run.runId
    if (run.transcript) { transcripts.set(run.transcript.id, run.transcript); transcriptTransactions.set(`rehydrated:${run.transcript.id}`, run.transcript) }
    if (run.sourceUnderstanding) sourcePackets.set(run.sourceUnderstanding.id, run.sourceUnderstanding)
    if (run.opportunityMap) opportunityMaps.set(run.opportunityMap.id, run.opportunityMap)
    if (run.sceneBatch && run.opportunityMap) {
      const restored = createCreativeSceneBatchV1({ project, opportunityMap: run.opportunityMap, transcriptTextByOpportunityId: transcriptTextByOpportunity(run.opportunityMap), restored: run.sceneBatch })
      if (!restored.ok) throw new Error(`CREATIVE_RUN_REHYDRATION_FAILED: ${restored.refusal.message}`)
      sceneBatches.set(restored.value.id, restored.value)
    }
    return run
  }

  const register = <TInput, TOutput>(definition: SanverseToolDefinitionV1<TInput, TOutput>) => {
    const result = projectRegistry.register(definition as SanverseToolDefinitionV1)
    if (!result.ok) throw new Error(`${result.refusal.code}: ${result.refusal.message}`)
  }

  register(Object.freeze({
    id: 'production.list_projects', version: 1 as const, level: 'T0' as const, requiresSandbox: false,
    inputSchema: emptySchema, outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async () => creativeOperationOk(Object.freeze({ projects: Object.freeze((await options.listProjects()).map(freezeSummary)), activeProjectId: activeId }), 1),
  }))
  register(Object.freeze({
    id: 'source.list_workspace_inputs', version: 1 as const, level: 'T0' as const, requiresSandbox: false,
    inputSchema: emptySchema, outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async () => {
      if (!options.listWorkspaceInputs) return creativeOperationRefusal('WORKSPACE_UNAVAILABLE', 'Workspace input discovery is available only to a local STDIO coding-agent session.')
      try {
        const files = await options.listWorkspaceInputs()
        return creativeOperationOk(Object.freeze({ files: Object.freeze(files.map((file) => Object.freeze({ relativePath: file.relativePath, kind: file.kind, byteLength: file.byteLength }))) }), 1)
      } catch (error) {
        const code = record(error) && typeof error.code === 'string' ? error.code : 'WORKSPACE_ROOT_INVALID'
        return creativeOperationRefusal(code, error instanceof Error ? error.message : 'The local coding-agent workspace is unavailable.')
      }
    },
  }))
  register(Object.freeze({
    id: 'production.select_project', version: 1 as const, level: 'T1' as const, requiresSandbox: false,
    inputSchema: schema({ projectId: stringSchema }, ['projectId']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      if (!boundedText(input.projectId, 96) || !projectIdPattern.test(input.projectId)) return creativeOperationRefusal('PROJECT_NOT_FOUND', 'The project ID is invalid or unavailable.')
      const listed = await options.listProjects()
      if (!listed.some((item) => item.id === input.projectId)) return creativeOperationRefusal('PROJECT_NOT_FOUND', 'The requested project does not exist.', Object.freeze({ recovery: 'Call production.list_projects and choose an existing project.' }))
      try { return creativeOperationOk(projectContext(await activate(input.projectId)), (await options.readProject(input.projectId)).revision) }
      catch { return creativeOperationRefusal('PROJECT_NOT_FOUND', 'The requested project could not be opened.') }
    },
  }))
  register(Object.freeze({
    id: 'production.import_source_video', version: 1 as const, level: 'T1' as const, requiresSandbox: false,
    inputSchema: schema({ localPath: stringSchema, projectLabel: stringSchema, transactionId: stringSchema }, ['localPath', 'transactionId']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      if (!boundedText(input.localPath, 4096)) return creativeOperationRefusal('IMPORT_PATH_INVALID', 'localPath must be a bounded path string.')
      if (!boundedText(input.transactionId, 128) || !transactionIdPattern.test(input.transactionId)) return creativeOperationRefusal('IMPORT_PATH_INVALID', 'A stable transactionId is required for idempotent import.')
      if (input.projectLabel !== undefined && !boundedText(input.projectLabel, 160)) return creativeOperationRefusal('IMPORT_PATH_INVALID', 'projectLabel must be bounded text when provided.')
      let imported = importTransactions.get(input.transactionId)
      try {
        if (!imported) {
          imported = await options.importSourceVideo({ localPath: input.localPath, ...(typeof input.projectLabel === 'string' ? { projectLabel: input.projectLabel } : {}), transactionId: input.transactionId })
          importTransactions.set(input.transactionId, imported)
        }
        const project = await activate(imported.project.projectId)
        let runId: string | null = null
        const source = project.assets.find((asset) => asset.mediaKind === 'video')
        if (source && options.writeCreativeRun && options.readCreativeRun) {
          runId = `run_${tail(`${project.projectId}:${project.revision}:${source.assetId}:${input.transactionId}:auto`)}`
          const existingRun = await options.readCreativeRun({ projectId: project.projectId, runId }).catch(() => null)
          if (existingRun) await rehydrateRun(existingRun)
          else {
            const now = new Date().toISOString()
            await persistRun(Object.freeze({ schemaVersion: CREATIVE_RUN_SCHEMA_V1, runId, projectId: project.projectId, baseProjectRevision: project.revision, sourceAssetId: source.assetId, stage: 'source-analysis' as const, createdAt: now, updatedAt: now, sceneIds: Object.freeze([]), reviews: Object.freeze([]), extensions: Object.freeze({}) }))
          }
        }
        return creativeOperationOk(Object.freeze({ ...projectContext(project), sourceSha256: imported.sourceSha256, originalFilename: imported.originalFilename, ...(runId ? { runId } : {}) }), project.revision)
      } catch (error) {
        const code = record(error) && typeof error.code === 'string' ? error.code : 'IMPORT_MEDIA_UNSUPPORTED'
        const allowed = new Set(['WORKSPACE_ROOT_INVALID','IMPORT_ROOT_NOT_ALLOWED','IMPORT_PATH_INVALID','IMPORT_SYMLINK_ESCAPE','IMPORT_FILE_NOT_FOUND','IMPORT_MEDIA_UNSUPPORTED'])
        return creativeOperationRefusal(allowed.has(code) ? code : 'IMPORT_MEDIA_UNSUPPORTED', error instanceof Error ? error.message : 'The source video could not be imported.')
      }
    },
  }))
  register(Object.freeze({
    id: 'production.get_project_context', version: 1 as const, level: 'T0' as const, requiresSandbox: false,
    inputSchema: emptySchema, outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async () => { const current = await requireProject(); return current.ok ? creativeOperationOk(projectContext(current.value), current.value.revision) : current },
  }))
  register(Object.freeze({
    id: 'creative.create_run', version: 1 as const, level: 'T1' as const, requiresSandbox: false,
    inputSchema: schema({ transactionId: stringSchema }, ['transactionId']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      const current = await requireProject(); if (!current.ok) return current
      if (!options.writeCreativeRun || !options.readCreativeRun) return creativeOperationRefusal('CREATIVE_RUN_STORE_UNAVAILABLE', 'This Sanverse host does not provide durable Creative Run storage.')
      if (!boundedText(input.transactionId, 128) || !transactionIdPattern.test(input.transactionId)) return creativeOperationRefusal('CREATIVE_RUN_INVALID', 'A stable transactionId is required to create a Creative Run.')
      const source = current.value.assets.find((asset) => asset.mediaKind === 'video')
      if (!source) return creativeOperationRefusal('PROJECT_REQUIRED', 'The active project has no source video.')
      const runId = `run_${tail(`${current.value.projectId}:${current.value.revision}:${source.assetId}:${input.transactionId}`)}`
      const persisted = await options.readCreativeRun({ projectId: current.value.projectId, runId }).catch(() => null)
      if (persisted) {
        try { const run = await rehydrateRun(persisted); return creativeOperationOk(summarizeCreativeRunV1(run), current.value.revision) }
        catch (error) { return creativeOperationRefusal('CREATIVE_RUN_REHYDRATION_FAILED', error instanceof Error ? error.message : 'The existing Creative Run could not be restored.') }
      }
      const now = new Date().toISOString()
      try {
        const run = await persistRun(Object.freeze({ schemaVersion: CREATIVE_RUN_SCHEMA_V1, runId, projectId: current.value.projectId, baseProjectRevision: current.value.revision, sourceAssetId: source.assetId, stage: 'source-analysis' as const, createdAt: now, updatedAt: now, sceneIds: Object.freeze([]), reviews: Object.freeze([]), extensions: Object.freeze({}) }))
        return creativeOperationOk(summarizeCreativeRunV1(run), current.value.revision)
      } catch (error) { return creativeOperationRefusal('CREATIVE_RUN_STORE_FAILED', error instanceof Error ? error.message : 'The Creative Run could not be persisted.') }
    },
  }))
  register(Object.freeze({
    id: 'creative.list_runs', version: 1 as const, level: 'T0' as const, requiresSandbox: false,
    inputSchema: emptySchema, outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async () => {
      const current = await requireProject(); if (!current.ok) return current
      if (!options.listCreativeRuns) return creativeOperationRefusal('CREATIVE_RUN_STORE_UNAVAILABLE', 'This Sanverse host does not provide durable Creative Run storage.')
      try {
        const runs = await options.listCreativeRuns(current.value.projectId)
        return creativeOperationOk(Object.freeze({ activeRunId, runs: Object.freeze(runs.map(summarizeCreativeRunV1).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) }), current.value.revision)
      } catch (error) { return creativeOperationRefusal('CREATIVE_RUN_STORE_FAILED', error instanceof Error ? error.message : 'Creative Runs could not be listed.') }
    },
  }))
  register(Object.freeze({
    id: 'creative.get_run', version: 1 as const, level: 'T0' as const, requiresSandbox: false,
    inputSchema: schema({ runId: stringSchema }, ['runId']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      const current = await requireProject(); if (!current.ok) return current
      if (!boundedText(input.runId, 96) || !runRefPattern.test(input.runId)) return creativeOperationRefusal('CREATIVE_RUN_NOT_FOUND', 'A valid runId is required.')
      const inSession = creativeRuns.get(input.runId)
      const run = inSession ?? (options.readCreativeRun ? await options.readCreativeRun({ projectId: current.value.projectId, runId: input.runId }).catch(() => null) : null)
      if (!run) return creativeOperationRefusal('CREATIVE_RUN_NOT_FOUND', 'That Creative Run does not exist for the active project.')
      const validated = validateCreativeRunV1(run)
      return validated.ok ? creativeOperationOk(validated.value, current.value.revision) : creativeOperationRefusal(validated.code, validated.message)
    },
  }))
  register(Object.freeze({
    id: 'creative.resume_run', version: 1 as const, level: 'T1' as const, requiresSandbox: false,
    inputSchema: schema({ runId: stringSchema }, ['runId']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      const current = await requireProject(); if (!current.ok) return current
      if (!boundedText(input.runId, 96) || !runRefPattern.test(input.runId) || !options.readCreativeRun) return creativeOperationRefusal('CREATIVE_RUN_NOT_FOUND', 'A valid persisted runId is required.')
      const run = await options.readCreativeRun({ projectId: current.value.projectId, runId: input.runId }).catch(() => null)
      if (!run) return creativeOperationRefusal('CREATIVE_RUN_NOT_FOUND', 'That Creative Run does not exist for the active project.')
      try { const restored = await rehydrateRun(run); return creativeOperationOk(restored, current.value.revision) }
      catch (error) { return creativeOperationRefusal('CREATIVE_RUN_REHYDRATION_FAILED', error instanceof Error ? error.message : 'The Creative Run could not be restored.') }
    },
  }))
  register(Object.freeze({
    id: 'creative.cancel_run', version: 1 as const, level: 'T1' as const, requiresSandbox: false,
    inputSchema: schema({ runId: stringSchema }, ['runId']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      const current = await requireProject(); if (!current.ok) return current
      if (!boundedText(input.runId, 96) || !runRefPattern.test(input.runId) || !options.readCreativeRun) return creativeOperationRefusal('CREATIVE_RUN_NOT_FOUND', 'A valid persisted runId is required.')
      const run = creativeRuns.get(input.runId) ?? await options.readCreativeRun({ projectId: current.value.projectId, runId: input.runId }).catch(() => null)
      if (!run) return creativeOperationRefusal('CREATIVE_RUN_NOT_FOUND', 'That Creative Run does not exist for the active project.')
      try {
        activeRunId = run.runId; creativeRuns.set(run.runId, run)
        const cancelled = await updateActiveRun({ stage: 'cancelled' })
        return creativeOperationOk(cancelled ?? run, current.value.revision)
      } catch (error) { return creativeOperationRefusal('CREATIVE_RUN_STORE_FAILED', error instanceof Error ? error.message : 'The Creative Run could not be cancelled.') }
    },
  }))
  register(Object.freeze({
    id: 'source.attach_transcript', version: 1 as const, level: 'T1' as const, requiresSandbox: false,
    inputSchema: schema({ format: stringSchema, contents: stringSchema, localPath: stringSchema, transactionId: stringSchema }, ['transactionId']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      const current = await requireProject(); if (!current.ok) return current
      const project = current.value
      const source = project.assets.find((asset) => asset.mediaKind === 'video')
      if (!source) return creativeOperationRefusal('PROJECT_REQUIRED', 'The active project has no primary source video.')
      if (!boundedText(input.transactionId, 128) || !transactionIdPattern.test(input.transactionId)) return creativeOperationRefusal('TRANSCRIPT_INVALID', 'A stable transactionId is required.')
      const transactionId = input.transactionId
      const hasContents = boundedText(input.contents, 2_000_000)
      const hasLocalPath = boundedText(input.localPath, 4096)
      if (hasContents === hasLocalPath) return creativeOperationRefusal('TRANSCRIPT_INVALID', 'Provide exactly one of transcript contents or a workspace-relative localPath.')
      const existing = transcriptTransactions.get(transactionId)
      if (existing) {
        if (existing.projectId !== project.projectId) return creativeOperationRefusal('TRANSCRIPT_SOURCE_MISMATCH', 'That transcript transaction belongs to a different project.')
        return creativeOperationOk(Object.freeze({ transcriptRef: existing.id, projectId: existing.projectId, sourceAssetId: existing.sourceAssetId, cueCount: existing.cues.length, analysisOnly: true, cues: existing.cues }), existing.sourceRevision)
      }

      let requested: SourceTranscriptV1['format'] | null = input.format === 'plain' || input.format === 'srt' || input.format === 'vtt' ? input.format : null
      let contents: string
      if (hasLocalPath) {
        if (!options.readWorkspaceTextFile) return creativeOperationRefusal('WORKSPACE_UNAVAILABLE', 'Workspace transcript files are available only to a local STDIO coding-agent session.')
        try {
          const file = await options.readWorkspaceTextFile({ localPath: input.localPath as string })
          contents = file.contents
          requested ??= file.format
        } catch (error) {
          const code = record(error) && typeof error.code === 'string' ? error.code : 'TRANSCRIPT_INVALID'
          return creativeOperationRefusal(code, error instanceof Error ? error.message : 'The workspace transcript file could not be read.')
        }
      } else {
        contents = input.contents as string
      }
      if (!requested) return creativeOperationRefusal('TRANSCRIPT_INVALID', 'format must be plain, srt, or vtt when transcript contents are provided.')
      const normalizedContents = contents.replace(/\r\n?/gu, '\n').trim()
      if (!normalizedContents || normalizedContents.length > 2_000_000) return creativeOperationRefusal('TRANSCRIPT_INVALID', 'Transcript contents must be non-empty and bounded.')
      const provenance = `provenance:external-transcript:${tail(`${project.projectId}:${transactionId}`)}`
      const parsed = requested === 'plain'
        ? Object.freeze([{ id: 'transcript:1', startTicks: 0, endTicks: source.duration.ticks, text: normalizedContents, provenance } satisfies TranscriptSegmentV1])
        : parseSrtOrVttTranscript(normalizedContents, provenance)
      if (parsed.length === 0 || parsed.some((cue) => !cue.text.trim() || !Number.isSafeInteger(cue.startTicks) || !Number.isSafeInteger(cue.endTicks) || cue.startTicks < 0 || cue.endTicks <= cue.startTicks || cue.endTicks > source.duration.ticks)) {
        return creativeOperationRefusal('TRANSCRIPT_INVALID', 'Transcript cues must have non-empty text and valid source-bounded timestamps.', Object.freeze({ recovery: 'Fix cue timestamps so every cue lies within the source video duration.' }))
      }
      const digest = await options.sha256Text(normalizedContents)
      const id = `transcript_${tail(`${project.projectId}:${source.assetId}:${digest}:${transactionId}`)}`
      const transcript: SourceTranscriptV1 = Object.freeze({
        schemaVersion: SOURCE_TRANSCRIPT_SCHEMA_V1, id, projectId: project.projectId, sourceAssetId: source.assetId, sourceRevision: project.revision, sha256: digest,
        format: requested, analysisOnly: true as const,
        cues: Object.freeze(parsed.map((cue, index) => Object.freeze({ id: `${id}:cue:${index + 1}`, startTick: cue.startTicks, endTick: cue.endTicks, text: cue.text }))),
      })
      transcripts.set(id, transcript); transcriptTransactions.set(transactionId, transcript)
      const run = activeRun()
      if (run && run.projectId === project.projectId && run.sourceAssetId === source.assetId) await updateActiveRun({ transcript, stage: 'source-analysis' })
      return creativeOperationOk(Object.freeze({ transcriptRef: id, projectId: project.projectId, sourceAssetId: source.assetId, cueCount: transcript.cues.length, analysisOnly: true, cues: transcript.cues, ...(activeRunId ? { runId: activeRunId } : {}) }), project.revision)
    },
  }))
  register(Object.freeze({
    id: 'source.get_transcript', version: 1 as const, level: 'T0' as const, requiresSandbox: false,
    inputSchema: schema({ transcriptRef: stringSchema }, ['transcriptRef']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      const current = await requireProject(); if (!current.ok) return current
      if (!boundedText(input.transcriptRef, 96) || !transcriptRefPattern.test(input.transcriptRef)) return creativeOperationRefusal('TRANSCRIPT_INVALID', 'A valid transcriptRef is required.')
      const transcript = transcripts.get(input.transcriptRef)
      if (!transcript) return creativeOperationRefusal('TRANSCRIPT_INVALID', 'The transcript reference is unknown in this MCP session.')
      if (transcript.projectId !== current.value.projectId) return creativeOperationRefusal('TRANSCRIPT_SOURCE_MISMATCH', 'That transcript belongs to a different project.')
      return creativeOperationOk(transcript, current.value.revision)
    },
  }))
  register(Object.freeze({
    id: 'source.analyze_video', version: 1 as const, level: 'T2' as const, requiresSandbox: false,
    inputSchema: schema({ transcriptRef: stringSchema }, []), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      const current = await requireProject(); if (!current.ok) return current
      const project = current.value
      const source = project.assets.find((asset) => asset.mediaKind === 'video')
      if (!source || !source.frameRate) return creativeOperationRefusal('SOURCE_ANALYSIS_STALE', 'The active project source metadata is unavailable.')
      let transcript: SourceTranscriptV1 | undefined
      if (input.transcriptRef !== undefined) {
        if (!boundedText(input.transcriptRef, 96) || !sourcePacketRefPattern.test(input.transcriptRef) && !transcriptRefPattern.test(input.transcriptRef)) return creativeOperationRefusal('TRANSCRIPT_INVALID', 'transcriptRef is invalid.')
        transcript = transcripts.get(input.transcriptRef)
        if (!transcript) return creativeOperationRefusal('TRANSCRIPT_INVALID', 'The transcript reference is unknown in this MCP session.')
        if (transcript.projectId !== project.projectId || transcript.sourceAssetId !== source.assetId) return creativeOperationRefusal('TRANSCRIPT_SOURCE_MISMATCH', 'The transcript does not belong to the active source.')
        if (transcript.sourceRevision > project.revision) return creativeOperationRefusal('SOURCE_ANALYSIS_STALE', 'The transcript references a future/stale project state.')
      }
      const segments = transcript ? transcriptSegments(transcript) : Object.freeze([])
      const provenance = Object.freeze([
        Object.freeze({ id: 'provenance:semantic-rules:v1', kind: 'transcript-rule' as const, analyzerId: 'DeterministicTranscriptSemanticAnalyzer/v1' }),
        Object.freeze({ id: 'provenance:system-derived:v1', kind: 'system-derived' as const, analyzerId: 'SanverseSourcePacket/v1' }),
      ])
      const document = await analyzeVideoUnderstanding({
        source: Object.freeze({ sourceId: source.assetId, durationTicks: source.duration.ticks, width: source.width, height: source.height, frameRate: source.frameRate }),
        transcript: segments,
      }, { semanticAnalyzer: new DeterministicTranscriptSemanticAnalyzer() }, provenance)
      const observations: SourceUnderstandingObservationV1[] = [
        ...document.semanticMoments.map((moment) => Object.freeze({ id: moment.id, kind: 'semantic-moment' as const, startTick: moment.startTicks, endTick: moment.endTicks, confidence: moment.confidence, semanticKind: moment.kind, transcriptCueIds: Object.freeze([...moment.transcriptSegmentIds]) })),
        ...document.observations.map((observation) => Object.freeze({ id: observation.id, kind: 'speech-present' as const, startTick: observation.startTicks, endTick: observation.endTicks, confidence: observation.confidence, transcriptCueIds: Object.freeze([]) })),
      ]
      const sourceSegments: SourceUnderstandingSegmentV1[] = segments.length > 0
        ? segments.map((segment) => Object.freeze({ id: `source-segment:${segment.id}`, startTick: segment.startTicks, endTick: segment.endTicks, transcriptCueIds: Object.freeze([segment.id]), observationIds: Object.freeze(observations.filter((item) => item.startTick < segment.endTicks && segment.startTicks < item.endTick).map((item) => item.id)), confidence: 1 }))
        : [Object.freeze({ id: `source-segment:${source.assetId}:whole`, startTick: 0, endTick: source.duration.ticks, transcriptCueIds: Object.freeze([]), observationIds: Object.freeze([]), confidence: 1 })]
      const serializable = JSON.stringify({ projectId: project.projectId, projectRevision: project.revision, sourceAssetId: source.assetId, durationTicks: source.duration.ticks, transcriptRef: transcript?.id ?? null, sourceSegments, observations })
      const evidenceHash = await options.sha256Text(serializable)
      const id = `sourcepkt_${tail(`${project.projectId}:${project.revision}:${source.assetId}:${evidenceHash}`)}`
      const packet: SourceUnderstandingPacketV1 = Object.freeze({
        schemaVersion: SOURCE_UNDERSTANDING_PACKET_SCHEMA_V1, id, projectId: project.projectId, projectRevision: project.revision, sourceAssetId: source.assetId, sourceDurationTicks: source.duration.ticks,
        ...(transcript ? { transcriptRef: transcript.id } : {}), sourceSegments: Object.freeze(sourceSegments), observations: Object.freeze(observations),
        capabilities: Object.freeze(['transcript-segmentation','deterministic-transcript-semantics','source-metadata']),
        limitations: Object.freeze(['No automatic face/object/surface detection was run; those capabilities are not fabricated from transcript evidence.','Shot/spatial/visual-region analysis is absent unless an existing analyzer supplies it.']), evidenceHash,
      })
      sourcePackets.set(id, packet)
      const run = activeRun()
      if (run && run.projectId === project.projectId && run.sourceAssetId === source.assetId) await updateActiveRun({ sourceUnderstanding: packet, stage: 'opportunity-planning' })
      return creativeOperationOk(Object.freeze({ ...packet, ...(activeRunId ? { runId: activeRunId } : {}) }), project.revision)
    },
  }))

  const transcriptTextByOpportunity = (map: MotionOpportunityMapV1): Readonly<Record<string, string>> => {
    const packet = sourcePackets.get(map.sourcePacketId)
    const transcript = packet?.transcriptRef ? transcripts.get(packet.transcriptRef) : undefined
    if (!transcript) return Object.freeze({})
    const cueById = new Map(transcript.cues.map((cue) => [cue.id, cue]))
    const output: Record<string, string> = {}
    for (const planned of map.opportunities) {
      const text = planned.evidence.transcriptCueIds.map((id) => cueById.get(id)?.text ?? '').filter(Boolean).join(' ').trim()
      if (text) output[planned.opportunity.id] = text
    }
    return Object.freeze(output)
  }

  register(Object.freeze({
    id: 'motion.plan_opportunities', version: 1 as const, level: 'T2' as const, requiresSandbox: false,
    inputSchema: schema({ sourcePacketRef: stringSchema, transcriptRef: stringSchema, targetCount: Object.freeze({ type: 'integer' }), maxCount: Object.freeze({ type: 'integer' }), agentCandidates: Object.freeze({ type: 'array' }), style: Object.freeze({ type: 'object' }) }, ['sourcePacketRef']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      const current = await requireProject(); if (!current.ok) return current
      if (!boundedText(input.sourcePacketRef, 96) || !sourcePacketRefPattern.test(input.sourcePacketRef)) return creativeOperationRefusal('SOURCE_ANALYSIS_STALE', 'A valid sourcePacketRef is required.')
      const packet = sourcePackets.get(input.sourcePacketRef)
      if (!packet) return creativeOperationRefusal('SOURCE_ANALYSIS_STALE', 'The source packet is unknown in this MCP session; analyze the current source again.')
      if (packet.projectId !== current.value.projectId || packet.projectRevision !== current.value.revision) return creativeOperationRefusal('OPPORTUNITY_MAP_STALE', 'The source packet does not target the exact current project revision.', Object.freeze({ recovery: 'Run source.analyze_video again for the current project revision.' }))
      const targetCount = input.targetCount === undefined ? undefined : Number(input.targetCount)
      const maxCount = input.maxCount === undefined ? undefined : Number(input.maxCount)
      if (targetCount !== undefined && (!Number.isSafeInteger(targetCount) || targetCount < 1 || targetCount > 20)) return creativeOperationRefusal('OPPORTUNITY_TARGET_INVALID', 'targetCount must be an integer from 1 through 20 when provided.')
      if (maxCount !== undefined && (!Number.isSafeInteger(maxCount) || maxCount < 1 || maxCount > 20)) return creativeOperationRefusal('OPPORTUNITY_TARGET_INVALID', 'maxCount must be an integer from 1 through 20 when provided.')
      let transcript: SourceTranscriptV1 | undefined
      const transcriptRef = typeof input.transcriptRef === 'string' ? input.transcriptRef : packet.transcriptRef
      if (transcriptRef) {
        transcript = transcripts.get(transcriptRef)
        if (!transcript) return creativeOperationRefusal('TRANSCRIPT_INVALID', 'The planning transcript is unknown in this MCP session.')
      }
      if (input.agentCandidates !== undefined && !Array.isArray(input.agentCandidates)) return creativeOperationRefusal('OPPORTUNITY_SOURCE_INVALID', 'agentCandidates must be an array when provided.')
      const planned = planMotionOpportunitiesV1({
        packet,
        ...(transcript ? { transcript } : {}),
        ...(Number.isSafeInteger(Number(input.maxCount)) && Number(input.maxCount) > 0 ? { maxCount: Number(input.maxCount) } : Number.isSafeInteger(Number(input.targetCount)) && Number(input.targetCount) > 0 ? { targetCount: Number(input.targetCount) } : { maxCount: 10 }),
        ...(Array.isArray(input.agentCandidates) ? { agentCandidates: input.agentCandidates as MotionOpportunityV1[] } : {}),
        ...(record(input.style) ? { style: input.style as never } : {}),
      })
      if (!planned.ok) return creativeOperationRefusal(planned.refusal.code, planned.refusal.message, planned.refusal.details)
      opportunityMaps.set(planned.value.id, planned.value)
      const run = activeRun()
      if (run && run.projectId === current.value.projectId) await updateActiveRun({ opportunityMap: planned.value, stage: 'storyboard' })
      return creativeOperationOk(Object.freeze({ ...planned.value, ...(activeRunId ? { runId: activeRunId } : {}) }), current.value.revision)
    },
  }))

  register(Object.freeze({
    id: 'motion.get_opportunity_map', version: 1 as const, level: 'T0' as const, requiresSandbox: false,
    inputSchema: schema({ opportunityMapId: stringSchema }, ['opportunityMapId']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      const current = await requireProject(); if (!current.ok) return current
      if (!boundedText(input.opportunityMapId, 96) || !opportunityMapRefPattern.test(input.opportunityMapId)) return creativeOperationRefusal('OPPORTUNITY_MAP_STALE', 'A valid opportunityMapId is required.')
      const map = opportunityMaps.get(input.opportunityMapId)
      if (!map) return creativeOperationRefusal('OPPORTUNITY_MAP_STALE', 'The opportunity map is unknown in this MCP session.')
      if (map.projectId !== current.value.projectId || map.projectRevision !== current.value.revision) return creativeOperationRefusal('OPPORTUNITY_MAP_STALE', 'The opportunity map no longer matches the current production revision.')
      return creativeOperationOk(map, current.value.revision)
    },
  }))

  type CreateBatchOutcome = Readonly<{ ok: true; batch: CreativeSceneBatchV1 }> | Readonly<{ ok: false; refusal: Readonly<{ code: string; message: string; details?: unknown }> }>
  const createBatch = async (map: MotionOpportunityMapV1, transactionId: string, opportunityId?: string): Promise<CreateBatchOutcome> => {
    const existingId = sceneBatchTransactions.get(transactionId)
    if (existingId) {
      const existing = sceneBatches.get(existingId)
      return existing
        ? Object.freeze({ ok: true as const, batch: existing })
        : Object.freeze({ ok: false as const, refusal: Object.freeze({ code: 'SCENE_SESSION_NOT_FOUND', message: 'The idempotent scene transaction points to an unavailable batch.' }) })
    }
    const current = await requireProject()
    if (!current.ok) return Object.freeze({ ok: false as const, refusal: current.refusal })
    if (map.projectId !== current.value.projectId || map.projectRevision !== current.value.revision) return Object.freeze({ ok: false as const, refusal: Object.freeze({ code: 'OPPORTUNITY_MAP_STALE', message: 'The opportunity map no longer matches the current production revision.' }) })
    const selected = opportunityId ? map.opportunities.filter((item) => item.opportunity.id === opportunityId) : map.opportunities
    if (selected.length === 0) return Object.freeze({ ok: false as const, refusal: Object.freeze({ code: 'SCENE_SESSION_NOT_FOUND', message: 'The requested opportunity is not present in the opportunity map.' }) })
    const effectiveMap = opportunityId
      ? Object.freeze({ ...map, id: `opmap_${tail(`${map.id}:${opportunityId}`)}`, targetCount: 1, opportunities: Object.freeze(selected) })
      : map
    const made = createCreativeSceneBatchV1({ project: current.value, opportunityMap: effectiveMap, transcriptTextByOpportunityId: transcriptTextByOpportunity(effectiveMap) })
    if (!made.ok) return Object.freeze({ ok: false as const, refusal: made.refusal })
    sceneBatches.set(made.value.id, made.value)
    sceneBatchTransactions.set(transactionId, made.value.id)
    const run = activeRun()
    if (run && run.opportunityMap?.id === map.id) await updateActiveRun({ sceneBatch: made.value.serialize(), sceneIds: made.value.sceneIds, stage: 'storyboard' })
    return Object.freeze({ ok: true as const, batch: made.value })
  }

  const requireActiveRunBatch = (): Readonly<{ run: CreativeRunV1; batch: CreativeSceneBatchV1 }> | null => {
    const run = activeRun()
    if (!run?.sceneBatch) return null
    const batch = sceneBatches.get(run.sceneBatch.id)
    return batch ? Object.freeze({ run, batch }) : null
  }
  const reviewStage = (scope: CreativeReviewScopeV1): CreativeRunV1['stage'] => scope === 'storyboard' ? 'storyboard-review' : scope === 'animatic' ? 'animatic-review' : 'motion-review'
  const replaceReview = (reviews: readonly CreativeReviewV1[], next: CreativeReviewV1): readonly CreativeReviewV1[] => Object.freeze([...reviews.filter((review) => review.reviewId !== next.reviewId), next])
  const latestReviewByScene = (run: CreativeRunV1, scope: CreativeReviewScopeV1, sceneIds: readonly string[]): readonly CreativeReviewV1[] => Object.freeze(sceneIds.map((sceneId) => run.reviews
    .filter((review) => review.scope === scope && review.sceneId === sceneId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.subjectRevision - a.subjectRevision)[0]).filter((review): review is CreativeReviewV1 => Boolean(review)))

  const prepareRunReviews = async (scope: CreativeReviewScopeV1): Promise<Readonly<{ ok: true; run: CreativeRunV1; reviews: readonly CreativeReviewV1[] }> | Readonly<{ ok: false; code: string; message: string }>> => {
    const active = requireActiveRunBatch()
    if (!active) return Object.freeze({ ok: false as const, code: 'CREATIVE_RUN_NOT_READY', message: 'The active Creative Run has no resumable scene batch.' })
    if (!options.materializeReviewEvidence) return Object.freeze({ ok: false as const, code: 'REVIEW_RENDERER_UNAVAILABLE', message: 'This host cannot materialize chat-first Creative review evidence.' })
    const requested = active.batch.requestOwnerReviews(scope)
    if (!requested.ok) return Object.freeze({ ok: false as const, code: scope === 'storyboard' ? 'STORYBOARD_APPROVAL_REQUIRED' : scope === 'animatic' ? 'ANIMATIC_APPROVAL_REQUIRED' : 'MOTION_APPROVAL_REQUIRED', message: requested.message })
    let reviews = active.run.reviews
    const materialized: CreativeReviewV1[] = []
    for (const request of requested.requests ?? Object.freeze([])) {
      const existing = reviews.find((review) => review.requestRef === request.requestRef && review.subjectId === request.subjectId && review.subjectRevision === request.subjectRevision && review.status === 'pending' && review.artifacts.length > 0)
      if (existing) { materialized.push(existing); continue }
      const now = new Date().toISOString()
      const reviewId = `review_${tail(`${active.run.runId}:${request.requestRef}:${request.subjectId}:${request.subjectRevision}`)}`
      const seedHash = await options.sha256Text(JSON.stringify({ runId: active.run.runId, reviewId, requestRef: request.requestRef, subjectId: request.subjectId, subjectRevision: request.subjectRevision }))
      const draft: CreativeReviewV1 = Object.freeze({
        schemaVersion: CREATIVE_REVIEW_SCHEMA_V1,
        reviewId,
        runId: active.run.runId,
        sceneId: request.sceneId,
        scope,
        requestRef: request.requestRef,
        subjectId: request.subjectId,
        subjectRevision: request.subjectRevision,
        evidenceHash: seedHash,
        status: 'pending',
        artifacts: Object.freeze([]),
        createdAt: now,
        updatedAt: now,
      })
      const rendered = await options.materializeReviewEvidence({ run: active.run, review: draft, batch: active.batch })
      if (rendered.reviewId !== reviewId || rendered.requestRef !== request.requestRef || rendered.subjectId !== request.subjectId || rendered.subjectRevision !== request.subjectRevision || rendered.sceneId !== request.sceneId || rendered.scope !== scope || rendered.artifacts.length === 0) return Object.freeze({ ok: false as const, code: 'CREATIVE_REVIEW_INVALID', message: 'The host review renderer returned evidence for a different review identity/revision.' })
      reviews = replaceReview(reviews, rendered)
      materialized.push(rendered)
    }
    const persisted = await updateActiveRun({ reviews, sceneBatch: active.batch.serialize(), sceneIds: active.batch.sceneIds, stage: reviewStage(scope) })
    if (!persisted) return Object.freeze({ ok: false as const, code: 'CREATIVE_RUN_STORE_FAILED', message: 'The Creative Run review state could not be persisted.' })
    return Object.freeze({ ok: true as const, run: persisted, reviews: Object.freeze(materialized) })
  }

  const advanceAfterResolvedReviews = async (scope: CreativeReviewScopeV1): Promise<Readonly<{ ok: true; run: CreativeRunV1; nextReviews: readonly CreativeReviewV1[] }> | Readonly<{ ok: false; code: string; message: string }>> => {
    const active = requireActiveRunBatch()
    if (!active) return Object.freeze({ ok: false as const, code: 'CREATIVE_RUN_NOT_READY', message: 'The active Creative Run has no resumable scene batch.' })
    const latest = latestReviewByScene(active.run, scope, active.batch.sceneIds)
    if (latest.length !== active.batch.sceneIds.length || latest.some((review) => review.status !== 'approved')) return Object.freeze({ ok: true as const, run: active.run, nextReviews: Object.freeze([]) })
    if (scope === 'motion') {
      const run = await updateActiveRun({ sceneBatch: active.batch.serialize(), sceneIds: active.batch.sceneIds, stage: 'ready-for-apply' })
      return run ? Object.freeze({ ok: true as const, run, nextReviews: Object.freeze([]) }) : Object.freeze({ ok: false as const, code: 'CREATIVE_RUN_STORE_FAILED', message: 'The approved Motion run could not be persisted.' })
    }
    const nextScope: CreativeReviewScopeV1 = scope === 'storyboard' ? 'animatic' : 'motion'
    const advanced = await active.batch.advanceAll(nextScope)
    if (!advanced.ok) return Object.freeze({ ok: false as const, code: scope === 'storyboard' ? 'STORYBOARD_APPROVAL_REQUIRED' : 'ANIMATIC_APPROVAL_REQUIRED', message: advanced.message })
    await updateActiveRun({ sceneBatch: active.batch.serialize(), sceneIds: active.batch.sceneIds, stage: nextScope })
    const prepared = await prepareRunReviews(nextScope)
    return prepared.ok
      ? Object.freeze({ ok: true as const, run: prepared.run, nextReviews: prepared.reviews })
      : prepared
  }

  register(Object.freeze({
    id: 'motion.create_scene_sandbox', version: 1 as const, level: 'T1' as const, requiresSandbox: false,
    inputSchema: schema({ opportunityMapId: stringSchema, opportunityId: stringSchema, transactionId: stringSchema }, ['opportunityMapId','opportunityId','transactionId']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      if (!boundedText(input.opportunityMapId, 96) || !opportunityMapRefPattern.test(input.opportunityMapId) || !boundedText(input.opportunityId, 128) || !boundedText(input.transactionId, 128) || !transactionIdPattern.test(input.transactionId)) return creativeOperationRefusal('SCENE_SESSION_NOT_FOUND', 'Valid opportunityMapId, opportunityId, and stable transactionId are required.')
      const map = opportunityMaps.get(input.opportunityMapId)
      if (!map) return creativeOperationRefusal('OPPORTUNITY_MAP_STALE', 'The opportunity map is unknown in this MCP session.')
      const made = await createBatch(map, input.transactionId, input.opportunityId)
      if (!made.ok) return creativeOperationRefusal(made.refusal.code, made.refusal.message, made.refusal.details)
      return creativeOperationOk(made.batch.snapshot(), made.batch.projectRevision)
    },
  }))

  register(Object.freeze({
    id: 'motion.create_scene_batch', version: 1 as const, level: 'T1' as const, requiresSandbox: false,
    inputSchema: schema({ opportunityMapId: stringSchema, transactionId: stringSchema }, ['opportunityMapId','transactionId']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      if (!boundedText(input.opportunityMapId, 96) || !opportunityMapRefPattern.test(input.opportunityMapId) || !boundedText(input.transactionId, 128) || !transactionIdPattern.test(input.transactionId)) return creativeOperationRefusal('SCENE_SESSION_NOT_FOUND', 'Valid opportunityMapId and stable transactionId are required.')
      const map = opportunityMaps.get(input.opportunityMapId)
      if (!map) return creativeOperationRefusal('OPPORTUNITY_MAP_STALE', 'The opportunity map is unknown in this MCP session.')
      const made = await createBatch(map, input.transactionId)
      if (!made.ok) return creativeOperationRefusal(made.refusal.code, made.refusal.message, made.refusal.details)
      return creativeOperationOk(made.batch.snapshot(), made.batch.projectRevision)
    },
  }))

  register(Object.freeze({
    id: 'motion.get_scene_batch', version: 1 as const, level: 'T0' as const, requiresSandbox: false,
    inputSchema: schema({ batchId: stringSchema }, ['batchId']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      const current = await requireProject(); if (!current.ok) return current
      if (!boundedText(input.batchId, 96) || !sceneBatchRefPattern.test(input.batchId)) return creativeOperationRefusal('SCENE_SESSION_NOT_FOUND', 'A valid batchId is required.')
      const batch = sceneBatches.get(input.batchId)
      if (!batch) return creativeOperationRefusal('SCENE_SESSION_NOT_FOUND', 'The scene batch is unknown in this MCP session.')
      if (batch.projectId !== current.value.projectId || batch.projectRevision !== current.value.revision) return creativeOperationRefusal('SCENE_SOURCE_STALE', 'The scene batch no longer matches the current production revision.')
      return creativeOperationOk(batch.snapshot(), current.value.revision)
    },
  }))

  register(Object.freeze({
    id: 'creative.prepare_review', version: 1 as const, level: 'T1' as const, requiresSandbox: false,
    inputSchema: schema({ scope: stringSchema }, ['scope']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      const scope = input.scope === 'storyboard' || input.scope === 'animatic' || input.scope === 'motion' ? input.scope : null
      if (!scope) return creativeOperationRefusal('INVALID_TOOL_INPUT', 'scope must be storyboard, animatic, or motion.')
      try {
        const prepared = await prepareRunReviews(scope)
        if (!prepared.ok) return creativeOperationRefusal(prepared.code, prepared.message)
        return creativeOperationOk(Object.freeze({ run: summarizeCreativeRunV1(prepared.run), reviews: prepared.reviews }), prepared.run.baseProjectRevision)
      } catch (error) { return creativeOperationRefusal('CREATIVE_REVIEW_RENDER_FAILED', error instanceof Error ? error.message : 'Creative review evidence could not be prepared.') }
    },
  }))

  register(Object.freeze({
    id: 'creative.get_review', version: 1 as const, level: 'T0' as const, requiresSandbox: false,
    inputSchema: schema({ reviewId: stringSchema }, ['reviewId']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      const current = await requireProject(); if (!current.ok) return current
      if (!boundedText(input.reviewId, 96) || !reviewRefPattern.test(input.reviewId)) return creativeOperationRefusal('CREATIVE_REVIEW_NOT_FOUND', 'A valid reviewId is required.')
      const run = activeRun()
      if (!run) return creativeOperationRefusal('CREATIVE_RUN_NOT_FOUND', 'Resume the Creative Run before reading its review evidence.')
      const review = run.reviews.find((item) => item.reviewId === input.reviewId)
      if (!review) return creativeOperationRefusal('CREATIVE_REVIEW_NOT_FOUND', 'That review does not belong to the active Creative Run.')
      return creativeOperationOk(Object.freeze({ projectId: current.value.projectId, runId: run.runId, stage: run.stage, review }), current.value.revision)
    },
  }))

  register<Record<string, unknown>, unknown>(Object.freeze({
    id: 'creative.decide_review', version: 1 as const, level: 'T2' as const, requiresSandbox: false,
    inputSchema: schema({ reviewId: stringSchema, decision: stringSchema, revisionNote: stringSchema }, ['reviewId','decision']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>, context: ToolExecutionContextV1) => {
      const current = await requireProject(); if (!current.ok) return current
      if (!boundedText(input.reviewId, 96) || !reviewRefPattern.test(input.reviewId)) return creativeOperationRefusal('CREATIVE_REVIEW_NOT_FOUND', 'A valid reviewId is required.')
      const decision = input.decision === 'approve' || input.decision === 'revise' || input.decision === 'reject' ? input.decision : null
      if (!decision) return creativeOperationRefusal('INVALID_TOOL_INPUT', 'decision must be approve, revise, or reject.')
      if (input.revisionNote !== undefined && !boundedText(input.revisionNote, 1000)) return creativeOperationRefusal('INVALID_TOOL_INPUT', 'revisionNote must be bounded text when provided.')
      const active = requireActiveRunBatch()
      if (!active) return creativeOperationRefusal('CREATIVE_RUN_NOT_READY', 'Resume a Creative Run with a scene batch before deciding a review.')
      const review = active.run.reviews.find((item) => item.reviewId === input.reviewId)
      if (!review || review.status !== 'pending') return creativeOperationRefusal('CREATIVE_REVIEW_STALE', 'The review is unavailable or no longer pending.')
      const host = context.hostReviewDecision
      if (!host || host.reviewId !== review.reviewId || host.decision !== decision || host.evidenceHash !== review.evidenceHash || host.subjectId !== review.subjectId || host.subjectRevision !== review.subjectRevision) {
        return creativeOperationRefusal('OWNER_CONFIRMATION_REQUIRED', 'This exact review decision requires trusted host confirmation bound to its evidence hash and subject revision. MCP JSON cannot satisfy this gate.')
      }
      if (decision === 'revise' && !boundedText(input.revisionNote, 1000)) return creativeOperationRefusal('REVISION_NOTE_REQUIRED', 'A revision decision requires a concrete bounded revisionNote.')
      const now = host.confirmedAt
      if (decision === 'approve') {
        const request = active.batch.snapshot().pendingApprovalRequests.find((item) => item.requestRef === review.requestRef)
        if (!request || request.sceneId !== review.sceneId || request.scope !== review.scope || request.subjectId !== review.subjectId || request.subjectRevision !== review.subjectRevision) return creativeOperationRefusal('APPROVAL_STALE', 'The host approval request no longer matches this exact review revision.')
        if (!options.issueOwnerApprovalRef || !options.resolveOwnerApprovalRef) return creativeOperationRefusal('OWNER_APPROVAL_REQUIRED', 'The host approval authority is unavailable; approval fails closed.')
        const issued = await options.issueOwnerApprovalRef(request)
        const resolved = await active.batch.resolveOwnerApproval(request.requestRef, (exact) => options.resolveOwnerApprovalRef!({ approvalRef: issued.approvalRef, request: exact }))
        if (!resolved.ok || resolved.approved !== true) return creativeOperationRefusal('OWNER_APPROVAL_REQUIRED', resolved.message)
        const approved = Object.freeze({ ...review, status: 'approved' as const, approvalRef: issued.approvalRef, updatedAt: now })
        const run = await updateActiveRun({ reviews: replaceReview(active.run.reviews, approved), sceneBatch: active.batch.serialize(), sceneIds: active.batch.sceneIds })
        if (!run) return creativeOperationRefusal('CREATIVE_RUN_STORE_FAILED', 'Approved review state could not be persisted.')
        const advanced = await advanceAfterResolvedReviews(review.scope)
        if (!advanced.ok) return creativeOperationRefusal(advanced.code, advanced.message)
        return creativeOperationOk(Object.freeze({ decision: 'approved', review: approved, run: summarizeCreativeRunV1(advanced.run), nextReviews: advanced.nextReviews }), current.value.revision)
      }
      if (decision === 'reject') {
        const excluded = active.batch.excludeScene(review.sceneId)
        if (!excluded.ok) return creativeOperationRefusal('CREATIVE_REVIEW_STALE', excluded.message)
        const rejected = Object.freeze({ ...review, status: 'rejected' as const, updatedAt: now })
        const remainingSceneIds = active.batch.sceneIds
        const run = await updateActiveRun({ reviews: replaceReview(active.run.reviews, rejected), sceneBatch: active.batch.serialize(), sceneIds: remainingSceneIds, ...(remainingSceneIds.length === 0 ? { stage: 'cancelled' as const } : {}) })
        if (!run) return creativeOperationRefusal('CREATIVE_RUN_STORE_FAILED', 'Rejected review state could not be persisted.')
        if (remainingSceneIds.length === 0) return creativeOperationOk(Object.freeze({ decision: 'rejected', review: rejected, run: summarizeCreativeRunV1(run), nextReviews: Object.freeze([]) }), current.value.revision)
        const advanced = await advanceAfterResolvedReviews(review.scope)
        if (!advanced.ok) return creativeOperationRefusal(advanced.code, advanced.message)
        return creativeOperationOk(Object.freeze({ decision: 'rejected', review: rejected, run: summarizeCreativeRunV1(advanced.run), nextReviews: advanced.nextReviews }), current.value.revision)
      }
      const revised = Object.freeze({ ...review, status: 'revision-requested' as const, revisionNote: String(input.revisionNote), updatedAt: now })
      const run = await updateActiveRun({ reviews: replaceReview(active.run.reviews, revised), sceneBatch: active.batch.serialize(), sceneIds: active.batch.sceneIds })
      return run
        ? creativeOperationOk(Object.freeze({ decision: 'revision-requested', review: revised, run: summarizeCreativeRunV1(run) }), current.value.revision)
        : creativeOperationRefusal('CREATIVE_RUN_STORE_FAILED', 'Revision-requested state could not be persisted.')
    },
  }))

  register(Object.freeze({
    id: 'creative.revise_scene', version: 1 as const, level: 'T2' as const, requiresSandbox: false,
    inputSchema: schema({ reviewId: stringSchema, text: stringSchema, fontSize: Object.freeze({ type: 'number' }), opacity: Object.freeze({ type: 'number' }) }, ['reviewId']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      const current = await requireProject(); if (!current.ok) return current
      if (!boundedText(input.reviewId, 96) || !reviewRefPattern.test(input.reviewId)) return creativeOperationRefusal('CREATIVE_REVIEW_NOT_FOUND', 'A valid reviewId is required.')
      const active = requireActiveRunBatch()
      if (!active) return creativeOperationRefusal('CREATIVE_RUN_NOT_READY', 'Resume a Creative Run with a scene batch before revising a scene.')
      const review = active.run.reviews.find((item) => item.reviewId === input.reviewId)
      if (!review || review.status !== 'revision-requested') return creativeOperationRefusal('REVISION_REQUEST_REQUIRED', 'The exact review must have a trusted revision decision before scene changes are accepted.')
      if (review.scope !== 'storyboard') return creativeOperationRefusal('LOCALIZED_REVISION_UNSUPPORTED', 'This first localized revision bridge supports Storyboard content/style changes only; later-stage changes fail closed rather than silently rebuilding unrelated scenes.')
      const workflow = active.batch.getWorkflow(review.sceneId)
      const sandbox = workflow?.state().storyboardSandbox
      if (!workflow || !sandbox) return creativeOperationRefusal('CREATIVE_REVIEW_STALE', 'The reviewed Storyboard scene is no longer available.')
      let changed = false
      if (input.text !== undefined || input.fontSize !== undefined) {
        const result = active.batch.reviseSceneStoryboard(review.sceneId, { ...(typeof input.text === 'string' ? { text: input.text } : {}), ...(typeof input.fontSize === 'number' ? { fontSize: input.fontSize } : {}), expectedSandboxRevision: sandbox.sandboxRevision })
        if (!result.ok) return creativeOperationRefusal('SCENE_REVISION_REJECTED', result.message)
        changed = true
      }
      if (input.opacity !== undefined) {
        const nextRevision = active.batch.getWorkflow(review.sceneId)?.state().storyboardSandbox?.sandboxRevision
        if (!Number.isSafeInteger(nextRevision)) return creativeOperationRefusal('SCENE_REVISION_REJECTED', 'The Storyboard revision became unavailable during localized repair.')
        const result = active.batch.reviseSceneOpacity(review.sceneId, Number(input.opacity), Number(nextRevision))
        if (!result.ok) return creativeOperationRefusal('SCENE_REVISION_REJECTED', result.message)
        changed = true
      }
      if (!changed) return creativeOperationRefusal('INVALID_TOOL_INPUT', 'Provide text, fontSize, and/or opacity for the requested localized Storyboard revision.')
      await updateActiveRun({ sceneBatch: active.batch.serialize(), sceneIds: active.batch.sceneIds, stage: 'storyboard' })
      try {
        const prepared = await prepareRunReviews('storyboard')
        if (!prepared.ok) return creativeOperationRefusal(prepared.code, prepared.message)
        const next = prepared.reviews.find((item) => item.sceneId === review.sceneId) ?? null
        return creativeOperationOk(Object.freeze({ revisedSceneId: review.sceneId, previousReviewId: review.reviewId, nextReview: next, run: summarizeCreativeRunV1(prepared.run) }), current.value.revision)
      } catch (error) { return creativeOperationRefusal('CREATIVE_REVIEW_RENDER_FAILED', error instanceof Error ? error.message : 'The revised Storyboard review could not be rendered.') }
    },
  }))

  register<Record<string, unknown>, unknown>(Object.freeze({
    id: 'motion.advance_scene_batch', version: 1 as const, level: 'T2' as const, requiresSandbox: false,
    inputSchema: schema({ batchId: stringSchema, action: stringSchema, scope: stringSchema, requestRef: stringSchema, approvalRef: stringSchema }, ['batchId','action']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      const current = await requireProject(); if (!current.ok) return current
      if (!boundedText(input.batchId, 96) || !sceneBatchRefPattern.test(input.batchId)) return creativeOperationRefusal('SCENE_SESSION_NOT_FOUND', 'A valid batchId is required.')
      const batch = sceneBatches.get(input.batchId)
      if (!batch) return creativeOperationRefusal('SCENE_SESSION_NOT_FOUND', 'The scene batch is unknown in this MCP session.')
      if (batch.projectRevision !== current.value.revision) return creativeOperationRefusal('SCENE_SOURCE_STALE', 'The scene batch no longer matches the current production revision.')
      if (input.action === 'request-review') {
        const scope = input.scope === 'storyboard' || input.scope === 'animatic' || input.scope === 'motion' ? input.scope : null
        if (!scope) return creativeOperationRefusal('INVALID_TOOL_INPUT', 'request-review requires scope storyboard, animatic, or motion.')
        const requested = batch.requestOwnerReviews(scope)
        if (!requested.ok) return creativeOperationRefusal(scope === 'storyboard' ? 'STORYBOARD_APPROVAL_REQUIRED' : scope === 'animatic' ? 'ANIMATIC_APPROVAL_REQUIRED' : 'MOTION_APPROVAL_REQUIRED', requested.message)
        return creativeOperationOk(Object.freeze({ ...batch.snapshot(), reviewRequests: requested.requests ?? Object.freeze([]) }), current.value.revision)
      }
      if (input.action === 'resolve-approval') {
        if (!boundedText(input.requestRef, 96) || !approvalRequestRefPattern.test(input.requestRef) || !boundedText(input.approvalRef, 180) || !approvalRefPattern.test(input.approvalRef)) return creativeOperationRefusal('APPROVAL_STALE', 'resolve-approval requires valid opaque requestRef and approvalRef values.')
        if (!options.resolveOwnerApprovalRef) return creativeOperationRefusal('OWNER_APPROVAL_REQUIRED', 'No host approval resolver is configured. Owner approval must be performed by the host authority, not supplied as MCP JSON.')
        const resolved = await batch.resolveOwnerApproval(input.requestRef, (request) => options.resolveOwnerApprovalRef!({ approvalRef: input.approvalRef as string, request }))
        if (!resolved.ok) return creativeOperationRefusal('APPROVAL_STALE', resolved.message)
        return creativeOperationOk(Object.freeze({ approved: resolved.approved === true, message: resolved.message, batch: batch.snapshot() }), current.value.revision)
      }
      if (input.action === 'advance') {
        const stage = input.scope === 'animatic' || input.scope === 'motion' ? input.scope : null
        if (!stage) return creativeOperationRefusal('INVALID_TOOL_INPUT', 'advance requires scope animatic or motion.')
        const advanced = await batch.advanceAll(stage)
        if (!advanced.ok) return creativeOperationRefusal(stage === 'animatic' ? 'STORYBOARD_APPROVAL_REQUIRED' : 'ANIMATIC_APPROVAL_REQUIRED', advanced.message)
        return creativeOperationOk(batch.snapshot(), current.value.revision)
      }
      return creativeOperationRefusal('INVALID_TOOL_INPUT', 'action must be request-review, resolve-approval, or advance.')
    },
  }))

  register<Record<string, unknown>, unknown>(Object.freeze({
    id: 'production.apply_approved_scene_batch', version: 1 as const, level: 'T2' as const, requiresSandbox: false,
    inputSchema: schema({ batchId: stringSchema, transactionId: stringSchema }, ['batchId','transactionId']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      const current = await requireProject(); if (!current.ok) return current
      if (!boundedText(input.batchId, 96) || !sceneBatchRefPattern.test(input.batchId) || !boundedText(input.transactionId, 128) || !transactionIdPattern.test(input.transactionId)) return creativeOperationRefusal('SCENE_SESSION_NOT_FOUND', 'Valid batchId and stable transactionId are required.')
      if (!options.putCreativeArtifact || !options.acceptChangeSet) return creativeOperationRefusal('PRODUCTION_APPLY_UNAVAILABLE', 'The production API does not expose immutable Creative artifact storage plus server-authoritative ChangeSet acceptance.')
      const batch = sceneBatches.get(input.batchId)
      if (!batch) return creativeOperationRefusal('SCENE_SESSION_NOT_FOUND', 'The scene batch is unknown in this MCP session.')
      if (batch.projectId !== current.value.projectId) return creativeOperationRefusal('SCENES_BASE_REVISION_MISMATCH', 'The Creative scene batch belongs to a different production project.')
      const prior = applyTransactions.get(input.transactionId)
      if (prior) {
        if (prior.batchId !== batch.id) return creativeOperationRefusal('CHANGE_SET_REJECTED', 'That transactionId was already used for a different Creative scene batch.')
        const live = await options.readProject(current.value.projectId)
        const active = live.changeSets.some((record) => record.changeSet.changeSetId === prior.changeSetId)
        return creativeOperationOk(Object.freeze({ transactionId: input.transactionId, batchId: batch.id, changeSetId: prior.changeSetId, artifactRefs: prior.artifactRefs, projectRevision: live.revision, alreadyApplied: active, previouslyUsed: true }), live.revision)
      }
      if (batch.projectRevision !== current.value.revision) return creativeOperationRefusal('SCENES_BASE_REVISION_MISMATCH', 'All approved scenes must still target the one exact live production revision. Re-plan against the current project before applying.')
      const snapshot = batch.snapshot()
      if (!snapshot.readyForProductionApply) return creativeOperationRefusal('MOTION_APPROVAL_REQUIRED', 'Every scene needs current Motion QA, canonical review evidence, and exact host-recorded Motion owner approval before production apply.')

      const prepared: Array<Readonly<{ artifact: CreativeSceneArtifactV1; ref: ExternalCreativeArtifactRefV1 }>> = []
      for (const sceneId of batch.sceneIds) {
        const workflow = batch.getWorkflow(sceneId)
        if (!workflow) return creativeOperationRefusal('SCENE_SESSION_NOT_FOUND', `Scene ${sceneId} is unavailable in the batch.`)
        const built = buildCreativeSceneArtifactV1(workflow)
        if (!built.ok) return creativeOperationRefusal(built.refusal.code, built.refusal.message)
        if (built.value.productionBaseRevision !== current.value.revision || built.value.projectId !== current.value.projectId) return creativeOperationRefusal('SCENE_SOURCE_STALE', 'A prepared Creative artifact no longer targets the exact live production revision.')
        const serialized = canonicalCreativeArtifactJsonV1(built.value)
        const expectedSha = await options.sha256Text(serialized)
        if (!/^[a-f0-9]{64}$/u.test(expectedSha)) return creativeOperationRefusal('CREATIVE_ARTIFACT_INVALID', 'The artifact SHA-256 adapter did not return a canonical 64-character digest.')
        let stored: Awaited<ReturnType<NonNullable<typeof options.putCreativeArtifact>>>
        try { stored = await options.putCreativeArtifact({ projectId: current.value.projectId, serialized }) }
        catch { return creativeOperationRefusal('CREATIVE_ARTIFACT_INVALID', 'The immutable Creative artifact could not be staged in project-local storage.') }
        const validatedStored = validateCreativeSceneArtifactV1(stored.artifact)
        if (!validatedStored.ok || stored.ref.sha256 !== expectedSha || stored.ref.artifactId !== `creativeart_${expectedSha}` || canonicalCreativeArtifactJsonV1(validatedStored.value) !== serialized) return creativeOperationRefusal('CREATIVE_ARTIFACT_HASH_MISMATCH', 'The stored Creative artifact did not round-trip with the exact canonical bytes/hash.')
        prepared.push(Object.freeze({ artifact: built.value, ref: stored.ref }))
      }

      const changeSetId = `changeset_${tail(`${current.value.projectId}:${current.value.revision}:${batch.id}:${input.transactionId}`)}`
      const changeSet: ChangeSet = Object.freeze({
        schemaVersion: 'sanverse.change-set/v1' as const,
        changeSetId,
        baseRevision: current.value.revision,
        operations: Object.freeze(prepared.map(({ artifact, ref }, index) => Object.freeze({
          schemaVersion: 'sanverse.operation/v1' as const,
          operationId: `operation_${tail(`${changeSetId}:${artifact.sceneId}:${index}`)}`,
          kind: 'add-creative-scene' as const,
          capabilityId: CREATIVE_SCENE_PRIMITIVE_ID,
          sceneId: artifact.sceneId,
          assetId: artifact.source.assetId,
          sourceInterval: Object.freeze({ start: mediaTime(artifact.source.sourceStartTick), duration: mediaTime(artifact.source.durationTicks) }),
          artifactId: ref.artifactId,
          artifactSha256: ref.sha256,
          presentationMode: artifact.presentation.mode,
          layer: 20 + index,
          extensions: emptyExtensions(),
        }))),
        provenance: Object.freeze({ source: 'ai' as const, requestId: input.transactionId }),
        extensions: emptyExtensions(),
      })
      let accepted: EditProject
      try { accepted = await options.acceptChangeSet({ projectId: current.value.projectId, changeSet }) }
      catch { return creativeOperationRefusal('CHANGE_SET_REJECTED', 'The production server refused the atomic Creative scene ChangeSet; accepted project state remains unchanged.') }
      if (accepted.revision !== current.value.revision + 1 || !accepted.changeSets.some((record) => record.active && record.changeSet.changeSetId === changeSetId && record.changeSet.operations.length === prepared.length)) return creativeOperationRefusal('CHANGE_SET_REJECTED', 'The production server did not confirm one atomic accepted Creative scene ChangeSet.')
      const artifactRefs = Object.freeze(prepared.map((item) => item.ref))
      applyTransactions.set(input.transactionId, Object.freeze({ batchId: batch.id, changeSetId, projectRevision: accepted.revision, artifactRefs }))
      return creativeOperationOk(Object.freeze({ transactionId: input.transactionId, batchId: batch.id, changeSetId, artifactRefs, projectRevision: accepted.revision, alreadyApplied: true, previouslyUsed: false }), accepted.revision)
    },
  }))

  register(Object.freeze({
    id: 'production.export_video', version: 1 as const, level: 'T1' as const, requiresSandbox: false,
    inputSchema: schema({ productionRevision: Object.freeze({ type: 'integer' }) }, ['productionRevision']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      const current = await requireProject(); if (!current.ok) return current
      if (!Number.isSafeInteger(input.productionRevision) || Number(input.productionRevision) !== current.value.revision) return creativeOperationRefusal('PRODUCTION_REVISION_STALE', 'Export requires the exact current production revision.', Object.freeze({ recovery: 'Call production.get_project_context and retry with its revision.' }))
      if (!options.createExport) return creativeOperationRefusal('EXPORT_FAILED', 'The production API export-job authority is unavailable in this MCP host.')
      try {
        const job = await options.createExport(current.value.projectId)
        if (job.projectId !== current.value.projectId || job.projectRevision !== current.value.revision) return creativeOperationRefusal('EXPORT_FAILED', 'The production export authority returned a job for a different project revision.')
        return creativeOperationOk(job, current.value.revision)
      } catch (error) {
        return creativeOperationRefusal('EXPORT_FAILED', error instanceof Error ? error.message : 'The production export job could not be started.')
      }
    },
  }))

  register(Object.freeze({
    id: 'production.get_export_status', version: 1 as const, level: 'T0' as const, requiresSandbox: false,
    inputSchema: schema({ jobId: stringSchema }, ['jobId']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      const current = await requireProject(); if (!current.ok) return current
      if (!boundedText(input.jobId, 96) || !exportJobRefPattern.test(input.jobId)) return creativeOperationRefusal('EXPORT_NOT_READY', 'A valid production export jobId is required.')
      if (!options.readExportJob) return creativeOperationRefusal('EXPORT_NOT_READY', 'The production API export-job status authority is unavailable in this MCP host.')
      try {
        const job = await options.readExportJob({ projectId: current.value.projectId, jobId: input.jobId })
        if (job.projectId !== current.value.projectId) return creativeOperationRefusal('EXPORT_NOT_READY', 'The export job belongs to a different project.')
        return creativeOperationOk(job, current.value.revision)
      } catch (error) {
        return creativeOperationRefusal('EXPORT_NOT_READY', error instanceof Error ? error.message : 'The production export job is not available yet.')
      }
    },
  }))

  register(Object.freeze({
    id: 'production.cancel_export', version: 1 as const, level: 'T1' as const, requiresSandbox: false,
    inputSchema: schema({ jobId: stringSchema }, ['jobId']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      const current = await requireProject(); if (!current.ok) return current
      if (!boundedText(input.jobId, 96) || !exportJobRefPattern.test(input.jobId)) return creativeOperationRefusal('EXPORT_NOT_READY', 'A valid production export jobId is required.')
      if (!options.cancelExportJob) return creativeOperationRefusal('EXPORT_NOT_READY', 'The production API export cancellation authority is unavailable in this MCP host.')
      try {
        const job = await options.cancelExportJob({ projectId: current.value.projectId, jobId: input.jobId })
        if (job.projectId !== current.value.projectId) return creativeOperationRefusal('EXPORT_NOT_READY', 'The export job belongs to a different project.')
        return creativeOperationOk(job, current.value.revision)
      } catch (error) {
        return creativeOperationRefusal('EXPORT_NOT_READY', error instanceof Error ? error.message : 'The production export job could not be cancelled.')
      }
    },
  }))

  register(Object.freeze({
    id: 'production.get_owner_review_status', version: 1 as const, level: 'T0' as const, requiresSandbox: false,
    inputSchema: schema({ batchId: stringSchema }, ['batchId']), outputSchema: outputRecordSchema, validateInput: passRecord,
    execute: async (input: Record<string, unknown>) => {
      const current = await requireProject(); if (!current.ok) return current
      if (!boundedText(input.batchId, 96) || !sceneBatchRefPattern.test(input.batchId)) return creativeOperationRefusal('SCENE_SESSION_NOT_FOUND', 'A valid batchId is required.')
      const batch = sceneBatches.get(input.batchId)
      if (!batch) return creativeOperationRefusal('SCENE_SESSION_NOT_FOUND', 'The scene batch is unknown in this MCP session.')
      return creativeOperationOk(batch.snapshot(), current.value.revision)
    },
  }))

  const registry = compositeRegistry(projectRegistry, legacyCatalog, () => legacySession, () => activeId !== null)
  return Object.freeze({
    sessionLabel: options.sessionLabel,
    registry,
    activeProjectId: () => activeId,
    getTranscript: (id: string) => transcripts.get(id) ?? null,
    getSourceUnderstanding: (id: string) => sourcePackets.get(id) ?? null,
    getOpportunityMap: (id: string) => opportunityMaps.get(id) ?? null,
    getSceneBatch: (id: string) => sceneBatches.get(id) ?? null,
  })
}
