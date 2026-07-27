import { NAMEPLATE_COMPONENT_ID } from '@sanverse/edit-domain/capabilities'
import { INTENT_CANDIDATE_SCHEMA } from '@sanverse/intent-domain/intent-candidate'

import { ProviderCallError, type IntentProviderPort } from './intent-port.ts'
import type { OutboundPayload } from './outbound-data-policy.ts'

/**
 * A provider that is not a model.
 *
 * Every rule here is fixed and readable, so the same sentence always produces
 * the same answer. That is the point: it lets the whole safety pipeline —
 * validation, refusal, clarification, repair, approval, export — be proved
 * before a single byte is sent anywhere, and it costs nothing to run a hundred
 * times in a test.
 *
 * It deliberately behaves BADLY on some inputs. It tries to smuggle a made-up
 * capability, it returns a plain sentence instead of structured data, and it
 * returns fields that are out of range. Those cases exist because a real model
 * will do all three, and the only way to know the system survives them is to
 * make them happen on purpose.
 */

const QUOTED = /["“”']([^"“”']{1,160})["“”']/gu

/** Words that mean "this is not something this build can do". */
const OUT_OF_SCOPE = [
  'music',
  'song',
  'soundtrack',
  'cut ',
  'trim',
  'crop',
  'zoom',
  'transition',
  'subtitle',
  'caption',
  'colour',
  'color grade',
  'background',
  'blur',
  'speed up',
  'slow down',
]

/** Attempts to make the editor do something that is not editing. */
const INJECTION = [
  'ignore previous',
  'ignore all previous',
  'system prompt',
  'disregard your',
  'rm -rf',
  'shell',
  'powershell',
  'read the file',
  'read file',
  'send it to',
  'upload to',
  'api key',
]

const extractQuoted = (message: string): readonly string[] => {
  const found: string[] = []
  for (const match of message.matchAll(QUOTED)) {
    const text = match[1].trim()
    if (text.length > 0) found.push(text)
  }
  return found
}

/** "call it Santosh" / "name it Santosh" / "saying Santosh" as a fallback. */
const extractLoose = (message: string): string | null => {
  const match = /(?:call it|name it|saying|that says|which says)\s+([^,.;]{1,60})/i.exec(message)
  return match ? match[1].trim() : null
}

const candidate = (value: Record<string, unknown>) => ({ schemaVersion: INTENT_CANDIDATE_SCHEMA, ...value })

const clarification = (field: string, question: string) =>
  candidate({ kind: 'clarification-required', question: { field, question } })

export type FakeIntentAdapterOptions = Readonly<{
  /** Force a transport failure, to exercise the unavailable path. */
  failWith?: 'timeout' | 'unavailable'
}>

export const createFakeIntentAdapter = (
  options: FakeIntentAdapterOptions = {},
): IntentProviderPort => ({
  name: 'fake',

  async propose(payload: OutboundPayload, { signal }: { readonly signal?: AbortSignal }): Promise<unknown> {
    if (signal?.aborted) throw new ProviderCallError('PROVIDER_UNAVAILABLE', 'The request was cancelled.')
    if (options.failWith === 'timeout') {
      throw new ProviderCallError('PROVIDER_TIMEOUT', 'The provider took too long.')
    }
    if (options.failWith === 'unavailable') {
      throw new ProviderCallError('PROVIDER_UNAVAILABLE', 'The provider could not be reached.')
    }

    const message = payload.message.toLowerCase()

    // 1. Prompt injection and requests for machine access. The fake plays the
    //    part of a model that has been talked into it, and tries to return a
    //    capability that does not exist. The service must refuse it.
    if (INJECTION.some((needle) => message.includes(needle))) {
      return candidate({
        kind: 'proposal-candidate',
        capabilityId: 'sanverse.shell.run/v1',
        capabilityVersion: 1,
        arguments: {
          primaryText: 'pwned',
          secondaryText: null,
          startMs: 0,
          durationMs: 5_000,
          point: { x: 0.5, y: 0.5 },
          anchor: 'center',
        },
      })
    }

    // 2. A chatty model that forgets to answer in the required shape.
    if (message.includes('thanks') || message.includes('hello')) {
      return 'Sure! Happy to help — what would you like me to do?'
    }

    // 3. Things this build genuinely cannot do yet.
    if (OUT_OF_SCOPE.some((needle) => message.includes(needle))) {
      return candidate({ kind: 'unsupported', reason: 'out-of-scope' })
    }

    // 4. Two different moments named in one sentence. There is no safe default
    //    for "which one did you mean", so it asks.
    const statedMoments = message.match(/(?:at|from)\s+\d+(?:\.\d+)?\s*(?:seconds?|secs?|s)\b/g) ?? []
    if (statedMoments.length > 1) {
      return clarification('start-time', 'You named two different moments. Which one should it appear at?')
    }

    const quoted = extractQuoted(payload.message)
    const primaryText = quoted[0] ?? extractLoose(payload.message)
    const secondaryText = quoted[1] ?? null

    // 5. No text anywhere in the request. Guessing a person's name would be
    //    worse than asking, so it asks.
    if (!primaryText) {
      return clarification('primary-text', 'What should the text say?')
    }

    // 6. Nowhere to put it, and no owner-approved default for position.
    if (payload.point === null) {
      return clarification('position', 'Where should it go? Choose Point, then click the spot.')
    }

    // 7. A moment stated in the sentence wins over the playhead.
    const stated = /(?:at|from)\s+(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/.exec(message)
    const startMs = stated ? Math.round(Number(stated[1]) * 1_000) : null

    const forSeconds = /for\s+(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/.exec(message)
    const durationMs = forSeconds ? Math.round(Number(forSeconds[1]) * 1_000) : null

    return candidate({
      kind: 'proposal-candidate',
      capabilityId: NAMEPLATE_COMPONENT_ID,
      capabilityVersion: 1,
      arguments: {
        primaryText,
        secondaryText,
        startMs,
        durationMs,
        // Position and anchor are left to deterministic code, which uses where
        // the user actually pointed. A provider inventing coordinates is how a
        // nameplate ends up over someone's face.
        point: null,
        anchor: null,
      },
    })
  },
})
