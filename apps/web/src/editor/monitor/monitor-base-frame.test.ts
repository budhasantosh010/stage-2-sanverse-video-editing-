import { describe, expect, it } from 'vitest'

import {
  HAVE_CURRENT_DATA,
  HAVE_METADATA,
  HAVE_NOTHING,
  monitorBaseFrameMessage,
  monitorBaseFrameState,
  retainsPreviousFrame,
  showsGapLayer,
  type MonitorBaseFrameInput,
} from './monitor-base-frame'

const healthy = (over: Partial<MonitorBaseFrameInput> = {}): MonitorBaseFrameInput => ({
  hasSource: true,
  readyState: HAVE_CURRENT_DATA,
  seeking: false,
  hasMediaError: false,
  inCanonicalGap: false,
  hasPresentedFrame: true,
  motionActive: false,
  motionFrameValid: false,
  ...over,
})

describe('monitor base frame state', () => {
  it('reports ready for a playing video that has presented a frame', () => {
    expect(monitorBaseFrameState(healthy())).toBe('ready')
    expect(monitorBaseFrameMessage('ready')).toBeNull()
  })

  it('reports loading before any frame exists, not gap', () => {
    expect(monitorBaseFrameState(healthy({
      readyState: HAVE_NOTHING,
      hasPresentedFrame: false,
    }))).toBe('loading')
    expect(monitorBaseFrameState(healthy({ hasSource: false, hasPresentedFrame: false }))).toBe('loading')
  })

  it('treats known size without a decodable frame as loading, never as ready', () => {
    // videoWidth/videoHeight are populated at HAVE_METADATA. Believing that
    // means "there is a picture" is what let an empty canvas be revealed.
    expect(monitorBaseFrameState(healthy({
      readyState: HAVE_METADATA,
      hasPresentedFrame: false,
    }))).toBe('loading')
  })

  it('keeps the previous frame while seeking instead of blanking', () => {
    expect(monitorBaseFrameState(healthy({ seeking: true }))).toBe('seeking')
    expect(retainsPreviousFrame('seeking')).toBe(true)
    expect(retainsPreviousFrame('ready')).toBe(false)
  })

  it('reports seeking rather than loading when readiness dips after a frame was shown', () => {
    expect(monitorBaseFrameState(healthy({
      readyState: HAVE_METADATA,
      hasPresentedFrame: true,
    }))).toBe('seeking')
  })

  it('reports loading, not seeking, when a seek starts before any frame existed', () => {
    expect(monitorBaseFrameState(healthy({
      seeking: true,
      hasPresentedFrame: false,
      readyState: HAVE_NOTHING,
    }))).toBe('loading')
  })

  it('shows the gap layer only for a canonical composition gap', () => {
    expect(monitorBaseFrameState(healthy({ inCanonicalGap: true }))).toBe('gap')
    expect(showsGapLayer('gap')).toBe(true)

    // Every situation that previously looked identical to a gap on screen.
    for (const notAGap of [
      healthy({ seeking: true }),
      healthy({ readyState: HAVE_METADATA, hasPresentedFrame: false }),
      healthy({ motionActive: true, motionFrameValid: false, hasPresentedFrame: false }),
      healthy({ hasSource: false, hasPresentedFrame: false }),
      healthy({ hasMediaError: true }),
    ]) {
      expect(showsGapLayer(monitorBaseFrameState(notAGap))).toBe(false)
    }
  })

  it('lets a real error outrank a gap so black is never explained away as intentional', () => {
    expect(monitorBaseFrameState(healthy({
      hasMediaError: true,
      inCanonicalGap: true,
    }))).toBe('error')
  })

  it('reports loading while the motion canvas has never drawn a real frame', () => {
    expect(monitorBaseFrameState(healthy({
      motionActive: true,
      motionFrameValid: false,
      hasPresentedFrame: false,
    }))).toBe('loading')
  })

  it('stays ready when the motion canvas holds a real, slightly stale frame', () => {
    expect(monitorBaseFrameState(healthy({
      motionActive: true,
      motionFrameValid: false,
      hasPresentedFrame: true,
    }))).toBe('ready')
  })

  it('gives every non-ready state one plain sentence', () => {
    expect(monitorBaseFrameMessage('loading')).toBe('Loading frame…')
    expect(monitorBaseFrameMessage('seeking')).toBe('Seeking…')
    expect(monitorBaseFrameMessage('gap')).toBe('No media at this time')
    expect(monitorBaseFrameMessage('error')).toBe('Preview unavailable')
  })
})
