import { describe,expect,it } from 'vitest'
import { evaluateScene,projectMotionCurves,projectMotionDopeSheet,projectMotionLayers,deriveNodeGraphProjection } from '@sanverse/motion-graph'
import { createPromotionCandidateV1 } from './contracts.ts'
import { proposeParameterizationPlanV1 } from './parameterization.ts'
import { classifyPromotionCandidateV1,productizePromotionCandidateV1,instantiateReusableMotionTemplateV1,applyTemplateParameterV1,applyStyleLockV1 } from './productization.ts'
import { promotionSource } from './test-fixtures.ts'

const buildProduct=()=>{const source=promotionSource();const candidate=createPromotionCandidateV1(source,['scene','component','motion-recipe'],'candidate:a');if(!candidate.ok)throw new Error('candidate');const plan=proposeParameterizationPlanV1(candidate.value,source.scene,'params:a');if(!plan.ok)throw new Error('plan');const classification=classifyPromotionCandidateV1(candidate.value,source.scene,source.motionPlan);const result=productizePromotionCandidateV1({id:'promoted.metric-story',title:'Metric Story',description:'Reusable metric story',candidate:candidate.value,source,parameterization:plan.value,classification,targetKind:'scene',registrationVersion:1});if(!result.ok)throw new Error(result.refusal.message);return {source,candidate:candidate.value,plan:plan.value,classification,product:result.value}}

describe('Promotion V1 classification and reusable template',()=>{
  it('classifies a multi-object approved story as a scene and exposes other target-kind opportunities without fake implementations',()=>{
    const {classification}=buildProduct()
    expect(classification.recommendedKind).toBe('scene')
    expect(classification.alternativeKinds).toEqual(expect.arrayContaining(['component','motion-recipe']))
    expect(classification.extractionOpportunities.some(item=>item.kind==='motion-recipe')).toBe(true)
  })

  it('builds a canonical reusable graph template and default fixture that preserves source pixels/semantic IDs',()=>{
    const {source,product}=buildProduct();const instance=instantiateReusableMotionTemplateV1(product.template,product.canonicalFixture.values,{instanceId:'instance:default'})
    expect(instance).toMatchObject({ok:true})
    if(!instance.ok)throw new Error('instantiate')
    expect(Object.keys(instance.value.scene.nodes)).toEqual(Object.keys(source.scene.nodes))
    expect(instance.value.scene.rootNodeId).toBe(source.scene.rootNodeId)
    const ctx=(tick:number)=>({localTicks:tick,durationTicks:1_440_000,ticksPerSecond:1_440_000,composition:{width:1920,height:1080,fpsNumerator:30,fpsDenominator:1},reducedMotion:false} as const)
    for(const tick of [0,360_000,720_000,1_440_000])expect(evaluateScene(instance.value.scene,ctx(tick)).nodes).toEqual(evaluateScene(source.scene,ctx(tick)).nodes)
    expect(product.template.exposure.creator).toContain('content.headline')
    expect(product.template.exposure.designer).toContain('style.accent')
    expect(product.template.exposure.advanced).toContain('motion.intensity')
  })

  it('instantiates different Project B content/media/style without source-code edits and preserves ordinary C3/C4/C5/C6 graph identity',()=>{
    const {source,product}=buildProduct();let instance=instantiateReusableMotionTemplateV1(product.template,product.canonicalFixture.values,{instanceId:'project-b:metric-story'});if(!instance.ok)throw new Error('instantiate')
    for(const [path,value] of [['content.headline','Retention accelerated'],['content.metric','82%'],['content.supporting-label','Month over month'],['media.hero-media','asset://project-b/hero']] as const){const next=applyTemplateParameterV1(product.template,instance.value.scene,path,value);expect(next).toMatchObject({ok:true});if(!next.ok)throw new Error(path);instance={ok:true,value:{...instance.value,scene:next.value},revision:next.revision}}
    const styled=applyStyleLockV1(product.template,instance.value.scene,{accent:'#FF7A1A',background:'#0B0D10',surface:'#181C22',primaryText:'#FFFFFF',secondaryText:'#AEB8C6'});expect(styled).toMatchObject({ok:true});if(!styled.ok)throw new Error('style')
    const scene=styled.value.scene
    expect(scene.nodes.headline?.type==='text'&&scene.nodes.headline.text).toEqual({kind:'constant',value:'Retention accelerated'})
    expect(scene.nodes.metric?.type==='text'&&scene.nodes.metric.text).toEqual({kind:'constant',value:'82%'})
    expect(scene.nodes.metric?.type==='text'&&scene.nodes.metric.fillColor).toEqual({kind:'constant',value:'#FF7A1A'})
    expect(scene.nodes.media?.type==='image'&&scene.nodes.media.source).toBe('asset://project-b/hero')
    expect(source.scene.nodes.headline?.type==='text'&&source.scene.nodes.headline.text).toEqual({kind:'constant',value:'Revenue grew'})
    expect(projectMotionLayers({scene}).layersById.metric?.nodeId).toBe('metric')
    expect(projectMotionDopeSheet(scene).layers.some(layer=>layer.nodeId==='metric')).toBe(true)
    expect(projectMotionCurves(scene).tracks.some(track=>track.nodeId==='metric'||track.nodeId==='headline')).toBe(true)
    expect(deriveNodeGraphProjection(scene).nodes.some(node=>node.nodeId==='metric')).toBe(true)
  })

  it('rejects unknown parameters, invalid types and constraints and supports calm/default/strong motion intensity on canonical keyframes',()=>{
    const {product}=buildProduct();const instance=instantiateReusableMotionTemplateV1(product.template,product.canonicalFixture.values,{instanceId:'i'});if(!instance.ok)throw new Error('instantiate')
    expect(applyTemplateParameterV1(product.template,instance.value.scene,'missing.path','x')).toMatchObject({ok:false,refusal:{code:'PROMOTION_PARAMETER_UNKNOWN'}})
    expect(applyTemplateParameterV1(product.template,instance.value.scene,'motion.intensity','strong' as never)).toMatchObject({ok:false,refusal:{code:'PROMOTION_PARAMETER_TYPE_MISMATCH'}})
    for(const value of [.55,1,1.35]){const result=applyTemplateParameterV1(product.template,instance.value.scene,'motion.intensity',value);expect(result).toMatchObject({ok:true});if(!result.ok)continue;const headline=result.value.nodes.headline!;expect(headline.transform.positionY.kind).toBe('keyframes')}
  })
})
