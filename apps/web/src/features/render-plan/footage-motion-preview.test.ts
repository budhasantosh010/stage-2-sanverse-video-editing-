import { describe, expect, it, vi } from 'vitest'
import { acceptChangeSet } from '@sanverse/edit-domain'
import { compileProjectToRenderPlan } from '@sanverse/render-contract/compile-project'

import { ms, testProject } from '../../test-fixtures'
import {
  drawFootageMotionFrame,
  footageMotionAtCompositionTime,
  footageMotionDrawDecision,
  forgetFootageMotionFrame,
} from './footage-motion-preview'
import { HAVE_CURRENT_DATA, HAVE_METADATA, HAVE_NOTHING } from './media-readiness'

/**
 * A video the browser can actually read a frame out of.
 *
 * `readyState` is deliberately part of the fixture. jsdom leaves it at
 * HAVE_NOTHING, and a fixture that reports a size without a decodable frame is
 * exactly the state that used to reveal an empty black canvas over healthy
 * footage.
 */
const readyVideo = (readyState = HAVE_CURRENT_DATA) => {
  const video = document.createElement('video')
  Object.defineProperties(video, {
    videoWidth: { configurable: true, value: 1920 },
    videoHeight: { configurable: true, value: 1080 },
    readyState: { configurable: true, value: readyState },
    currentSrc: { configurable: true, value: 'blob:sanverse/source-a' },
  })
  return video
}

const stubbedCanvas = () => {
  const context = {
    save: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    restore: vi.fn(),
    fillStyle: '',
  }
  const canvas = document.createElement('canvas')
  vi.spyOn(canvas, 'getContext').mockReturnValue(context as never)
  forgetFootageMotionFrame(canvas)
  return { canvas, context }
}

const motionProject = () => {
  const base = testProject()
  const accepted = acceptChangeSet(base, {
    schemaVersion: 'sanverse.change-set/v1',
    changeSetId: 'changeset_motionweb',
    baseRevision: base.revision,
    operations: [{
      schemaVersion: 'sanverse.operation/v3',
      operationId: 'operation_motionweb',
      kind: 'set-footage-motion',
      capabilityId: 'sanverse.footage.motion.primitive/v1',
      motionId: 'motion_web00001',
      assetId: base.assets[0].assetId,
      sourceInterval: { start: ms(5_000), duration: ms(5_000) },
      transform: { translateX: 0.1, translateY: -0.05, scale: 1.2, rotationDegrees: 5, opacity: 1 },
      crop: { top: 0.05, right: 0.02, bottom: 0.03, left: 0.04 },
      tracks: [],
      extensions: {},
    }],
    provenance: { source: 'direct', requestId: null },
    extensions: {},
  })
  if (!accepted.ok) throw new Error(JSON.stringify(accepted.error))
  const compiled = compileProjectToRenderPlan(accepted.value)
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.error))
  return compiled.value
}

describe('primary-footage browser projection', () => {
  it('resolves composition time to source-relative motion and defaults outside the interval', () => {
    const plan = motionProject()
    expect(footageMotionAtCompositionTime(plan, ms(4_999).ticks)).toBeNull()
    const active = footageMotionAtCompositionTime(plan, ms(7_000).ticks)
    expect(active).toMatchObject({ sourceTicks: ms(7_000).ticks })
    expect(active?.evaluated.transform).toMatchObject({ scale: 1.2, translateX: 0.1 })
    expect(footageMotionAtCompositionTime(plan, ms(10_000).ticks)).toBeNull()
  })

  it('draws from the one video using crop, center transform, and normalized translation', () => {
    const { canvas, context } = stubbedCanvas()
    const video = readyVideo()

    expect(drawFootageMotionFrame({
      canvas,
      video,
      plan: motionProject(),
      compositionTicks: ms(7_000).ticks,
    })).toBe(true)
    expect(canvas.hidden).toBe(false)
    expect(context.translate).toHaveBeenCalledWith(960 + 192, 540 - 54)
    expect(context.scale).toHaveBeenCalledWith(1.2, 1.2)
    expect(context.drawImage).toHaveBeenCalledOnce()
    expect(context.drawImage.mock.calls[0][0]).toBe(video)
  })

  it('hides the projection outside motion and never creates a second video element', () => {
    const { canvas } = stubbedCanvas()
    const video = readyVideo()
    document.body.append(video)
    expect(drawFootageMotionFrame({
      canvas,
      video,
      plan: motionProject(),
      compositionTicks: ms(1_000).ticks,
    })).toBe(false)
    expect(canvas.hidden).toBe(true)
    expect(document.querySelectorAll('video')).toHaveLength(1)
    video.remove()
  })

  it('never reveals a canvas it has not drawn a real frame onto', () => {
    // The recorded failure: videoWidth is populated at HAVE_METADATA, so the
    // canvas used to clear itself black and show that over healthy footage.
    const { canvas, context } = stubbedCanvas()
    expect(drawFootageMotionFrame({
      canvas,
      video: readyVideo(HAVE_METADATA),
      plan: motionProject(),
      compositionTicks: ms(7_000).ticks,
    })).toBe(false)
    expect(canvas.hidden).toBe(true)
    expect(context.fillRect).not.toHaveBeenCalled()
    expect(context.drawImage).not.toHaveBeenCalled()
  })

  it('retains the last valid frame instead of blanking when readiness dips mid-seek', () => {
    const { canvas, context } = stubbedCanvas()
    const plan = motionProject()
    expect(drawFootageMotionFrame({
      canvas, video: readyVideo(), plan, compositionTicks: ms(7_000).ticks,
    })).toBe(true)
    expect(canvas.hidden).toBe(false)

    const drawsAfterFirstFrame = context.drawImage.mock.calls.length
    expect(drawFootageMotionFrame({
      canvas, video: readyVideo(HAVE_NOTHING), plan, compositionTicks: ms(7_500).ticks,
    })).toBe(false)
    // Still visible, still holding the previous real frame, and nothing was
    // cleared out from under it.
    expect(canvas.hidden).toBe(false)
    expect(context.clearRect).toHaveBeenCalledTimes(1)
    expect(context.drawImage).toHaveBeenCalledTimes(drawsAfterFirstFrame)
  })

  it('does not retain another source last frame after the video source changes', () => {
    const { canvas } = stubbedCanvas()
    const plan = motionProject()
    expect(drawFootageMotionFrame({
      canvas, video: readyVideo(), plan, compositionTicks: ms(7_000).ticks,
    })).toBe(true)

    const replacement = readyVideo(HAVE_NOTHING)
    Object.defineProperty(replacement, 'currentSrc', { configurable: true, value: 'blob:sanverse/source-b' })
    expect(drawFootageMotionFrame({
      canvas, video: replacement, plan, compositionTicks: ms(7_000).ticks,
    })).toBe(false)
    expect(canvas.hidden).toBe(true)
  })

  it('decides draw, retain, or hide from readiness alone', () => {
    const base = { videoWidth: 1920, videoHeight: 1080, readyState: HAVE_CURRENT_DATA, hasDrawnValidFrame: false }
    expect(footageMotionDrawDecision({ ...base, motionActive: true })).toBe('draw')
    expect(footageMotionDrawDecision({ ...base, motionActive: false })).toBe('hide')
    expect(footageMotionDrawDecision({ ...base, motionActive: true, readyState: HAVE_METADATA })).toBe('hide')
    expect(footageMotionDrawDecision({
      ...base, motionActive: true, readyState: HAVE_METADATA, hasDrawnValidFrame: true,
    })).toBe('retain')
    expect(footageMotionDrawDecision({
      ...base, motionActive: true, videoWidth: 0, hasDrawnValidFrame: true,
    })).toBe('retain')
  })
})
