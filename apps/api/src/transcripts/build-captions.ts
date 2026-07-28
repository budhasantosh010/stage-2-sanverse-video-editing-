import {
  CAPTIONS_COMPONENT_ID,
  DEFAULT_CAPTION_STYLE_ID,
  DEFAULT_REPAIR,
  DEFAULT_SEGMENTATION,
  MAX_CAPTION_CUES,
  OPERATION_SCHEMA_VERSION,
  repairCueTimings,
  segmentTranscript,
  type CaptionCue,
  type CaptionStyleId,
  type ChangeSet,
  type CueAdjustment,
  type Transcript,
  type VideoAsset,
} from '@sanverse/edit-domain'

import { importTranscriptSidecar, type SidecarImportError } from './sidecar-import.ts'

/**
 * From a transcript file to one approved edit, in one place.
 *
 * The whole caption pipeline is here as a straight line so that every step is
 * visible and none of them is optional:
 *
 *   the file the user has
 *        │  importTranscriptSidecar   nothing is trusted; seconds become ticks
 *        ▼
 *   words with timings
 *        │  segmentTranscript         deterministic; where lines break
 *        ▼
 *   draft captions
 *        │  repairCueTimings          no overlap, nothing unreadably brief
 *        ▼
 *   final captions
 *        │  one add-captions operation
 *        ▼
 *   one change set  ──►  the ordinary accept route  ──►  the project
 *
 * The last arrow matters: captions go through exactly the same server-side
 * acceptance every other edit does. There is no privileged path that writes to
 * a project, which is what keeps "the server is the authority" true by
 * construction rather than by discipline.
 */

export type BuildCaptionsIssue =
  | SidecarImportError
  | { readonly code: 'NO_CAPTIONS_PRODUCED'; readonly message: string }
  | { readonly code: 'TOO_MANY_CAPTIONS'; readonly message: string }

export type BuildCaptionsReport = Readonly<{
  changeSet: ChangeSet
  transcript: Transcript
  cueCount: number
  /** Every timing the repair step had to change. Shown, never hidden. */
  adjustments: readonly CueAdjustment[]
  /** Segments of the file that could not be used, and why. */
  skipped: readonly { readonly index: number; readonly reason: string }[]
  worstResidualSeconds: number
}>

export type BuildCaptionsInput = Readonly<{
  contents: string
  asset: VideoAsset
  baseRevision: number
  styleId?: CaptionStyleId
  /** Injected so the same input always produces the same output in tests. */
  ids: Readonly<{ transcriptId: string; captionSetId: string; operationId: string; changeSetId: string }>
}>

const cueId = (index: number): string => `cue_${String(index + 1).padStart(4, '0')}`

export const buildCaptionsChangeSet = (
  input: BuildCaptionsInput,
):
  | { readonly ok: true; readonly value: BuildCaptionsReport }
  | { readonly ok: false; readonly error: BuildCaptionsIssue } => {
  const imported = importTranscriptSidecar({
    contents: input.contents,
    assetId: input.asset.assetId,
    transcriptId: input.ids.transcriptId,
  })
  if (!imported.ok) return imported

  const drafts = segmentTranscript(imported.value.transcript, DEFAULT_SEGMENTATION)
  const repaired = repairCueTimings(drafts, {
    ...DEFAULT_REPAIR,
    // Captions are anchored to the footage, so the limit is the footage's own
    // length — not the finished video's, which has not been decided yet and
    // will change with every later cut.
    sourceDurationTicks: input.asset.duration.ticks,
  })

  if (repaired.cues.length === 0) {
    return {
      ok: false,
      error: {
        code: 'NO_CAPTIONS_PRODUCED',
        message: 'No readable captions could be made from that transcript.',
      },
    }
  }
  if (repaired.cues.length > MAX_CAPTION_CUES) {
    return {
      ok: false,
      error: {
        code: 'TOO_MANY_CAPTIONS',
        message: 'That transcript produces more captions than one video can hold.',
      },
    }
  }

  const cues: CaptionCue[] = repaired.cues.map((cue, index) => Object.freeze({
    cueId: cueId(index),
    sourceInterval: cue.sourceInterval,
    lines: cue.lines,
  }))

  const changeSet: ChangeSet = Object.freeze({
    schemaVersion: 'sanverse.change-set/v1',
    changeSetId: input.ids.changeSetId,
    baseRevision: input.baseRevision,
    operations: Object.freeze([Object.freeze({
      schemaVersion: OPERATION_SCHEMA_VERSION,
      operationId: input.ids.operationId,
      kind: 'add-captions' as const,
      capabilityId: CAPTIONS_COMPONENT_ID,
      captionSetId: input.ids.captionSetId,
      assetId: input.asset.assetId,
      styleId: input.styleId ?? DEFAULT_CAPTION_STYLE_ID,
      cues: Object.freeze(cues),
    })]),
    // Captions come from a file the user chose, not from a model, so the
    // provenance is direct. Recording it as `ai` would be a lie the history
    // would then show to the user.
    provenance: Object.freeze({ source: 'direct' as const, requestId: null }),
    extensions: Object.freeze({}),
  })

  return {
    ok: true,
    value: {
      changeSet,
      transcript: imported.value.transcript,
      cueCount: cues.length,
      adjustments: repaired.adjustments,
      skipped: imported.value.skipped,
      worstResidualSeconds: imported.value.worstResidualSeconds,
    },
  }
}
