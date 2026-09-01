import { describe, expect, it } from 'vitest'
import { creativeReviewSourceFrameUrlV1 } from './CreativeSceneRenderPage'

describe('Creative Storyboard review source frame identity', () => {
  it('maps the KVS local tick onto the exact canonical source tick without using composition time', () => {
    expect(creativeReviewSourceFrameUrlV1({
      projectId: 'project_1234567890abcdef',
      assetId: 'asset_1234567890ab',
      assetVersion: 'abcdef0123456789',
      sourceStartTick: 5_760_000,
      localTick: 720_000,
      width: 1280,
    })).toBe('/api/projects/project_1234567890abcdef/media-analysis/frame?assetId=asset_1234567890ab&assetVersion=abcdef0123456789&sourceTicks=6480000&width=640')
  })
})
