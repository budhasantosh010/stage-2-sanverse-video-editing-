import { describe, expect, it } from 'vitest'

import { summarizeEvaluation, validateEvaluationCorpus } from './evaluation.ts'

const validCase = {
  caseId: 'plain-request',
  message: 'add my name here',
  hasPoint: true,
  expected: 'proposal',
  expectedClarificationField: null,
  why: 'Everything needed is present, so the system should propose rather than ask.',
}

describe('evaluation corpus', () => {
  it('accepts a well-formed corpus', () => {
    expect(validateEvaluationCorpus([validCase]).ok).toBe(true)
  })

  it('refuses a clarification case that does not say what is missing', () => {
    const result = validateEvaluationCorpus([
      { ...validCase, expected: 'clarification', expectedClarificationField: null },
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.issues[0].code).toBe('FIELD_REQUIRED')
  })

  it('refuses duplicate case IDs', () => {
    expect(validateEvaluationCorpus([validCase, validCase]).ok).toBe(false)
  })

  it('counts a wrong clarification field as a failure, not a pass', () => {
    const summary = summarizeEvaluation([
      {
        caseId: 'asks-the-wrong-thing',
        expected: 'clarification',
        actual: 'clarification',
        expectedClarificationField: 'primary-text',
        actualClarificationField: 'duration',
      },
    ])
    expect(summary.passed).toBe(0)
    expect(summary.failures).toHaveLength(1)
  })
})
