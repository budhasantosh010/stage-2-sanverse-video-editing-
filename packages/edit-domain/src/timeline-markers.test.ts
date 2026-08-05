import { describe, expect, it } from 'vitest'

import { TIMELINE_MARKERS_PRIMITIVE_ID, MUSIC_PRIMITIVE_ID } from './capabilities.ts'
import { validateOperation } from './operations.ts'
import {
  MARKER_COLORS,
  MAX_MARKERS,
  MAX_MARKER_LABEL_LENGTH,
  MAX_MARKER_NOTE_LENGTH,
  foldTimelineMarkerOperations,
  markerAfter,
  markerBefore,
  searchMarkers,
  sortMarkers,
  validateSetTimelineMarkersOperation,
  type SetTimelineMarkersOperation,
  type TimelineMarkerV1,
} from './timeline-markers.ts'
import {
  acceptChangeSet,
  activeTimelineMarkers,
  redoChangeSet,
  undoChangeSet,
  type EditProject,
} from './project.ts'
import { changeSetOf, testMultiAssetProject } from './test-fixtures.ts'

const marker = (overrides: Partial<TimelineMarkerV1> = {}): Record<string, unknown> => ({
  markerId: 'marker_aaaaaaaa',
  startTicks: 1_440_000,
  durationTicks: 0,
  label: 'Good take',
  note: '',
  color: 'neutral',
  ...overrides,
})

const setMarkers = (
  markers: readonly Record<string, unknown>[],
  operationId = 'operation_marker01',
): Record<string, unknown> => ({
  schemaVersion: 'sanverse.operation/v3',
  operationId,
  kind: 'set-timeline-markers',
  capabilityId: TIMELINE_MARKERS_PRIMITIVE_ID,
  markers,
  extensions: {},
})

const accept = (
  project: EditProject,
  changeSetId: string,
  operations: readonly unknown[],
): EditProject => {
  const result = acceptChangeSet(project, changeSetOf(changeSetId, project.revision, operations as never))
  if (!result.ok) throw new Error(`accept failed: ${JSON.stringify(result.error)}`)
  return result.value
}

const valueOf = (input: Record<string, unknown>): SetTimelineMarkersOperation => {
  const result = validateSetTimelineMarkersOperation(input)
  if (!result.ok) throw new Error(`expected valid: ${JSON.stringify(result.error)}`)
  return result.value
}

describe('T1.9 markers — the user\'s own notes', () => {
  it('accepts a point marker and a range marker as the same kind of thing', () => {
    const operation = valueOf(setMarkers([
      marker({ markerId: 'marker_point001', durationTicks: 0 }),
      marker({ markerId: 'marker_range001', startTicks: 2_880_000, durationTicks: 1_440_000 }),
    ]))
    expect(operation.markers).toHaveLength(2)
    expect(operation.markers[0].durationTicks).toBe(0)
    expect(operation.markers[1].durationTicks).toBe(1_440_000)
  })

  it('offers a closed list of colours and refuses anything else', () => {
    expect(MARKER_COLORS).toEqual(['neutral', 'red', 'amber', 'green', 'blue', 'violet'])
    for (const color of MARKER_COLORS) {
      expect(validateSetTimelineMarkersOperation(setMarkers([marker({ color })])).ok).toBe(true)
    }
    // A free-form colour could be made invisible against the timeline, and would
    // survive a theme change as the wrong colour.
    for (const bad of ['#ff0000', 'rgb(0,0,0)', 'RED', '', null, 7]) {
      const result = validateSetTimelineMarkersOperation(setMarkers([marker({ color: bad as never })]))
      expect(result.ok).toBe(false)
    }
  })

  it('refuses control characters rather than silently removing them', () => {
    // Stripping would store something different from what the user typed and
    // then show it back as though it were theirs.
    for (const code of [0, 7, 27, 127]) {
      const hidden = String.fromCharCode(code)
      const result = validateSetTimelineMarkersOperation(
        setMarkers([marker({ label: `take${hidden}one` })]),
      )
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.error.issues.some((issue) => issue.path.endsWith('.label'))).toBe(true)
    }
  })

  it('allows a newline in a note but not in a label', () => {
    expect(validateSetTimelineMarkersOperation(setMarkers([marker({ note: 'one\ntwo' })])).ok).toBe(true)
    // A label is one line on a timeline; a newline in it would be lost without
    // the user being told.
    expect(validateSetTimelineMarkersOperation(setMarkers([marker({ label: 'one\ntwo' })])).ok).toBe(false)
  })

  it('holds the user to the stated limits', () => {
    expect(validateSetTimelineMarkersOperation(
      setMarkers([marker({ label: 'a'.repeat(MAX_MARKER_LABEL_LENGTH) })]),
    ).ok).toBe(true)
    expect(validateSetTimelineMarkersOperation(
      setMarkers([marker({ label: 'a'.repeat(MAX_MARKER_LABEL_LENGTH + 1) })]),
    ).ok).toBe(false)
    expect(validateSetTimelineMarkersOperation(
      setMarkers([marker({ note: 'a'.repeat(MAX_MARKER_NOTE_LENGTH + 1) })]),
    ).ok).toBe(false)
    const many = Array.from({ length: MAX_MARKERS + 1 }, (_unused, index) =>
      marker({ markerId: `marker_${String(index).padStart(8, '0')}` }))
    expect(validateSetTimelineMarkersOperation(setMarkers(many)).ok).toBe(false)
  })

  it('refuses two markers sharing one identity, because delete would be ambiguous', () => {
    const result = validateSetTimelineMarkersOperation(setMarkers([
      marker({ markerId: 'marker_samesame' }),
      marker({ markerId: 'marker_samesame', startTicks: 99 }),
    ]))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'DUPLICATE_ID')).toBe(true)
  })

  it('refuses a negative moment and a negative length', () => {
    expect(validateSetTimelineMarkersOperation(setMarkers([marker({ startTicks: -1 })])).ok).toBe(false)
    expect(validateSetTimelineMarkersOperation(setMarkers([marker({ durationTicks: -1 })])).ok).toBe(false)
  })

  it('refuses fractional ticks, so a marker always lands on a whole tick', () => {
    expect(validateSetTimelineMarkersOperation(setMarkers([marker({ startTicks: 12.5 })])).ok).toBe(false)
  })

  it('refuses an unknown key rather than dropping it', () => {
    const result = validateSetTimelineMarkersOperation({ ...setMarkers([marker()]), colour: 'red' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'FIELD_UNKNOWN')).toBe(true)
  })

  it('refuses a capability that does not produce markers', () => {
    const result = validateSetTimelineMarkersOperation({
      ...setMarkers([marker()]),
      capabilityId: MUSIC_PRIMITIVE_ID,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'CAPABILITY_UNKNOWN')).toBe(true)
  })

  it('stores markers in one settled order however they arrive', () => {
    const operation = valueOf(setMarkers([
      marker({ markerId: 'marker_bbbbbbbb', startTicks: 5_000 }),
      marker({ markerId: 'marker_aaaaaaaa', startTicks: 5_000 }),
      marker({ markerId: 'marker_cccccccc', startTicks: 1_000 }),
    ]))
    // Same set in, same stored order out — which is what makes replaying a
    // project's history produce the same file every time.
    expect(operation.markers.map((each) => each.markerId)).toEqual([
      'marker_cccccccc', 'marker_aaaaaaaa', 'marker_bbbbbbbb',
    ])
  })

  it('is reachable through the general operation validator', () => {
    const result = validateOperation(setMarkers([marker()]))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.kind).toBe('set-timeline-markers')
  })
})

describe('T1.9 markers in a project', () => {
  it('gives every project that has never had a marker exactly none', () => {
    // Every project saved before markers existed. Nothing is rewritten.
    expect(activeTimelineMarkers(testMultiAssetProject())).toEqual([])
  })

  it('keeps the last complete set, so two changes cannot leave a state nobody chose', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_marker01', [setMarkers([marker({ markerId: 'marker_first001' })])])
    project = accept(project, 'changeset_marker02', [
      setMarkers([
        marker({ markerId: 'marker_first001' }),
        marker({ markerId: 'marker_second01', startTicks: 2_880_000 }),
      ], 'operation_marker02'),
    ])
    expect(activeTimelineMarkers(project).map((each) => each.markerId))
      .toEqual(['marker_first001', 'marker_second01'])
  })

  it('undoes back to the previous complete set, not to nothing', () => {
    let project = testMultiAssetProject()
    project = accept(project, 'changeset_marker01', [setMarkers([marker({ markerId: 'marker_first001' })])])
    project = accept(project, 'changeset_marker02', [
      setMarkers([
        marker({ markerId: 'marker_first001' }),
        marker({ markerId: 'marker_second01', startTicks: 2_880_000 }),
      ], 'operation_marker02'),
    ])
    const undone = undoChangeSet(project)
    if (!undone.ok) throw new Error('undo failed')
    expect(activeTimelineMarkers(undone.value).map((each) => each.markerId)).toEqual(['marker_first001'])
    const redone = redoChangeSet(undone.value)
    if (!redone.ok) throw new Error('redo failed')
    expect(activeTimelineMarkers(redone.value)).toHaveLength(2)
  })

  it('accepts a marker sitting past the end of the video instead of refusing the edit', () => {
    // The user trimmed the end off. Their note about it is now stale, which is
    // ordinary. Refusing here would make a good cut fail because of an old note.
    const project = accept(testMultiAssetProject(), 'changeset_marker01', [
      setMarkers([marker({ startTicks: 999_999_999 })]),
    ])
    expect(activeTimelineMarkers(project)).toHaveLength(1)
  })
})


describe('T1.9 moving between markers and finding them', () => {
  const markers: readonly TimelineMarkerV1[] = Object.freeze([
    Object.freeze({ markerId: 'marker_aaaaaaaa', startTicks: 1_000, durationTicks: 0, label: 'Intro', note: '', color: 'red' as const }),
    Object.freeze({ markerId: 'marker_bbbbbbbb', startTicks: 5_000, durationTicks: 0, label: 'Sponsor read', note: 'fix the audio', color: 'blue' as const }),
    Object.freeze({ markerId: 'marker_cccccccc', startTicks: 9_000, durationTicks: 100, label: 'Outro', note: '', color: 'neutral' as const }),
  ])

  it('finds the next marker strictly after the playhead', () => {
    expect(markerAfter(markers, 0)?.markerId).toBe('marker_aaaaaaaa')
    // Strictly after, so pressing "next" while standing on one keeps moving
    // instead of finding the marker under your feet again.
    expect(markerAfter(markers, 1_000)?.markerId).toBe('marker_bbbbbbbb')
    expect(markerAfter(markers, 9_000)).toBeNull()
  })

  it('finds the previous marker strictly before the playhead', () => {
    expect(markerBefore(markers, 9_000)?.markerId).toBe('marker_bbbbbbbb')
    expect(markerBefore(markers, 1_000)).toBeNull()
  })

  it('searches the label and the note, ignoring capitals', () => {
    expect(searchMarkers(markers, 'SPONSOR').map((each) => each.markerId)).toEqual(['marker_bbbbbbbb'])
    expect(searchMarkers(markers, 'audio').map((each) => each.markerId)).toEqual(['marker_bbbbbbbb'])
  })

  it('shows everything again when the search box is cleared', () => {
    // Clearing the box should bring the list back, not empty it.
    expect(searchMarkers(markers, '')).toHaveLength(3)
    expect(searchMarkers(markers, '   ')).toHaveLength(3)
  })

  it('sorts by moment, then by identity, so the order never wobbles', () => {
    const same = sortMarkers([
      { ...markers[1], markerId: 'marker_zzzzzzzz', startTicks: 1_000 },
      markers[0],
    ])
    expect(same.map((each) => each.markerId)).toEqual(['marker_aaaaaaaa', 'marker_zzzzzzzz'])
  })

  it('folds an empty history to no markers at all', () => {
    expect(foldTimelineMarkerOperations([])).toEqual([])
  })
})
