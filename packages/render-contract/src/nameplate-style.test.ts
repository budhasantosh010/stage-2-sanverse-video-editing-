import { describe, expect, it } from 'vitest'

import {
  NAMEPLATE_STYLE_V1,
  anchorFraction,
  ffmpegPlacementExpression,
  resolveNameplateMetrics,
  resolveNameplatePlacement,
  toCssColor,
  toFfmpegColor,
} from './nameplate-style'

/**
 * Evaluate an FFmpeg placement expression numerically.
 *
 * This is what makes the parity claim real rather than aspirational: the exact
 * string handed to FFmpeg is computed here with the same measured text box the
 * browser would use, and compared against the browser's own placement result.
 */
const evaluateFfmpegExpression = (expression: string, textWidth: number, textHeight: number): number => {
  const javascript = expression
    .replace(/\\,/g, ',')
    .replace(/\bif\(/g, 'IF(')
    .replace(/\btext_w\b/g, String(textWidth))
    .replace(/\btext_h\b/g, String(textHeight))
  const evaluate = new Function(
    'IF',
    'lt',
    'max',
    'min',
    `return (${javascript})`,
  ) as (
    IF: (condition: number, a: number, b: number) => number,
    lt: (a: number, b: number) => number,
    max: (a: number, b: number) => number,
    min: (a: number, b: number) => number,
  ) => number
  return evaluate(
    (condition, a, b) => (condition ? a : b),
    (a, b) => (a < b ? 1 : 0),
    Math.max,
    Math.min,
  )
}

const placeBothWays = (input: {
  pointX: number
  pointY: number
  anchor: string
  frameWidth: number
  frameHeight: number
  boxWidth: number
  boxHeight: number
}) => {
  const metrics = resolveNameplateMetrics(input.frameWidth, input.frameHeight)
  const fraction = anchorFraction(input.anchor)
  const browser = resolveNameplatePlacement({ ...input, safeMargin: metrics.safeMargin })
  const ffmpeg = {
    x: evaluateFfmpegExpression(
      ffmpegPlacementExpression({
        axis: 'x',
        point: input.pointX,
        anchorFraction: fraction.x,
        frameSize: input.frameWidth,
        safeMargin: metrics.safeMargin,
      }),
      input.boxWidth,
      input.boxHeight,
    ),
    y: evaluateFfmpegExpression(
      ffmpegPlacementExpression({
        axis: 'y',
        point: input.pointY,
        anchorFraction: fraction.y,
        frameSize: input.frameHeight,
        safeMargin: metrics.safeMargin,
      }),
      input.boxWidth,
      input.boxHeight,
    ),
  }
  return { browser, ffmpeg }
}

describe('preview and export agree on placement', () => {
  const cases = [
    { name: 'centre of the frame', pointX: 0.5, pointY: 0.5, anchor: 'center' },
    { name: 'top-left corner of the frame', pointX: 0, pointY: 0, anchor: 'center' },
    { name: 'bottom-right corner of the frame', pointX: 1, pointY: 1, anchor: 'center' },
    { name: 'legacy top-left anchoring', pointX: 0.25, pointY: 0.75, anchor: 'top-left' },
    { name: 'bottom-centre lower third', pointX: 0.5, pointY: 0.85, anchor: 'bottom-center' },
    { name: 'awkward fractional point', pointX: 0.137, pointY: 0.911, anchor: 'center' },
  ]

  for (const testCase of cases) {
    it(`matches at the ${testCase.name}`, () => {
      const { browser, ffmpeg } = placeBothWays({
        ...testCase,
        frameWidth: 1920,
        frameHeight: 1080,
        boxWidth: 420,
        boxHeight: 96,
      })
      // FFmpeg truncates to whole pixels; the shared rule already rounds.
      expect(Math.round(ffmpeg.x)).toBe(browser.x)
      expect(Math.round(ffmpeg.y)).toBe(browser.y)
    })
  }

  it('matches for portrait and square compositions too', () => {
    for (const [frameWidth, frameHeight] of [[1080, 1920], [1080, 1080], [3840, 2160]]) {
      const { browser, ffmpeg } = placeBothWays({
        pointX: 0.4,
        pointY: 0.6,
        anchor: 'center',
        frameWidth,
        frameHeight,
        boxWidth: 300,
        boxHeight: 80,
      })
      expect(Math.round(ffmpeg.x)).toBe(browser.x)
      expect(Math.round(ffmpeg.y)).toBe(browser.y)
    }
  })

  it('agrees even when the box is wider than the safe area', () => {
    const { browser, ffmpeg } = placeBothWays({
      pointX: 0,
      pointY: 0.5,
      anchor: 'center',
      frameWidth: 640,
      frameHeight: 360,
      boxWidth: 900,
      boxHeight: 60,
    })
    expect(Math.round(ffmpeg.x)).toBe(browser.x)
    expect(Math.round(ffmpeg.y)).toBe(browser.y)
  })

  it('never places the box outside the safe area when it fits', () => {
    const metrics = resolveNameplateMetrics(1920, 1080)
    for (const pointX of [0, 0.25, 0.5, 0.75, 1]) {
      const placement = resolveNameplatePlacement({
        pointX,
        pointY: 0.5,
        anchor: 'center',
        frameWidth: 1920,
        frameHeight: 1080,
        boxWidth: 420,
        boxHeight: 96,
        safeMargin: metrics.safeMargin,
      })
      expect(placement.x).toBeGreaterThanOrEqual(metrics.safeMargin)
      expect(placement.x + 420).toBeLessThanOrEqual(1920 - metrics.safeMargin)
    }
  })
})

describe('nameplate metrics', () => {
  it('scales with the video, not with the browser window', () => {
    // The v1 preview used `2vw`, so the same video previewed differently in a
    // full-screen window and a narrow one, while the export never changed.
    const hd = resolveNameplateMetrics(1920, 1080)
    const uhd = resolveNameplateMetrics(3840, 2160)
    expect(uhd.primaryFontSize).toBe(hd.primaryFontSize * 2)
    expect(uhd.padding).toBe(hd.padding * 2)
  })

  it('uses the shortest edge, so portrait and landscape look the same', () => {
    expect(resolveNameplateMetrics(1920, 1080)).toEqual(resolveNameplateMetrics(1080, 1920))
  })

  it('never collapses to an unreadable size on tiny videos', () => {
    const tiny = resolveNameplateMetrics(160, 90)
    expect(tiny.primaryFontSize).toBeGreaterThanOrEqual(NAMEPLATE_STYLE_V1.minPrimaryFontSize)
    expect(tiny.padding).toBeGreaterThanOrEqual(NAMEPLATE_STYLE_V1.minPadding)
  })

  it('produces whole pixels only', () => {
    const metrics = resolveNameplateMetrics(1337, 777)
    for (const value of Object.values(metrics)) {
      expect(Number.isInteger(value)).toBe(true)
    }
  })
})

describe('colours are written once and translated per renderer', () => {
  it('expresses the same colour in both dialects', () => {
    expect(toFfmpegColor(NAMEPLATE_STYLE_V1.backgroundColor, NAMEPLATE_STYLE_V1.backgroundOpacity)).toBe('0x000000@0.82')
    expect(toCssColor(NAMEPLATE_STYLE_V1.backgroundColor, NAMEPLATE_STYLE_V1.backgroundOpacity)).toBe('rgba(0, 0, 0, 0.82)')
    expect(toCssColor(NAMEPLATE_STYLE_V1.secondaryColor, NAMEPLATE_STYLE_V1.secondaryOpacity)).toBe('rgba(255, 255, 255, 0.78)')
  })
})
