import type { Transcript } from '@sanverse/edit-domain'

/**
 * The seam a speech-recognition service would plug into.
 *
 * Nothing implements this against a real service yet, and that is deliberate.
 * Sending a user's video or audio to a third party is the single most
 * privacy-sensitive thing this product could ever do, so the boundary is
 * defined FIRST, with its rules written down, and the wiring comes later under
 * those rules rather than being retrofitted around whatever an SDK happened to
 * make easy.
 *
 * Four rules, each of which exists because the alternative is a real harm:
 *
 *   1. OFF BY DEFAULT. `NullTranscriptionAdapter` is what ships. A build with
 *      no configuration makes no network call, ever. Captions still work — from
 *      a sidecar file the user already has.
 *
 *   2. THE PORT IS HANDED A REFERENCE, NOT A FILE. It receives an opaque
 *      `mediaRef` that only a storage adapter can resolve. An adapter therefore
 *      cannot wander the disk, and cannot see the project, the edit history, or
 *      anything the user typed.
 *
 *   3. THE RETURN IS `unknown`. The port promises nothing about the shape of
 *      what comes back. Exactly as with the AI provider port, typing it as a
 *      transcript would be a lie that spreads downstream. `validateTranscript`
 *      is the only thing that decides what a reply is allowed to be.
 *
 *   4. THE USER IS TOLD. `source: 'transcription'` is recorded on the result,
 *      so a transcript that left the machine can always be told apart from one
 *      that did not.
 */

export type TranscriptionRequest = Readonly<{
  /** Opaque storage reference. Only a storage adapter can turn this into bytes. */
  mediaRef: string
  /** BCP-47 hint, or null to let the service decide. */
  languageHint: string | null
  /** Length of the media in seconds, so an adapter can refuse what is too long. */
  durationSeconds: number
}>

export type TranscriptionProviderPort = Readonly<{
  /** Shown in diagnostics only. */
  name: string
  /**
   * False for every adapter that makes no network call. The service refuses to
   * run an enabled remote adapter unless the user has explicitly turned it on,
   * and this flag is how it can tell without knowing what the adapter is.
   */
  sendsMediaOffMachine: boolean
  transcribe(
    request: TranscriptionRequest,
    options: { readonly signal?: AbortSignal },
  ): Promise<unknown>
}>

export class TranscriptionError extends Error {
  readonly code: 'TRANSCRIPTION_DISABLED' | 'TRANSCRIPTION_TIMEOUT' | 'TRANSCRIPTION_UNAVAILABLE' | 'TRANSCRIPTION_REJECTED'
  constructor(code: TranscriptionError['code'], message: string, options?: ErrorOptions) {
    super(message, options)
    this.code = code
    this.name = 'TranscriptionError'
  }
}

/**
 * What ships. Refuses, clearly, and points at the thing that does work.
 *
 * A stub that returned an empty transcript would be worse than one that
 * refuses: the user would get a video with no captions and no explanation.
 */
export const NullTranscriptionAdapter: TranscriptionProviderPort = Object.freeze({
  name: 'null',
  sendsMediaOffMachine: false,
  async transcribe(): Promise<never> {
    throw new TranscriptionError(
      'TRANSCRIPTION_DISABLED',
      'Automatic transcription is switched off. Add a transcript file to caption this video.',
    )
  },
})

/**
 * A deterministic stand-in for tests, mirroring the fake AI provider.
 *
 * It reads a script handed to it rather than inventing words, so a test that
 * uses it is testing the caption pipeline, not a guess about what a
 * recogniser might say. It makes no network call and never touches the media.
 */
export const createFakeTranscriptionAdapter = (
  reply: (request: TranscriptionRequest) => unknown,
): TranscriptionProviderPort => Object.freeze({
  name: 'fake',
  sendsMediaOffMachine: false,
  async transcribe(request: TranscriptionRequest): Promise<unknown> {
    return reply(request)
  },
})

export type TranscriptionResult =
  | { readonly ok: true; readonly value: Transcript }
  | { readonly ok: false; readonly error: TranscriptionError }
