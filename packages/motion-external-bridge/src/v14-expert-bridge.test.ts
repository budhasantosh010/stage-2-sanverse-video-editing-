import { describe, expect, it } from 'vitest'
import { evaluateScene } from '@sanverse/motion-graph'
import { inspectExternalExpertBridgeV14, materializeExternalExpertBridgeV14 } from './v14-expert-bridge.ts'

const procedural = JSON.stringify({schemaVersion:'sanverse.procedural-subset/v1',program:'orbital-rings',width:960,height:540,seed:42,parameters:{ringCount:8,radius:180,thickness:4,wobble:14,speed:1.1}})
const shader = JSON.stringify({schemaVersion:'sanverse.shader-subset/v1',program:'plasma-field',width:960,height:540,seed:88,parameters:{frequency:.8,amplitude:.9,hueShift:210,scale:1.2}})

describe('V1.4 truthful procedural/shader external bridge', () => {
  it('chooses bounded expert wrapping for supported procedural and shader subsets', () => {
    expect(inspectExternalExpertBridgeV14('procedural',procedural)).toMatchObject({ok:true,value:{decision:'expert-wrap',spec:{kind:'procedural',program:'orbital-rings',maxPrimitives:8}}})
    expect(inspectExternalExpertBridgeV14('shader',shader)).toMatchObject({ok:true,value:{decision:'expert-wrap',spec:{kind:'shader',program:'plasma-field',maxPrimitives:1}}})
  })

  it('materializes supported source to one canonical Motion expert node', () => {
    const result = materializeExternalExpertBridgeV14('asset:expert','procedural',procedural)
    expect(result).toMatchObject({ok:true,value:{schemaVersion:'sanverse.motion-scene/v1'}})
    if (!result.ok) return
    const resolved = evaluateScene(result.value,{localTicks:720_000,durationTicks:7_200_000,ticksPerSecond:1_440_000,composition:{width:1920,height:1080,fpsNumerator:30,fpsDenominator:1},reducedMotion:false})
    expect(resolved.nodes['asset:expert::expert']).toMatchObject({type:'expert',expert:{program:'orbital-rings',seed:42}})
  })

  it('refuses arbitrary program source, extra runtime fields and unbounded budgets', () => {
    expect(inspectExternalExpertBridgeV14('shader',JSON.stringify({schemaVersion:'sanverse.shader-subset/v1',program:'user-glsl',width:960,height:540,seed:1,parameters:{frequency:1,amplitude:1,hueShift:0,scale:1}}))).toMatchObject({ok:false,refusal:{code:'EXPERT_PROGRAM_UNSUPPORTED'}})
    expect(inspectExternalExpertBridgeV14('shader',JSON.stringify({schemaVersion:'sanverse.shader-subset/v1',program:'plasma-field',width:960,height:540,seed:1,parameters:{frequency:1,amplitude:1,hueShift:0,scale:1},source:'fetch("https://example.com")'}))).toMatchObject({ok:false,refusal:{code:'EXPERT_SOURCE_UNSAFE'}})
    expect(inspectExternalExpertBridgeV14('procedural',JSON.stringify({schemaVersion:'sanverse.procedural-subset/v1',program:'orbital-rings',width:960,height:540,seed:1,parameters:{ringCount:900,radius:180,thickness:4,wobble:14,speed:1}}))).toMatchObject({ok:false,refusal:{code:'EXPERT_SOURCE_INVALID'}})
  })
})
