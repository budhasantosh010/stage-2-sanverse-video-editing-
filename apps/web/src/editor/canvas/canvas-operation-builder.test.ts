import { describe, expect, it } from 'vitest'
import { DEFAULT_VISUAL_PROPERTIES, PROJECT_TIMESCALE, validateOperation } from '@sanverse/edit-domain'
import type { CanvasVisualSelection } from './canvas-contract'
import { buildCanvasVisualOperation, canvasAnimatedPropertyConflict } from './canvas-operation-builder'

const selection: CanvasVisualSelection = Object.freeze({
  timelineItemId: 'item_title',
  visualId: 'title_abcd1234',
  nodeId: 'title_abcd1234',
  label: 'Title',
  kind: 'title',
  state: 'committed',
  projectRevision: 5,
  startTicks: 0,
  durationTicks: 5_000_000,
  visualProperties: DEFAULT_VISUAL_PROPERTIES,
  supportsCrop: false,
  supportsRotation: true,
  supportsResize: true,
  blockedReason: null,
  proposalPoint: null,
})

describe('canvas operation builder', () => {
  it('builds one valid full-state set-visual-properties operation and preserves unrelated properties', () => {
    const properties = Object.freeze({
      ...DEFAULT_VISUAL_PROPERTIES,
      transform: Object.freeze({ ...DEFAULT_VISUAL_PROPERTIES.transform, translateX: 0.125 }),
      layer: 4,
      effects: Object.freeze([{ kind: 'brightness' as const, amount: 0.2 }]),
    })
    const result = buildCanvasVisualOperation(selection, properties, 'operation_12345678')
    expect(result).toMatchObject({
      ok: true,
      operation: {
        kind: 'set-visual-properties',
        capabilityId: 'sanverse.visual.properties.primitive/v1',
        visualId: 'title_abcd1234',
        transform: { translateX: 0.125 },
        layer: 4,
        crop: DEFAULT_VISUAL_PROPERTIES.crop,
        effects: [{ kind: 'brightness', amount: 0.2 }],
      },
    })
    if (result.ok) expect(validateOperation(result.operation).ok).toBe(true)
  })

  it('never creates an accepted operation for proposal repair', () => {
    expect(buildCanvasVisualOperation({ ...selection, state: 'proposed', kind: 'proposal' }, DEFAULT_VISUAL_PROPERTIES, 'operation_12345678')).toEqual({
      ok: false,
      message: 'Pending proposal movement is not an accepted project edit.',
    })
  })

  it('refuses to flatten animated properties silently', () => {
    const animated = {
      ...selection,
      visualProperties: {
        ...DEFAULT_VISUAL_PROPERTIES,
        tracks: [{ property: 'scale' as const, keyframes: [
          { at: { ticks: 0, timescale: 1_440_000 }, value: 1, easing: { kind: 'linear' as const } },
          { at: { ticks: 1_440_000, timescale: 1_440_000 }, value: 2, easing: { kind: 'linear' as const } },
        ] }],
      },
    }
    expect(canvasAnimatedPropertyConflict(animated as CanvasVisualSelection, 'resize')).toBe('This property is animated. Edit its keyframe in the Inspector.')
    expect(canvasAnimatedPropertyConflict(animated as CanvasVisualSelection, 'move')).toBeNull()
  })
})
