import { afterEach, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js'
import { createSanverseToolRegistryV1 } from '@sanverse/motion-agent-tools'
import {
  SANVERSE_EXTERNAL_CONTEXT_KEY,
  createSanverseStandardMcpHttpServerV1,
  createSanverseStandardMcpServerV1,
} from './standard-server.ts'
import type { Server as NodeHttpServer } from 'node:http'

const servers: NodeHttpServer[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))))
})

const registry = () => {
  const value = createSanverseToolRegistryV1()
  value.register({
    id: 'read_context', version: 1, level: 'T0', requiresSandbox: false,
    inputSchema: { type: 'object', additionalProperties: false }, outputSchema: { type: 'object' },
    validateInput: (input) => input && typeof input === 'object' && !Array.isArray(input) && Object.keys(input as object).length === 0
      ? ({ ok: true as const, value: {} })
      : ({ ok: false as const, refusal: { code: 'INVALID', message: 'no input' } }),
    execute: (_input, context) => ({ ok: true as const, value: { sandboxId: context.sandboxId ?? null, revision: context.revision ?? null }, revision: context.revision ?? 0 }),
  })
  value.register({
    id: 'sandbox_write', version: 1, level: 'T1', requiresSandbox: true,
    inputSchema: { type: 'object', properties: { label: { type: 'string' } }, required: ['label'], additionalProperties: false }, outputSchema: { type: 'object' },
    validateInput: (input) => typeof input === 'object' && input !== null && !Array.isArray(input) && typeof (input as { label?: unknown }).label === 'string'
      ? ({ ok: true as const, value: input as { label: string } })
      : ({ ok: false as const, refusal: { code: 'INVALID', message: 'label required' } }),
    execute: (input, context) => { const typed = input as { label: string }; return { ok: true as const, value: { label: typed.label, sandboxId: context.sandboxId, revision: context.revision }, revision: context.revision ?? 0 } },
  })
  value.register({
    id: 'owner_write', version: 1, level: 'T2', requiresSandbox: true, requiresOwnerApproval: true,
    inputSchema: { type: 'object', additionalProperties: true }, outputSchema: { type: 'object' },
    validateInput: (input) => ({ ok: true as const, value: input }),
    execute: () => ({ ok: true as const, value: { forged: true }, revision: 0 }),
  })
  return value
}

const connectInMemory = async () => {
  const server = createSanverseStandardMcpServerV1(() => registry())
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'standard-test', version: '1.0.0' }, { capabilities: {} })
  await client.connect(clientTransport)
  return { client, clientTransport, serverTransport }
}

describe('standard external MCP adapter', () => {
  it('performs the official initialize handshake and maps the existing registry through tools/list and tools/call', async () => {
    const { client, clientTransport, serverTransport } = await connectInMemory()
    expect(client.getServerVersion()).toMatchObject({ name: 'sanverse-creative-engine', version: '1.0.0' })
    const listed = await client.listTools()
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual(['owner_write', 'read_context', 'sandbox_write'])
    expect(listed.tools.find((tool) => tool.name === 'sandbox_write')).toMatchObject({
      annotations: { destructiveHint: false, openWorldHint: false },
      inputSchema: { properties: { [SANVERSE_EXTERNAL_CONTEXT_KEY]: expect.any(Object), label: expect.any(Object) } },
    })
    const read = await client.callTool({ name: 'read_context', arguments: { [SANVERSE_EXTERNAL_CONTEXT_KEY]: { sandboxId: 'ignored-for-read', productionRevision: 7 } } })
    expect(read.structuredContent).toMatchObject({ ok: true, value: { sandboxId: 'ignored-for-read', revision: 7 } })
    const write = await client.callTool({ name: 'sandbox_write', arguments: { label: 'visible', [SANVERSE_EXTERNAL_CONTEXT_KEY]: { sandboxId: 'sandbox:test', productionRevision: 8 } } })
    expect(write.structuredContent).toMatchObject({ ok: true, value: { label: 'visible', sandboxId: 'sandbox:test', revision: 8 } })
    await clientTransport.close(); await serverTransport.close()
  })

  it('refuses owner-approval forging before the canonical owner-gated tool executes', async () => {
    const { client, clientTransport, serverTransport } = await connectInMemory()
    const result = await client.callTool({ name: 'owner_write', arguments: { approval: { status: 'owner-approved' }, [SANVERSE_EXTERNAL_CONTEXT_KEY]: { sandboxId: 'sandbox:test', productionRevision: 1 } } })
    expect(result).toMatchObject({ isError: true, structuredContent: { ok: false, refusal: { code: 'OWNER_APPROVAL_REQUIRED' } } })
    await clientTransport.close(); await serverTransport.close()
  })

  it('serves authenticated Streamable HTTP with session reconnect and rejects non-local Origin', async () => {
    const created: string[] = []
    const http = createSanverseStandardMcpHttpServerV1({
      token: 'test-token',
      createRegistry: (label) => { created.push(label); return { registry: registry(), label } },
      health: () => ({ status: 'ready', mcp: 'ready', toolCount: 3, projectConnected: true }),
    })
    servers.push(http)
    await new Promise<void>((resolve, reject) => http.listen(0, '127.0.0.1', resolve).once('error', reject))
    const address = http.address(); if (!address || typeof address === 'string') throw new Error('Expected TCP address.')
    const endpoint = `http://127.0.0.1:${address.port}/mcp`

    const health = await fetch(`http://127.0.0.1:${address.port}/healthz`)
    expect(await health.json()).toEqual({ status: 'ready', mcp: 'ready', toolCount: 3, projectConnected: true, activeSessions: 0 })
    const denied = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer test-token', origin: 'https://evil.example' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: LATEST_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'evil', version: '1' } } }),
    })
    expect(denied.status).toBe(403)
    const unauthorized = await fetch(endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: LATEST_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'missing-token', version: '1' } } }),
    })
    expect(unauthorized.status).toBe(401)

    const transport = new StreamableHTTPClientTransport(new URL(endpoint), { requestInit: { headers: { authorization: 'Bearer test-token' } } })
    const client = new Client({ name: 'http-test', version: '1.0.0' }, { capabilities: {} })
    await client.connect(transport)
    expect((await client.listTools()).tools).toHaveLength(3)
    expect(created).toHaveLength(1)
    const sessionId = transport.sessionId
    expect(sessionId).toBeTruthy()
    expect(await (await fetch(`http://127.0.0.1:${address.port}/healthz`)).json()).toMatchObject({ activeSessions: 1 })
    await client.callTool({ name: 'read_context', arguments: {} })
    expect(created).toHaveLength(1)
    await transport.terminateSession()
    await transport.close()
    expect(await (await fetch(`http://127.0.0.1:${address.port}/healthz`)).json()).toMatchObject({ activeSessions: 0 })

    const reconnectTransport = new StreamableHTTPClientTransport(new URL(endpoint), { requestInit: { headers: { authorization: 'Bearer test-token' } } })
    const reconnectClient = new Client({ name: 'http-reconnect', version: '1.0.0' }, { capabilities: {} })
    await reconnectClient.connect(reconnectTransport)
    expect((await reconnectClient.listTools()).tools).toHaveLength(3)
    expect(created).toHaveLength(2)
    await reconnectTransport.terminateSession()
    await reconnectTransport.close()
  })

  it('expires abandoned HTTP sessions so long-running hosts cannot accumulate orphaned client state', async () => {
    const http = createSanverseStandardMcpHttpServerV1({
      token: 'test-token',
      sessionIdleMs: 50,
      createRegistry: (label) => ({ registry: registry(), label }),
      health: () => ({ status: 'ready', mcp: 'ready' }),
    })
    servers.push(http)
    await new Promise<void>((resolve, reject) => http.listen(0, '127.0.0.1', resolve).once('error', reject))
    const address = http.address(); if (!address || typeof address === 'string') throw new Error('Expected TCP address.')
    const base = `http://127.0.0.1:${address.port}`
    const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { authorization: 'Bearer test-token' } } })
    const client = new Client({ name: 'abandoned-session-test', version: '1.0.0' }, { capabilities: {} })
    await client.connect(transport)
    expect(await (await fetch(`${base}/healthz`)).json()).toMatchObject({ activeSessions: 1 })
    await new Promise((resolve) => setTimeout(resolve, 90))
    expect(await (await fetch(`${base}/healthz`)).json()).toMatchObject({ activeSessions: 0 })
    await transport.close()
  })
})
