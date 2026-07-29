import {
  effectiveComposition,
  findClip,
  placeSourceSpan,
  type EditOperation,
  type EditProject,
  type TimeRange,
} from '@sanverse/edit-domain'

import { describeOperation } from '../../features/history/describe-operation'

export type OperationPresentation = Readonly<{
  label: string
  detail: string | null
  interval: {
    startTicks: number
    durationTicks: number
  } | null
}>

function sourceInterval(
  project: EditProject,
  assetId: string,
  range: TimeRange,
): OperationPresentation['interval'] {
  const placements = placeSourceSpan(effectiveComposition(project), assetId, range)
  if (placements.length === 0) return null
  const startTicks = placements[0].compositionRange.start.ticks
  const endTicks = Math.max(
    ...placements.map(
      (placement) =>
        placement.compositionRange.start.ticks + placement.compositionRange.duration.ticks,
    ),
  )
  return Object.freeze({ startTicks, durationTicks: Math.max(0, endTicks - startTicks) })
}

function clipInterval(
  project: EditProject,
  clipId: string,
): OperationPresentation['interval'] {
  const clip = findClip(effectiveComposition(project), clipId)
  return clip
    ? Object.freeze({
        startTicks: clip.compositionStart.ticks,
        durationTicks: clip.sourceRange.duration.ticks,
      })
    : null
}

export function presentOperation(
  project: EditProject,
  operation: EditOperation,
): OperationPresentation {
  let interval: OperationPresentation['interval'] = null

  switch (operation.kind) {
    case 'add-nameplate':
    case 'add-title':
    case 'set-title':
    case 'add-callout':
    case 'set-callout':
    case 'add-media-overlay':
    case 'set-media-overlay':
      interval = sourceInterval(project, operation.assetId, operation.sourceInterval)
      break
    case 'add-captions': {
      const ranges = operation.cues
        .map((cue) => sourceInterval(project, operation.assetId, cue.sourceInterval))
        .filter((value): value is NonNullable<typeof value> => value !== null)
      if (ranges.length > 0) {
        const startTicks = Math.min(...ranges.map((range) => range.startTicks))
        const endTicks = Math.max(
          ...ranges.map((range) => range.startTicks + range.durationTicks),
        )
        interval = Object.freeze({ startTicks, durationTicks: endTicks - startTicks })
      }
      break
    }
    case 'split-clip': {
      const clip = findClip(effectiveComposition(project), operation.clipId)
      if (clip) {
        interval = Object.freeze({
          startTicks:
            clip.compositionStart.ticks +
            Math.min(operation.atClipTime.ticks, clip.sourceRange.duration.ticks),
          durationTicks: 0,
        })
      }
      break
    }
    case 'trim-clip':
    case 'remove-clip':
    case 'reorder-clip':
    case 'set-clip-enabled':
    case 'set-clip-audio':
    case 'set-clip-transition':
      interval = clipInterval(project, operation.clipId)
      break
    case 'add-music':
    case 'set-music':
      interval = Object.freeze({
        startTicks: operation.compositionStart.ticks,
        durationTicks: 0,
      })
      break
    case 'set-caption-cue':
    case 'remove-caption-cue':
    case 'set-caption-style':
    case 'set-visual-properties':
      // These operations do not carry enough canonical composition timing on
      // their own. Assist keeps them visible but never invents a seek target.
      break
    default: {
      const unknown = operation as EditOperation
      return Object.freeze({
        label: describeOperation(unknown),
        detail: null,
        interval: null,
      })
    }
  }

  return Object.freeze({
    label: describeOperation(operation),
    detail: null,
    interval,
  })
}
