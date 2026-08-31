import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { SANVERSE_ROOT } from './sanverse-mcp-shared.ts'

const PROJECT_ID = process.env.SANVERSE_CONTINUATION_PROJECT_ID ?? 'project_21c01709e413d034d4cec25dcb4b1ca4'
const RUN_ID = process.env.SANVERSE_CONTINUATION_RUN_ID ?? 'run_00n2km2k'
const REVIEW_ID = process.env.SANVERSE_CONTINUATION_REVIEW_ID ?? 'review_000cuypa'
const launcher = resolve(SANVERSE_ROOT, 'scripts', 'sanverse-mcp-stdio.mjs')
const evidencePath = resolve(SANVERSE_ROOT, 'DOCS', 'evidence', '2026-09-01-mcp-continuation-v1', 'stdio-reconnect.json')

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const valueOf = (result: Awaited<ReturnType<Client['callTool']>>, label: string): Record<string, unknown> => {
  if (!record(result.structuredContent)) throw new Error(`${label}: missing structuredContent.`)
  if (result.structuredContent.ok !== true || !record(result.structuredContent.value)) {
    throw new Error(`${label}: ${JSON.stringify(result.structuredContent)}`)
  }
  return result.structuredContent.value
}
const imageCount = (result: Awaited<ReturnType<Client['callTool']>>): number => result.content.filter((item) => item.type === 'image').length

const connect = async (name: string) => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [launcher],
    cwd: SANVERSE_ROOT,
    stderr: 'pipe',
    maxBufferSize: 64 * 1024 * 1024,
  })
  const stderr: string[] = []
  transport.stderr?.on('data', (chunk) => stderr.push(String(chunk)))
  const client = new Client({ name, version: '1.0.0' }, { capabilities: {} })
  const startedAt = Date.now()
  await client.connect(transport)
  return Object.freeze({ client, transport, stderr, connectMs: Date.now() - startedAt })
}

type ContinuationSnapshot = Readonly<{
  stage: string
  reviewId: string
  reviewStatus: string
  evidenceHash: string
  subjectId: string
  subjectRevision: number
  artifactIdentity: readonly string[]
  chatImageCount: number
  toolCount: number
}>

const snapshot = async (client: Client): Promise<ContinuationSnapshot> => {
  const tools = await client.listTools()
  if (tools.tools.length !== 62) throw new Error(`Expected 62 Sanverse tools, received ${tools.tools.length}.`)
  valueOf(await client.callTool({ name: 'production.select_project', arguments: { projectId: PROJECT_ID } }), 'select project')
  const resumed = valueOf(await client.callTool({ name: 'creative.resume_run', arguments: { runId: RUN_ID } }), 'resume run')
  const stage = String(resumed.stage ?? '')
  if (!stage) throw new Error('Resumed run did not expose a stage.')

  const reviewResult = await client.callTool({ name: 'creative.get_review', arguments: { reviewId: REVIEW_ID } })
  const reviewValue = valueOf(reviewResult, 'get review')
  if (!record(reviewValue.review)) throw new Error('Review payload is missing.')
  const review = reviewValue.review
  const artifacts = Array.isArray(review.artifacts) ? review.artifacts.filter(record) : []
  const artifactIdentity = artifacts.map((artifact) => `${String(artifact.artifactId ?? '')}:${String(artifact.sha256 ?? '')}`).sort()
  const result: ContinuationSnapshot = Object.freeze({
    stage,
    reviewId: String(review.reviewId ?? ''),
    reviewStatus: String(review.status ?? ''),
    evidenceHash: String(review.evidenceHash ?? ''),
    subjectId: String(review.subjectId ?? ''),
    subjectRevision: Number(review.subjectRevision),
    artifactIdentity: Object.freeze(artifactIdentity),
    chatImageCount: imageCount(reviewResult),
    toolCount: tools.tools.length,
  })
  if (result.reviewId !== REVIEW_ID) throw new Error(`Expected review ${REVIEW_ID}, received ${result.reviewId}.`)
  if (!result.evidenceHash || !result.subjectId || !Number.isSafeInteger(result.subjectRevision)) throw new Error('Review identity is incomplete.')
  if (result.artifactIdentity.length === 0 || result.chatImageCount === 0) throw new Error('Persisted review evidence was not rehydrated into chat evidence.')
  return result
}

const close = async (connection: Awaited<ReturnType<typeof connect>>) => {
  await connection.client.close().catch(() => undefined)
  await connection.transport.close().catch(() => undefined)
}

const first = await connect('sanverse-continuation-process-a')
let firstSnapshot: ContinuationSnapshot
try {
  firstSnapshot = await snapshot(first.client)
} finally {
  await close(first)
}

// Process A is gone here. Process B gets a brand-new MCP transport/server process.
const second = await connect('sanverse-continuation-process-b')
let secondSnapshot: ContinuationSnapshot
try {
  secondSnapshot = await snapshot(second.client)
} finally {
  await close(second)
}

if (JSON.stringify(firstSnapshot) !== JSON.stringify(secondSnapshot)) {
  throw new Error(`Continuation identity changed across MCP process restart. first=${JSON.stringify(firstSnapshot)} second=${JSON.stringify(secondSnapshot)}`)
}

const report = Object.freeze({
  schemaVersion: 'sanverse.mcp-continuation-audit/v1',
  generatedAt: new Date().toISOString(),
  projectId: PROJECT_ID,
  runId: RUN_ID,
  reviewId: REVIEW_ID,
  transportProcesses: 2,
  processAClosedBeforeProcessB: true,
  samePersistedCreativeRun: true,
  sameReviewEvidenceIdentity: true,
  productionMutationRequested: false,
  first: Object.freeze({ connectMs: first.connectMs, snapshot: firstSnapshot, stderrHadHandshakeTimeout: first.stderr.join('').includes('timed out handshaking') }),
  second: Object.freeze({ connectMs: second.connectMs, snapshot: secondSnapshot, stderrHadHandshakeTimeout: second.stderr.join('').includes('timed out handshaking') }),
  contract: 'Client task/session identity may survive independently of the MCP process. On client resume, a new Sanverse transport can reinitialize and creative.resume_run rehydrates the same durable Creative Run/review.',
})

await mkdir(dirname(evidencePath), { recursive: true })
await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(report, null, 2))
