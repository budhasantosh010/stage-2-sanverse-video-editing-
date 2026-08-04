import { PROJECT_TIMESCALE } from '@sanverse/edit-domain'

import type { FilmstripClip } from './filmstrip-plan'

/**
 * A sixty-minute project, as a shape rather than as a file.
 *
 * ## Why a fixture this big exists
 *
 * Everything in an editor works on a thirty-second test video. The failures
 * that matter — the tab running out of memory, the timeline stuttering, the
 * scroll that decodes ten thousand thumbnails — only appear on the long
 * projects a user has already put hours into. Those are the worst possible
 * moment to find out.
 *
 * So the bounds are asserted against something the size of a real talking-head
 * episode:
 *
 * ```
 *   60 minutes of finished video
 *   250 pieces of main footage       averaging ~14 s each
 *    12 recordings, used repeatedly  because a real edit revisits shots
 *   100 things laid on top
 *   500 captions
 * ```
 *
 * It is built rather than recorded because the numbers are what is being
 * tested, not the pixels. Nothing here decodes anything.
 */
export const LONG_FORM_DURATION_TICKS = 60 * 60 * PROJECT_TIMESCALE
export const LONG_FORM_PRIMARY_CLIPS = 250
export const LONG_FORM_OVERLAY_ITEMS = 100
export const LONG_FORM_CAPTIONS = 500
/** Repeated on purpose: a real edit comes back to the same shots. */
export const LONG_FORM_RECORDINGS = 12

/** Deterministic: the same fixture every run, so a bound that moves is a real change. */
const spread = (index: number, modulus: number): number => (index * 2_654_435_761) % modulus

export const longFormPrimaryClips = (): readonly FilmstripClip[] => {
  const clips: FilmstripClip[] = []
  const averageTicks = Math.floor(LONG_FORM_DURATION_TICKS / LONG_FORM_PRIMARY_CLIPS)
  let cursor = 0
  for (let index = 0; index < LONG_FORM_PRIMARY_CLIPS; index += 1) {
    // Lengths vary from about 7 s to about 21 s, which is what a real cut looks
    // like. A fixture of identical clips would hide anything that depends on
    // one clip being longer than a window.
    const duration = Math.max(
      PROJECT_TIMESCALE,
      averageTicks - Math.floor(averageTicks / 2) + spread(index + 1, averageTicks),
    )
    const recording = index % LONG_FORM_RECORDINGS
    clips.push(Object.freeze({
      clipId: `clip_long${String(index).padStart(6, '0')}`,
      assetId: `asset_recording${String(recording).padStart(2, '0')}`,
      startTicks: cursor,
      durationTicks: duration,
      // Trimmed heads, so any filmstrip that confuses timeline time with
      // recording time is wrong here by a different amount on every clip.
      sourceStartTicks: spread(index + 7, 30 * PROJECT_TIMESCALE),
    }))
    cursor += duration
  }
  return Object.freeze(clips)
}

export const longFormOverlayClips = (): readonly FilmstripClip[] => {
  const total = longFormTotalTicks()
  const clips: FilmstripClip[] = []
  for (let index = 0; index < LONG_FORM_OVERLAY_ITEMS; index += 1) {
    const start = Math.floor((index * total) / LONG_FORM_OVERLAY_ITEMS)
    clips.push(Object.freeze({
      clipId: `broll_long${String(index).padStart(6, '0')}`,
      assetId: `asset_broll${String(index % 6).padStart(2, '0')}`,
      startTicks: start,
      durationTicks: 4 * PROJECT_TIMESCALE,
      sourceStartTicks: spread(index + 13, 10 * PROJECT_TIMESCALE),
    }))
  }
  return Object.freeze(clips)
}

export const longFormTotalTicks = (): number => {
  const clips = longFormPrimaryClips()
  const last = clips[clips.length - 1]
  return last.startTicks + last.durationTicks
}

/** A recording the project names but whose file has gone. Must never crash anything. */
export const LONG_FORM_MISSING_ASSET_ID = 'asset_recordinggone'

export const longFormWithMissingSource = (): readonly FilmstripClip[] => {
  const clips = [...longFormPrimaryClips()]
  clips[10] = Object.freeze({ ...clips[10], assetId: LONG_FORM_MISSING_ASSET_ID })
  return Object.freeze(clips)
}
