import { describe, expect, it } from 'vitest'

import {
  monitorBaseLayerMessage,
  motionCanvasFrameToken,
  resolveMonitorBaseLayer,
  showsGapLayer,
  showsMotionCanvas,
  type MonitorBaseLayerInput,
} from './monitor-base-layer'
import { HAVE_CURRENT_DATA, HAVE_METADATA } from '../../features/render-plan/media-readiness'

const TOKEN = motionCanvasFrameToken({
  assetId: 'asset_interview',
  sourceTicks: 1_440_000,
  compositionTicks: 1_440_000,
  motionId: 'motion_punch_in',
  geometryVersion: 3,
})

/** A healthy paused preview showing a valid motion frame. */
const healthy = (patch: Partial<MonitorBaseLayerInput> = {}): MonitorBaseLayerInput => Object.freeze({
  hasSource: true,
  readyState: HAVE_CURRENT_DATA,
  seeking: false,
  mediaError: null,
  inCanonicalGap: false,
  hasPresentedFrame: true,
  motionActive: true,
  requestedFrameToken: TOKEN,
  drawnFrameToken: TOKEN,
  playing: false,
  ...patch,
})

describe('the base picture layer', () => {
  it('shows the motion canvas only when it holds the exact frame being asked for', () => {
    expect(resolveMonitorBaseLayer(healthy())).toEqual({ kind: 'motion-canvas', frameToken: TOKEN })
  })

  it('falls back to the native video rather than black when the canvas holds nothing', () => {
    // The whole point. Untransformed real footage is footage. Black is not.
    expect(resolveMonitorBaseLayer(healthy({ drawnFrameToken: null }))).toEqual({ kind: 'native-video' })
  })

  it('falls back to the native video when the canvas holds a stale frame', () => {
    const stale = motionCanvasFrameToken({
      assetId: 'asset_interview',
      sourceTicks: 720_000,
      compositionTicks: 720_000,
      motionId: 'motion_punch_in',
      geometryVersion: 3,
    })
    expect(resolveMonitorBaseLayer(healthy({ drawnFrameToken: stale }))).toEqual({ kind: 'native-video' })
  })

  it('refuses a frame drawn for a different asset', () => {
    const otherAsset = motionCanvasFrameToken({
      assetId: 'asset_broll',
      sourceTicks: 1_440_000,
      compositionTicks: 1_440_000,
      motionId: 'motion_punch_in',
      geometryVersion: 3,
    })
    expect(resolveMonitorBaseLayer(healthy({ drawnFrameToken: otherAsset }))).toEqual({ kind: 'native-video' })
  })

  it('refuses a frame drawn at the old panel size', () => {
    const oldGeometry = motionCanvasFrameToken({
      assetId: 'asset_interview',
      sourceTicks: 1_440_000,
      compositionTicks: 1_440_000,
      motionId: 'motion_punch_in',
      geometryVersion: 2,
    })
    expect(resolveMonitorBaseLayer(healthy({ drawnFrameToken: oldGeometry }))).toEqual({ kind: 'native-video' })
  })

  it('keeps the last real frame on screen through a seek instead of jumping', () => {
    const stale = motionCanvasFrameToken({
      assetId: 'asset_interview',
      sourceTicks: 720_000,
      compositionTicks: 720_000,
      motionId: 'motion_punch_in',
      geometryVersion: 3,
    })
    expect(resolveMonitorBaseLayer(healthy({ seeking: true, drawnFrameToken: stale })))
      .toEqual({ kind: 'motion-canvas', frameToken: stale })
  })

  it('keeps the canvas during playback, when React cannot keep pace with the decoder', () => {
    const behind = motionCanvasFrameToken({
      assetId: 'asset_interview',
      sourceTicks: 1_400_000,
      compositionTicks: 1_400_000,
      motionId: 'motion_punch_in',
      geometryVersion: 3,
    })
    expect(resolveMonitorBaseLayer(healthy({ playing: true, drawnFrameToken: behind })))
      .toEqual({ kind: 'motion-canvas', frameToken: behind })
  })

  it('uses the native video when motion is identity, whatever the canvas holds', () => {
    expect(resolveMonitorBaseLayer(healthy({ motionActive: false }))).toEqual({ kind: 'native-video' })
  })

  it('reports a real failure above everything else', () => {
    const layer = resolveMonitorBaseLayer(healthy({ mediaError: 'Preview unavailable', inCanonicalGap: true }))
    expect(layer).toEqual({ kind: 'error', reason: 'Preview unavailable' })
    expect(showsGapLayer(layer)).toBe(false)
  })

  it('paints the deliberate black only for a canonical gap', () => {
    expect(showsGapLayer(resolveMonitorBaseLayer(healthy({ inCanonicalGap: true })))).toBe(true)
    for (const patch of [
      { seeking: true },
      { playing: true },
      { readyState: HAVE_METADATA },
      { drawnFrameToken: null },
      { motionActive: false },
      { hasPresentedFrame: false, readyState: HAVE_METADATA },
    ] satisfies readonly Partial<MonitorBaseLayerInput>[]) {
      expect(showsGapLayer(resolveMonitorBaseLayer(healthy(patch)))).toBe(false)
    }
  })

  it('is loading before any frame has ever been decodable, and not a gap', () => {
    const layer = resolveMonitorBaseLayer(healthy({
      readyState: HAVE_METADATA,
      hasPresentedFrame: false,
      drawnFrameToken: null,
    }))
    expect(layer).toEqual({ kind: 'loading' })
    expect(showsGapLayer(layer)).toBe(false)
  })

  it('is loading, not a gap, when no source is attached at all', () => {
    expect(resolveMonitorBaseLayer(healthy({ hasSource: false, inCanonicalGap: true })))
      .toEqual({ kind: 'loading' })
  })

  it('says nothing at all when the picture is working', () => {
    expect(monitorBaseLayerMessage(resolveMonitorBaseLayer(healthy()))).toBeNull()
    expect(monitorBaseLayerMessage(resolveMonitorBaseLayer(healthy({ drawnFrameToken: null })))).toBeNull()
  })

  it('takes no pointer input at all', () => {
    // The regression this whole module exists for: hovering used to decide
    // which layer was the picture. There is no hover, focus, or pointer field
    // in the input type, so it structurally cannot.
    const keys = Object.keys(healthy())
    for (const key of keys) {
      expect(key.toLowerCase()).not.toMatch(/hover|focus|pointer|mouse/)
    }
  })

  it('shows the motion canvas from exactly one predicate', () => {
    expect(showsMotionCanvas(resolveMonitorBaseLayer(healthy()))).toBe(true)
    expect(showsMotionCanvas(resolveMonitorBaseLayer(healthy({ drawnFrameToken: null })))).toBe(false)
    expect(showsMotionCanvas(resolveMonitorBaseLayer(healthy({ inCanonicalGap: true })))).toBe(false)
  })
})
