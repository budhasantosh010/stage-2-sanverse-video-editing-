import { describe, expect, it } from 'vitest'
import { evaluateScene } from '@sanverse/motion-graph'
import { inspectExternalMotionAssetV1, materializeExternalMotionAssetV1 } from './inspection.ts'
import type { ExternalMotionProvenanceV1 } from './provenance.ts'
import { inspectThreeWebglV15 } from './v15-three-webgl.ts'
import { inspectAdobeAssistedBridgeV15 } from './v15-adobe.ts'

const rights=(sourceKind:ExternalMotionProvenanceV1['sourceKind']):ExternalMotionProvenanceV1=>({schemaVersion:'sanverse.external-motion-provenance/v1',sourceKind,sourceName:'owner fixture',rightsClass:'owner-authored',attributionRequired:false,reusableLibraryAllowed:true,projectUseAllowed:true,aiModificationAllowed:true,restrictions:[]})
const ctx=(tick:number)=>({localTicks:tick,durationTicks:1_440_000,ticksPerSecond:1_440_000,composition:{width:1920,height:1080,fpsNumerator:30,fpsDenominator:1},reducedMotion:false} as const)

describe('V1.5 advanced A2 bridges',()=>{
  it('materializes only the bounded deterministic Three/WebGL subset and preserves direct seek',()=>{
    const source=JSON.stringify({schemaVersion:'sanverse.three-subset/v1',width:1920,height:1080,durationTicks:1_440_000,objects:[{id:'card',geometry:'plane',material:'basic',color:'#ffffff',x:-.2,y:0,width:.4,height:.2,keyframes:[{tick:0,x:-.2,opacity:0},{tick:720_000,x:0,opacity:1},{tick:1_440_000,x:.2,opacity:1}]}]})
    expect(inspectThreeWebglV15(source)).toMatchObject({strategy:'NATIVE_MATERIALIZE',deterministic:true,directSeekSafe:true})
    const inspection=inspectExternalMotionAssetV1({assetId:'three:card',sourceKind:'three-webgl',bytes:source,provenance:rights('three-webgl')})
    expect(inspection).toMatchObject({ok:true,value:{materialization:'canonical-scene'}})
    if(!inspection.ok)return
    const result=materializeExternalMotionAssetV1(inspection.value,source)
    expect(result.ok).toBe(true)
    if(!result.ok||result.value.kind!=='canonical-scene')return
    const direct=evaluateScene(result.value.scene,ctx(720_000));evaluateScene(result.value.scene,ctx(1_440_000));const backward=evaluateScene(result.value.scene,ctx(720_000))
    expect(backward).toEqual(direct)
    expect(direct.nodes['three:card::card']).toMatchObject({type:'shape',opacity:1,transform:{positionX:0}})
  })

  it('classifies arbitrary Three/WebGL source without executing it and fails closed on network/time/random',()=>{
    const unsafe=`import * as THREE from 'three'; const camera=new THREE.PerspectiveCamera(); const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.ShaderMaterial()); requestAnimationFrame(()=>fetch('https://example.com')); const x=Math.random();`
    expect(inspectThreeWebglV15(unsafe)).toMatchObject({strategy:'REJECT',networkRequired:true,wallClockUsed:true,uncontrolledRandomUsed:true,customShaderCount:1})
    expect(inspectExternalMotionAssetV1({assetId:'three:unsafe',sourceKind:'three-webgl',bytes:unsafe,provenance:rights('three-webgl')})).toMatchObject({ok:false,refusal:{code:'THREE_WEBGL_REJECTED'}})
  })

  it('uses extraction-assisted AEP/MOGRT manifests, maps intended controls, and refuses unknown expressions',()=>{
    const source=JSON.stringify({schemaVersion:'sanverse.adobe-extract/v1',sourceKind:'mogrt',width:1920,height:1080,durationTicks:1_440_000,layers:[{id:'title',type:'text',text:'Revenue',fill:'#ffffff',x:{keyframes:[{tick:0,value:-.2},{tick:1_440_000,value:.2}]},opacity:1,expressions:{opacity:'value'}}],controls:[{id:'headline',label:'Headline',type:'text',layerId:'title',property:'text'},{id:'color',label:'Color',type:'color',layerId:'title',property:'fill'}]})
    expect(inspectAdobeAssistedBridgeV15('mogrt',source)).toMatchObject({extractionRequired:false,deterministic:true,directSeekSafe:true,nativeMaterializationAvailable:true})
    const inspection=inspectExternalMotionAssetV1({assetId:'mogrt:title',sourceKind:'mogrt',bytes:source,provenance:rights('mogrt')})
    expect(inspection.ok).toBe(true)
    if(!inspection.ok)return
    const result=materializeExternalMotionAssetV1(inspection.value,source)
    expect(result.ok).toBe(true)
    if(!result.ok||result.value.kind!=='canonical-scene')return
    expect(result.value.scene.exposures.map(exposure=>exposure.label)).toEqual(['Headline','Color'])
    const direct=evaluateScene(result.value.scene,ctx(720_000));evaluateScene(result.value.scene,ctx(0));expect(evaluateScene(result.value.scene,ctx(720_000))).toEqual(direct)

    const unknown=JSON.stringify({schemaVersion:'sanverse.adobe-extract/v1',sourceKind:'aep',width:1920,height:1080,durationTicks:1_440_000,layers:[{id:'x',type:'text',text:'Nope',expressions:{x:'wiggle(5,20)'}}]})
    expect(inspectAdobeAssistedBridgeV15('aep',unknown).features).toEqual(expect.arrayContaining([expect.objectContaining({classification:'UNSUPPORTED',feature:'expression:unknown'})]))
    expect(inspectExternalMotionAssetV1({assetId:'aep:bad',sourceKind:'aep',bytes:unknown,provenance:rights('aep')})).toMatchObject({ok:false,refusal:{code:'ADOBE_NATIVE_MATERIALIZATION_UNAVAILABLE'}})
  })

  it('requires trusted extraction for raw Adobe payloads instead of claiming universal compatibility',()=>{
    const raw='After Effects Project binary-ish payload'
    expect(inspectAdobeAssistedBridgeV15('aep',raw)).toMatchObject({extractionRequired:true,nativeMaterializationAvailable:false})
    expect(inspectExternalMotionAssetV1({assetId:'aep:raw',sourceKind:'aep',bytes:raw,provenance:rights('aep')})).toMatchObject({ok:false,refusal:{code:'ADOBE_EXTRACTION_REQUIRED'}})
  })
})
