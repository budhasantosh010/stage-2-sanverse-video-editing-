import { describe,expect,it } from 'vitest'
import { buildExpertMotionReviewFrame } from './ExpertMotionReviewLab.tsx'

describe('V1.4 Motion Lab Expert Motion integration',()=>{
  it('projects the same three canonical expert semantic nodes through C3 and C6',()=>{const frame=buildExpertMotionReviewFrame(3_600_000);expect(frame.c3ExpertNodeIds).toEqual(['expert.procedural','expert.particles','expert.shader']);expect(frame.c6ExpertNodeIds).toEqual(expect.arrayContaining([...frame.c3ExpertNodeIds]));expect(frame.qaStatus).toBe('PASS')})
  it('is history-free at the full browser integration seam',()=>{const direct=buildExpertMotionReviewFrame(2_340_000);buildExpertMotionReviewFrame(7_200_000);const backward=buildExpertMotionReviewFrame(2_340_000),random=buildExpertMotionReviewFrame(2_340_000);expect(backward.runtimeFrames).toEqual(direct.runtimeFrames);expect(random.runtimeFrames).toEqual(direct.runtimeFrames)})
  it('carries bounded procedural, reconstructable particle and canonical shader uniform truth into the review model',()=>{const frame=buildExpertMotionReviewFrame(2_880_000);expect(frame.runtimeFrames['expert.procedural']).toMatchObject({program:'orbital-rings',resourceUsage:{primitiveCount:8}});expect(frame.runtimeFrames['expert.particles']).toMatchObject({program:'radial-burst',resourceUsage:{primitiveCount:72}});expect(frame.runtimeFrames['expert.shader']).toMatchObject({program:'plasma-field',shader:{uniforms:{canonicalTick:2_880_000,seed:303}}})})
})
