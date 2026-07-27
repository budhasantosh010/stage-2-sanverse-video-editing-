import { err, isRecord, ok, type Result } from '@sanverse/edit-domain/result'

/**
 * The only things worth asking a user about.
 *
 * A clarification is allowed to ask for a fact that changes the edit, and
 * nothing else. "What should it say?" changes the edit. "Tell me more about
 * your video" does not, so it can never be asked.
 *
 * The list is closed on purpose. A provider that invents a new kind of question
 * is refused rather than passed through, because an open-ended question is how
 * a chat assistant slides into interrogating the user instead of editing.
 */
export const CLARIFICATION_FIELDS = [
  'primary-text',
  'secondary-text',
  'position',
  'start-time',
  'duration',
  'clip',
] as const

export type ClarificationField = (typeof CLARIFICATION_FIELDS)[number]

export const MAX_CLARIFICATION_QUESTION_LENGTH = 200

export type ClarificationQuestion = Readonly<{
  field: ClarificationField
  /** One short question in the user's own words. No jargon, no options list. */
  question: string
}>

export type ClarificationError = {
  readonly code: 'CLARIFICATION_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: string }[]
}

const QUESTION_KEYS = ['field', 'question'] as const

const fail = (path: string, code: string): ClarificationError => ({
  code: 'CLARIFICATION_INVALID',
  issues: [{ path, code }],
})

export const validateClarificationQuestion = (
  input: unknown,
  path = '$',
): Result<ClarificationQuestion, ClarificationError> => {
  if (!isRecord(input)) return err(fail(path, 'TYPE_INVALID'))
  for (const key of QUESTION_KEYS) {
    if (!Object.hasOwn(input, key)) return err(fail(`${path}.${key}`, 'FIELD_REQUIRED'))
  }
  for (const key of Object.keys(input)) {
    if (!(QUESTION_KEYS as readonly string[]).includes(key)) {
      return err(fail(`${path}.${key}`, 'FIELD_UNKNOWN'))
    }
  }
  if (!CLARIFICATION_FIELDS.includes(input.field as ClarificationField)) {
    return err(fail(`${path}.field`, 'VALUE_OUT_OF_RANGE'))
  }
  if (typeof input.question !== 'string') return err(fail(`${path}.question`, 'TYPE_INVALID'))
  const question = input.question.trim()
  if (question.length === 0) return err(fail(`${path}.question`, 'VALUE_OUT_OF_RANGE'))
  if ([...question].length > MAX_CLARIFICATION_QUESTION_LENGTH) {
    return err(fail(`${path}.question`, 'TEXT_TOO_LONG'))
  }
  return ok(Object.freeze({ field: input.field as ClarificationField, question }))
}

/**
 * The question the system asks itself when a fact is missing and no
 * owner-approved default exists. Written here, in the domain, so the wording is
 * the same whichever provider is connected — the provider is not trusted to
 * phrase a question to the user.
 */
export const DEFAULT_CLARIFICATION: Readonly<Record<ClarificationField, string>> = Object.freeze({
  'primary-text': 'What should the text say?',
  'secondary-text': 'What should the smaller second line say?',
  position: 'Where on the picture should it go? Choose Point, then click the spot.',
  'start-time': 'When should it appear? Move the video to that moment and ask again.',
  duration: 'How long should it stay on screen?',
  clip: 'Which part of the video should this go on?',
})
