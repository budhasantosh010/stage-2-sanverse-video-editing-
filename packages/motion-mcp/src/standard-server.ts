import { randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server as NodeHttpServer, type ServerResponse } from 'node:http'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import type { SanverseToolDefinitionV1, SanverseToolRegistryV1, ToolExecutionContextV1 } from '@sanverse/motion-agent-tools'

export const SANVERSE_STANDARD_MCP_SERVER_NAME = 'sanverse-creative-engine' as const
export const SANVERSE_STANDARD_MCP_SERVER_VERSION = '1.0.0' as const
export const SANVERSE_EXTERNAL_CONTEXT_KEY = '_sanverse' as const

export type SanverseExternalWriteClassV1 = 'read' | 'sandbox-write' | 'owner-gated'
export interface SanverseExternalContextV1 {
  readonly sandboxId?: string
  readonly productionRevision?: number
}
export interface SanverseExternalRegistrySessionV1 {
  readonly registry: SanverseToolRegistryV1
  readonly label?: string
}
export interface SanverseExternalSessionContextV1 {
  readonly transport: 'stdio' | 'http'
  readonly workspaceRoot?: string
}
export type SanverseExternalRegistryFactoryV1 = (sessionLabel: string, context: SanverseExternalSessionContextV1) => SanverseExternalRegistrySessionV1 | Promise<SanverseExternalRegistrySessionV1>
export interface SanverseMcpToolCallEvidenceV1 {
  readonly at: string
  readonly sessionLabel: string
  readonly clientName: string
  readonly clientVersion: string
  readonly toolName: string
  readonly sandboxId: string | null
  readonly productionRevision: number | null
  readonly ok: boolean
  readonly refusalCode: string | null
  readonly resultSandboxId: string | null
  readonly reviewRef: string | null
  readonly resultRevision: number | null
}
export interface SanverseStandardMcpServerOptionsV1 {
  readonly sessionLabel?: string
  readonly onToolCall?: (event: SanverseMcpToolCallEvidenceV1) => void | Promise<void>
}

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const freezeRecord = (value: Record<string, unknown>) => Object.freeze({ ...value })

const descriptionById: Readonly<Record<string, string>> = Object.freeze({
  'production.list_projects': 'List production-backed Sanverse projects and this MCP session\'s active project. Works when there are zero projects and does not mutate production state.',
  'production.select_project': 'Select one existing Sanverse project for this MCP session only. This does not edit the project; project-specific tools read the live server-authoritative revision before mutation.',
  'production.import_source_video': 'Import one allowlisted local source video through the existing Sanverse production intake authority and make it this session\'s active project. In local STDIO, relative paths resolve inside the coding-agent workspace; HTTP keeps explicit import-root confinement. Requires a stable transactionId.',
  'production.get_project_context': 'Read the active production project identity, exact revision, primary source/clip, duration, dimensions, frame rate, and audio state. Does not mutate the project.',
  'source.list_workspace_inputs': 'List supported video/transcript/image inputs inside this local STDIO coding-agent workspace using safe relative paths only. Does not expose absolute workspace paths or arbitrary filesystem contents; HTTP sessions refuse this tool.',
  'source.attach_transcript': 'Attach plain, SRT, or WebVTT transcript as analysis-only source context for the active project. Local STDIO may supply a workspace-relative localPath so Sanverse reads the file inside the same confinement boundary; it does not create visible captions.',
  'source.get_transcript': 'Read a transcript previously attached in this MCP session. Does not mutate the project or create captions.',
  'source.analyze_video': 'Build a deterministic production-backed Source Understanding packet from the active source and optional attached transcript. Reports only supported evidence and explicit limitations; it does not fabricate face/object/tracking observations.',
  'motion.plan_opportunities': 'Plan deterministic source-bounded Motion opportunities from an exact Source Understanding packet using Sanverse Creative Direction and the real Motion Library/recipes. Validates agentCandidates rather than trusting them and does not mutate the accepted project.',
  'motion.get_opportunity_map': 'Read a previously created Motion Opportunity Map for the exact current production revision. Does not mutate production state.',
  'motion.create_scene_sandbox': 'Create one isolated Creative scene Storyboard sandbox for a selected opportunity. This creates sandbox/review state only and stops before animation; Storyboard owner approval is required before Animatic.',
  'motion.create_scene_batch': 'Create isolated Storyboard sandboxes for all selected opportunities in one Motion Opportunity Map against one common production revision. This does not mutate the accepted project and does not bypass owner gates.',
  'motion.get_scene_batch': 'Read the exact current state of a multi-scene Creative batch, including approval/review readiness. Does not mutate production state.',
  'motion.advance_scene_batch': 'Operate the owner-gated Storyboard → Animatic → Motion batch workflow. request-review creates exact review requests only; resolve-approval accepts only opaque host-issued approval references; advance refuses until the previous stage is owner-approved.',
  'production.get_owner_review_status': 'Read exact owner-review status for a Creative scene batch. External clients cannot mint approvals through this tool.',
  'production.apply_approved_scene_batch': 'Atomically apply an exact, fully Motion-approved Creative scene batch to the live production project as one server-authoritative ChangeSet and one Undo step. Requires current production revision through the batch; any stale scene/artifact/approval fails without partial mutation.',
  'production.export_video': 'Start the existing Sanverse production export job for the exact current productionRevision. Uses the canonical production preview/export authority and never creates a second exporter.',
  'production.get_export_status': 'Read status/progress/result for an existing production export job belonging to the active project. Does not mutate project state.',
  'production.cancel_export': 'Cancel an existing queued/running production export job through the existing Sanverse export-job authority. This does not edit the accepted project.',
  'production.get_creative_context': 'Read compact production-backed Creative context: project revision, source identity, selected semantic node, C3-C6 projection counts, and current sandbox stage status. Does not mutate the accepted project.',
  'production.create_creative_sandbox': 'Create this MCP session\'s isolated Creative storyboard sandbox from the existing production-backed candidate. The accepted production project is not mutated.',
  'production.get_sandbox_review': 'Retrieve bounded deterministic review evidence for the active session sandbox, including the exact storyboard state/tick and resolved selected semantic node. Does not mutate the accepted project.',
  'production.set_sandbox_selected_opacity': 'Set the selected semantic node opacity in the active storyboard sandbox through the existing canonical Motion Graph revision engine. Requires _sanverse.sandboxId and _sanverse.productionRevision; accepted production state is not mutated.',
  'get_project_context': 'Read the current Closed-Loop session state and accepted-project revision. Prefer production.get_creative_context when a compact production summary is sufficient.',
  'create_storyboard_sandbox': 'Create a storyboard sandbox over the current accepted Creative project. This is sandbox state only; it does not mutate the accepted production project.',
  'revise_storyboard': 'Apply validated canonical Motion Graph operations to the active storyboard sandbox. Requires _sanverse.sandboxId and _sanverse.productionRevision. Does not mutate the accepted production project.',
  'validate_storyboard': 'Run deterministic structural QA against the active storyboard sandbox. Requires _sanverse.sandboxId. Returns QA findings without accepting the sandbox.',
  'build_animatic': 'Build exact-tick Animatic state from an owner-approved storyboard in the active sandbox. Requires _sanverse.sandboxId and _sanverse.productionRevision.',
  'revise_animatic': 'Apply an exact-revision timing transaction to the active sandbox Animatic. Requires _sanverse.sandboxId and _sanverse.productionRevision.',
  'validate_animatic': 'Run deterministic Animatic timing/readability QA in the active sandbox. Requires _sanverse.sandboxId.',
  'build_motion_plan': 'Build a canonical MotionPlan from owner-approved Storyboard and Animatic state in the active sandbox. Requires _sanverse.sandboxId and _sanverse.productionRevision.',
  'revise_motion': 'Build or locally repair the active canonical Motion Graph draft inside the session sandbox. Requires _sanverse.sandboxId and _sanverse.productionRevision.',
  'validate_motion': 'Run deterministic structural Motion QA against the active sandbox draft. Requires _sanverse.sandboxId.',
  'render_review': 'Render/retrieve bounded review evidence for the exact current Motion draft revision. Requires _sanverse.sandboxId.',
  'set_visual_findings': 'Record bounded visual QA findings on the active sandbox draft for local repair/review. Requires _sanverse.sandboxId and _sanverse.productionRevision.',
  'request_owner_review': 'Create a review request packet for the exact current Storyboard, Animatic, or Motion revision. This requests review only and never creates owner approval.',
  'record_owner_approval': 'Owner-gated host authority. External MCP clients cannot manufacture OwnerApprovalV1; this external transport refuses client-forged approval attempts.',
  'discard_sandbox': 'Discard the active MCP session sandbox and all of its candidate changes. Requires _sanverse.sandboxId and the current _sanverse.productionRevision. The accepted production project remains unchanged.',
  'motion.apply-plan-atomic-v15': 'Apply one validated semantic MotionPlan atomically to canonical Motion Graph candidate state inside the sandbox. Requires _sanverse.sandboxId and _sanverse.productionRevision.',
  'expert.instantiate-recipe': 'Instantiate one vetted bounded expert-motion recipe in sandbox candidate state. Requires _sanverse.sandboxId and _sanverse.productionRevision.',
  'expert.evaluate-at-tick': 'Evaluate a bounded deterministic expert-motion specification at one exact canonical tick inside the sandbox.',
  'expert.evaluate-within-budget-v15': 'Evaluate expert motion against the existing deterministic runtime budget and return bounded evidence.',
  'expert.assess-performance-v15': 'Assess recorded Expert Runtime performance evidence against the existing V1.5 host budget. Read-only evidence tool.',
  'external.inspect-aep': 'Inspect an AEP bridge payload for supported bounded extraction metadata without importing arbitrary runtime code.',
  'external.inspect-mogrt': 'Inspect a MOGRT bridge payload for supported bounded extraction metadata without importing arbitrary runtime code.',
  'external.inspect-procedural': 'Inspect a bounded declarative procedural motion asset and its rights/determinism metadata.',
  'external.inspect-shader': 'Inspect a bounded declarative shader asset and its rights/determinism metadata.',
  'external.inspect-three-webgl': 'Inspect the bounded Three/WebGL bridge subset and report whether it can be materialized deterministically.',
  'external.materialize-aep': 'Materialize the supported bounded AEP extraction subset into canonical sandbox motion state. Requires _sanverse.sandboxId and _sanverse.productionRevision.',
  'external.materialize-mogrt': 'Materialize the supported bounded MOGRT extraction subset into canonical sandbox motion state. Requires _sanverse.sandboxId and _sanverse.productionRevision.',
  'external.materialize-procedural': 'Materialize a validated bounded procedural asset into canonical sandbox motion state. Requires _sanverse.sandboxId and _sanverse.productionRevision.',
  'external.materialize-shader': 'Materialize a validated bounded shader asset into canonical sandbox motion state. Requires _sanverse.sandboxId and _sanverse.productionRevision.',
  'external.materialize-three-webgl': 'Materialize only the supported bounded Three/WebGL subset into canonical sandbox motion state. Requires _sanverse.sandboxId and _sanverse.productionRevision.',
})

const writeClass = (definition: SanverseToolDefinitionV1): SanverseExternalWriteClassV1 => definition.requiresOwnerApproval
  ? 'owner-gated'
  : definition.level === 'T0'
    ? 'read'
    : 'sandbox-write'

const fallbackDescription = (definition: SanverseToolDefinitionV1): string => {
  const classification = writeClass(definition)
  return `Sanverse ${definition.level} ${classification} tool ${definition.id}. It uses the existing canonical Sanverse registry; sandbox-gated calls require _sanverse.sandboxId and production mutations remain outside this external transport.`
}

const externalInputSchema = (schema: unknown): Record<string, unknown> => {
  const base = record(schema) ? schema : { type: 'object' }
  const properties = record(base.properties) ? base.properties : {}
  return Object.freeze({
    ...base,
    type: 'object',
    properties: Object.freeze({
      ...properties,
      [SANVERSE_EXTERNAL_CONTEXT_KEY]: Object.freeze({
        type: 'object',
        description: 'Sanverse transport context. Required where the tool description says so; stripped before canonical tool validation.',
        additionalProperties: false,
        properties: Object.freeze({
          sandboxId: Object.freeze({ type: 'string', minLength: 1 }),
          productionRevision: Object.freeze({ type: 'integer', minimum: 0 }),
        }),
      }),
    }),
  })
}

const splitArguments = (value: unknown): Readonly<{ input: Readonly<Record<string, unknown>>; context: ToolExecutionContextV1 }> => {
  const args = record(value) ? value : {}
  const envelope = record(args[SANVERSE_EXTERNAL_CONTEXT_KEY]) ? args[SANVERSE_EXTERNAL_CONTEXT_KEY] as Record<string, unknown> : {}
  const input: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(args)) if (key !== SANVERSE_EXTERNAL_CONTEXT_KEY) input[key] = entry
  const sandboxId = typeof envelope.sandboxId === 'string' && envelope.sandboxId.trim() ? envelope.sandboxId : undefined
  const revision = Number.isSafeInteger(envelope.productionRevision) ? Number(envelope.productionRevision) : undefined
  return Object.freeze({
    input: freezeRecord(input),
    context: Object.freeze({ ...(sandboxId ? { sandboxId } : {}), ...(revision !== undefined ? { revision } : {}), availableCapabilities: Object.freeze([]) }),
  })
}

const modelResult = (value: unknown) => {
  const structured = record(value) ? value : Object.freeze({ value })
  const isError = record(value) && value.ok === false
  return Object.freeze({
    content: Object.freeze([{ type: 'text' as const, text: JSON.stringify(value) }]),
    structuredContent: structured,
    isError,
  })
}

const ownerGateRefusal = () => modelResult(Object.freeze({
  ok: false,
  refusal: Object.freeze({
    code: 'OWNER_APPROVAL_REQUIRED',
    message: 'Owner approval is host authority. External MCP clients cannot manufacture OwnerApprovalV1 or satisfy approval by sending JSON.',
    recovery: 'Request owner review through request_owner_review and leave the exact revision awaiting owner action in Sanverse.',
  }),
}))

export const createSanverseStandardMcpServerV1 = (
  registryProvider: () => SanverseToolRegistryV1 | Promise<SanverseToolRegistryV1>,
  options: SanverseStandardMcpServerOptionsV1 = {},
): Server => {
  const server = new Server(
    { name: SANVERSE_STANDARD_MCP_SERVER_NAME, version: SANVERSE_STANDARD_MCP_SERVER_VERSION },
    {
      capabilities: { tools: {} },
      instructions: 'Use Sanverse MCP for Sanverse project/motion operations. Keep candidate writes in explicit sandboxes, pass _sanverse.sandboxId and _sanverse.productionRevision where required, never fabricate owner approval, and discard exploratory sandboxes when finished.',
    },
  )
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const registry = await registryProvider()
    return {
      tools: registry.list().map((summary) => {
        const definition = registry.get(summary.id)
        if (!definition) throw new Error(`Registry definition disappeared for ${summary.id}.`)
        return {
          name: definition.id,
          title: definition.id,
          description: descriptionById[definition.id] ?? fallbackDescription(definition),
          inputSchema: externalInputSchema(definition.inputSchema) as never,
          outputSchema: definition.outputSchema as never,
          annotations: {
            readOnlyHint: writeClass(definition) === 'read',
            destructiveHint: false,
            idempotentHint: writeClass(definition) === 'read',
            openWorldHint: false,
          },
          _meta: {
            'io.sanverse/toolLevel': definition.level,
            'io.sanverse/writeClass': writeClass(definition),
            'io.sanverse/requiresSandbox': definition.requiresSandbox,
            'io.sanverse/requiresOwnerApproval': definition.requiresOwnerApproval === true,
          },
        }
      }),
    }
  })
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const registry = await registryProvider()
    const definition = registry.get(request.params.name)
    const { input, context } = splitArguments(request.params.arguments)
    const client = server.getClientVersion()
    const recordEvidence = async (value: unknown) => {
      if (!options.onToolCall) return
      const refusal = record(value) && value.ok === false && record(value.refusal) ? value.refusal : null
      const resultValue = record(value) && record(value.value) ? value.value : null
      await options.onToolCall(Object.freeze({
        at: new Date().toISOString(),
        sessionLabel: options.sessionLabel ?? 'session',
        clientName: client?.name ?? 'unknown-client',
        clientVersion: client?.version ?? 'unknown',
        toolName: request.params.name,
        sandboxId: context.sandboxId ?? null,
        productionRevision: context.revision ?? null,
        ok: record(value) ? value.ok !== false : true,
        refusalCode: refusal && typeof refusal.code === 'string' ? refusal.code : null,
        resultSandboxId: resultValue && typeof resultValue.sandboxId === 'string' ? resultValue.sandboxId : null,
        reviewRef: resultValue && typeof resultValue.reviewRef === 'string' ? resultValue.reviewRef : null,
        resultRevision: record(value) && Number.isSafeInteger(value.revision) ? Number(value.revision) : null,
      }))
    }
    if (!definition) {
      const value = Object.freeze({ ok: false, refusal: Object.freeze({ code: 'TOOL_NOT_FOUND', message: `Unknown Sanverse tool: ${request.params.name}.` }) })
      await recordEvidence(value)
      return modelResult(value)
    }
    if (definition.requiresOwnerApproval) {
      const value = Object.freeze({ ok: false, refusal: Object.freeze({ code: 'OWNER_APPROVAL_REQUIRED', message: 'Owner approval is host authority. External MCP clients cannot manufacture OwnerApprovalV1 or satisfy approval by sending JSON.' }) })
      await recordEvidence(value)
      return ownerGateRefusal()
    }
    const result = await registry.invoke(definition.id, input, context)
    await recordEvidence(result)
    return modelResult(result)
  })
  return server
}

const tokenAccepted = (authorization: string | undefined, token: string | undefined): boolean => {
  if (!token) return true
  if (!authorization) return false
  const actual = Buffer.from(authorization)
  const expected = Buffer.from(`Bearer ${token}`)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

const localHostAccepted = (hostHeader: string | undefined): boolean => {
  if (!hostHeader) return false
  const host = hostHeader.toLowerCase().replace(/^\[/, '').replace(/\]$/, '').split(':')[0]
  return host === '127.0.0.1' || host === 'localhost'
}

const localOriginAccepted = (origin: string | undefined): boolean => {
  if (!origin) return true
  try {
    const parsed = new URL(origin)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')
  } catch {
    return false
  }
}

const readJsonBody = async (request: IncomingMessage, maxBodyBytes = 1_048_576): Promise<unknown> => new Promise((resolve, reject) => {
  const chunks: Buffer[] = []
  let bytes = 0
  request.on('data', (chunk: Buffer) => {
    bytes += chunk.length
    if (bytes > maxBodyBytes) {
      reject(new RangeError('MCP request body is too large.'))
      request.destroy()
      return
    }
    chunks.push(chunk)
  })
  request.on('end', () => {
    try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
    catch (error) { reject(error) }
  })
  request.on('error', reject)
})

const json = (response: ServerResponse, status: number, payload: unknown) => {
  const body = JSON.stringify(payload)
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' })
  response.end(body)
}

export interface SanverseStandardHttpOptionsV1 {
  readonly createRegistry: SanverseExternalRegistryFactoryV1
  readonly token?: string
  readonly path?: string
  readonly health?: () => Readonly<Record<string, unknown>> | Promise<Readonly<Record<string, unknown>>>
  readonly maxBodyBytes?: number
  readonly sessionIdleMs?: number
  readonly onToolCall?: (event: SanverseMcpToolCallEvidenceV1) => void | Promise<void>
}

export const createSanverseStandardMcpHttpServerV1 = (options: SanverseStandardHttpOptionsV1): NodeHttpServer => {
  const path = options.path ?? '/mcp'
  const sessionIdleMs = options.sessionIdleMs ?? 30 * 60 * 1000
  if (!Number.isSafeInteger(sessionIdleMs) || sessionIdleMs < 50) throw new RangeError('sessionIdleMs must be an integer of at least 50ms.')
  const transports = new Map<string, StreamableHTTPServerTransport>()
  const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const forgetSession = (id: string) => {
    transports.delete(id)
    const timer = expiryTimers.get(id)
    if (timer) clearTimeout(timer)
    expiryTimers.delete(id)
  }
  const refreshExpiry = (id: string, transport: StreamableHTTPServerTransport) => {
    const existing = expiryTimers.get(id)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      forgetSession(id)
      void transport.close()
    }, sessionIdleMs)
    timer.unref?.()
    expiryTimers.set(id, timer)
  }
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    if (url.pathname === '/healthz') {
      if (request.method !== 'GET') { json(response, 405, { error: 'Method not allowed' }); return }
      const health = options.health ? await options.health() : Object.freeze({ status: 'ready', mcp: 'ready' })
      json(response, 200, Object.freeze({ ...health, activeSessions: transports.size }))
      return
    }
    if (url.pathname !== path) { json(response, 404, { error: 'Not found' }); return }
    if (!localHostAccepted(request.headers.host)) { json(response, 403, { error: 'Local Host header required.' }); return }
    if (!localOriginAccepted(typeof request.headers.origin === 'string' ? request.headers.origin : undefined)) { json(response, 403, { error: 'Origin is not allowed.' }); return }
    if (!tokenAccepted(typeof request.headers.authorization === 'string' ? request.headers.authorization : undefined, options.token)) { json(response, 401, { error: 'Local MCP bearer token required.' }); return }
    const sessionId = typeof request.headers['mcp-session-id'] === 'string' ? request.headers['mcp-session-id'] : undefined
    let transport = sessionId ? transports.get(sessionId) : undefined
    try {
      if (!transport && request.method === 'POST' && !sessionId) {
        const body = await readJsonBody(request, options.maxBodyBytes)
        if (!isInitializeRequest(body)) { json(response, 400, { jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Initialize the MCP session first.' } }); return }
        const sessionLabel = randomUUID()
        let sessionRegistry: Promise<SanverseExternalRegistrySessionV1> | undefined
        const registryProvider = async () => (sessionRegistry ??= Promise.resolve(options.createRegistry(sessionLabel, Object.freeze({ transport: 'http' as const })))).then((session) => session.registry)
        const mcpServer = createSanverseStandardMcpServerV1(registryProvider, { sessionLabel, onToolCall: options.onToolCall })
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: randomUUID,
          enableJsonResponse: true,
          onsessioninitialized: (id) => { transports.set(id, transport!); refreshExpiry(id, transport!) },
          onsessionclosed: (id) => { forgetSession(id) },
        })
        await mcpServer.connect(transport)
        await transport.handleRequest(request, response, body)
        return
      }
      if (!transport) { json(response, 400, { jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Unknown or missing MCP session.' } }); return }
      if (sessionId) refreshExpiry(sessionId, transport)
      await transport.handleRequest(request, response)
    } catch (error) {
      if (!response.headersSent) json(response, 500, { jsonrpc: '2.0', id: null, error: { code: -32603, message: error instanceof Error ? error.message : 'Internal MCP error' } })
    }
  })
  server.on('close', () => {
    for (const timer of expiryTimers.values()) clearTimeout(timer)
    expiryTimers.clear()
    for (const transport of transports.values()) void transport.close()
    transports.clear()
  })
  return server
}

export const connectSanverseStandardStdioV1 = async (
  createRegistry: SanverseExternalRegistryFactoryV1,
  options: Readonly<{
    workspaceRoot?: string
    onToolCall?: (event: SanverseMcpToolCallEvidenceV1) => void | Promise<void>
  }> = {},
) => {
  const sessionLabel = randomUUID()
  const sessionContext = Object.freeze({ transport: 'stdio' as const, ...(options.workspaceRoot ? { workspaceRoot: options.workspaceRoot } : {}) })
  let session: Promise<SanverseExternalRegistrySessionV1> | undefined
  const mcpServer = createSanverseStandardMcpServerV1(
    async () => (session ??= Promise.resolve(createRegistry(sessionLabel, sessionContext))).then((value) => value.registry),
    { sessionLabel, onToolCall: options.onToolCall },
  )
  const transport = new StdioServerTransport(process.stdin, process.stdout)
  await mcpServer.connect(transport)
  return Object.freeze({ server: mcpServer, transport })
}

