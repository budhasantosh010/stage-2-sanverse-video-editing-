import { describe, expect, it } from 'vitest'

import {
  VISUAL_FIT_MODES,
  isVisualFitMode,
  normalizationFilterSteps,
  normalizationObjectFit,
  normalizeVisual,
  visualNormalizationMessage,
  type VisualFitMode,
} from './visual-normalization.ts'

const geometry = (input: Parameters<typeof normalizeVisual>[0]) => {
  const result = normalizeVisual(input)
  if (!result.ok) throw new Error(`expected geometry, got refusal ${result.refusal}`)
  return result.value
}

/** What the finished frame measures once bars are added or overhang is cut. */
const finishedSize = (value: ReturnType<typeof geometry>) => ({
  width: value.scaledWidth + value.padLeft + value.padRight - value.cropLeft - value.cropRight,
  height: value.scaledHeight + value.padTop + value.padBottom - value.cropTop - value.cropBottom,
})

describe('fitting footage into the finished video', () => {
  it('leaves footage that is already the right size completely alone', () => {
    // This is the promise that existing projects are not disturbed. Every
    // project made before framing existed holds one recording and a canvas the
    // same size as it, so this is the case that must be an exact no-op.
    for (const fitMode of VISUAL_FIT_MODES) {
      const value = geometry({
        sourceWidth: 1920, sourceHeight: 1080, canvasWidth: 1920, canvasHeight: 1080, fitMode,
      })
      expect(value.scaledWidth).toBe(1920)
      expect(value.scaledHeight).toBe(1080)
      expect([value.padLeft, value.padTop, value.padRight, value.padBottom]).toEqual([0, 0, 0, 0])
      expect([value.cropLeft, value.cropTop, value.cropRight, value.cropBottom]).toEqual([0, 0, 0, 0])
    }
  })

  it('shows the whole of an upright phone clip in a widescreen project, with bars at the sides', () => {
    // The exact case in FAIL-051: a 714x1280 phone clip in a 1920x1080 project.
    // 1080/1280 is the smaller factor, so the height fills and the width does
    // not: 714 * (1080/1280) = 602.4, rounded down to an even 602.
    const value = geometry({
      sourceWidth: 714, sourceHeight: 1280, canvasWidth: 1920, canvasHeight: 1080, fitMode: 'fit',
    })
    expect(value.scaledHeight).toBe(1080)
    expect(value.scaledWidth).toBe(602)
    expect(value.padTop + value.padBottom).toBe(0)
    expect(value.padLeft + value.padRight).toBe(1920 - 602)
    expect(value.cropLeft + value.cropRight + value.cropTop + value.cropBottom).toBe(0)
    expect(finishedSize(value)).toEqual({ width: 1920, height: 1080 })
  })

  it('fills the screen with the same phone clip when asked, cutting the top and bottom off', () => {
    // 1920/714 is now the larger factor, so the width fills and the height
    // overflows: 1280 * (1920/714) = 3442.0, and everything above and below the
    // canvas is thrown away.
    const value = geometry({
      sourceWidth: 714, sourceHeight: 1280, canvasWidth: 1920, canvasHeight: 1080, fitMode: 'fill',
    })
    expect(value.scaledWidth).toBe(1920)
    expect(value.scaledHeight).toBeGreaterThan(1080)
    expect(value.cropTop + value.cropBottom).toBe(value.scaledHeight - 1080)
    expect(value.padLeft + value.padTop + value.padRight + value.padBottom).toBe(0)
    expect(finishedSize(value)).toEqual({ width: 1920, height: 1080 })
  })

  it('always produces exactly the canvas, whatever it is handed', () => {
    // This is the whole point. `concat` refuses unless every piece is identical,
    // so if any input can escape at a size other than the canvas, export breaks
    // again. Nothing here is allowed to.
    const sources: readonly (readonly [number, number])[] = [
      [1920, 1080], [714, 1280], [1080, 1080], [3840, 2160], [640, 480],
      [1280, 720], [1, 4000], [4000, 1], [1079, 1921], [720, 576],
    ]
    const canvases: readonly (readonly [number, number])[] = [
      [1920, 1080], [1080, 1920], [1080, 1080], [854, 480],
    ]
    for (const [sourceWidth, sourceHeight] of sources) {
      for (const [canvasWidth, canvasHeight] of canvases) {
        for (const fitMode of VISUAL_FIT_MODES) {
          const value = geometry({ sourceWidth, sourceHeight, canvasWidth, canvasHeight, fitMode })
          expect(finishedSize(value)).toEqual({ width: canvasWidth, height: canvasHeight })
        }
      }
    }
  })

  it('never squashes the picture out of shape', () => {
    // The rejected third option. Stretching to the canvas shape would make a
    // face wide and flat; the shape on screen must stay the shape that was
    // filmed, to within the one pixel that rounding to an even number costs.
    const cases: readonly (readonly [number, number])[] = [[714, 1280], [3840, 2160], [640, 480], [1080, 1080]]
    for (const [sourceWidth, sourceHeight] of cases) {
      for (const fitMode of VISUAL_FIT_MODES) {
        const value = geometry({ sourceWidth, sourceHeight, canvasWidth: 1920, canvasHeight: 1080, fitMode })
        const filmedShape = sourceWidth / sourceHeight
        const shownShape = value.scaledWidth / value.scaledHeight
        expect(Math.abs(shownShape - filmedShape)).toBeLessThan(0.01)
      }
    }
  })

  it('turns a sideways-filmed clip the right way up before measuring it', () => {
    // A phone filmed sideways stores an ordinary 1920x1080 picture plus a note
    // saying "turn this a quarter turn". Measuring it before obeying the note
    // would call it widescreen and fill the canvas, when what the viewer will
    // actually see is a tall 1080x1920 picture that needs bars at the sides.
    const withNote = geometry({
      sourceWidth: 1920, sourceHeight: 1080, sourceRotationDegrees: 90,
      canvasWidth: 1920, canvasHeight: 1080, fitMode: 'fit',
    })
    const alreadyUpright = geometry({
      sourceWidth: 1080, sourceHeight: 1920, canvasWidth: 1920, canvasHeight: 1080, fitMode: 'fit',
    })
    expect(withNote.scaledWidth).toBe(alreadyUpright.scaledWidth)
    expect(withNote.scaledHeight).toBe(alreadyUpright.scaledHeight)
    expect(withNote.scaledHeight).toBe(1080)
    expect(withNote.padLeft + withNote.padRight).toBeGreaterThan(0)
  })

  it('treats a half turn as no change of shape, because it is not one', () => {
    const upsideDown = geometry({
      sourceWidth: 1920, sourceHeight: 1080, sourceRotationDegrees: 180,
      canvasWidth: 1920, canvasHeight: 1080,
    })
    expect(upsideDown.scaledWidth).toBe(1920)
    expect(upsideDown.scaledHeight).toBe(1080)
  })

  it('corrects footage recorded with oblong pixels before framing it', () => {
    // Some camcorder and broadcast formats store a 1440-wide frame that is meant
    // to be shown 1920 wide, by declaring each pixel 4/3 as wide as it is tall.
    // Framing it on the stored 1440 would letterbox a picture that actually
    // fills the screen exactly.
    const oblong = geometry({
      sourceWidth: 1440, sourceHeight: 1080,
      sourceSampleAspectNumerator: 4, sourceSampleAspectDenominator: 3,
      canvasWidth: 1920, canvasHeight: 1080, fitMode: 'fit',
    })
    expect(oblong.scaledWidth).toBe(1920)
    expect(oblong.scaledHeight).toBe(1080)
    expect(oblong.padLeft + oblong.padRight).toBe(0)

    // and the same frame WITHOUT the note is genuinely narrower, so it gets bars
    const square = geometry({
      sourceWidth: 1440, sourceHeight: 1080, canvasWidth: 1920, canvasHeight: 1080, fitMode: 'fit',
    })
    expect(square.scaledWidth).toBe(1440)
    expect(square.padLeft + square.padRight).toBe(480)
  })

  it('only ever produces even numbers, because the colour format cannot store odd ones', () => {
    // yuv420p shares colour information between pairs of pixels, so it simply
    // cannot describe a picture an odd number of pixels wide. An odd number here
    // becomes an FFmpeg failure much later, with a message about nothing.
    const odds: readonly (readonly [number, number])[] = [[1079, 1921], [333, 777], [1, 1], [4001, 2999]]
    for (const [sourceWidth, sourceHeight] of odds) {
      for (const fitMode of VISUAL_FIT_MODES) {
        const value = geometry({ sourceWidth, sourceHeight, canvasWidth: 1920, canvasHeight: 1080, fitMode })
        expect(value.scaledWidth % 2).toBe(0)
        expect(value.scaledHeight % 2).toBe(0)
        expect(value.scaledWidth).toBeGreaterThanOrEqual(2)
        expect(value.scaledHeight).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('adds bars that add back up to the canvas exactly, with no missing pixel', () => {
    // An odd number of leftover pixels cannot be split evenly. The spare one
    // goes to the right and the bottom, always, so the two sides plus the
    // picture come to the canvas width to the pixel rather than to within one.
    const value = geometry({
      sourceWidth: 1000, sourceHeight: 1000, canvasWidth: 1921, canvasHeight: 1081, fitMode: 'fit',
    })
    expect(value.padLeft + value.scaledWidth + value.padRight).toBe(1921)
    expect(value.padTop + value.scaledHeight + value.padBottom).toBe(1081)
    expect(value.padRight - value.padLeft).toBeLessThanOrEqual(1)
  })

  it('defaults to showing the whole picture, never to cutting it', () => {
    // Choosing 'fill' by default would silently throw away the edges of footage
    // the user never agreed to lose.
    const value = geometry({ sourceWidth: 714, sourceHeight: 1280, canvasWidth: 1920, canvasHeight: 1080 })
    expect(value.fitMode).toBe('fit')
    expect(value.cropLeft + value.cropRight + value.cropTop + value.cropBottom).toBe(0)
  })

  it('offers exactly two answers, and stretching is not one of them', () => {
    expect(VISUAL_FIT_MODES).toEqual(['fit', 'fill'])
    expect(isVisualFitMode('stretch')).toBe(false)
    expect(isVisualFitMode('fit')).toBe(true)
    expect(isVisualFitMode('fill')).toBe(true)
    expect(isVisualFitMode(undefined)).toBe(false)
  })

  it('answers the same way every time, and changes nothing it was given', () => {
    const input = Object.freeze({
      sourceWidth: 714, sourceHeight: 1280, canvasWidth: 1920, canvasHeight: 1080, fitMode: 'fit' as VisualFitMode,
    })
    const first = geometry(input)
    const second = geometry(input)
    expect(second).toEqual(first)
    expect(Object.isFrozen(first)).toBe(true)
  })
})

describe('refusing to guess when the numbers are unusable', () => {
  const unusable: readonly (readonly [string, Parameters<typeof normalizeVisual>[0], string])[] = [
    ['a clip with no width', { sourceWidth: 0, sourceHeight: 1080, canvasWidth: 1920, canvasHeight: 1080 }, 'SOURCE_SIZE_UNUSABLE'],
    ['a clip with a negative height', { sourceWidth: 1920, sourceHeight: -4, canvasWidth: 1920, canvasHeight: 1080 }, 'SOURCE_SIZE_UNUSABLE'],
    ['a clip whose size is not a number', { sourceWidth: Number.NaN, sourceHeight: 1080, canvasWidth: 1920, canvasHeight: 1080 }, 'SOURCE_SIZE_UNUSABLE'],
    ['a project with no canvas', { sourceWidth: 1920, sourceHeight: 1080, canvasWidth: 0, canvasHeight: 1080 }, 'CANVAS_SIZE_UNUSABLE'],
    ['a canvas of one pixel', { sourceWidth: 1920, sourceHeight: 1080, canvasWidth: 1, canvasHeight: 1080 }, 'CANVAS_SIZE_UNUSABLE'],
    ['a pixel shape of zero', { sourceWidth: 1920, sourceHeight: 1080, sourceSampleAspectNumerator: 0, canvasWidth: 1920, canvasHeight: 1080 }, 'PIXEL_SHAPE_UNUSABLE'],
  ]

  for (const [name, input, refusal] of unusable) {
    it(`refuses ${name}, and says which piece of information was wrong`, () => {
      const result = normalizeVisual(input)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.refusal).toBe(refusal)
      expect(result.message.length).toBeGreaterThan(0)
    })
  }

  it('refuses a turn that is not a quarter, a half or three quarters', () => {
    const result = normalizeVisual({
      sourceWidth: 1920, sourceHeight: 1080,
      sourceRotationDegrees: 45 as unknown as 90,
      canvasWidth: 1920, canvasHeight: 1080,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.refusal).toBe('ROTATION_UNSUPPORTED')
  })

  it('explains the failure in words a person can act on, naming no code and no file', () => {
    // The message this replaces was "The local renderer could not produce a
    // verified MP4", which told the user nothing and sent them nowhere.
    for (const refusal of ['SOURCE_SIZE_UNUSABLE', 'CANVAS_SIZE_UNUSABLE', 'PIXEL_SHAPE_UNUSABLE', 'ROTATION_UNSUPPORTED'] as const) {
      const message = visualNormalizationMessage(refusal)
      expect(message).not.toMatch(/[A-Z]{2,}_[A-Z]/)
      expect(message).not.toMatch(/ffmpeg|scale=|setsar|yuv420p|\\|\//i)
      expect(message.length).toBeGreaterThan(20)
    }
  })
})

describe('the same rule written for FFmpeg', () => {
  it('always ends by declaring the size, the pixel shape and the colour storage', () => {
    // These three are exactly what `concat` compares. If any one of them is
    // missing the export fails on the second differently-sized clip.
    for (const fitMode of VISUAL_FIT_MODES) {
      const steps = normalizationFilterSteps({ canvasWidth: 1920, canvasHeight: 1080, fitMode })
      const joined = steps.join(',')
      expect(joined).toContain('1920')
      expect(joined).toContain('1080')
      expect(steps.at(-2)).toBe('setsar=1')
      expect(steps.at(-1)).toBe('format=pix_fmts=yuv420p')
    }
  })

  it('squares the pixels before it measures anything against the canvas', () => {
    const steps = normalizationFilterSteps({ canvasWidth: 1920, canvasHeight: 1080, fitMode: 'fit' })
    const squaringStep = steps.findIndex((step) => step.includes('iw*sar'))
    const canvasStep = steps.findIndex((step) => step.includes('force_original_aspect_ratio'))
    expect(squaringStep).toBeGreaterThanOrEqual(0)
    expect(canvasStep).toBeGreaterThan(squaringStep)
  })

  it('shrinks to fit and pads, or grows to cover and crops — and never stretches', () => {
    const fit = normalizationFilterSteps({ canvasWidth: 1920, canvasHeight: 1080, fitMode: 'fit' }).join(',')
    expect(fit).toContain('force_original_aspect_ratio=decrease')
    expect(fit).toContain('pad=')
    expect(fit).not.toContain('crop=')

    const fill = normalizationFilterSteps({ canvasWidth: 1920, canvasHeight: 1080, fitMode: 'fill' }).join(',')
    expect(fill).toContain('force_original_aspect_ratio=increase')
    expect(fill).toContain('crop=')
  })

  it('builds nothing a user could have typed into it', () => {
    // Everything in these steps comes from two numbers and a closed two-value
    // choice. There is no place for text a user supplied to reach FFmpeg's
    // filter parser, which is what makes this safe to write into a file.
    for (const fitMode of VISUAL_FIT_MODES) {
      const joined = normalizationFilterSteps({ canvasWidth: 1920, canvasHeight: 1080, fitMode }).join(',')
      expect(joined).toMatch(/^[a-zA-Z0-9_=:',()*\-+/.\[\]$ ]+$/)
      expect(joined).not.toContain(';')
      expect(joined).not.toContain('\n')
    }
  })

  it('names the browser its own word for exactly the same rule', () => {
    // The browser shows the video in a box the shape of the canvas. `contain`
    // shrinks the whole picture in and leaves the box showing through, which is
    // the black bars; `cover` grows it to fill and clips the overhang. Saying it
    // here rather than writing 'contain' somewhere in the browser code is what
    // stops the preview and the export drifting apart.
    expect(normalizationObjectFit('fit')).toBe('contain')
    expect(normalizationObjectFit('fill')).toBe('cover')
  })
})
