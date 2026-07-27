import { NAMEPLATE_COMPONENT_ID } from '@sanverse/edit-domain'
import {
  CLARIFICATION_FIELDS,
  INTENT_CANDIDATE_SCHEMA,
  NAMEPLATE_ARGUMENT_KEYS,
  UNSUPPORTED_REASONS,
  validateIntentCandidate,
} from '@sanverse/intent-domain'
import { describe, expect, it } from 'vitest'

import { ProviderCallError } from './intent-port.ts'
import type { OutboundPayload } from './outbound-data-policy.ts'
import {
  buildSystemPrompt,
  createOpenAiCompatibleAdapter,
  decodeCandidateText,
  MAX_INBOUND_BYTES,
  readEnvelopeContent,
} from './openai-compatible-adapter.ts'

const payload: OutboundPayload = Object.freeze({
  message: 'add a nameplate saying "Santosh" "Founder" for 4 seconds',
  locale: 'en',
  capabilities: Object.freeze([Object.freeze({ capabilityId: NAMEPLATE_COMPONENT_ID, version: 1, accepts: 'nameplate' })]),
  frame: Object.freeze({ width: 1920, height: 1080 }),
  timing: Object.freeze({ videoLengthSeconds: 15, playheadSeconds: 2, pointedAtSeconds: 2 }),
  point: Object.freeze({ x: 0.64, y: 0.68 }),
})

const CANDIDATE = {
  schemaVersion: INTENT_CANDIDATE_SCHEMA,
  kind: 'proposal-candidate',
  capabilityId: NAMEPLATE_COMPONENT_ID,
  capabilityVersion: 1,
  arguments: {
    primaryText: 'Santosh',
    secondaryText: 'Founder',
    startMs: null,
    durationMs: 4_000,
    point: null,
    anchor: null,
  },
}

const envelopeWith = (content: string): string =>
  JSON.stringify({ id: 'x', choices: [{ index: 0, message: { role: 'assistant', content } }] })

type Captured = { url: string; init: RequestInit }

const adapterReturning = (content: string, status = 200, captured?: Captured[]) =>
  createOpenAiCompatibleAdapter({
    label: 'test',
    endpoint: 'http://127.0.0.1:4000/v1/chat/completions',
    apiKey: 'sk-test',
    model: 'test-model',
    fetchImpl: (async (url: string, init: RequestInit) => {
      captured?.push({ url, init })
      return new Response(content, { status })
    }) as unknown as typeof fetch,
  })

const bodyOf = (captured: Captured[]): Record<string, unknown> =>
  JSON.parse(String(captured[0].init.body)) as Record<string, unknown>

describe('the system prompt is generated from the domain, never typed twice', () => {
  const prompt = buildSystemPrompt()

  it('names the exact schema version the validator requires', () => {
    expect(prompt).toContain(INTENT_CANDIDATE_SCHEMA)
  })

  it('names every argument key the validator accepts', () => {
    for (const key of NAMEPLATE_ARGUMENT_KEYS) expect(prompt).toContain(key)
  })

  it('names every clarification field the domain allows', () => {
    for (const field of CLARIFICATION_FIELDS) expect(prompt).toContain(field)
  })

  it('names every unsupported reason the domain allows', () => {
    for (const reason of UNSUPPORTED_REASONS) expect(prompt).toContain(reason)
  })

  it('never offers provider-failure, which is the service\'s word and not the model\'s', () => {
    expect(prompt).not.toContain('provider-failure')
  })

  it('tells the model that position and anchor are not its decision', () => {
    expect(prompt).toMatch(/"point": always null/)
    expect(prompt).toMatch(/"anchor": always null/)
  })
})

describe('what goes on the wire', () => {
  it('posts to the configured endpoint with the configured model at temperature zero', async () => {
    const captured: Captured[] = []
    await adapterReturning(envelopeWith(JSON.stringify(CANDIDATE)), 200, captured).propose(payload, {})

    expect(captured[0].url).toBe('http://127.0.0.1:4000/v1/chat/completions')
    expect(captured[0].init.method).toBe('POST')
    const body = bodyOf(captured)
    expect(body.model).toBe('test-model')
    expect(body.temperature).toBe(0)
  })

  it('sends the allowlisted payload verbatim and nothing else as the user message', async () => {
    const captured: Captured[] = []
    await adapterReturning(envelopeWith(JSON.stringify(CANDIDATE)), 200, captured).propose(payload, {})

    const messages = bodyOf(captured).messages as { role: string; content: string }[]
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[1].role).toBe('user')
    expect(JSON.parse(messages[1].content)).toEqual(payload)
  })

  it('sends the key as a bearer header when one is configured', async () => {
    const captured: Captured[] = []
    await adapterReturning(envelopeWith(JSON.stringify(CANDIDATE)), 200, captured).propose(payload, {})
    expect((captured[0].init.headers as Record<string, string>).authorization).toBe('Bearer sk-test')
  })

  it('sends no authorization header at all when no key is configured, as LM Studio requires', async () => {
    const captured: Captured[] = []
    const adapter = createOpenAiCompatibleAdapter({
      label: 'lmstudio',
      endpoint: 'http://localhost:1234/v1/chat/completions',
      apiKey: null,
      model: 'local',
      fetchImpl: (async (url: string, init: RequestInit) => {
        captured.push({ url, init })
        return new Response(envelopeWith(JSON.stringify(CANDIDATE)))
      }) as unknown as typeof fetch,
    })
    await adapter.propose(payload, {})
    expect((captured[0].init.headers as Record<string, string>).authorization).toBeUndefined()
  })
})

describe('reading a reply', () => {
  it('returns a plain JSON candidate, which then passes the closed validator', async () => {
    const reply = await adapterReturning(envelopeWith(JSON.stringify(CANDIDATE))).propose(payload, {})
    const validated = validateIntentCandidate(reply)
    expect(validated.ok).toBe(true)
  })

  it('unwraps a markdown code fence, which models add constantly', async () => {
    const reply = await adapterReturning(envelopeWith('```json\n' + JSON.stringify(CANDIDATE) + '\n```')).propose(payload, {})
    expect(validateIntentCandidate(reply).ok).toBe(true)
  })

  it('unwraps a reasoning model\'s think block, which NVIDIA hosts many of', async () => {
    const content = `<think>The user wants a nameplate. I will return one.</think>\n${JSON.stringify(CANDIDATE)}`
    const reply = await adapterReturning(envelopeWith(content)).propose(payload, {})
    expect(validateIntentCandidate(reply).ok).toBe(true)
  })

  it('unwraps a think block wrapped around a fence', async () => {
    const content = `<think>thinking</think>\n\`\`\`json\n${JSON.stringify(CANDIDATE)}\n\`\`\``
    const reply = await adapterReturning(envelopeWith(content)).propose(payload, {})
    expect(validateIntentCandidate(reply).ok).toBe(true)
  })

  it('hands prose through untouched so the validator refuses it as unusable', async () => {
    const reply = await adapterReturning(envelopeWith('Sure! What would you like me to do?')).propose(payload, {})
    expect(reply).toBe('Sure! What would you like me to do?')
    expect(validateIntentCandidate(reply).ok).toBe(false)
  })

  it('does not strip a key a model smuggles in — the validator must still see it', async () => {
    const smuggled = { ...CANDIDATE, shellCommand: 'rm -rf /' }
    const reply = await adapterReturning(envelopeWith(JSON.stringify(smuggled))).propose(payload, {})
    expect(reply).toHaveProperty('shellCommand')
    const validated = validateIntentCandidate(reply)
    expect(validated.ok).toBe(false)
    expect(validated.ok === false && validated.error.issues.some((issue) => issue.code === 'FIELD_UNKNOWN')).toBe(true)
  })

  it('hands back a body that is not a chat envelope rather than guessing at it', async () => {
    const reply = await adapterReturning(JSON.stringify({ error: 'model not found' })).propose(payload, {})
    expect(reply).toEqual({ error: 'model not found' })
    expect(validateIntentCandidate(reply).ok).toBe(false)
  })

  it('hands back an HTML error page from a misconfigured proxy as text', async () => {
    const reply = await adapterReturning('<html><body>502 Bad Gateway</body></html>').propose(payload, {})
    expect(typeof reply).toBe('string')
    expect(validateIntentCandidate(reply).ok).toBe(false)
  })
})

describe('failures', () => {
  const expectCall = async (adapter: ReturnType<typeof createOpenAiCompatibleAdapter>, code: string, match: RegExp) => {
    await expect(adapter.propose(payload, {})).rejects.toMatchObject({ code })
    await expect(adapter.propose(payload, {})).rejects.toThrow(match)
  }

  it('reports the HTTP status so a wrong key is distinguishable from an outage', async () => {
    await expectCall(adapterReturning('{}', 401), 'PROVIDER_UNAVAILABLE', /HTTP 401/)
  })

  it('treats a rate limit as unavailable', async () => {
    await expectCall(adapterReturning('{}', 429), 'PROVIDER_UNAVAILABLE', /HTTP 429/)
  })

  it('treats a gateway timeout as a timeout', async () => {
    await expectCall(adapterReturning('{}', 504), 'PROVIDER_TIMEOUT', /HTTP 504/)
  })

  it('reports an unreachable proxy as unavailable rather than crashing the request', async () => {
    const adapter = createOpenAiCompatibleAdapter({
      label: 'litellm',
      endpoint: 'http://127.0.0.1:4000/v1/chat/completions',
      apiKey: null,
      model: 'm',
      fetchImpl: (async () => {
        throw new TypeError('fetch failed')
      }) as unknown as typeof fetch,
    })
    await expect(adapter.propose(payload, {})).rejects.toBeInstanceOf(ProviderCallError)
    await expect(adapter.propose(payload, {})).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
  })

  it('reports a cancelled call as a timeout', async () => {
    const controller = new AbortController()
    controller.abort()
    const adapter = createOpenAiCompatibleAdapter({
      label: 'litellm',
      endpoint: 'http://127.0.0.1:4000/v1/chat/completions',
      apiKey: null,
      model: 'm',
      fetchImpl: (async () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        throw error
      }) as unknown as typeof fetch,
    })
    await expect(adapter.propose(payload, { signal: controller.signal })).rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT' })
  })

  it('refuses a response larger than the bound instead of buffering it', async () => {
    const huge = 'x'.repeat(MAX_INBOUND_BYTES + 1_024)
    await expect(adapterReturning(huge).propose(payload, {})).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
  })

  it('never puts the provider\'s response text into the error', async () => {
    const secret = 'ECHOED-USER-SENTENCE'
    const caught = await adapterReturning(secret, 500)
      .propose(payload, {})
      .then(() => null)
      .catch((error: unknown) => error as Error)
    expect(caught).toBeInstanceOf(ProviderCallError)
    expect(caught?.message).not.toContain(secret)
    expect(caught?.message).toContain('HTTP 500')
  })
})

describe('decodeCandidateText', () => {
  it('returns the original text unchanged when it cannot be parsed', () => {
    expect(decodeCandidateText('  not json  ')).toBe('  not json  ')
  })

  it('leaves a bare fence alone rather than mangling it', () => {
    expect(decodeCandidateText('```')).toBe('```')
  })

  it('does not treat a think block in the middle as a wrapper', () => {
    const text = `{"a":1}<think>later</think>`
    expect(decodeCandidateText(text)).toBe(text)
  })
})

describe('readEnvelopeContent', () => {
  it('returns null for every shape that is not a chat-completions envelope', () => {
    for (const input of [null, 'text', 42, {}, { choices: [] }, { choices: [{}] }, { choices: [{ message: {} }] }]) {
      expect(readEnvelopeContent(input)).toBeNull()
    }
  })
})
