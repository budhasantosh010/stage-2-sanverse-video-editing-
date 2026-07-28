import { validateTranscript, type Transcript } from '@sanverse/edit-domain'

import {
  NullTranscriptionAdapter,
  TranscriptionError,
  type TranscriptionProviderPort,
  type TranscriptionRequest,
  type TranscriptionResult,
} from './transcription-port.ts'

/**
 * The fixed steps every transcription goes through, in this order.
 *
 * The order is the safety property. In particular, consent is checked BEFORE
 * the adapter is called, not after, and the reply is validated before anything
 * downstream sees it.
 *
 *   1. is an adapter configured at all?            no  -> refuse, plainly
 *   2. does it send media off the machine?         yes -> require consent
 *   3. call it, with a deadline                    slow-> refuse, plainly
 *   4. validate whatever came back                 bad -> refuse, plainly
 *   5. check it describes the asset we asked about wrong asset -> refuse
 *
 * Step 5 exists because a service that returns someone else's transcript would
 * otherwise caption this video with another video's words, and every check
 * before it would have passed.
 */

export type TranscriptionServiceConfig = Readonly<{
  provider: TranscriptionProviderPort
  /** The user must have said yes for an adapter that sends media away. */
  userAllowsSendingMediaOffMachine: boolean
  timeoutMs: number
}>

export const DEFAULT_TRANSCRIPTION_CONFIG: TranscriptionServiceConfig = Object.freeze({
  provider: NullTranscriptionAdapter,
  userAllowsSendingMediaOffMachine: false,
  timeoutMs: 120_000,
})

export const transcribeMedia = async (
  request: TranscriptionRequest,
  assetId: string,
  transcriptId: string,
  config: TranscriptionServiceConfig = DEFAULT_TRANSCRIPTION_CONFIG,
): Promise<TranscriptionResult> => {
  if (config.provider.sendsMediaOffMachine && !config.userAllowsSendingMediaOffMachine) {
    return {
      ok: false,
      error: new TranscriptionError(
        'TRANSCRIPTION_DISABLED',
        'This would send your video to another service, and you have not allowed that.',
      ),
    }
  }

  const controller = new AbortController()
  const deadline = setTimeout(() => controller.abort(), config.timeoutMs)
  let raw: unknown
  try {
    raw = await config.provider.transcribe(request, { signal: controller.signal })
  } catch (cause) {
    if (cause instanceof TranscriptionError) return { ok: false, error: cause }
    // The adapter's own message may quote the service's reply, so it is never
    // shown to the user and never logged.
    return {
      ok: false,
      error: new TranscriptionError(
        controller.signal.aborted ? 'TRANSCRIPTION_TIMEOUT' : 'TRANSCRIPTION_UNAVAILABLE',
        controller.signal.aborted
          ? 'Working out what was said took too long.'
          : 'Working out what was said did not succeed.',
      ),
    }
  } finally {
    clearTimeout(deadline)
  }

  const validated = validateTranscript(raw)
  if (!validated.ok) {
    return {
      ok: false,
      error: new TranscriptionError('TRANSCRIPTION_REJECTED', 'The transcript that came back could not be read.'),
    }
  }

  if (validated.value.assetId !== assetId) {
    return {
      ok: false,
      error: new TranscriptionError(
        'TRANSCRIPTION_REJECTED',
        'The transcript that came back describes a different video.',
      ),
    }
  }
  if (validated.value.transcriptId !== transcriptId) {
    return {
      ok: false,
      error: new TranscriptionError('TRANSCRIPTION_REJECTED', 'The transcript that came back could not be read.'),
    }
  }
  if (validated.value.source !== 'transcription') {
    // A remote reply claiming to be a local sidecar would hide from the user
    // that their media left the machine.
    return {
      ok: false,
      error: new TranscriptionError('TRANSCRIPTION_REJECTED', 'The transcript that came back could not be read.'),
    }
  }

  return { ok: true, value: validated.value satisfies Transcript }
}
