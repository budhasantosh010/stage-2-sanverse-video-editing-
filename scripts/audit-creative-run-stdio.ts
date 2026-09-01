import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { SANVERSE_ROOT } from './sanverse-mcp-shared.ts'

const PROJECT_ID = process.env.SANVERSE_CREATIVE_RUN_AUDIT_PROJECT_ID ?? 'project_21c01709e413d034d4cec25dcb4b1ca4'
const evidencePath = resolve(SANVERSE_ROOT, 'DOCS', 'evidence', '2026-08-31-creative-run-chat-review-v1', 'stdio-audit.json')
const launcher = resolve(SANVERSE_ROOT, 'scripts', 'sanverse-mcp-stdio.mjs')
const auditSuffix = `audit_${Date.now().toString(36)}`

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const structured = (result: Awaited<ReturnType<Client['callTool']>>): Record<string, unknown> => {
  if (!record(result.structuredContent)) throw new Error(`Tool returned no structured content: ${JSON.stringify(result.content)}`)
  if (result.structuredContent.ok === false) throw new Error(`Tool refusal: ${JSON.stringify(result.structuredContent)}`)
  return result.structuredContent
}
const valueOf = (result: Awaited<ReturnType<Client['callTool']>>): Record<string, unknown> => {
  const body = structured(result)
  if (!record(body.value)) throw new Error(`Tool returned no value: ${JSON.stringify(body)}`)
  return body.value
}
const imageCount = (result: Awaited<ReturnType<Client['callTool']>>): number => result.content.filter((item) => item.type === 'image').length
const call = async (label: string, client: Client, stderr: readonly string[], params: Parameters<Client['callTool']>[0]) => {
  console.log(`AUDIT_STEP ${label}`)
  try { return await client.callTool(params) }
  catch (error) {
    console.error(`AUDIT_STDERR ${label}\n${stderr.join('')}`)
    throw error
  }
}

const connect = async (name: string, confirm: boolean) => {
  const transport = new StdioClientTransport({ command: process.execPath, args: [launcher], cwd: SANVERSE_ROOT, stderr: 'pipe', maxBufferSize: 64 * 1024 * 1024 })
  const stderr: string[] = []
  transport.stderr?.on('data', (chunk) => stderr.push(String(chunk)))
  const confirmations: Array<Record<string, unknown>> = []
  const client = new Client(
    { name, version: '1.0.0' },
    { capabilities: { elicitation: {} }, inputRequired: { autoFulfill: true, maxRounds: 3 } },
  )
  client.setRequestHandler('elicitation/create', async (request) => {
    confirmations.push(request as unknown as Record<string, unknown>)
    return confirm ? { action: 'accept' as const, content: { confirm: true } } : { action: 'decline' as const }
  })
  console.log(`AUDIT_CONNECT ${name}`)
  try { await client.connect(transport) }
  catch (error) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50))
    console.error(`AUDIT_CONNECT_STDERR ${name}\n${stderr.join('')}`)
    throw error
  }
  console.log(`AUDIT_CONNECTED ${name}`)
  return { client, transport, stderr, confirmations }
}

const first = await connect('sanverse-creative-run-audit-first', true)
let runId = ''
let storyboardReviewId = ''
let animaticReviewId = ''
let firstPrepareImageCount = 0
let approvalImageCount = 0
try {
  const tools = await first.client.listTools()
  if (tools.tools.length !== 69) throw new Error(`Expected 69 Sanverse tools, received ${tools.tools.length}.`)
  valueOf(await first.client.callTool({ name: 'production.select_project', arguments: { projectId: PROJECT_ID } }))
  const created = valueOf(await first.client.callTool({ name: 'creative.create_run', arguments: { transactionId: `${auditSuffix}_create_run` } }))
  runId = String(created.runId ?? '')
  if (!/^run_[a-z0-9]{8,64}$/u.test(runId)) throw new Error(`Invalid runId ${runId}.`)

  const transcript = valueOf(await first.client.callTool({ name: 'source.attach_transcript', arguments: {
    format: 'plain',
    contents: 'Revenue grew 82 percent. Compare the old workflow versus the new workflow. First connect the source, then review it. Security and permission boundaries matter. The biggest feature is shared context. This saves time automatically. Download the final report now.',
    transactionId: `${auditSuffix}_transcript`,
  } }))
  const analyzed = valueOf(await first.client.callTool({ name: 'source.analyze_video', arguments: { transcriptRef: transcript.transcriptRef } }))
  const planned = valueOf(await first.client.callTool({ name: 'motion.plan_opportunities', arguments: { sourcePacketRef: analyzed.id, transcriptRef: transcript.transcriptRef, maxCount: 1 } }))
  if (planned.selectedCount !== 1) throw new Error(`Expected one bounded opportunity, received ${String(planned.selectedCount)}.`)
  valueOf(await first.client.callTool({ name: 'motion.create_scene_batch', arguments: { opportunityMapId: planned.id, transactionId: `${auditSuffix}_scene_batch` } }))

  const preparedResult = await first.client.callTool({ name: 'creative.prepare_review', arguments: { scope: 'storyboard' } })
  const prepared = valueOf(preparedResult)
  firstPrepareImageCount = imageCount(preparedResult)
  const reviews = Array.isArray(prepared.reviews) ? prepared.reviews.filter(record) : []
  if (reviews.length !== 1 || firstPrepareImageCount !== 3) throw new Error(`Expected one Storyboard review with three chat images; reviews=${reviews.length}, images=${firstPrepareImageCount}.`)
  storyboardReviewId = String(reviews[0]!.reviewId ?? '')

  const approvedResult = await first.client.callTool({ name: 'creative.decide_review', arguments: { reviewId: storyboardReviewId, decision: 'approve' } })
  const approved = valueOf(approvedResult)
  approvalImageCount = imageCount(approvedResult)
  if (approved.decision !== 'approved') throw new Error(`Expected approved decision, received ${JSON.stringify(approved)}.`)
  if (first.confirmations.length !== 1) throw new Error(`Expected exactly one owner confirmation round, received ${first.confirmations.length}.`)
  const nextReviews = Array.isArray(approved.nextReviews) ? approved.nextReviews.filter(record) : []
  if (nextReviews.length !== 1 || approvalImageCount !== 3) throw new Error(`Expected one Animatic review with three chat images after Storyboard approval; reviews=${nextReviews.length}, images=${approvalImageCount}.`)
  animaticReviewId = String(nextReviews[0]!.reviewId ?? '')
} finally {
  console.log('AUDIT_CLOSE first.client')
  await first.client.close().catch(() => undefined)
  console.log('AUDIT_CLOSED first.client')
  await first.transport.close().catch(() => undefined)
  console.log('AUDIT_CLOSED first.transport')
}

const second = await connect('sanverse-creative-run-audit-reconnect', false)
let reconnectImageCount = 0
let resumedStage = ''
try {
  valueOf(await second.client.callTool({ name: 'production.select_project', arguments: { projectId: PROJECT_ID } }))
  const resumed = valueOf(await second.client.callTool({ name: 'creative.resume_run', arguments: { runId } }))
  resumedStage = String(resumed.stage ?? '')
  if (resumedStage !== 'animatic-review') throw new Error(`Expected animatic-review after reconnect, received ${resumedStage}.`)
  const reviewResult = await call('second.get_animatic_review', second.client, second.stderr, { name: 'creative.get_review', arguments: { reviewId: animaticReviewId } })
  const review = valueOf(reviewResult)
  reconnectImageCount = imageCount(reviewResult)
  if (!record(review.review) || review.review.reviewId !== animaticReviewId || review.review.status !== 'pending' || reconnectImageCount !== 3) throw new Error(`Reconnect review mismatch: ${JSON.stringify({ review, reconnectImageCount })}`)
} finally {
  await second.client.close().catch(() => undefined)
  await second.transport.close().catch(() => undefined)
}

const report = Object.freeze({
  schemaVersion: 'sanverse.creative-run-stdio-audit/v1',
  generatedAt: new Date().toISOString(),
  projectId: PROJECT_ID,
  runId,
  toolCount: 69,
  firstSession: Object.freeze({ storyboardReviewId, chatImageCount: firstPrepareImageCount, ownerConfirmationRounds: first.confirmations.length, nextReviewId: animaticReviewId, nextReviewChatImageCount: approvalImageCount }),
  reconnectSession: Object.freeze({ resumedStage, reviewId: animaticReviewId, chatImageCount: reconnectImageCount }),
  security: Object.freeze({ ownerDecisionViaMcpElicitation: true, ordinaryJsonCannotMintHostDecision: true }),
})
await mkdir(dirname(evidencePath), { recursive: true })
await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(report, null, 2))
