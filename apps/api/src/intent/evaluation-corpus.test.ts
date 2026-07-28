import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  NAMEPLATE_COMPONENT_ID,
  PROJECT_TIMESCALE,
  TICKS_PER_MILLISECOND,
  createProject,
  type EditProject,
} from '@sanverse/edit-domain'
import {
  summarizeEvaluation,
  validateEvaluationCorpus,
  type EvaluationCase,
  type EvaluationResult,
} from '@sanverse/intent-domain'

import { createFakeIntentAdapter } from './fake-intent-adapter.ts'
import { createIntentService } from './intent-service.ts'

const PROJECT_ID = 'project_0123456789abcdef'
const CLIP_ID = 'clip_0123456789ab'
const THIRTY_SECONDS = 30_000 * TICKS_PER_MILLISECOND

const CORPUS_FILES = ['nameplate-valid', 'nameplate-ambiguous', 'nameplate-adversarial'] as const

function loadCorpus(): readonly EvaluationCase[] {
  const cases: EvaluationCase[] = []
  for (const name of CORPUS_FILES) {
    const path = fileURLToPath(new URL(`../../../../fixtures/intent/${name}.json`, import.meta.url))
    const parsed = validateEvaluationCorpus(JSON.parse(readFileSync(path, 'utf8')), `$.${name}`)
    if (!parsed.ok) throw new Error(`${name} is not a valid corpus: ${JSON.stringify(parsed.error.issues)}`)
    cases.push(...parsed.value)
  }
  return cases
}

function testProject(): EditProject {
  const created = createProject({
    projectId: PROJECT_ID,
    asset: {
      schemaVersion: 'sanverse.asset/media/v1' as const,
      mediaKind: 'video' as const,
      assetId: 'asset_0123456789ab',
      storageRef: `project:${PROJECT_ID}/source`,
      sha256: 'a'.repeat(64),
      byteLength: 1_000,
      duration: { ticks: THIRTY_SECONDS, timescale: PROJECT_TIMESCALE },
      width: 1920,
      height: 1080,
      frameRate: { numerator: 30, denominator: 1 },
      hasAudio: true,
      durationResidualSeconds: 0,
    },
    compositionId: 'composition_0123456789ab',
    trackId: 'track_0123456789ab',
    clipId: CLIP_ID,
  })
  if (!created.ok) throw new Error('fixture project is invalid')
  return created.value
}

/**
 * The corpus asserts what the PRODUCT does, never what a model says.
 *
 * Every one of these runs against the fake provider, so it is free, instant,
 * and identical on every machine. When a real provider is connected, the same
 * corpus runs against it unchanged — the expectations do not move.
 */
describe('nameplate intent corpus', () => {
  const project = testProject()
  let counter = 0
  const service = createIntentService({
    provider: createFakeIntentAdapter(),
    loadProject: async () => project,
    createOperationId: () => `operation_${String(counter++).padStart(16, '0')}`,
  })

  const run = async (evaluationCase: EvaluationCase): Promise<EvaluationResult> => {
    const outcome = await service.propose({
      schemaVersion: 'sanverse.intent-request/v1',
      requestId: `request_${evaluationCase.caseId.replace(/[^a-z0-9]/g, '').padEnd(8, '0').slice(0, 40)}`,
      projectId: PROJECT_ID,
      baseRevision: project.revision,
      message: evaluationCase.message,
      context: {
        clipId: CLIP_ID,
        sampledClipTimeTicks: evaluationCase.hasPoint ? 6_000 * TICKS_PER_MILLISECOND : null,
        point: evaluationCase.hasPoint ? { x: 0.4, y: 0.7 } : null,
        playheadTicks: 6_000 * TICKS_PER_MILLISECOND,
        compositionDurationTicks: THIRTY_SECONDS,
        compositionWidth: 1920,
        compositionHeight: 1080,
      },
      capabilityIds: [NAMEPLATE_COMPONENT_ID],
      locale: 'en',
    })

    return {
      caseId: evaluationCase.caseId,
      expected: evaluationCase.expected,
      actual: outcome.kind,
      expectedClarificationField: evaluationCase.expectedClarificationField,
      actualClarificationField: outcome.kind === 'clarification' ? outcome.field : null,
    }
  }

  it('behaves as recorded for every case', async () => {
    const cases = loadCorpus()
    expect(cases.length).toBeGreaterThanOrEqual(18)
    const results: EvaluationResult[] = []
    for (const evaluationCase of cases) results.push(await run(evaluationCase))
    const summary = summarizeEvaluation(results)
    expect(summary.failures).toEqual([])
    expect(summary.passed).toBe(summary.total)
  })

  it('never produces a change set for anything in the adversarial file', async () => {
    const path = fileURLToPath(new URL('../../../../fixtures/intent/nameplate-adversarial.json', import.meta.url))
    const parsed = validateEvaluationCorpus(JSON.parse(readFileSync(path, 'utf8')))
    if (!parsed.ok) throw new Error('adversarial corpus is invalid')
    for (const evaluationCase of parsed.value) {
      const result = await run(evaluationCase)
      expect(result.actual).not.toBe('proposal')
    }
  })
})
