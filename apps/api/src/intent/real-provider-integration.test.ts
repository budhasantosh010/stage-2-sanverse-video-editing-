import { createServer, type Server } from 'node:http'
import { AddressInfo } from 'node:net'

import {
  NAMEPLATE_COMPONENT_ID,
  PROJECT_TIMESCALE,
  TICKS_PER_MILLISECOND,
  createProject,
  type EditProject,
} from '@sanverse/edit-domain'
import { INTENT_CANDIDATE_SCHEMA } from '@sanverse/intent-domain'
import { afterEach, describe, expect, it } from 'vitest'

import { createIntentProvider, resolveIntentProviderConfig } from './intent-provider-config.ts'
import { createIntentService } from './intent-service.ts'

/**
 * The real adapter against a real HTTP server.
 *
 * The unit tests inject a fake `fetch`, which proves the decisions but not the
 * plumbing. This file starts an actual server that speaks the OpenAI
 * chat-completions shape and drives the whole chain — environment variables,
 * configuration, adapter, sockets, envelope, closed validator, operation
 * builder, change set — so that the only untested difference between this and a
 * live NVIDIA call is the distance the packets travel.
 *
 * It is also the standing regression test for G4B-13: a provider that is not
 * running must leave the project untouched and say so.
 */

const PROJECT_ID = 'project_0123456789abcdef'
const CLIP_ID = 'clip_0123456789ab'
const THIRTY_SECONDS = 30_000 * TICKS_PER_MILLISECOND

function testProject(): EditProject {
  const created = createProject({
    projectId: PROJECT_ID,
    asset: {
      schemaVersion: 'sanverse.asset/video/v1',
      assetId: 'asset_0123456789ab',
      storageRef: `project:${PROJECT_ID}/source`,
      sha256: 'a'.repeat(64),
      byteLength: 1_000,
      duration: { ticks: THIRTY_SECONDS, timescale: PROJECT_TIMESCALE },
      width: 1920,
      height: 1080,
      frameRate: { numerator: 30, denominator: 1 },
      hasAudio: true,
      durationResidualSeconds: 0,
    },
    compositionId: 'composition_0123456789ab',
    trackId: 'track_0123456789ab',
    clipId: CLIP_ID,
  })
  if (!created.ok) throw new Error('fixture project is invalid')
  return created.value
}

const request = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 'sanverse.intent-request/v1',
  requestId: 'request_0123456789abcdef',
  projectId: PROJECT_ID,
  baseRevision: 0,
  message: 'add a nameplate saying "Priya" "Head of Design" for 3 seconds',
  context: {
    clipId: CLIP_ID,
    sampledClipTimeTicks: 6_000 * TICKS_PER_MILLISECOND,
    point: { x: 0.4, y: 0.7 },
    playheadTicks: 6_000 * TICKS_PER_MILLISECOND,
    compositionDurationTicks: THIRTY_SECONDS,
    compositionWidth: 1920,
    compositionHeight: 1080,
  },
  capabilityIds: [NAMEPLATE_COMPONENT_ID],
  locale: 'en',
  ...overrides,
})

const CANDIDATE = {
  schemaVersion: INTENT_CANDIDATE_SCHEMA,
  kind: 'proposal-candidate',
  capabilityId: NAMEPLATE_COMPONENT_ID,
  capabilityVersion: 1,
  arguments: {
    primaryText: 'Priya',
    secondaryText: 'Head of Design',
    startMs: null,
    durationMs: 3_000,
    point: null,
    anchor: null,
  },
}

type Received = { body: string; authorization: string | undefined }

const running: Server[] = []

afterEach(async () => {
  await Promise.all(running.splice(0).map((server) => new Promise<void>((done) => server.close(() => done()))))
})

/** A stand-in for LiteLLM: speaks the chat-completions shape and nothing more. */
async function startStubProvider(
  respond: (received: Received) => { status: number; body: string },
  received: Received[] = [],
): Promise<string> {
  const server = createServer((incoming, outgoing) => {
    const chunks: Buffer[] = []
    incoming.on('data', (chunk: Buffer) => chunks.push(chunk))
    incoming.on('end', () => {
      const entry: Received = {
        body: Buffer.concat(chunks).toString('utf8'),
        authorization: incoming.headers.authorization,
      }
      received.push(entry)
      const answer = respond(entry)
      outgoing.writeHead(answer.status, { 'content-type': 'application/json' })
      outgoing.end(answer.body)
    })
  })
  running.push(server)
  await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready))
  const { port } = server.address() as AddressInfo
  return `http://127.0.0.1:${port}/v1`
}

const chatReply = (content: string): string =>
  JSON.stringify({ id: 'stub', choices: [{ index: 0, message: { role: 'assistant', content } }] })

function serviceFor(baseUrl: string, apiKey?: string) {
  const config = resolveIntentProviderConfig({
    SANVERSE_AI_PROVIDER: 'openai-compatible',
    SANVERSE_AI_BASE_URL: baseUrl,
    SANVERSE_AI_MODEL: 'stub-model',
    SANVERSE_AI_API_KEY: apiKey,
    SANVERSE_AI_LABEL: 'stub',
  })
  const project = testProject()
  return createIntentService({
    provider: createIntentProvider(config),
    loadProject: async () => project,
    createOperationId: () => 'operation_0123456789abcdef',
    timeoutMs: 2_000,
  })
}

describe('the real adapter, over real HTTP', () => {
  it('turns a model reply into a pending proposal', async () => {
    const baseUrl = await startStubProvider(() => ({ status: 200, body: chatReply(JSON.stringify(CANDIDATE)) }))
    const outcome = await serviceFor(baseUrl).propose(request())

    expect(outcome.kind).toBe('proposal')
    if (outcome.kind !== 'proposal') return
    expect(outcome.changeSet.operations[0].primaryText).toBe('Priya')
    expect(outcome.changeSet.operations[0].secondaryText).toBe('Head of Design')
    expect(outcome.changeSet.provenance.source).toBe('ai')
    // The provider returned point: null, so deterministic code used the click.
    expect(outcome.changeSet.operations[0].target.point).toEqual({ x: 0.4, y: 0.7 })
    expect(outcome.changeSet.operations[0].compositionInterval.duration.ticks).toBe(3_000 * TICKS_PER_MILLISECOND)
  })

  it('sends only the allowlisted payload and the key, over the wire', async () => {
    const received: Received[] = []
    const baseUrl = await startStubProvider(() => ({ status: 200, body: chatReply(JSON.stringify(CANDIDATE)) }), received)
    await serviceFor(baseUrl, 'sk-live-key').propose(request())

    expect(received[0].authorization).toBe('Bearer sk-live-key')
    const sent = JSON.parse(received[0].body) as { messages: { role: string; content: string }[] }
    const userPayload = JSON.parse(sent.messages[1].content) as Record<string, unknown>
    expect(Object.keys(userPayload).sort()).toEqual(['capabilities', 'frame', 'locale', 'message', 'point', 'timing'])
    // The things that must never travel.
    expect(received[0].body).not.toContain(PROJECT_ID)
    expect(received[0].body).not.toContain(CLIP_ID)
    expect(received[0].body).not.toContain('source.mp4')
    expect(received[0].body).not.toContain('a'.repeat(64))
  })

  it('refuses a smuggled capability that arrived over a real connection', async () => {
    const hostile = { ...CANDIDATE, capabilityId: 'sanverse.shell.run/v1' }
    const baseUrl = await startStubProvider(() => ({ status: 200, body: chatReply(JSON.stringify(hostile)) }))
    const outcome = await serviceFor(baseUrl).propose(request())

    expect(outcome).toMatchObject({ kind: 'rejected', code: 'CAPABILITY_NOT_ALLOWED' })
  })

  it('refuses an extra key rather than stripping it', async () => {
    const hostile = { ...CANDIDATE, shellCommand: 'rm -rf /' }
    const baseUrl = await startStubProvider(() => ({ status: 200, body: chatReply(JSON.stringify(hostile)) }))
    const outcome = await serviceFor(baseUrl).propose(request())

    expect(outcome).toMatchObject({ kind: 'rejected', code: 'PROVIDER_RESPONSE_INVALID' })
  })

  it('passes a clarification through from a real reply', async () => {
    const asking = {
      schemaVersion: INTENT_CANDIDATE_SCHEMA,
      kind: 'clarification-required',
      question: { field: 'primary-text', question: 'What should the text say?' },
    }
    const baseUrl = await startStubProvider(() => ({ status: 200, body: chatReply(JSON.stringify(asking)) }))
    const outcome = await serviceFor(baseUrl).propose(request())

    expect(outcome).toMatchObject({ kind: 'clarification', field: 'primary-text' })
  })

  it('says the reply was unusable when a model answers in prose', async () => {
    const baseUrl = await startStubProvider(() => ({ status: 200, body: chatReply('Sure, happy to help!') }))
    const outcome = await serviceFor(baseUrl).propose(request())

    expect(outcome).toMatchObject({ kind: 'rejected', code: 'PROVIDER_RESPONSE_INVALID' })
  })

  it('reports a wrong API key as unavailable to the user, with the status in the log', async () => {
    const logged: Record<string, unknown>[] = []
    const baseUrl = await startStubProvider(() => ({ status: 401, body: '{"error":"invalid key"}' }))
    const project = testProject()
    const service = createIntentService({
      provider: createIntentProvider(
        resolveIntentProviderConfig({
          SANVERSE_AI_PROVIDER: 'openai-compatible',
          SANVERSE_AI_BASE_URL: baseUrl,
          SANVERSE_AI_MODEL: 'stub-model',
          SANVERSE_AI_LABEL: 'stub',
        }),
      ),
      loadProject: async () => project,
      createOperationId: () => 'operation_0123456789abcdef',
      log: (event) => logged.push(event),
    })

    const outcome = await service.propose(request())
    expect(outcome).toMatchObject({ kind: 'rejected', code: 'PROVIDER_UNAVAILABLE' })

    const failure = logged.find((entry) => entry.event === 'intent.provider-failed')
    expect(String(failure?.detail)).toContain('HTTP 401')
    // The log must never carry what the user typed.
    expect(JSON.stringify(logged)).not.toContain('Head of Design')
  })

  it('leaves the project untouched when the proxy is not running at all', async () => {
    // A port nothing is listening on: exactly a stopped LiteLLM proxy.
    const outcome = await serviceFor('http://127.0.0.1:1/v1').propose(request())

    expect(outcome).toMatchObject({ kind: 'rejected', code: 'PROVIDER_UNAVAILABLE' })
    if (outcome.kind !== 'rejected') return
    expect(outcome.message).toContain('Your video is unchanged.')
  })

  it('abandons a provider that never answers, instead of hanging the request', async () => {
    const server = createServer(() => {
      /* accept the connection and never reply */
    })
    running.push(server)
    await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready))
    const { port } = server.address() as AddressInfo

    const project = testProject()
    const service = createIntentService({
      provider: createIntentProvider(
        resolveIntentProviderConfig({
          SANVERSE_AI_PROVIDER: 'openai-compatible',
          SANVERSE_AI_BASE_URL: `http://127.0.0.1:${port}/v1`,
          SANVERSE_AI_MODEL: 'stub-model',
        }),
      ),
      loadProject: async () => project,
      createOperationId: () => 'operation_0123456789abcdef',
      timeoutMs: 250,
    })

    const outcome = await service.propose(request())
    expect(outcome).toMatchObject({ kind: 'rejected', code: 'PROVIDER_UNAVAILABLE' })
  })
})
