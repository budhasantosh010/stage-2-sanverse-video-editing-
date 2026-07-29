import {
  PROJECT_TIMESCALE,
  activeCaptionSets,
  activeOverlayOperations,
  compositionDuration,
  effectiveComposition,
  type EditProject,
} from '@sanverse/edit-domain'

export type OpenCutTimelineSpikeItemKind = 'title' | 'video' | 'caption' | 'music'

export type OpenCutTimelineSpikeItem = Readonly<{
  itemId: string
  kind: OpenCutTimelineSpikeItemKind
  label: string
  startTicks: number
  durationTicks: number
}>

export type OpenCutTimelineSpikeViewModel = Readonly<{
  sourceProjectId: string
  sourceRevision: number
  timescale: number
  durationTicks: number
  items: readonly OpenCutTimelineSpikeItem[]
}>

const laneOrder: Readonly<Record<OpenCutTimelineSpikeItemKind, number>> = Object.freeze({
  title: 0,
  video: 1,
  caption: 2,
  music: 3,
})

/**
 * A one-way projection. Nothing returned here can be persisted or replayed as
 * a project; every identifier and time comes from the authoritative Sanverse
 * EditProject.
 */
export const createOpenCutTimelineSpikeViewModel = (
  project: EditProject,
): OpenCutTimelineSpikeViewModel => {
  const composition = effectiveComposition(project)
  const durationTicks = compositionDuration(composition).ticks
  const items: OpenCutTimelineSpikeItem[] = []

  for (const operation of activeOverlayOperations(project)) {
    if (operation.kind === 'add-title') {
      items.push(Object.freeze({
        itemId: operation.titleId,
        kind: 'title',
        label: operation.headline,
        startTicks: operation.sourceInterval.start.ticks,
        durationTicks: operation.sourceInterval.duration.ticks,
      }))
    } else if (operation.kind === 'add-music') {
      items.push(Object.freeze({
        itemId: operation.musicId,
        kind: 'music',
        label: 'Music',
        startTicks: operation.compositionStart.ticks,
        durationTicks: Math.max(0, durationTicks - operation.compositionStart.ticks),
      }))
    }
  }

  for (const track of composition.tracks) {
    for (const clip of track.clips) {
      items.push(Object.freeze({
        itemId: clip.clipId,
        kind: 'video',
        label: 'Primary video',
        startTicks: clip.compositionStart.ticks,
        durationTicks: clip.sourceRange.duration.ticks,
      }))
    }
  }

  for (const captions of activeCaptionSets(project)) {
    const first = captions.cues.at(0)
    const last = captions.cues.at(-1)
    if (!first || !last) continue
    const startTicks = first.sourceInterval.start.ticks
    const endTicks = last.sourceInterval.start.ticks + last.sourceInterval.duration.ticks
    items.push(Object.freeze({
      itemId: captions.captionSetId,
      kind: 'caption',
      label: 'Captions',
      startTicks,
      durationTicks: Math.max(0, endTicks - startTicks),
    }))
  }

  items.sort((left, right) =>
    laneOrder[left.kind] - laneOrder[right.kind] || left.startTicks - right.startTicks,
  )

  return Object.freeze({
    sourceProjectId: project.projectId,
    sourceRevision: project.revision,
    timescale: PROJECT_TIMESCALE,
    durationTicks,
    items: Object.freeze(items),
  })
}
