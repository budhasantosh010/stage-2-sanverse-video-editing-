import { err, isRecord, ok, type Result } from '@sanverse/edit-domain/result'

import { CLARIFICATION_FIELDS, type ClarificationField } from './clarification.ts'

/**
 * How the product is allowed to answer, from the user's point of view.
 *
 * These four are the only endings. Note what is missing: there is no "did
 * something unexpected" and no "partially applied". Every path through the
 * system lands on one of these, and three of the four leave the project
 * completely untouched.
 */
export const EVALUATION_OUTCOMES = ['proposal', 'clarification', 'unsupported', 'rejected'] as const
export type EvaluationOutcome = (typeof EVALUATION_OUTCOMES)[number]

/**
 * One test in the prompt corpus.
 *
 * It records the expected PRODUCT BEHAVIOUR, never expected model wording. A
 * corpus that asserts sentences breaks the moment a provider is swapped or a
 * model is updated, and then gets deleted — which is how a safety net quietly
 * disappears. Asserting behaviour survives every provider change.
 */
export type EvaluationCase = Readonly<{
  caseId: string
  /** What the user types. */
  message: string
  /** Whether the user pointed at the picture first. */
  hasPoint: boolean
  expected: EvaluationOutcome
  /** For a clarification, exactly which missing fact must be asked about. */
  expectedClarificationField: ClarificationField | null
  /** Why this behaviour is the right one. Read by a human, not by code. */
  why: string
}>

export type EvaluationError = {
  readonly code: 'EVALUATION_CASE_INVALID'
  readonly issues: readonly { readonly path: string; readonly code: string }[]
}

const CASE_KEYS = [
  'caseId',
  'message',
  'hasPoint',
  'expected',
  'expectedClarificationField',
  'why',
] as const

const fail = (path: string, code: string): EvaluationError => ({
  code: 'EVALUATION_CASE_INVALID',
  issues: [{ path, code }],
})

export const validateEvaluationCase = (
  input: unknown,
  path = '$',
): Result<EvaluationCase, EvaluationError> => {
  if (!isRecord(input)) return err(fail(path, 'TYPE_INVALID'))
  for (const key of CASE_KEYS) {
    if (!Object.hasOwn(input, key)) return err(fail(`${path}.${key}`, 'FIELD_REQUIRED'))
  }
  for (const key of Object.keys(input)) {
    if (!(CASE_KEYS as readonly string[]).includes(key)) {
      return err(fail(`${path}.${key}`, 'FIELD_UNKNOWN'))
    }
  }
  if (typeof input.caseId !== 'string' || input.caseId.trim().length === 0) {
    return err(fail(`${path}.caseId`, 'VALUE_OUT_OF_RANGE'))
  }
  if (typeof input.message !== 'string' || input.message.length === 0) {
    return err(fail(`${path}.message`, 'VALUE_OUT_OF_RANGE'))
  }
  if (typeof input.hasPoint !== 'boolean') return err(fail(`${path}.hasPoint`, 'TYPE_INVALID'))
  if (!(EVALUATION_OUTCOMES as readonly string[]).includes(input.expected as string)) {
    return err(fail(`${path}.expected`, 'VALUE_OUT_OF_RANGE'))
  }
  if (
    input.expectedClarificationField !== null &&
    !(CLARIFICATION_FIELDS as readonly string[]).includes(input.expectedClarificationField as string)
  ) {
    return err(fail(`${path}.expectedClarificationField`, 'VALUE_OUT_OF_RANGE'))
  }
  // A clarification case that does not say which fact is missing proves
  // nothing: "it asked something" is not a behaviour worth locking in.
  if (input.expected === 'clarification' && input.expectedClarificationField === null) {
    return err(fail(`${path}.expectedClarificationField`, 'FIELD_REQUIRED'))
  }
  if (typeof input.why !== 'string' || input.why.trim().length === 0) {
    return err(fail(`${path}.why`, 'VALUE_OUT_OF_RANGE'))
  }

  return ok(Object.freeze({
    caseId: input.caseId as string,
    message: input.message as string,
    hasPoint: input.hasPoint as boolean,
    expected: input.expected as EvaluationOutcome,
    expectedClarificationField: (input.expectedClarificationField ?? null) as ClarificationField | null,
    why: input.why as string,
  }))
}

export const validateEvaluationCorpus = (
  input: unknown,
  path = '$',
): Result<readonly EvaluationCase[], EvaluationError> => {
  if (!Array.isArray(input)) return err(fail(path, 'TYPE_INVALID'))
  if (input.length === 0) return err(fail(path, 'VALUE_OUT_OF_RANGE'))
  const cases: EvaluationCase[] = []
  const seen = new Set<string>()
  for (const [index, raw] of input.entries()) {
    const parsed = validateEvaluationCase(raw, `${path}[${index}]`)
    if (!parsed.ok) return parsed
    if (seen.has(parsed.value.caseId)) return err(fail(`${path}[${index}].caseId`, 'DUPLICATE_ID'))
    seen.add(parsed.value.caseId)
    cases.push(parsed.value)
  }
  return ok(Object.freeze(cases))
}

export type EvaluationResult = Readonly<{
  caseId: string
  expected: EvaluationOutcome
  actual: EvaluationOutcome
  expectedClarificationField: ClarificationField | null
  actualClarificationField: ClarificationField | null
}>

export type EvaluationSummary = Readonly<{
  total: number
  passed: number
  failures: readonly EvaluationResult[]
}>

export const judgeEvaluation = (result: EvaluationResult): boolean =>
  result.expected === result.actual &&
  result.expectedClarificationField === result.actualClarificationField

export const summarizeEvaluation = (results: readonly EvaluationResult[]): EvaluationSummary => {
  const failures = results.filter((result) => !judgeEvaluation(result))
  return Object.freeze({
    total: results.length,
    passed: results.length - failures.length,
    failures: Object.freeze(failures),
  })
}
