import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { SANVERSE_ROOT } from './sanverse-mcp-shared.ts'

const preferredProjectId = process.env.SANVERSE_STORYBOARD_AUTHORING_AUDIT_PROJECT_ID ?? 'project_21c01709e413d034d4cec25dcb4b1ca4'
const evidencePath = resolve(SANVERSE_ROOT, 'DOCS', 'evidence', '2026-09-01-general-storyboard-authoring-v1', 'stdio-authoring-audit.json')
const launcher = resolve(SANVERSE_ROOT, 'scripts', 'sanverse-mcp-stdio.mjs')
const suffix = Date.now().toString(36)
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const valueOf = (result: Awaited<ReturnType<Client['callTool']>>): Record<string, unknown> => {
  if (!record(result.structuredContent) || result.structuredContent.ok === false || !record(result.structuredContent.value)) throw new Error(`Tool refusal/result mismatch: ${JSON.stringify(result.structuredContent ?? result.content)}`)
  return result.structuredContent.value
}
const refusalCodeOf = (result: Awaited<ReturnType<Client['callTool']>>): string | null => record(result.structuredContent) && result.structuredContent.ok === false && record(result.structuredContent.refusal) && typeof result.structuredContent.refusal.code === 'string' ? result.structuredContent.refusal.code : null
const imageCount = (result: Awaited<ReturnType<Client['callTool']>>): number => result.content.filter((item) => item.type === 'image').length

const transport = new StdioClientTransport({ command: process.execPath, args: [launcher], cwd: SANVERSE_ROOT, stderr: 'pipe', maxBufferSize: 64 * 1024 * 1024 })
const stderr: string[] = []
transport.stderr?.on('data', (chunk) => stderr.push(String(chunk)))
const confirmations: Array<Record<string, unknown>> = []
const client = new Client({ name: 'sanverse-storyboard-authoring-audit', version: '1.0.0' }, { capabilities: { elicitation: {} }, inputRequired: { autoFulfill: true, maxRounds: 4 } })
client.setRequestHandler('elicitation/create', async (request) => {
  confirmations.push(request as unknown as Record<string, unknown>)
  return { action: 'accept' as const, content: { confirm: true } }
})

try {
  await client.connect(transport)
  const tools = await client.listTools()
  if (tools.tools.length !== 73) throw new Error(`Expected 73 Sanverse tools, received ${tools.tools.length}.`)
  const requiredTools = ['creative.propose_direction','creative.get_direction','creative.revise_direction','creative.reopen_direction','creative.inspect_storyboard','creative.get_storyboard_authoring_schema','creative.apply_storyboard_graph_operations','creative.prepare_review']
  for (const id of requiredTools) if (!tools.tools.some((tool) => tool.name === id)) throw new Error(`Missing required authoring tool ${id}.`)

  const listed = valueOf(await client.callTool({ name:'production.list_projects', arguments:{} }))
  const projects = Array.isArray(listed.projects) ? listed.projects.filter(record) : []
  const projectId = projects.some((project) => project.id === preferredProjectId) ? preferredProjectId : String(projects[0]?.id ?? '')
  if (!/^project_[a-z0-9]{16,64}$/u.test(projectId)) throw new Error('No production project is available for the Storyboard authoring audit.')
  valueOf(await client.callTool({ name:'production.select_project', arguments:{ projectId } }))
  const before = valueOf(await client.callTool({ name:'production.get_project_context', arguments:{} }))
  const productionRevision = Number(before.revision)

  const schema = valueOf(await client.callTool({ name:'creative.get_storyboard_authoring_schema', arguments:{} }))
  if (!Array.isArray(schema.operationTypes) || !schema.operationTypes.includes('set-node-static-property') || !schema.operationTypes.includes('duplicate-node') || !schema.operationTypes.includes('add-semantic-part')) throw new Error('General authoring schema is missing required canonical operation types.')

  const created = valueOf(await client.callTool({ name:'creative.create_run', arguments:{ transactionId:`authoring_audit_${suffix}_run` } }))
  const runId = String(created.runId ?? '')
  const transcript = valueOf(await client.callTool({ name:'source.attach_transcript', arguments:{ format:'plain', contents:'The plan costs $29. Compare the current plan with the improved plan. Make the price unmistakable and show a strong circular proof point.', transactionId:`authoring_audit_${suffix}_transcript` } }))
  const analyzed = valueOf(await client.callTool({ name:'source.analyze_video', arguments:{ transcriptRef:transcript.transcriptRef } }))
  const blockedBeforeDirection = await client.callTool({ name:'motion.plan_opportunities', arguments:{ sourcePacketRef:analyzed.id, transcriptRef:transcript.transcriptRef, maxCount:3 } })
  if (refusalCodeOf(blockedBeforeDirection) !== 'CREATIVE_DIRECTION_APPROVAL_REQUIRED') throw new Error('Opportunity planning did not fail closed before Creative Direction approval.')

  const proposedResult = await client.callTool({ name:'creative.propose_direction', arguments:{ sourcePacketRef:analyzed.id, brandContext:{ ownerBrief:'Use a clear editorial direction with a restrained purple accent and source-first readability.', palette:['#0B0C10','#8B5CF6','#FFFFFF'], traits:['clean','editorial'] }, preferences:{ motionIntensity:0.35, density:'medium' } } })
  const proposed = valueOf(proposedResult)
  if (!record(proposed.proposal) || !record(proposed.review) || proposed.review.scope !== 'creative-direction' || imageCount(proposedResult) < 1) throw new Error('Creative Direction proposal did not produce a chat-visible review board.')
  const firstDirectionReviewId = String(proposed.review.reviewId ?? '')
  const proposalId = String(proposed.proposal.proposalId ?? '')
  const revisedResult = await client.callTool({ name:'creative.revise_direction', arguments:{ proposalId, expectedRevision:1, changes:{ paletteRoles:{ accent:'#8B5CF6' }, baseTiming:'calm' }, reason:'Use the approved purple accent with calmer motion.' } })
  const revised = valueOf(revisedResult)
  if (!record(revised.proposal) || Number(revised.proposal.revision) !== 2 || !record(revised.review)) throw new Error('Creative Direction revision did not advance to revision 2 with fresh evidence.')
  const staleDirectionDecision = await client.callTool({ name:'creative.decide_review', arguments:{ reviewId:firstDirectionReviewId, decision:'approve' } })
  if (refusalCodeOf(staleDirectionDecision) !== 'CREATIVE_DIRECTION_STALE') throw new Error('Stale Creative Direction review evidence was not refused.')
  const approvedDirectionResult = await client.callTool({ name:'creative.decide_review', arguments:{ reviewId:String(revised.review.reviewId ?? ''), decision:'approve' } })
  const approvedDirection = valueOf(approvedDirectionResult)
  if (approvedDirection.decision !== 'approved' || !record(approvedDirection.approvedStyleLock)) throw new Error('Exact revised Creative Direction did not compile into an Approved Style Lock.')
  const approvedStyleLock = approvedDirection.approvedStyleLock
  if (Number(approvedStyleLock.proposalRevision) !== 2 || typeof approvedStyleLock.contentHash !== 'string' || !/^[a-f0-9]{64}$/u.test(approvedStyleLock.contentHash)) throw new Error('Approved Style Lock provenance is incomplete.')

  const planned = valueOf(await client.callTool({ name:'motion.plan_opportunities', arguments:{ sourcePacketRef:analyzed.id, transcriptRef:transcript.transcriptRef, maxCount:3 } }))
  if (!record(planned.styleLockRef) || planned.styleLockRef.styleLockId !== approvedStyleLock.styleLockId || planned.styleLockRef.contentHash !== approvedStyleLock.contentHash || Number(planned.styleLockRef.proposalRevision) !== 2) throw new Error('Opportunity map did not preserve exact Approved Style Lock provenance.')
  const batch = valueOf(await client.callTool({ name:'motion.create_scene_batch', arguments:{ opportunityMapId:planned.id, transactionId:`authoring_audit_${suffix}_batch` } }))
  const batchId = String(batch.id ?? '')
  const scenes = Array.isArray(batch.scenes) ? batch.scenes.filter(record) : []
  if (scenes.length === 0) throw new Error('Authoring audit produced no Creative scenes.')

  let chosen: Readonly<{ sceneId:string; inspection:Record<string,unknown>; textId:string; shapeId:string; expectedStateIds:readonly string[] }> | null = null
  for (const scene of scenes) {
    const sceneId = String(scene.sceneId ?? '')
    const inspection = valueOf(await client.callTool({ name:'creative.inspect_storyboard', arguments:{ batchId, sceneId } }))
    if (!record(inspection.storyboard) || !Array.isArray(inspection.storyboard.states) || !record(inspection.storyboard.states[0])) continue
    const graph = record(inspection.storyboard.states[0].graphState) ? inspection.storyboard.states[0].graphState : null
    if (!graph || !record(graph.nodes)) continue
    const nodes = Object.values(graph.nodes).filter(record)
    const textNode = nodes.find((node) => node.type === 'text' && typeof node.id === 'string')
    const shapeNode = nodes.find((node) => node.type === 'shape' && typeof node.id === 'string')
    if (textNode && shapeNode) {
      const expectedStateIds = Object.freeze(inspection.storyboard.states.filter(record).filter((state) => record(state.graphState) && record(state.graphState.nodes) && record(state.graphState.nodes[String(textNode.id)]) && record(state.graphState.nodes[String(shapeNode.id)])).map((state) => String(state.id ?? '')).filter(Boolean))
      if (expectedStateIds.length > 0) { chosen = Object.freeze({ sceneId, inspection, textId:String(textNode.id), shapeId:String(shapeNode.id), expectedStateIds }); break }
    }
  }
  if (!chosen) throw new Error('No generated scene exposed both canonical text and shape nodes for the real authoring battery.')

  let revision = Number(chosen.inspection.sandboxRevision)
  const currency = valueOf(await client.callTool({ name:'creative.apply_storyboard_graph_operations', arguments:{ batchId, sceneId:chosen.sceneId, transactionId:`authoring_audit_${suffix}_currency`, expectedSandboxRevision:revision, targets:{mode:'all-states-containing-node',nodeId:chosen.textId}, operations:[{operationId:`op_${suffix}_currency`,type:'set-property',target:{nodeId:chosen.textId,property:'text.text'},value:{kind:'constant',value:'£29'}}] } }))
  revision = Number(currency.sandboxRevision)
  const ellipse = valueOf(await client.callTool({ name:'creative.apply_storyboard_graph_operations', arguments:{ batchId, sceneId:chosen.sceneId, transactionId:`authoring_audit_${suffix}_ellipse`, expectedSandboxRevision:revision, targets:{mode:'all-states-containing-node',nodeId:chosen.shapeId}, operations:[{operationId:`op_${suffix}_ellipse`,type:'set-node-static-property',nodeId:chosen.shapeId,change:{property:'shape.shape',value:'ellipse'}}] } }))
  revision = Number(ellipse.sandboxRevision)

  const duplicateId = `agent-proof-${suffix}`
  const partId = `part:agent-proof-${suffix}`
  const redesign = valueOf(await client.callTool({ name:'creative.apply_storyboard_graph_operations', arguments:{ batchId, sceneId:chosen.sceneId, transactionId:`authoring_audit_${suffix}_redesign`, expectedSandboxRevision:revision, targets:{mode:'all-states-containing-node',nodeId:chosen.textId}, operations:[
    {operationId:`op_${suffix}_duplicate`,type:'duplicate-node',nodeId:chosen.textId,duplicateId},
    {operationId:`op_${suffix}_label`,type:'set-property',target:{nodeId:duplicateId,property:'text.text'},value:{kind:'constant',value:'PROOF'}},
    {operationId:`op_${suffix}_move`,type:'set-property',target:{nodeId:duplicateId,property:'transform.positionY'},value:{kind:'constant',value:120}},
    {operationId:`op_${suffix}_semantic`,type:'add-semantic-part',part:{id:partId,label:'Proof label',role:'content-group',nodeIds:[duplicateId]}},
  ] } }))
  revision = Number(redesign.sandboxRevision)

  const finalInspection = valueOf(await client.callTool({ name:'creative.inspect_storyboard', arguments:{ batchId, sceneId:chosen.sceneId } }))
  if (Number(finalInspection.sandboxRevision) !== revision) throw new Error('Final Storyboard inspection revision does not match the authored transaction result.')
  if (!record(finalInspection.storyboard) || !Array.isArray(finalInspection.storyboard.states)) throw new Error('Final Storyboard inspection is missing KVS state.')
  const authoredStates = finalInspection.storyboard.states.filter(record).filter((state) => chosen!.expectedStateIds.includes(String(state.id ?? '')))
  if (authoredStates.length !== chosen.expectedStateIds.length) throw new Error('Final Storyboard inspection lost one or more KVS states targeted by the authoring transaction.')
  for (const rawState of authoredStates) {
    if (!record(rawState.graphState) || !record(rawState.graphState.nodes)) throw new Error('Final authored KVS graph is malformed.')
    const text = rawState.graphState.nodes[chosen.textId]
    const shape = rawState.graphState.nodes[chosen.shapeId]
    const duplicate = rawState.graphState.nodes[duplicateId]
    if (!record(text) || !record(text.text) || text.text.kind !== 'constant' || text.text.value !== '£29') throw new Error('Currency authoring did not persist across every targeted KVS state.')
    if (!record(shape) || shape.type !== 'shape' || shape.shape !== 'ellipse') throw new Error('Ellipse authoring did not persist across every targeted KVS state.')
    if (!record(duplicate) || duplicate.type !== 'text') throw new Error('Major structural redesign did not persist its duplicated proof label across every targeted KVS state.')
  }

  const reviewResult = await client.callTool({ name:'creative.prepare_review', arguments:{ scope:'storyboard' } })
  const reviewValue = valueOf(reviewResult)
  const reviews = Array.isArray(reviewValue.reviews) ? reviewValue.reviews.filter(record) : []
  const selectedReview = reviews.find((review) => review.sceneId === chosen!.sceneId)
  if (!selectedReview || !record(selectedReview.context) || !Array.isArray(selectedReview.context.states)) throw new Error('Storyboard review did not expose persisted authoring context.')
  const selectedStates = selectedReview.context.states.filter(record)
  if (selectedStates.length < 2 || !selectedStates.every((state) => Number(state.sourceFrameTick) === Number(selectedReview.context!.sourceStartTick) + Number(state.localTick))) throw new Error('Storyboard review source-frame mapping is not exact.')
  if (!selectedStates.some((state) => Array.isArray(state.addedNodeIds) && state.addedNodeIds.includes(duplicateId))) throw new Error('Storyboard review diff did not expose the structural redesign.')
  const semanticChanges = selectedStates.flatMap((state) => Array.isArray(state.changedNodes) ? state.changedNodes.filter(record).flatMap((node) => Array.isArray(node.changes) ? node.changes.filter(record) : []) : [])
  if (!semanticChanges.some((change) => String(change.to ?? '').includes('£29'))) throw new Error('Storyboard chat context did not expose the authored pound value in its semantic before/after diff.')
  if (!semanticChanges.some((change) => String(change.to ?? '').includes('ellipse'))) throw new Error('Storyboard chat context did not expose the authored ellipse in its semantic before/after diff.')
  const selectedArtifacts = Array.isArray(selectedReview.artifacts) ? selectedReview.artifacts.filter(record) : []
  if (selectedArtifacts.length !== selectedStates.length || !selectedArtifacts.every((artifact) => String(artifact.label ?? '').includes('source composite') && String(artifact.safeUrl ?? '').includes('sourceVisible=1'))) throw new Error('Storyboard review evidence is not exact KVS source-composited evidence.')
  if (imageCount(reviewResult) < selectedArtifacts.length) throw new Error('STDIO chat did not attach the source-composited KVS images.')

  const after = valueOf(await client.callTool({ name:'production.get_project_context', arguments:{} }))
  if (Number(after.revision) !== productionRevision) throw new Error('Storyboard authoring audit mutated accepted production revision before owner approval/apply.')

  const report = Object.freeze({
    schemaVersion:'sanverse.storyboard-authoring-stdio-audit/v1',
    generatedAt:new Date().toISOString(),
    projectId,
    productionRevision,
    runId,
    batchId,
    sceneId:chosen.sceneId,
    toolCount:tools.tools.length,
    creativeDirection:Object.freeze({ proposalId, approvedRevision:2, styleLockId:String(approvedStyleLock.styleLockId ?? ''), contentHash:String(approvedStyleLock.contentHash ?? ''), staleReviewRefused:true, confirmationRounds:confirmations.length }),
    authoring:Object.freeze({ currency:'£29', shape:'ellipse', duplicatedNodeId:duplicateId, semanticPartId:partId, finalSandboxRevision:revision }),
    review:Object.freeze({ reviewId:String(selectedReview.reviewId ?? ''), kvsCount:selectedStates.length, artifactCount:selectedArtifacts.length, chatImageCount:imageCount(reviewResult), sourceComposite:true, contextHash:createHash('sha256').update(JSON.stringify(selectedReview.context)).digest('hex') }),
    productionMutation:false,
  })
  await mkdir(dirname(evidencePath), { recursive:true })
  await writeFile(evidencePath, `${JSON.stringify(report,null,2)}\n`, 'utf8')
  console.log(JSON.stringify(report,null,2))
} catch (error) {
  console.error(stderr.join(''))
  throw error
} finally {
  await client.close().catch(() => undefined)
  await transport.close().catch(() => undefined)
}
