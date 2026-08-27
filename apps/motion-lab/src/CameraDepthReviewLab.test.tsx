import { describe,expect,it } from 'vitest'
import { buildCameraDepthReviewFrame } from './CameraDepthReviewLab.tsx'

describe('V1.3 Motion Lab C9→C10 review integration',()=>{
  it('composes a tracked callout through C10 and gives foreground stronger camera response than background',()=>{const frame=buildCameraDepthReviewFrame(3_600_000),back=frame.transforms['camera.back']!,front=frame.transforms['camera.front']!,callout=frame.transforms['camera.callout']!;expect(frame.operations).toHaveLength(18);expect(callout.positionX).not.toBe(0);expect(Math.abs(front.scaleX-1)).toBeGreaterThan(Math.abs(back.scaleX-1));expect(frame.camera.zoom).toBeCloseTo(1.18,5)})
  it('is history-free at the integration seam: direct/backward/random calls at the same tick are identical',()=>{const direct=buildCameraDepthReviewFrame(1_800_000);buildCameraDepthReviewFrame(6_300_000);const backward=buildCameraDepthReviewFrame(1_800_000),random=buildCameraDepthReviewFrame(1_800_000);expect(backward).toEqual(direct);expect(random).toEqual(direct)})
  it('carries the conservative B8 decision and native Rive subset into the browser proof model',()=>{const start=buildCameraDepthReviewFrame(0),end=buildCameraDepthReviewFrame(7_200_000);expect(start.preference).toBe('restrained');expect(start.failureLesson).toContain('CAMERA_TOO_AGGRESSIVE');expect(start.rivePositionX).toBeLessThan(end.rivePositionX)})
})
