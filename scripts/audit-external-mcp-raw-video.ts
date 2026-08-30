import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { HostApprovalRequestV1 } from '@sanverse/creative-production-adapter'
import {
  SANVERSE_API_URL,
  SANVERSE_MCP_ENDPOINT,
  SANVERSE_ROOT,
  readLocalMcpToken,
  readProductionProject,
  redoProductionProject,
  undoProductionProject,
} from './sanverse-mcp-shared.ts'
import { issueHostOwnerApprovalV1 } from './sanverse-mcp-approval-authority.ts'

const fixtureRoot = resolve(process.env.SANVERSE_RAW_VIDEO_E2E_ROOT ?? join(SANVERSE_ROOT, '.sanverse-data', 'raw-video-e2e'))
const videoPath = join(fixtureRoot, 'fixture-video.mp4')
const transcriptPath = join(fixtureRoot, 'fixture-transcript.srt')
const downloadedExportPath = join(fixtureRoot, 'audit-export.mp4')
const evidencePath = join(fixtureRoot, 'audit-result.json')

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object result.')
  return value as Record<string, unknown>
}

const sha256Bytes = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

const client = new Client({ name: 'sanverse-raw-video-e2e-audit', version: '1.0.0' }, { capabilities: {} })
const token = await readLocalMcpToken()
const transport = new StreamableHTTPClientTransport(new URL(SANVERSE_MCP_ENDPOINT), {
  requestInit: { headers: { authorization: `Bearer ${token}` } },
})

const call = async <T = Record<string, unknown>>(name: string, args: Record<string, unknown> = {}): Promise<T> => {
  const result = await client.callTool({ name, arguments: args })
  const structured = asRecord(result.structuredContent)
  if (structured.ok !== true) {
    const refusal = asRecord(structured.refusal)
    throw new Error(`${name} refused: ${String(refusal.code)} — ${String(refusal.message)}`)
  }
  return structured.value as T
}

const callExpectedRefusal = async (name: string, args: Record<string, unknown>, code: string): Promise<void> => {
  const result = await client.callTool({ name, arguments: args })
  const structured = asRecord(result.structuredContent)
  if (structured.ok !== false) throw new Error(`${name} unexpectedly succeeded.`)
  const refusal = asRecord(structured.refusal)
  if (refusal.code !== code) throw new Error(`${name} refused with ${String(refusal.code)} instead of ${code}.`)
}

const approveRequests = async (batchId: string, scope: 'storyboard' | 'animatic' | 'motion'): Promise<number> => {
  const review = await call<{ reviewRequests: readonly HostApprovalRequestV1[] }>('motion.advance_scene_batch', {
    batchId,
    action: 'request-review',
    scope,
  })
  if (!Array.isArray(review.reviewRequests) || review.reviewRequests.length === 0) throw new Error(`No ${scope} review requests were created.`)
  for (const request of review.reviewRequests) {
    const issued = await issueHostOwnerApprovalV1({ request })
    const resolved = await call<{ approved: boolean }>('motion.advance_scene_batch', {
      batchId,
      action: 'resolve-approval',
      requestRef: request.requestRef,
      approvalRef: issued.approvalRef,
    })
    if (resolved.approved !== true) throw new Error(`Host approval did not resolve for ${request.sceneId} ${scope}.`)
  }
  return review.reviewRequests.length
}

const pollExport = async (jobId: string, timeoutMs = 180_000): Promise<Record<string, unknown>> => {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const status = await call<Record<string, unknown>>('production.get_export_status', { jobId })
    if (status.status === 'succeeded') return status
    if (status.status === 'failed' || status.status === 'cancelled') throw new Error(`Export ended as ${String(status.status)}: ${JSON.stringify(status.error ?? null)}`)
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500))
  }
  throw new Error(`Export ${jobId} did not finish within ${timeoutMs}ms.`)
}

try {
  await client.connect(transport)
  const listed = await client.listTools()
  const names = listed.tools.map((tool) => tool.name)
  if (listed.tools.length !== 53) throw new Error(`Expected stable 53-tool raw-video + workspace-discovery + legacy MCP surface; found ${listed.tools.length}.`)
  for (const required of [
    'production.list_projects',
    'production.import_source_video',
    'source.list_workspace_inputs',
    'source.attach_transcript',
    'source.analyze_video',
    'motion.plan_opportunities',
    'motion.create_scene_batch',
    'motion.advance_scene_batch',
    'production.apply_approved_scene_batch',
    'production.export_video',
    'production.get_export_status',
    'production.cancel_export',
  ]) if (!names.includes(required)) throw new Error(`MCP tools/list is missing ${required}.`)

  const initial = await call<{ projects: readonly unknown[]; activeProjectId: string | null }>('production.list_projects')
  if (initial.projects.length !== 0 || initial.activeProjectId !== null) throw new Error('Isolated E2E did not start from zero projects.')

  const imported = await call<Record<string, unknown>>('production.import_source_video', {
    localPath: videoPath,
    projectLabel: 'Raw Video MCP E2E',
    transactionId: 'raw_video_e2e_import_001',
  })
  const projectId = String(imported.projectId)
  const importedRevision = Number(imported.revision)
  if (!/^project_[a-z0-9]{16,64}$/u.test(projectId) || !Number.isSafeInteger(importedRevision)) throw new Error('Import did not return canonical project identity/revision.')

  const transcriptContents = await readFile(transcriptPath, 'utf8')
  const transcript = await call<Record<string, unknown>>('source.attach_transcript', {
    format: 'srt',
    contents: transcriptContents,
    transactionId: 'raw_video_e2e_transcript_001',
  })
  if (transcript.analysisOnly !== true) throw new Error('Transcript was not analysis-only.')

  const sourcePacket = await call<Record<string, unknown>>('source.analyze_video', { transcriptRef: transcript.transcriptRef })
  const map = await call<Record<string, unknown>>('motion.plan_opportunities', {
    sourcePacketRef: sourcePacket.id,
    transcriptRef: transcript.transcriptRef,
    targetCount: 3,
  })
  const opportunities = map.opportunities as readonly unknown[]
  if (!Array.isArray(opportunities) || opportunities.length !== 3) throw new Error('Planner did not return exactly three bounded opportunities.')

  const batch = await call<Record<string, unknown>>('motion.create_scene_batch', {
    opportunityMapId: map.id,
    transactionId: 'raw_video_e2e_scene_batch_001',
  })
  const batchId = String(batch.id)
  const scenes = batch.scenes as readonly Record<string, unknown>[]
  if (!Array.isArray(scenes) || scenes.length !== 3) throw new Error('Scene batch did not create three isolated Storyboards.')

  await callExpectedRefusal('motion.advance_scene_batch', { batchId, action: 'advance', scope: 'animatic' }, 'STORYBOARD_APPROVAL_REQUIRED')
  const storyboardApprovals = await approveRequests(batchId, 'storyboard')
  await call('motion.advance_scene_batch', { batchId, action: 'advance', scope: 'animatic' })
  await callExpectedRefusal('motion.advance_scene_batch', { batchId, action: 'advance', scope: 'motion' }, 'ANIMATIC_APPROVAL_REQUIRED')
  const animaticApprovals = await approveRequests(batchId, 'animatic')
  await call('motion.advance_scene_batch', { batchId, action: 'advance', scope: 'motion' })
  const motionApprovals = await approveRequests(batchId, 'motion')

  const ready = await call<Record<string, unknown>>('production.get_owner_review_status', { batchId })
  if (ready.readyForProductionApply !== true) throw new Error('Batch did not become production-apply ready after exact host approvals.')

  const beforeApply = await readProductionProject(projectId)
  const applied = await call<Record<string, unknown>>('production.apply_approved_scene_batch', {
    batchId,
    transactionId: 'raw_video_e2e_apply_001',
  })
  const acceptedRevision = Number(applied.projectRevision)
  if (acceptedRevision !== beforeApply.revision + 1) throw new Error('Atomic Creative apply did not advance production by exactly one revision.')
  const afterApply = await readProductionProject(projectId)
  const acceptedRecord = afterApply.changeSets.find((record) => record.changeSet.changeSetId === applied.changeSetId)
  if (!acceptedRecord?.active || acceptedRecord.changeSet.operations.length !== 3 || !acceptedRecord.changeSet.operations.every((operation) => operation.kind === 'add-creative-scene')) {
    throw new Error('Accepted production state does not contain one active three-scene Creative ChangeSet.')
  }

  await callExpectedRefusal('production.export_video', { productionRevision: acceptedRevision - 1 }, 'PRODUCTION_REVISION_STALE')
  const exportStart = await call<Record<string, unknown>>('production.export_video', { productionRevision: acceptedRevision })
  const jobId = String(exportStart.jobId)
  const finished = await pollExport(jobId)
  const exportResult = asRecord(finished.result)
  if (exportResult.hasAudio !== true || exportResult.projectRevision !== acceptedRevision) throw new Error('Export result lost audio or project-revision identity.')
  const mediaUrl = String(exportResult.mediaUrl)
  const mediaResponse = await fetch(`${SANVERSE_API_URL}${mediaUrl}`)
  if (!mediaResponse.ok) throw new Error(`Published export media returned ${mediaResponse.status}.`)
  const bytes = new Uint8Array(await mediaResponse.arrayBuffer())
  const downloadedSha = sha256Bytes(bytes)
  if (downloadedSha !== exportResult.sha256) throw new Error('Downloaded export bytes do not match the production export SHA-256.')
  await writeFile(downloadedExportPath, bytes)

  const undone = await undoProductionProject(projectId)
  if (undone.changeSets.some((record) => record.changeSet.changeSetId === applied.changeSetId)) throw new Error('One production Undo did not remove the entire Creative batch history entry.')
  const redone = await redoProductionProject(projectId)
  const restored = redone.changeSets.find((record) => record.changeSet.changeSetId === applied.changeSetId)
  if (!restored?.active || restored.changeSet.operations.length !== 3) throw new Error('One production Redo did not restore the entire Creative batch.')

  const componentIds = (ready.scenes as readonly Record<string, unknown>[]).map((scene) => String(scene.componentId))
  const evidence = Object.freeze({
    schemaVersion: 'sanverse.external-mcp-raw-video-e2e-evidence/v1',
    endpoint: SANVERSE_MCP_ENDPOINT,
    initialProjectCount: 0,
    toolCount: listed.tools.length,
    projectId,
    importedRevision,
    acceptedRevision,
    opportunityCount: opportunities.length,
    sceneCount: scenes.length,
    componentIds,
    componentFamilyCount: new Set(componentIds).size,
    ownerApprovals: Object.freeze({ storyboard: storyboardApprovals, animatic: animaticApprovals, motion: motionApprovals }),
    oneChangeSet: true,
    undo: true,
    redo: true,
    export: Object.freeze({
      jobId,
      exportId: exportResult.id,
      width: exportResult.width,
      height: exportResult.height,
      durationMs: exportResult.durationMs,
      hasAudio: exportResult.hasAudio,
      sha256: exportResult.sha256,
      downloadedSha256: downloadedSha,
      byteLength: bytes.byteLength,
      projectRevision: exportResult.projectRevision,
      path: downloadedExportPath,
    }),
  })
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(evidence, null, 2))
} finally {
  await transport.terminateSession().catch(() => undefined)
  await transport.close().catch(() => undefined)
}
