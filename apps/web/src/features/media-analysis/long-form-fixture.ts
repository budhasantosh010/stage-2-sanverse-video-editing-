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

/**
 * A stand-in checksum for one recording's bytes.
 *
 * Sixteen hexadecimal characters, exactly like a real `assetVersion`, so the
 * fixture exercises the same name shape the real thing does. Derived from the
 * index so it is stable across runs and DIFFERENT per recording — two
 * recordings that shared a version would hide a name collision.
 */
export const longFormAssetVersion = (index: number): string =>
  spread(index + 3, 0xffff_ffff).toString(16).padStart(8, '0').repeat(2).slice(0, 16)

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
      assetVersion: longFormAssetVersion(recording),
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
      assetVersion: longFormAssetVersion(100 + (index % 6)),
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
export const LONG_FORM_MISSING_ASSET_VERSION = '0000000000000000'

export const longFormWithMissingSource = (): readonly FilmstripClip[] => {
  const clips = [...longFormPrimaryClips()]
  clips[10] = Object.freeze({
    ...clips[10],
    assetId: LONG_FORM_MISSING_ASSET_ID,
    assetVersion: LONG_FORM_MISSING_ASSET_VERSION,
  })
  return Object.freeze(clips)
}

/**
 * The dialogue that came with the footage (lane A1).
 *
 * It is the SAME clips as the picture, because dialogue is not a separate
 * recording — it is the sound of the very same file. That is the fact the A1
 * waveform has to honour: cut the picture and the sound is cut with it, at the
 * same moment of the same file. A fixture that gave A1 its own independent
 * clips would let a wrong implementation pass.
 */
export const longFormDialogueClips = (): readonly FilmstripClip[] => longFormPrimaryClips()

/**
 * Music and extra sound the user laid on (lane A2), WITH GAPS.
 *
 * Gaps are deliberate: a bed of music under one section and silence under the
 * next is what a real episode looks like, and an implementation that assumed
 * the lane was continuous would draw a waveform across a stretch with no sound.
 */
export const LONG_FORM_MUSIC_ITEMS = 20
export const LONG_FORM_MUSIC_RECORDINGS = 3

export const longFormMusicClips = (): readonly FilmstripClip[] => {
  const total = longFormTotalTicks()
  const stride = Math.floor(total / LONG_FORM_MUSIC_ITEMS)
  const clips: FilmstripClip[] = []
  for (let index = 0; index < LONG_FORM_MUSIC_ITEMS; index += 1) {
    const song = index % LONG_FORM_MUSIC_RECORDINGS
    clips.push(Object.freeze({
      clipId: `music_long${String(index).padStart(6, '0')}`,
      assetId: `asset_song${String(song).padStart(2, '0')}`,
      assetVersion: longFormAssetVersion(200 + song),
      startTicks: index * stride,
      // Two thirds of the stride, so a third of every stretch is a real gap.
      durationTicks: Math.max(PROJECT_TIMESCALE, Math.floor((stride * 2) / 3)),
      // Varied trims: a bed that starts partway into the song, by a different
      // amount each time, so anything confusing song time with timeline time is
      // wrong by a different amount on every item.
      sourceStartTicks: spread(index + 21, 45 * PROJECT_TIMESCALE),
    }))
  }
  return Object.freeze(clips)
}

/** Pictures laid on top (lane V2). A picture has no moments, only a size. */
export const LONG_FORM_IMAGE_ITEMS = 12

export const longFormImageClips = (): readonly FilmstripClip[] => {
  const total = longFormTotalTicks()
  const clips: FilmstripClip[] = []
  for (let index = 0; index < LONG_FORM_IMAGE_ITEMS; index += 1) {
    clips.push(Object.freeze({
      clipId: `picture_long${String(index).padStart(6, '0')}`,
      assetId: `asset_picture${String(index % 4).padStart(2, '0')}`,
      assetVersion: longFormAssetVersion(300 + (index % 4)),
      startTicks: Math.floor(((index * 2 + 1) * total) / (LONG_FORM_IMAGE_ITEMS * 2)),
      durationTicks: 5 * PROJECT_TIMESCALE,
      sourceStartTicks: 0,
    }))
  }
  return Object.freeze(clips)
}

/**
 * A clip that has been cut in half, as two clips.
 *
 * The point of having this in the fixture is that BOTH halves must reuse the
 * frames the whole already had. A split that re-decoded would be invisible on a
 * thirty-second test and ruinous on an hour.
 */
export const longFormSplitAt = (
  clips: readonly FilmstripClip[],
  index: number,
): readonly FilmstripClip[] => {
  const target = clips[index]
  if (!target) return clips
  const leftDuration = Math.max(1, Math.floor(target.durationTicks / 2))
  const next = [...clips]
  next.splice(index, 1,
    Object.freeze({ ...target, clipId: `${target.clipId}a`, durationTicks: leftDuration }),
    Object.freeze({
      ...target,
      clipId: `${target.clipId}b`,
      startTicks: target.startTicks + leftDuration,
      durationTicks: target.durationTicks - leftDuration,
      sourceStartTicks: target.sourceStartTicks + leftDuration,
    }),
  )
  return Object.freeze(next)
}

/**
 * A clip that something was dropped on top of, leaving two fragments of the
 * original with a hole between them. Overwrite produces exactly this shape.
 */
export const longFormOverwriteFragmentAt = (
  clips: readonly FilmstripClip[],
  index: number,
): readonly FilmstripClip[] => {
  const target = clips[index]
  if (!target || target.durationTicks < 4 * PROJECT_TIMESCALE) return clips
  const holeStart = target.startTicks + PROJECT_TIMESCALE
  const holeEnd = holeStart + 2 * PROJECT_TIMESCALE
  const next = [...clips]
  next.splice(index, 1,
    Object.freeze({ ...target, clipId: `${target.clipId}L`, durationTicks: PROJECT_TIMESCALE }),
    Object.freeze({
      ...target,
      clipId: `${target.clipId}R`,
      startTicks: holeEnd,
      durationTicks: target.startTicks + target.durationTicks - holeEnd,
      sourceStartTicks: target.sourceStartTicks + (holeEnd - target.startTicks),
    }),
  )
  return Object.freeze(next)
}
