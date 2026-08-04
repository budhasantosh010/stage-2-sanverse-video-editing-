import type { TimelineItemView, TimelineLaneKind } from '../timeline/timeline-contract'

import type { DerivedMediaClip } from './timeline-derived-media'

/**
 * Turning one row of the timeline into the plain question derived media asks.
 *
 * The timeline knows about clips, captions, callouts, nameplates and music. All
 * derived media wants to know is: which file, which bytes, which moment, how
 * long, and is this a picture or a sound. This is the one place that translates,
 * so nothing downstream has to know what a nameplate is.
 *
 * Returning `null` is a first-class answer meaning "this row is not made of
 * anything decodable" — a title is typed words, a gap is nothing at all — and it
 * is different from "we could not decode it", which is a refusal the user sees.
 */

/** The two facts about a file that the timeline itself does not carry. */
export type AssetFacts = Readonly<{
  assetVersion: string
  mediaKind: 'video' | 'image' | 'audio'
  hasAudio: boolean
}>

/**
 * Which rows draw a sound shape rather than pictures.
 *
 * The dialogue row is the SOUND OF THE FOOTAGE — the very same file as the
 * picture above it, at the very same moment. That is why it takes its moment
 * straight from the clip: cut the picture and the sound is cut with it, and a
 * waveform that took its moment from anywhere else would drift apart from the
 * picture it belongs to on the first trim.
 */
const SOUND_LANES: readonly TimelineLaneKind[] = Object.freeze(['dialogue', 'music'])

export const derivedMediaClipFor = (
  item: TimelineItemView,
  laneKind: TimelineLaneKind,
  assets: Readonly<Record<string, AssetFacts>>,
): DerivedMediaClip | null => {
  if (item.assetId === null) return null
  // A ghost of something the assistant has proposed is not yet part of the
  // video. Decoding for it would spend real work on an edit that may be
  // rejected a second later.
  if (item.state !== 'committed') return null
  if (item.durationTicks <= 0) return null

  const facts = assets[item.assetId]
  if (!facts || facts.assetVersion.length === 0) return null

  const drawSound = SOUND_LANES.includes(laneKind)
  if (drawSound) {
    if (facts.mediaKind === 'image' || !facts.hasAudio) return null
  } else if (laneKind === 'caption') {
    return null
  } else if (item.kind !== 'clip' && item.kind !== 'media-overlay') {
    // Titles, callouts and nameplates are typed words drawn by the exporter.
    // There is no file behind them to take a picture of.
    return null
  }

  return Object.freeze({
    itemId: item.id,
    assetId: item.assetId,
    assetVersion: facts.assetVersion,
    mediaKind: facts.mediaKind,
    startTicks: item.startTicks,
    durationTicks: item.durationTicks,
    // A picture has no moments, so its moment is always zero rather than
    // whatever number happened to be lying around.
    sourceStartTicks: facts.mediaKind === 'image' ? 0 : Math.max(0, item.sourceStartTicks ?? 0),
    drawSound,
  })
}
