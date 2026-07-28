import { describe, expect, it } from 'vitest'

import {
  ANNOTATION_SCHEMA_VERSION,
  ANNOTATION_SHAPES,
  MAX_ANNOTATIONS_PER_REQUEST,
  MAX_FREEHAND_POINTS,
  annotationBounds,
  describeAnnotation,
  validateAnnotation,
  validateAnnotations,
  type Annotation,
  type AnnotationShape,
} from './annotations.ts'
import { EXECUTABLE_OPERATION_KINDS, validateOperation } from './operations.ts'
import { ms, TEST_ASSET_ID } from './test-fixtures.ts'

const mark = (overrides: Partial<Annotation> = {}): unknown => ({
  schemaVersion: ANNOTATION_SCHEMA_VERSION,
  annotationId: 'annotation_aaaaaaaa',
  shape: 'point',
  coordinateSpace: 'source-normalized',
  points: [{ x: 0.5, y: 0.5 }],
  assetId: TEST_ASSET_ID,
  sourceTime: ms(8_000),
  note: '',
  ...overrides,
})

const pointsFor = (shape: AnnotationShape) =>
  shape === 'point' ? [{ x: 0.5, y: 0.5 }] : [{ x: 0.4, y: 0.4 }, { x: 0.6, y: 0.6 }]

describe('annotations are structurally incapable of reaching the export', () => {
  // The load-bearing test for G5C-02C. A mark is not an edit, and nothing about
  // it can be mistaken for one, so no renderer ever has to decide to skip it.
  it('has no operation kind that the executor recognises', () => {
    for (const shape of ANNOTATION_SHAPES) {
      expect(EXECUTABLE_OPERATION_KINDS).not.toContain(shape)
      expect(EXECUTABLE_OPERATION_KINDS).not.toContain(`annotate-${shape}`)
    }
    expect(EXECUTABLE_OPERATION_KINDS).not.toContain('annotate')
  })

  it('is refused outright if anyone tries to submit one as an edit', () => {
    const result = validateOperation(mark())
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('an annotation must never validate as an operation')
    expect(result.error.issues[0]?.code).toBe('OPERATION_KIND_UNKNOWN')
  })

  it('carries no capability, so nothing can authorise it to produce an edit', () => {
    const annotation = validateAnnotation(mark())
    expect(annotation.ok).toBe(true)
    if (!annotation.ok) return
    expect(Object.hasOwn(annotation.value, 'capabilityId')).toBe(false)
    expect(Object.hasOwn(annotation.value, 'kind')).toBe(false)
  })
})

describe('validateAnnotation', () => {
  it('accepts every shape with its own exact number of points', () => {
    for (const shape of ANNOTATION_SHAPES) {
      const result = validateAnnotation(mark({ shape, points: pointsFor(shape) }))
      expect(result.ok, shape).toBe(true)
    }
  })

  it('refuses a shape given the wrong number of points', () => {
    const result = validateAnnotation(mark({ shape: 'box', points: [{ x: 0.5, y: 0.5 }] }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'WRONG_POINT_COUNT')).toBe(true)
  })

  it('refuses a mark outside the picture rather than clamping it', () => {
    const result = validateAnnotation(mark({ points: [{ x: 1.4, y: 0.5 }] }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues[0]?.code).toBe('VALUE_OUT_OF_RANGE')
  })

  it('refuses an unknown shape instead of ignoring it', () => {
    const result = validateAnnotation(mark({ shape: 'lasso' as AnnotationShape }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'SHAPE_UNKNOWN')).toBe(true)
  })

  it('refuses an unknown key rather than dropping it', () => {
    const result = validateAnnotation({ ...(mark() as object), colour: 'red' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'FIELD_UNKNOWN')).toBe(true)
  })

  it('refuses a freehand stroke longer than the ceiling rather than thinning it', () => {
    const points = Array.from({ length: MAX_FREEHAND_POINTS + 1 }, (_value, index) => ({
      x: index / (MAX_FREEHAND_POINTS + 1),
      y: 0.5,
    }))
    const result = validateAnnotation(mark({ shape: 'freehand', points }))
    expect(result.ok).toBe(false)
  })

  it('refuses more marks on one request than the ceiling allows', () => {
    const many = Array.from({ length: MAX_ANNOTATIONS_PER_REQUEST + 1 }, (_value, index) =>
      mark({ annotationId: `annotation_${String(index).padStart(8, '0')}` }),
    )
    const result = validateAnnotations(many)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues[0]?.code).toBe('TOO_MANY_ANNOTATIONS')
  })

  it('refuses two marks sharing one id', () => {
    const result = validateAnnotations([mark(), mark()])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'DUPLICATE_ANNOTATION_ID')).toBe(true)
  })
})

describe('annotationBounds', () => {
  it('expands a circle to both sides of its centre, not just to the rim point', () => {
    // Drawn: centre at 0.5,0.5 with a rim point at 0.7,0.6. The circle the user
    // saw reaches 0.3 on the left too, so the bounds must be 0.3-0.7 wide.
    const annotation = validateAnnotation(
      mark({ shape: 'circle', points: [{ x: 0.5, y: 0.5 }, { x: 0.7, y: 0.6 }] }),
    )
    if (!annotation.ok) throw new Error('fixture must validate')
    const bounds = annotationBounds(annotation.value)
    expect(bounds.x).toBeCloseTo(0.3, 10)
    expect(bounds.width).toBeCloseTo(0.4, 10)
    expect(bounds.y).toBeCloseTo(0.4, 10)
    expect(bounds.height).toBeCloseTo(0.2, 10)
  })

  it('takes a box from its two corners in either order', () => {
    const annotation = validateAnnotation(
      mark({ shape: 'box', points: [{ x: 0.8, y: 0.9 }, { x: 0.2, y: 0.1 }] }),
    )
    if (!annotation.ok) throw new Error('fixture must validate')
    const bounds = annotationBounds(annotation.value)
    expect(bounds.x).toBeCloseTo(0.2, 10)
    expect(bounds.y).toBeCloseTo(0.1, 10)
    expect(bounds.width).toBeCloseTo(0.6, 10)
    expect(bounds.height).toBeCloseTo(0.8, 10)
  })
})

describe('describeAnnotation', () => {
  it('says where a point is in ordinary words', () => {
    const annotation = validateAnnotation(mark({ points: [{ x: 0.9, y: 0.1 }] }))
    if (!annotation.ok) throw new Error('fixture must validate')
    expect(describeAnnotation(annotation.value)).toBe('pointed at the top right of the picture')
  })

  it('keeps the direction of an arrow, because the direction is the meaning', () => {
    const annotation = validateAnnotation(
      mark({ shape: 'arrow', points: [{ x: 0.1, y: 0.9 }, { x: 0.9, y: 0.1 }] }),
    )
    if (!annotation.ok) throw new Error('fixture must validate')
    expect(describeAnnotation(annotation.value)).toBe(
      'drew an arrow from the bottom left of the picture to the top right of the picture',
    )
  })

  it('gives every shape a sentence, so none can silently produce nothing', () => {
    for (const shape of ANNOTATION_SHAPES) {
      const annotation = validateAnnotation(mark({ shape, points: pointsFor(shape) }))
      if (!annotation.ok) throw new Error(`fixture must validate: ${shape}`)
      expect(describeAnnotation(annotation.value).length, shape).toBeGreaterThan(0)
    }
  })
})
