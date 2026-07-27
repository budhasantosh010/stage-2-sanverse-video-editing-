import { validateChangeSet, type AddNameplateOperation } from '@sanverse/edit-domain'
import type { ClarificationField } from '@sanverse/intent-domain'

const PROJECT_ID = /^project_[a-z0-9]{16,64}$/

export const CONVERSATION_ERROR =
  'The assistant could not be reached. Your video is unchanged.'

export type ConversationOutcome =
  | Readonly<{
      kind: 'proposal'
      requestId: string
      operation: AddNameplateOperation
      explanation: string
      note: string | null
    }>
  | Readonly<{ kind: 'clarification'; requestId: string; field: ClarificationField; question: string }>
  | Readonly<{ kind: 'unsupported'; requestId: string; message: string }>
  | Readonly<{ kind: 'rejected'; requestId: string; code: string; message: string }>

export type IntentContextInput = Readonly<{
  clipId: string
  sampledClipTimeTicks: number | null
  point: Readonly<{ x: number; y: number }> | null
  playheadTicks: number
  compositionDurationTicks: number
  compositionWidth: number
  compositionHeight: number
}>

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null

const asText = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 400 ? value : fallback

/**
 * Ask the assistant for an edit.
 *
 * Nothing this returns has been applied. The proposal comes back as a change
 * set the browser re-validates with the same domain validator the server uses,
 * because the browser trusts the shape of nothing it is handed — not even from
 * its own API, which is one HTTP hop away from anything that could impersonate
 * it.
 */
export async function requestIntent(
  projectId: string,
  input: Readonly<{ message: string; baseRevision: number; context: IntentContextInput }>,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ConversationOutcome> {
  if (!PROJECT_ID.test(projectId)) throw new Error(CONVERSATION_ERROR)

  let response: Response
  try {
    response = await fetcher(`/api/projects/${projectId}/intents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: input.message,
        baseRevision: input.baseRevision,
        context: input.context,
        locale: 'en',
      }),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error(CONVERSATION_ERROR, { cause: error })
  }

  if (response.status !== 200) throw new Error(CONVERSATION_ERROR)

  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    throw new Error(CONVERSATION_ERROR, { cause: error })
  }

  const outcome = asRecord(asRecord(body)?.outcome)
  if (!outcome) throw new Error(CONVERSATION_ERROR)
  const requestId = typeof outcome.requestId === 'string' ? outcome.requestId : ''

  if (outcome.kind === 'clarification') {
    const field = outcome.field
    if (typeof field !== 'string') throw new Error(CONVERSATION_ERROR)
    return Object.freeze({
      kind: 'clarification' as const,
      requestId,
      field: field as ClarificationField,
      question: asText(outcome.question, 'One more thing is needed before this can be done.'),
    })
  }

  if (outcome.kind === 'unsupported') {
    return Object.freeze({
      kind: 'unsupported' as const,
      requestId,
      message: asText(outcome.message, 'This version can add text to your video. It cannot do that yet.'),
    })
  }

  if (outcome.kind === 'rejected') {
    return Object.freeze({
      kind: 'rejected' as const,
      requestId,
      code: typeof outcome.code === 'string' ? outcome.code : 'REJECTED',
      message: asText(outcome.message, CONVERSATION_ERROR),
    })
  }

  if (outcome.kind !== 'proposal') throw new Error(CONVERSATION_ERROR)

  const changeSet = validateChangeSet(outcome.changeSet)
  if (!changeSet.ok || changeSet.value.operations.length !== 1) throw new Error(CONVERSATION_ERROR)
  if (changeSet.value.provenance.source !== 'ai') throw new Error(CONVERSATION_ERROR)

  return Object.freeze({
    kind: 'proposal' as const,
    requestId,
    operation: changeSet.value.operations[0] as AddNameplateOperation,
    explanation: asText(outcome.explanation, 'This adds text to your video.'),
    note: typeof outcome.note === 'string' && outcome.note.length > 0 && outcome.note.length <= 400 ? outcome.note : null,
  })
}
