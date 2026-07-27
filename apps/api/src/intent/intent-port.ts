import type { OutboundPayload } from './outbound-data-policy.ts'

/**
 * The one seam a provider plugs into.
 *
 * Two things about this signature are deliberate and load-bearing:
 *
 * 1. It is handed an `OutboundPayload`, never the request. A provider adapter
 *    therefore cannot reach for the project ID, a path, or the edit history —
 *    it has never been given them.
 *
 * 2. It returns `unknown`. The port promises NOTHING about the shape of what
 *    comes back. Typing it as a candidate would be a lie that spreads: every
 *    caller downstream would then treat unchecked provider output as trusted.
 *    The one and only place that decides what the reply is allowed to be is
 *    `validateIntentCandidate`.
 */
export type IntentProviderPort = Readonly<{
  /** Shown in diagnostics only. Never shown to the user during normal use. */
  name: string
  propose(payload: OutboundPayload, options: { readonly signal?: AbortSignal }): Promise<unknown>
}>

export class ProviderCallError extends Error {
  readonly code: 'PROVIDER_TIMEOUT' | 'PROVIDER_UNAVAILABLE'
  constructor(code: ProviderCallError['code'], message: string, options?: ErrorOptions) {
    super(message, options)
    this.code = code
    this.name = 'ProviderCallError'
  }
}
