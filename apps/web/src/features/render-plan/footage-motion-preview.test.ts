import { describe, expect, it, vi } from 'vitest'
import { acceptChangeSet } from '@sanverse/edit-domain'
import { compileProjectToRenderPlan } from '@sanverse/render-contract/compile-project'

import { ms, testProject } from '../../test-fixtures'
import { drawFootageMotionFrame, footageMotionAtCompositionTime } from './footage-motion-preview'

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
    const drawImage = vi.fn()
    const context = {
      save: vi.fn(),
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage,
      restore: vi.fn(),
      fillStyle: '',
    }
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getContext').mockReturnValue(context as never)
    const video = document.createElement('video')
    Object.defineProperties(video, {
      videoWidth: { configurable: true, value: 1920 },
      videoHeight: { configurable: true, value: 1080 },
    })

    expect(drawFootageMotionFrame({
      canvas,
      video,
      plan: motionProject(),
      compositionTicks: ms(7_000).ticks,
    })).toBe(true)
    expect(canvas.hidden).toBe(false)
    expect(context.translate).toHaveBeenCalledWith(960 + 192, 540 - 54)
    expect(context.scale).toHaveBeenCalledWith(1.2, 1.2)
    expect(drawImage).toHaveBeenCalledOnce()
    expect(drawImage.mock.calls[0][0]).toBe(video)
  })

  it('hides the projection outside motion and never creates a second video element', () => {
    const canvas = document.createElement('canvas')
    const video = document.createElement('video')
    Object.defineProperties(video, {
      videoWidth: { configurable: true, value: 1920 },
      videoHeight: { configurable: true, value: 1080 },
    })
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
})
