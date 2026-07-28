import { describe, expect, it } from 'vitest'

import {
  CAPTIONS_COMPONENT_ID,
  CAPTION_CUE_PRIMITIVE_ID,
  CAPTION_STYLE_PRIMITIVE_ID,
  NAMEPLATE_COMPONENT_ID,
} from './capabilities.ts'
import {
  DEFAULT_CAPTION_STYLE_ID,
  MAX_CAPTION_LINE_LENGTH,
  foldCaptionOperations,
  validateCaptionOperation,
  type CaptionOperation,
  type CaptionStyleId,
} from './caption-operations.ts'
import { OPERATION_SCHEMA_VERSION } from './timeline-operations.ts'
import { ms, testCaptions } from './test-fixtures.ts'

const setCue = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId: 'operation_setcue01',
  kind: 'set-caption-cue',
  capabilityId: CAPTION_CUE_PRIMITIVE_ID,
  captionSetId: 'captions_aaaaaaaa',
  cueId: 'cue_0002',
  sourceInterval: { start: ms(3_000), duration: ms(1_500) },
  lines: ['corrected line'],
  ...overrides,
})

const removeCue = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId: 'operation_rmcue001',
  kind: 'remove-caption-cue',
  capabilityId: CAPTION_CUE_PRIMITIVE_ID,
  captionSetId: 'captions_aaaaaaaa',
  cueId: 'cue_0003',
  ...overrides,
})

const setStyle = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: OPERATION_SCHEMA_VERSION,
  operationId: 'operation_style001',
  kind: 'set-caption-style',
  capabilityId: CAPTION_STYLE_PRIMITIVE_ID,
  captionSetId: 'captions_aaaaaaaa',
  styleId: 'sanverse.caption.plain/v1',
  ...overrides,
})

const expectValid = (input: unknown): CaptionOperation => {
  const result = validateCaptionOperation(input)
  if (!result.ok) throw new Error(`expected valid: ${JSON.stringify(result.error.issues)}`)
  return result.value
}

describe('validateCaptionOperation — add-captions', () => {
  it('accepts a well-formed set', () => {
    const operation = expectValid(testCaptions())
    expect(operation.kind).toBe('add-captions')
    if (operation.kind !== 'add-captions') return
    expect(operation.cues).toHaveLength(3)
    expect(operation.styleId).toBe(DEFAULT_CAPTION_STYLE_ID)
  })

  it('refuses a set with no cues, because it looks like it worked', () => {
    const result = validateCaptionOperation(testCaptions({ cues: [] }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'CUES_EMPTY')).toBe(true)
  })

  it('refuses two cues on screen at the same time', () => {
    const result = validateCaptionOperation(testCaptions({
      cues: [
        { cueId: 'cue_0001', sourceInterval: { start: ms(1_000), duration: ms(3_000) }, lines: ['a'] },
        { cueId: 'cue_0002', sourceInterval: { start: ms(2_000), duration: ms(1_000) }, lines: ['b'] },
      ],
    }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'CUES_OVERLAP')).toBe(true)
  })

  it('refuses two cues sharing an id', () => {
    const result = validateCaptionOperation(testCaptions({
      cues: [
        { cueId: 'cue_0001', sourceInterval: { start: ms(1_000), duration: ms(500) }, lines: ['a'] },
        { cueId: 'cue_0001', sourceInterval: { start: ms(2_000), duration: ms(500) }, lines: ['b'] },
      ],
    }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'DUPLICATE_CUE_ID')).toBe(true)
  })

  it('refuses a capability that cannot produce captions', () => {
    const result = validateCaptionOperation(testCaptions({ capabilityId: NAMEPLATE_COMPONENT_ID }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'CAPABILITY_UNKNOWN')).toBe(true)
  })

  it('refuses a look it does not know', () => {
    expect(validateCaptionOperation(testCaptions({ styleId: 'sanverse.caption.neon/v9' as CaptionStyleId })).ok).toBe(false)
  })

  it('refuses a newline hidden inside a line', () => {
    // Otherwise one line silently becomes two on screen.
    const result = validateCaptionOperation(testCaptions({
      cues: [{ cueId: 'cue_0001', sourceInterval: { start: ms(0), duration: ms(500) }, lines: ['a\nb'] }],
    }))
    expect(result.ok).toBe(false)
  })

  it('refuses a line past the hard ceiling', () => {
    const result = validateCaptionOperation(testCaptions({
      cues: [{
        cueId: 'cue_0001',
        sourceInterval: { start: ms(0), duration: ms(500) },
        lines: ['x'.repeat(MAX_CAPTION_LINE_LENGTH + 1)],
      }],
    }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'TEXT_TOO_LONG')).toBe(true)
  })

  it('refuses an unknown key rather than dropping it', () => {
    const result = validateCaptionOperation(testCaptions({ position: 'bottom' } as never))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'FIELD_UNKNOWN')).toBe(true)
  })
})

describe('validateCaptionOperation — the three editing operations', () => {
  it('accepts a cue replacement', () => {
    expect(expectValid(setCue()).kind).toBe('set-caption-cue')
  })

  it('accepts a cue removal', () => {
    expect(expectValid(removeCue()).kind).toBe('remove-caption-cue')
  })

  it('accepts a style change', () => {
    expect(expectValid(setStyle()).kind).toBe('set-caption-style')
  })

  it('refuses a cue id that is not a cue id', () => {
    expect(validateCaptionOperation(setCue({ cueId: 'nope' })).ok).toBe(false)
  })

  it('refuses an operation kind it has never heard of', () => {
    expect(validateCaptionOperation(setCue({ kind: 'set-caption-colour' })).ok).toBe(false)
  })
})

describe('foldCaptionOperations', () => {
  const fold = (operations: readonly unknown[]) =>
    foldCaptionOperations(operations.map((operation) => expectValid(operation)))

  it('returns the set exactly as added when nothing edits it', () => {
    const [set] = fold([testCaptions()])
    expect(set.cues.map((cue) => cue.lines[0])).toEqual(['first line', 'second line', 'third line'])
    expect(set.assetId).toBe('asset_aaaaaaaa')
  })

  it('applies a later correction to one cue and leaves the rest alone', () => {
    const [set] = fold([testCaptions(), setCue()])
    expect(set.cues.map((cue) => cue.lines[0])).toEqual(['first line', 'corrected line', 'third line'])
    expect(set.cues[1].sourceInterval.duration).toEqual(ms(1_500))
  })

  it('applies a later removal', () => {
    const [set] = fold([testCaptions(), removeCue()])
    expect(set.cues.map((cue) => cue.cueId)).toEqual(['cue_0001', 'cue_0002'])
  })

  it('applies a later style change to the whole set', () => {
    const [set] = fold([testCaptions(), setStyle()])
    expect(set.styleId).toBe('sanverse.caption.plain/v1')
  })

  it('keeps cues in time order however they were edited', () => {
    const [set] = fold([
      testCaptions(),
      setCue({ cueId: 'cue_0001', sourceInterval: { start: ms(9_000), duration: ms(500) }, lines: ['moved late'] }),
    ])
    expect(set.cues.map((cue) => cue.lines[0])).toEqual(['second line', 'third line', 'moved late'])
  })

  it('ignores an edit naming a set that is not there', () => {
    // Happens when the change set that created the captions was switched off.
    // The user already said "do not show those", so this is not an error.
    const sets = fold([setCue()])
    expect(sets).toEqual([])
  })

  it('is a fold, not a rewrite: the original operation is untouched', () => {
    const original = testCaptions()
    fold([original, setCue()])
    expect(original.cues[1].lines[0]).toBe('second line')
  })
})
