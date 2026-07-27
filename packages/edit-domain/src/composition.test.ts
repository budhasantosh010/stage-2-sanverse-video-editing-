import { describe, expect, it } from 'vitest'

import {
  clipCompositionRange,
  clipTimeToComposition,
  clipTimeToSource,
  compositionDuration,
  compositionTimeToClip,
  createSingleClipComposition,
  findClip,
  validateComposition,
} from './composition'
import { TEST_CLIP_ID, TEST_COMPOSITION_ID, TEST_TRACK_ID, ms, testAsset } from './test-fixtures'

const asset = testAsset()

const composition = () => {
  const result = createSingleClipComposition({
    compositionId: TEST_COMPOSITION_ID,
    trackId: TEST_TRACK_ID,
    clipId: TEST_CLIP_ID,
    asset,
  })
  if (!result.ok) throw new Error(`setup failed: ${JSON.stringify(result.error)}`)
  return result.value
}

describe('the single-clip composition every video starts as', () => {
  it('covers the whole asset and takes its dimensions', () => {
    const value = composition()
    expect(value.width).toBe(1920)
    expect(value.height).toBe(1080)
    expect(compositionDuration(value)).toEqual(ms(30_000))
    const clip = findClip(value, TEST_CLIP_ID)
    expect(clip?.sourceRange).toEqual({ start: ms(0), duration: ms(30_000) })
  })

  it('occupies exactly the source duration, so no retiming can be expressed', () => {
    const clip = findClip(composition(), TEST_CLIP_ID)
    if (!clip) throw new Error('setup failed')
    expect(clipCompositionRange(clip).duration).toEqual(clip.sourceRange.duration)
  })
})

describe('moving between timelines', () => {
  it('maps clip time to composition time and back without loss', () => {
    const value = validateComposition(
      {
        compositionId: TEST_COMPOSITION_ID,
        width: 1920,
        height: 1080,
        tracks: [
          {
            trackId: TEST_TRACK_ID,
            kind: 'video',
            order: 0,
            clips: [
              {
                clipId: TEST_CLIP_ID,
                assetId: asset.assetId,
                // The second half of the source, placed at the start of the video.
                sourceRange: { start: ms(15_000), duration: ms(15_000) },
                compositionStart: ms(0),
                enabled: true,
                gainDb: 0,
                fadeIn: ms(0),
                fadeOut: ms(0),
              },
            ],
          },
        ],
      },
      [asset],
    )
    if (!value.ok) throw new Error(`setup failed: ${JSON.stringify(value.error)}`)
    const clip = findClip(value.value, TEST_CLIP_ID)
    if (!clip) throw new Error('setup failed')

    // 2 s into the clip is 2 s into the finished video, but 17 s into the file.
    expect(clipTimeToComposition(clip, ms(2_000))).toEqual(ms(2_000))
    expect(clipTimeToSource(clip, ms(2_000))).toEqual(ms(17_000))
    expect(compositionTimeToClip(clip, ms(2_000))).toEqual(ms(2_000))
  })
})

describe('composition validation', () => {
  it('refuses a clip that reaches past the end of its asset', () => {
    const result = validateComposition(
      {
        compositionId: TEST_COMPOSITION_ID,
        width: 1920,
        height: 1080,
        tracks: [
          {
            trackId: TEST_TRACK_ID,
            kind: 'video',
            order: 0,
            clips: [
              {
                clipId: TEST_CLIP_ID,
                assetId: asset.assetId,
                sourceRange: { start: ms(25_000), duration: ms(10_000) },
                compositionStart: ms(0),
                enabled: true,
                gainDb: 0,
                fadeIn: ms(0),
                fadeOut: ms(0),
              },
            ],
          },
        ],
      },
      [asset],
    )
    expect(result).toMatchObject({ ok: false })
    if (result.ok) return
    expect(result.error.issues.some((issue) => issue.code === 'SOURCE_RANGE_OUTSIDE_ASSET')).toBe(true)
  })

  it('refuses two clips overlapping on one track but allows them to touch', () => {
    const build = (secondStartMs: number) =>
      validateComposition(
        {
          compositionId: TEST_COMPOSITION_ID,
          width: 1920,
          height: 1080,
          tracks: [
            {
              trackId: TEST_TRACK_ID,
              kind: 'video',
              order: 0,
              clips: [
                {
                  clipId: 'clip_aaaaaaaa',
                  assetId: asset.assetId,
                  sourceRange: { start: ms(0), duration: ms(10_000) },
                  compositionStart: ms(0),
                  enabled: true,
                  gainDb: 0,
                  fadeIn: ms(0),
                  fadeOut: ms(0),
                },
                {
                  clipId: 'clip_bbbbbbbb',
                  assetId: asset.assetId,
                  sourceRange: { start: ms(10_000), duration: ms(10_000) },
                  compositionStart: ms(secondStartMs),
                  enabled: true,
                  gainDb: 0,
                  fadeIn: ms(0),
                  fadeOut: ms(0),
                },
              ],
            },
          ],
        },
        [asset],
      )

    expect(build(10_000)).toMatchObject({ ok: true })
    expect(build(9_999)).toMatchObject({ ok: false })
  })

  it('refuses a clip referencing an asset the project does not hold', () => {
    const result = validateComposition(
      {
        compositionId: TEST_COMPOSITION_ID,
        width: 1920,
        height: 1080,
        tracks: [
          {
            trackId: TEST_TRACK_ID,
            kind: 'video',
            order: 0,
            clips: [
              {
                clipId: TEST_CLIP_ID,
                assetId: 'asset_bbbbbbbb',
                sourceRange: { start: ms(0), duration: ms(1_000) },
                compositionStart: ms(0),
                enabled: true,
                gainDb: 0,
                fadeIn: ms(0),
                fadeOut: ms(0),
              },
            ],
          },
        ],
      },
      [asset],
    )
    expect(result).toMatchObject({ ok: false })
  })
})
