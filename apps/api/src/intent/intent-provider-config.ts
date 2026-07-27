import { createFakeIntentAdapter } from './fake-intent-adapter.ts'
import type { IntentProviderPort } from './intent-port.ts'
import { createOpenAiCompatibleAdapter } from './openai-compatible-adapter.ts'

/**
 * Which provider this build talks to, decided once, from the environment.
 *
 * Two rules govern everything in this file, and both exist because of the same
 * failure: an owner believing they tested a real model when they did not.
 *
 *   1. The fake is the default. Absence of configuration means the fake, never
 *      a half-configured real provider.
 *   2. Broken configuration THROWS. It never quietly falls back to the fake,
 *      because "I ran the corpus against NVIDIA" would then be a false claim
 *      recorded as evidence, which is the exact class of mistake CRITICAL RULE
 *      #3 exists to prevent.
 *
 * DEC-011: one adapter speaking the OpenAI chat-completions shape, pointed by
 * default at a local LiteLLM proxy that routes to NVIDIA, opencode, OpenRouter,
 * or LM Studio. There is deliberately no per-provider branch anywhere.
 */

export type IntentProviderConfig =
  | Readonly<{ kind: 'fake' }>
  | Readonly<{
      kind: 'openai-compatible'
      /** Shown in startup output and diagnostics only. Never sent anywhere. */
      label: string
      /** Absolute chat-completions endpoint, already resolved. */
      endpoint: string
      apiKey: string | null
      model: string
    }>

export const INTENT_PROVIDER_KINDS = ['fake', 'openai-compatible'] as const

export class ProviderConfigError extends Error {
  readonly code = 'PROVIDER_CONFIG_INVALID'
  constructor(message: string) {
    super(message)
    this.name = 'ProviderConfigError'
  }
}

/**
 * Hosts for which unencrypted http is acceptable, because the bytes never
 * touch a network: a LiteLLM proxy or LM Studio running on this machine.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

const CHAT_COMPLETIONS_PATH = '/chat/completions'

const trimmed = (value: string | undefined): string | null => {
  if (typeof value !== 'string') return null
  const result = value.trim()
  return result.length === 0 ? null : result
}

/**
 * Accepts either the base URL (`http://127.0.0.1:4000/v1`) or the full endpoint
 * (`http://127.0.0.1:4000/v1/chat/completions`) and resolves both to the same
 * place. Pasting the full endpoint is the single most common configuration
 * mistake, and silently producing `/chat/completions/chat/completions` would
 * surface as an unexplained 404 hours later.
 */
export const resolveChatCompletionsEndpoint = (rawBaseUrl: string): string => {
  let url: URL
  try {
    url = new URL(rawBaseUrl)
  } catch {
    throw new ProviderConfigError(`SANVERSE_AI_BASE_URL is not a valid URL: "${rawBaseUrl}"`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ProviderConfigError(`SANVERSE_AI_BASE_URL must be http or https, not "${url.protocol}"`)
  }

  // Plain http to anywhere but this machine would put the sentence the user
  // typed on a network in the clear. Refused at startup rather than discovered
  // in a packet capture.
  if (url.protocol === 'http:' && !LOOPBACK_HOSTS.has(url.hostname)) {
    throw new ProviderConfigError(
      `SANVERSE_AI_BASE_URL uses plain http to "${url.hostname}". Use https, or a provider on this machine.`,
    )
  }

  if (url.search !== '' || url.hash !== '') {
    throw new ProviderConfigError('SANVERSE_AI_BASE_URL must not carry a query string or fragment.')
  }

  const path = url.pathname.replace(/\/+$/, '')
  url.pathname = path.endsWith(CHAT_COMPLETIONS_PATH) ? path : `${path}${CHAT_COMPLETIONS_PATH}`
  return url.toString()
}

export const resolveIntentProviderConfig = (
  environment: Readonly<Record<string, string | undefined>>,
): IntentProviderConfig => {
  const kind = trimmed(environment.SANVERSE_AI_PROVIDER) ?? 'fake'

  if (!(INTENT_PROVIDER_KINDS as readonly string[]).includes(kind)) {
    throw new ProviderConfigError(
      `SANVERSE_AI_PROVIDER must be one of ${INTENT_PROVIDER_KINDS.join(', ')}. Received "${kind}".`,
    )
  }

  if (kind === 'fake') return Object.freeze({ kind: 'fake' as const })

  const baseUrl = trimmed(environment.SANVERSE_AI_BASE_URL)
  if (!baseUrl) {
    throw new ProviderConfigError('SANVERSE_AI_BASE_URL is required when SANVERSE_AI_PROVIDER is openai-compatible.')
  }
  const model = trimmed(environment.SANVERSE_AI_MODEL)
  if (!model) {
    throw new ProviderConfigError('SANVERSE_AI_MODEL is required when SANVERSE_AI_PROVIDER is openai-compatible.')
  }

  const endpoint = resolveChatCompletionsEndpoint(baseUrl)

  // No key is a legitimate configuration: LM Studio on this machine does not
  // use one. An empty string is treated as absent rather than sent as a header.
  const apiKey = trimmed(environment.SANVERSE_AI_API_KEY)

  return Object.freeze({
    kind: 'openai-compatible' as const,
    label: trimmed(environment.SANVERSE_AI_LABEL) ?? new URL(endpoint).host,
    endpoint,
    apiKey,
    model,
  })
}

/** The composition point: configuration in, a port out. */
export const createIntentProvider = (config: IntentProviderConfig): IntentProviderPort =>
  config.kind === 'fake'
    ? createFakeIntentAdapter()
    : createOpenAiCompatibleAdapter({
        label: config.label,
        endpoint: config.endpoint,
        apiKey: config.apiKey,
        model: config.model,
      })

/**
 * One line the owner cannot miss at startup. Says which provider is live and,
 * when it is real, where it points — so "I tested the real one" is never a
 * guess. The API key is never included.
 */
export const describeIntentProvider = (config: IntentProviderConfig): string =>
  config.kind === 'fake'
    ? 'AI provider: fake (deterministic, offline). Nothing leaves this machine.'
    : `AI provider: ${config.label} — model "${config.model}" at ${config.endpoint}${config.apiKey ? '' : ' (no API key set)'}`
