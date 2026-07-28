import { describe, expect, it } from 'vitest'

import {
  annotationPointToClient,
  captureAnnotationPoints,
  type ClientPoint,
} from './annotation-capture.ts'
import type { ElementBox } from '../point-target/point-target.ts'

/**
 * G5C-02B — the proof that a mark stays on the same object no matter how the
 * video happens to be displayed.
 *
 * Each case below shows the same video in a differently-shaped box. The mark is
 * always stored as a fraction of the PICTURE, so every case must produce the
 * same stored number even though the pixel the finger touched is different
 * every time.
 */

const LANDSCAPE = { width: 1920, height: 1080 }
const PORTRAIT = { width: 1080, height: 1920 }
const SQUARE = { width: 1000, height: 1000 }

type Display = Readonly<{ name: string; box: ElementBox; video: { width: number; height: number } }>

/** Where the picture actually sits inside each of these boxes, worked out by hand. */
const DISPLAYS: readonly Display[] = [
  {
    // Video and box have the same shape: the picture fills the box exactly.
    name: 'landscape video, exactly-fitting box',
    box: { left: 0, top: 0, width: 960, height: 540 },
    video: LANDSCAPE,
  },
  {
    // Box is WIDER than 16:9, so black bars appear down the left and right.
    // Picture height 540, picture width 540 * 16/9 = 960, bars (1200-960)/2 = 120.
    name: 'landscape video, wide box (bars at the sides)',
    box: { left: 0, top: 0, width: 1200, height: 540 },
    video: LANDSCAPE,
  },
  {
    // Box is TALLER than 16:9, so black bars appear above and below.
    // Picture width 960, picture height 960 * 9/16 = 540, bars (900-540)/2 = 180.
    name: 'landscape video, tall box (bars above and below)',
    box: { left: 0, top: 0, width: 960, height: 900 },
    video: LANDSCAPE,
  },
  {
    // A phone recording shown on a laptop: tall picture, wide box, big side bars.
    name: 'portrait video in a landscape box',
    box: { left: 0, top: 0, width: 1600, height: 900 },
    video: PORTRAIT,
  },
  {
    name: 'landscape video in a portrait box',
    box: { left: 0, top: 0, width: 800, height: 1400 },
    video: LANDSCAPE,
  },
  {
    // The page has scrolled and the panel is offset, so left/top are not zero.
    name: 'offset element, not at the page origin',
    box: { left: 137, top: 42, width: 960, height: 540 },
    video: LANDSCAPE,
  },
  {
    // Half the size of the first case. Resizing must change nothing stored.
    name: 'resized smaller',
    box: { left: 0, top: 0, width: 480, height: 270 },
    video: LANDSCAPE,
  },
  {
    // Fullscreen on a 4K display, with bars because the screen is 16:10.
    name: 'fullscreen on a 16:10 screen',
    box: { left: 0, top: 0, width: 3840, height: 2400 },
    video: LANDSCAPE,
  },
  {
    name: 'square video in a wide box',
    box: { left: 0, top: 0, width: 1600, height: 800 },
    video: SQUARE,
  },
]

/** Turn a fraction of the picture into the screen pixel it would be shown at. */
const pixelFor = (display: Display, x: number, y: number): ClientPoint => {
  const client = annotationPointToClient({ x, y }, display.box, display.video.width, display.video.height)
  if (!client) throw new Error('the content box must be computable for every fixture')
  return client
}

describe('a mark means the same thing at every display size and shape', () => {
  // The value being proved: pick three real spots on the picture, show the video
  // nine different ways, tap the pixel each spot appears at, and get the same
  // three stored numbers every single time.
  const SPOTS = [
    { name: 'dead centre', x: 0.5, y: 0.5 },
    { name: 'a face in the upper left', x: 0.23, y: 0.31 },
    { name: 'a logo in the lower right', x: 0.88, y: 0.94 },
  ]

  for (const spot of SPOTS) {
    it(`stores ${spot.name} identically across all ${DISPLAYS.length} displays`, () => {
      for (const display of DISPLAYS) {
        const pixel = pixelFor(display, spot.x, spot.y)
        const captured = captureAnnotationPoints({
          clientPoints: [pixel],
          elementBox: display.box,
          videoWidth: display.video.width,
          videoHeight: display.video.height,
          currentTimeSeconds: 8,
        })
        expect(captured.ok, display.name).toBe(true)
        if (!captured.ok) return
        expect(captured.value.points[0].x, `${display.name} x`).toBeCloseTo(spot.x, 9)
        expect(captured.value.points[0].y, `${display.name} y`).toBeCloseTo(spot.y, 9)
      }
    })
  }

  it('keeps a whole freehand stroke in order and in place across displays', () => {
    const stroke = [
      { x: 0.1, y: 0.2 },
      { x: 0.3, y: 0.35 },
      { x: 0.5, y: 0.5 },
      { x: 0.72, y: 0.68 },
    ]
    for (const display of DISPLAYS) {
      const captured = captureAnnotationPoints({
        clientPoints: stroke.map((point) => pixelFor(display, point.x, point.y)),
        elementBox: display.box,
        videoWidth: display.video.width,
        videoHeight: display.video.height,
        currentTimeSeconds: 1,
      })
      expect(captured.ok, display.name).toBe(true)
      if (!captured.ok) return
      expect(captured.value.points.length).toBe(stroke.length)
      captured.value.points.forEach((point, index) => {
        expect(point.x, `${display.name}[${index}].x`).toBeCloseTo(stroke[index].x, 9)
        expect(point.y, `${display.name}[${index}].y`).toBeCloseTo(stroke[index].y, 9)
      })
    }
  })
})

describe('the black bars are the thing that would have broken it', () => {
  // Without subtracting the bars, the mark would be stored in the wrong place.
  // This test measures HOW wrong, so nobody can later "simplify" the correction
  // away on the belief that it makes no difference.
  it('naive element-relative maths lands somewhere else entirely', () => {
    const display = DISPLAYS[3] // portrait video in a landscape box
    const pixel = pixelFor(display, 0.5, 0.5)

    const naiveX = (pixel.clientX - display.box.left) / display.box.width
    const captured = captureAnnotationPoints({
      clientPoints: [pixel],
      elementBox: display.box,
      videoWidth: display.video.width,
      videoHeight: display.video.height,
      currentTimeSeconds: 0,
    })
    if (!captured.ok) throw new Error('capture must succeed')

    expect(captured.value.points[0].x).toBeCloseTo(0.5, 9)
    expect(naiveX).toBeCloseTo(0.5, 9)

    // The middle happens to agree. Anywhere else does not:
    const offCentre = pixelFor(display, 0.9, 0.5)
    const naiveOffCentre = (offCentre.clientX - display.box.left) / display.box.width
    const capturedOffCentre = captureAnnotationPoints({
      clientPoints: [offCentre],
      elementBox: display.box,
      videoWidth: display.video.width,
      videoHeight: display.video.height,
      currentTimeSeconds: 0,
    })
    if (!capturedOffCentre.ok) throw new Error('capture must succeed')
    expect(capturedOffCentre.value.points[0].x).toBeCloseTo(0.9, 9)
    // Picture width is 900 * (1080/1920) = 506.25 inside a 1600-wide box, so the
    // naive number is dragged towards the middle by the bars.
    expect(naiveOffCentre).toBeCloseTo(0.6265625, 6)
    expect(Math.abs(naiveOffCentre - 0.9)).toBeGreaterThan(0.27)
  })
})

describe('round trip', () => {
  it('survives being drawn at one size and redrawn at another', () => {
    const small = DISPLAYS[6]
    const huge = DISPLAYS[7]
    const captured = captureAnnotationPoints({
      clientPoints: [pixelFor(small, 0.42, 0.61)],
      elementBox: small.box,
      videoWidth: small.video.width,
      videoHeight: small.video.height,
      currentTimeSeconds: 3.5,
    })
    if (!captured.ok) throw new Error('capture must succeed')

    const redrawn = annotationPointToClient(
      captured.value.points[0],
      huge.box,
      huge.video.width,
      huge.video.height,
    )
    expect(redrawn).not.toBeNull()
    if (!redrawn) return

    const recaptured = captureAnnotationPoints({
      clientPoints: [redrawn],
      elementBox: huge.box,
      videoWidth: huge.video.width,
      videoHeight: huge.video.height,
      currentTimeSeconds: 3.5,
    })
    if (!recaptured.ok) throw new Error('recapture must succeed')
    expect(recaptured.value.points[0].x).toBeCloseTo(0.42, 9)
    expect(recaptured.value.points[0].y).toBeCloseTo(0.61, 9)
  })

  it('records the moment on the video, in whole milliseconds', () => {
    const captured = captureAnnotationPoints({
      clientPoints: [pixelFor(DISPLAYS[0], 0.5, 0.5)],
      elementBox: DISPLAYS[0].box,
      videoWidth: 1920,
      videoHeight: 1080,
      currentTimeSeconds: 8.6667,
    })
    if (!captured.ok) throw new Error('capture must succeed')
    expect(captured.value.timeMs).toBe(8667)
  })
})

describe('marks that run off the edge', () => {
  it('pulls a stroke back to the boundary rather than throwing the gesture away', () => {
    const display = DISPLAYS[0]
    const captured = captureAnnotationPoints({
      clientPoints: [
        pixelFor(display, 0.5, 0.5),
        { clientX: display.box.left - 400, clientY: display.box.top + 100 },
      ],
      elementBox: display.box,
      videoWidth: display.video.width,
      videoHeight: display.video.height,
      currentTimeSeconds: 0,
    })
    expect(captured.ok).toBe(true)
    if (!captured.ok) return
    expect(captured.value.points[1].x).toBe(0)
  })

  it('refuses a mark with no points at all', () => {
    const captured = captureAnnotationPoints({
      clientPoints: [],
      elementBox: DISPLAYS[0].box,
      videoWidth: 1920,
      videoHeight: 1080,
      currentTimeSeconds: 0,
    })
    expect(captured.ok).toBe(false)
  })

  it('refuses when the video size is not known yet', () => {
    const captured = captureAnnotationPoints({
      clientPoints: [{ clientX: 10, clientY: 10 }],
      elementBox: DISPLAYS[0].box,
      videoWidth: 0,
      videoHeight: 0,
      currentTimeSeconds: 0,
    })
    expect(captured.ok).toBe(false)
  })
})
