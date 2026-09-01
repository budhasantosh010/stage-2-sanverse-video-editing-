import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { SANVERSE_ROOT } from './sanverse-mcp-shared.ts'

const PROJECT_ID = process.env.SANVERSE_CONTINUATION_PROJECT_ID ?? 'project_21c01709e413d034d4cec25dcb4b1ca4'
const launcher = resolve(SANVERSE_ROOT, 'scripts', 'sanverse-mcp-stdio.mjs')
const evidencePath = resolve(SANVERSE_ROOT, 'DOCS', 'evidence', '2026-09-01-mcp-continuation-v1', 'stdio-reconnect.json')
const suffix = Date.now().toString(36)

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const valueOf = (result: Awaited<ReturnType<Client['callTool']>>, label: string): Record<string, unknown> => {
  if (!record(result.structuredContent) || result.structuredContent.ok !== true || !record(result.structuredContent.value)) throw new Error(`${label}: ${JSON.stringify(result.structuredContent ?? result.content)}`)
  return result.structuredContent.value
}
const imageCount = (result: Awaited<ReturnType<Client['callTool']>>): number => result.content.filter((item) => item.type === 'image').length

const connect = async (name: string, confirm: boolean) => {
  const transport = new StdioClientTransport({ command: process.execPath, args: [launcher], cwd: SANVERSE_ROOT, stderr: 'pipe', maxBufferSize: 64 * 1024 * 1024 })
  const stderr: string[] = []
  transport.stderr?.on('data', (chunk) => stderr.push(String(chunk)))
  const confirmations: Array<Record<string, unknown>> = []
  const client = new Client({ name, version: '1.0.0' }, { capabilities: { elicitation: {} }, inputRequired: { autoFulfill: true, maxRounds: 3 } })
  client.setRequestHandler('elicitation/create', async (request) => {
    confirmations.push(request as unknown as Record<string, unknown>)
    return confirm ? { action: 'accept' as const, content: { confirm: true } } : { action: 'decline' as const }
  })
  const startedAt = Date.now()
  await client.connect(transport)
  return { client, transport, stderr, confirmations, connectMs: Date.now() - startedAt }
}
const close = async (connection: Awaited<ReturnType<typeof connect>>) => {
  await connection.client.close().catch(() => undefined)
  await connection.transport.close().catch(() => undefined)
}
const verifyToolCount = async (client: Client): Promise<number> => {
  const count = (await client.listTools()).tools.length
  if (count !== 73) throw new Error(`Expected 73 Sanverse tools, received ${count}.`)
  return count
}
const productionRevision = async (client: Client): Promise<number> => Number(valueOf(await client.callTool({ name:'production.get_project_context', arguments:{} }), 'project context').revision)

type PendingSnapshot = Readonly<{ stage:string; reviewId:string; evidenceHash:string; subjectId:string; subjectRevision:number; artifactIdentity:readonly string[]; chatImageCount:number }>
const pendingSnapshot = async (client: Client, runId: string, reviewId: string): Promise<PendingSnapshot> => {
  const resumed = valueOf(await client.callTool({ name:'creative.resume_run', arguments:{ runId } }), 'resume pending run')
  const reviewResult = await client.callTool({ name:'creative.get_review', arguments:{ reviewId } })
  const wrapper = valueOf(reviewResult, 'get pending direction review')
  if (!record(wrapper.review)) throw new Error('Pending Creative Direction review payload is missing.')
  const review = wrapper.review
  const artifacts = Array.isArray(review.artifacts) ? review.artifacts.filter(record) : []
  return Object.freeze({
    stage:String(resumed.stage ?? ''),
    reviewId:String(review.reviewId ?? ''),
    evidenceHash:String(review.evidenceHash ?? ''),
    subjectId:String(review.subjectId ?? ''),
    subjectRevision:Number(review.subjectRevision),
    artifactIdentity:Object.freeze(artifacts.map((artifact) => `${String(artifact.artifactId ?? '')}:${String(artifact.sha256 ?? '')}`).sort()),
    chatImageCount:imageCount(reviewResult),
  })
}

let runId = ''
let reviewId = ''
let originalProductionRevision = -1
let processASnapshot: PendingSnapshot
const processA = await connect('sanverse-continuation-v2-a', false)
try {
  await verifyToolCount(processA.client)
  valueOf(await processA.client.callTool({ name:'production.select_project', arguments:{ projectId:PROJECT_ID } }), 'select project A')
  originalProductionRevision = await productionRevision(processA.client)
  const created = valueOf(await processA.client.callTool({ name:'creative.create_run', arguments:{ transactionId:`continuation_${suffix}_run` } }), 'create run')
  runId = String(created.runId ?? '')
  const transcript = valueOf(await processA.client.callTool({ name:'source.attach_transcript', arguments:{ format:'plain', contents:'Revenue improved 42 percent. Keep the video source visible, use clear editorial graphics, and explain the comparison without distracting from the speaker.', transactionId:`continuation_${suffix}_transcript` } }), 'attach transcript')
  const analyzed = valueOf(await processA.client.callTool({ name:'source.analyze_video', arguments:{ transcriptRef:transcript.transcriptRef } }), 'analyze source')
  const proposedResult = await processA.client.callTool({ name:'creative.propose_direction', arguments:{ sourcePacketRef:analyzed.id, brandContext:{ ownerBrief:'Use a restrained editorial direction with a purple accent.', palette:['#0B0C10','#8B5CF6','#FFFFFF'], traits:['clean','editorial'] } } })
  const proposed = valueOf(proposedResult, 'propose direction')
  if (!record(proposed.review)) throw new Error('Creative Direction proposal did not expose a review.')
  reviewId = String(proposed.review.reviewId ?? '')
  processASnapshot = await pendingSnapshot(processA.client, runId, reviewId)
  if (processASnapshot.stage !== 'creative-direction-review' || processASnapshot.chatImageCount < 1 || processASnapshot.artifactIdentity.length < 1) throw new Error(`Process A pending snapshot is incomplete: ${JSON.stringify(processASnapshot)}`)
  if (await productionRevision(processA.client) !== originalProductionRevision) throw new Error('Process A mutated production while preparing Creative Direction.')
} finally { await close(processA) }

let processBSnapshot: PendingSnapshot
let approvedLock: Record<string, unknown>
const processB = await connect('sanverse-continuation-v2-b', true)
try {
  await verifyToolCount(processB.client)
  valueOf(await processB.client.callTool({ name:'production.select_project', arguments:{ projectId:PROJECT_ID } }), 'select project B')
  processBSnapshot = await pendingSnapshot(processB.client, runId, reviewId)
  if (JSON.stringify(processBSnapshot) !== JSON.stringify(processASnapshot)) throw new Error(`Pending Creative Direction identity changed across process restart. A=${JSON.stringify(processASnapshot)} B=${JSON.stringify(processBSnapshot)}`)
  const approved = valueOf(await processB.client.callTool({ name:'creative.decide_review', arguments:{ reviewId, decision:'approve' } }), 'approve direction after reconnect')
  if (approved.decision !== 'approved' || !record(approved.approvedStyleLock)) throw new Error('Process B did not create an Approved Style Lock.')
  approvedLock = approved.approvedStyleLock
  if (processB.confirmations.length !== 1) throw new Error(`Expected one trusted owner confirmation in process B; got ${processB.confirmations.length}.`)
  if (await productionRevision(processB.client) !== originalProductionRevision) throw new Error('Process B mutated production while approving Creative Direction.')
} finally { await close(processB) }

let processCStage = ''
let processCLock: Record<string, unknown>
const processC = await connect('sanverse-continuation-v2-c', false)
try {
  await verifyToolCount(processC.client)
  valueOf(await processC.client.callTool({ name:'production.select_project', arguments:{ projectId:PROJECT_ID } }), 'select project C')
  const resumed = valueOf(await processC.client.callTool({ name:'creative.resume_run', arguments:{ runId } }), 'resume approved run')
  processCStage = String(resumed.stage ?? '')
  const direction = valueOf(await processC.client.callTool({ name:'creative.get_direction', arguments:{} }), 'get approved direction')
  if (!record(direction.approvedStyleLock)) throw new Error('Approved Style Lock did not survive process restart.')
  processCLock = direction.approvedStyleLock
  for (const key of ['styleLockId','proposalId','proposalRevision','projectId','sourcePacketId','contentHash'] as const) if (processCLock[key] !== approvedLock[key]) throw new Error(`Approved Style Lock ${key} changed across restart.`)
  if (processCStage !== 'opportunity-planning') throw new Error(`Expected opportunity-planning after approved reconnect, received ${processCStage}.`)
  if (await productionRevision(processC.client) !== originalProductionRevision) throw new Error('Process C observed unexpected production mutation.')
} finally { await close(processC) }

const report = Object.freeze({
  schemaVersion:'sanverse.mcp-continuation-audit/v2',
  generatedAt:new Date().toISOString(),
  projectId:PROJECT_ID,
  productionRevision:originalProductionRevision,
  runId,
  reviewId,
  transportProcesses:3,
  processAClosedBeforeProcessB:true,
  processBClosedBeforeProcessC:true,
  reconnectBeforeApproval:Object.freeze({ exactPendingReviewIdentity:true, snapshot:processASnapshot }),
  approvalAfterReconnect:Object.freeze({ trustedConfirmationRounds:processB.confirmations.length, styleLockId:String(approvedLock.styleLockId ?? ''), contentHash:String(approvedLock.contentHash ?? ''), proposalRevision:Number(approvedLock.proposalRevision) }),
  reconnectAfterApproval:Object.freeze({ stage:processCStage, exactApprovedStyleLockIdentity:true, styleLockId:String(processCLock.styleLockId ?? ''), contentHash:String(processCLock.contentHash ?? '') }),
  productionMutationRequested:false,
  productionMutationObserved:false,
  first:Object.freeze({ connectMs:processA.connectMs, stderrHadHandshakeTimeout:processA.stderr.join('').includes('timed out handshaking') }),
  second:Object.freeze({ connectMs:processB.connectMs, stderrHadHandshakeTimeout:processB.stderr.join('').includes('timed out handshaking') }),
  third:Object.freeze({ connectMs:processC.connectMs, stderrHadHandshakeTimeout:processC.stderr.join('').includes('timed out handshaking') }),
  contract:'A Creative Run persists independently of MCP process lifetime. Pending Creative Direction evidence survives one fresh STDIO process; exact trusted approval can occur after reconnect; the resulting Approved Style Lock then survives another fresh STDIO process without mutating production.',
})
await mkdir(dirname(evidencePath), { recursive:true })
await writeFile(evidencePath, `${JSON.stringify(report,null,2)}\n`, 'utf8')
console.log(JSON.stringify(report,null,2))
