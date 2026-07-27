import { ProjectIntakeError } from '../projects/project-repository.ts'
import { ProjectStateError } from '../projects/project-state-service.ts'

/**
 * One table saying how every known failure becomes an HTTP answer.
 *
 * This used to be a chain of `if` statements at the bottom of the request
 * handler, growing by a branch for every feature. That shape has two problems
 * that get worse, not better, with size: nobody can see the whole policy at
 * once, and the natural thing to do when adding a case is to append another
 * branch — which is how a 500 quietly starts being returned for something the
 * caller could have fixed themselves.
 *
 * Here the policy is data. Reading it top to bottom tells you exactly what the
 * API can say and when.
 *
 * The three status families mean different things and must not be confused:
 *
 *   4xx  the caller can fix this and retry           (stale revision, bad JSON)
 *   5xx  the caller can do nothing; we failed        (renderer broke)
 *   503  temporarily unavailable, try again later    (ffmpeg missing)
 *
 * Anything not listed here is an unknown failure. It is logged and answered
 * with a generic 500, never guessed at, because guessing means telling the user
 * their edit is invalid when in fact the server has a bug.
 */

export type FailureAnswer = Readonly<{
  status: number
  /** Message shown to the user. Plain language, never a stack or a path. */
  message: string
  /** Machine-readable code the browser branches on. */
  code?: string
  /** True when the operator needs to see this in the server log. */
  log?: boolean
  /** Non-JSON answers, used only for byte-range failures. */
  headers?: Readonly<Record<string, string>>
  emptyBody?: boolean
}>

/** Codes that mean "the thing you asked for is not here". */
const NOT_FOUND_CODES = new Set([
  'PROJECT_NOT_FOUND',
  'INVALID_PROJECT_ID',
  'EXPORT_NOT_FOUND',
  'INVALID_EXPORT_ID',
])

/** Codes that mean "the edits cannot be turned into a video". The caller's problem. */
const UNRENDERABLE_CODES = new Set([
  'RENDER_PROJECT_INVALID',
  'NOTHING_TO_RENDER',
  'RENDER_INPUT_INVALID',
])

/** Codes that mean "the renderer itself failed". Our problem, and worth logging. */
const RENDERER_FAULT_CODES = new Set([
  'RENDER_PATH_INVALID',
  'RENDER_FAILED',
  'RENDER_OUTPUT_MISSING',
  'RENDER_OUTPUT_INVALID',
])

/** Project-state failures the caller can act on, and the status each deserves. */
const PROJECT_STATE_STATUS: Readonly<Record<string, number>> = {
  // A stale edit is the client's problem to retry, not a server fault.
  REVISION_CONFLICT: 409,
  CHANGE_SET_REJECTED: 400,
  NOTHING_TO_UNDO: 409,
  NOTHING_TO_REDO: 409,
  CHANGE_SET_UNKNOWN: 409,
  PROJECT_STATE_INVALID: 500,
}

const codeOf = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined

export const errorCode = codeOf

/**
 * Decide the answer for one failure, or return null when it is unrecognised.
 *
 * Returning null rather than a default 500 is deliberate: the caller then knows
 * it is dealing with something nobody has thought about, and can log it as such.
 */
export const describeFailure = (error: unknown): FailureAnswer | null => {
  const code = codeOf(error)

  if (code === 'INVALID_RANGE') {
    return {
      status: 416,
      message: '',
      headers: { 'content-range': 'bytes */0', 'cache-control': 'no-store' },
      emptyBody: true,
    }
  }

  if (code !== undefined && NOT_FOUND_CODES.has(code)) {
    return { status: 404, message: 'Project media was not found.' }
  }

  if (error instanceof ProjectStateError) {
    const status = PROJECT_STATE_STATUS[error.code] ?? 500
    return { status, message: error.message, code: error.code, log: status >= 500 }
  }

  if (code !== undefined && UNRENDERABLE_CODES.has(code)) {
    return { status: 400, message: 'The accepted edits cannot be exported.', code }
  }
  if (code === 'RENDER_TOOL_UNAVAILABLE') {
    return { status: 503, message: 'The local renderer is unavailable.', code }
  }
  if (code === 'RENDER_PROCESS_BLOCKED') {
    return { status: 503, message: 'The local renderer process was blocked from starting.', code }
  }
  if (code === 'RENDER_CANCELLED') {
    return { status: 408, message: 'Export was cancelled.', code }
  }
  if (code !== undefined && RENDERER_FAULT_CODES.has(code)) {
    return { status: 500, message: 'The local renderer could not produce a verified MP4.', code, log: true }
  }

  if (error instanceof ProjectIntakeError) {
    const status = error.code === 'UPLOAD_TOO_LARGE' ? 413 : error.code === 'PROJECT_COLLISION' ? 409 : 400
    return { status, message: error.message, code: error.code }
  }

  // Something outside the state service reported invalid saved history.
  if (code === 'PROJECT_STATE_INVALID') {
    return { status: 500, message: 'The saved project history is invalid.', code, log: true }
  }

  return null
}
