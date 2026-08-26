import { describe,expect,it } from 'vitest'
import { createPromotionCandidateV1 } from './contracts.ts'
import { proposeParameterizationPlanV1 } from './parameterization.ts'
import { classifyPromotionCandidateV1,productizePromotionCandidateV1,instantiateReusableMotionTemplateV1,applyTemplateParameterV1,applyStyleLockV1 } from './productization.ts'
import { createPromotionRegistryV1,registerPromotedCapabilityV1,runPromotionQaV1,aggregatePromotionRightsV1,validatePromotedCapabilityLineageV1,parsePromotedCapabilityLineageV1,serializePromotedCapabilityLineageV1 } from './qa-registry.ts'
import { promotionSource } from './test-fixtures.ts'

const built=(source=promotionSource())=>{const c=createPromotionCandidateV1(source,['scene'],'candidate:a');if(!c.ok)throw new Error(c.refusal.message);const p=proposeParameterizationPlanV1(c.value,source.scene,'params:a');if(!p.ok)throw new Error(p.refusal.message);const classification=classifyPromotionCandidateV1(c.value,source.scene,source.motionPlan);const product=productizePromotionCandidateV1({id:'promoted.metric-story',title:'Metric Story',description:'Reusable metric story',candidate:c.value,source,parameterization:p.value,classification,targetKind:'scene',registrationVersion:1});if(!product.ok)throw new Error(product.refusal.message);const instance=instantiateReusableMotionTemplateV1(product.value.template,product.value.canonicalFixture.values,{instanceId:'default'});if(!instance.ok)throw new Error(instance.refusal.message);return{source,candidate:c.value,plan:p.value,product:product.value,instance:instance.value}}

describe('Promotion V1 QA, lineage, rights and atomic registration',()=>{
  it('passes promotion QA only when default parity, bindings, replacement content/style and direct-seek checks pass',()=>{
    const x=built();let replacement=x.instance.scene
    for(const [path,value] of [['content.headline','Retention accelerated'],['content.metric','82%']] as const){const next=applyTemplateParameterV1(x.product.template,replacement,path,value);if(!next.ok)throw new Error(path);replacement=next.value}
    const styled=applyStyleLockV1(x.product.template,replacement,{accent:'#FF7A1A',background:'#0B0D10',surface:'#181C22',primaryText:'#FFFFFF',secondaryText:'#AEB8C6'});if(!styled.ok)throw new Error('style')
    const qa=runPromotionQaV1({source:x.source,capability:x.product,defaultInstance:x.instance.scene,replacementInstance:styled.value.scene,durationTicks:1_440_000,ticksPerSecond:1_440_000,composition:{width:1920,height:1080,fpsNumerator:30,fpsDenominator:1},sampleTicks:[0,360_000,720_000,1_440_000]})
    expect(qa.ok).toBe(true);expect(qa.findings).toEqual([])
  })

  it('fails broken binding/default parity and blocks global registration when any dependency is project-only',()=>{
    const x=built();const broken={...x.product,template:{...x.product.template,parameters:x.product.template.parameters.map((parameter,index)=>index===0?{...parameter,bindings:[{nodeId:'missing',propertyPath:'text.text',transform:'identity'}]}:parameter)}} as never
    const qa=runPromotionQaV1({source:x.source,capability:broken,defaultInstance:x.instance.scene,replacementInstance:x.instance.scene,durationTicks:1_440_000,ticksPerSecond:1_440_000,composition:{width:1920,height:1080,fpsNumerator:30,fpsDenominator:1},sampleTicks:[0,720_000]})
    expect(qa).toMatchObject({ok:false});expect(qa.findings.some(item=>item.code==='PROMOTION_BINDING_BROKEN')).toBe(true)
    const restricted=promotionSource({dependencies:[{id:'stock:1',origin:'external',reusePermission:'project-only',runtimeAssetOwned:false}]})
    expect(aggregatePromotionRightsV1(restricted.dependencies)).toMatchObject({permission:'project-only'})
    const y=built(restricted);const registry=createPromotionRegistryV1()
    const fakeQa={schemaVersion:'sanverse.promotion-qa/v1' as const,ok:true,findings:Object.freeze([]),checkedAt:'2026-08-26T00:00:00.000Z'}
    expect(registerPromotedCapabilityV1(registry,y.product,fakeQa,{schemaVersion:'sanverse.promotion-registration-confirmation/v1',id:'confirm:1',candidateId:y.candidate.id,candidateRevision:y.candidate.revision,authority:'owner',confirmedAt:'2026-08-26T00:00:00.000Z'},{posterRef:'frame://p',reviewRef:'review://r'})).toMatchObject({ok:false,refusal:{code:'PROMOTION_RIGHTS_RESTRICTED'}})
    expect(registry.entries).toHaveLength(0)
  })

  it('registers atomically only after QA + explicit promotion confirmation + review artifacts, preserving generated origin and immutable lineage',()=>{
    const x=built();const qa=runPromotionQaV1({source:x.source,capability:x.product,defaultInstance:x.instance.scene,replacementInstance:x.instance.scene,durationTicks:1_440_000,ticksPerSecond:1_440_000,composition:{width:1920,height:1080,fpsNumerator:30,fpsDenominator:1},sampleTicks:[0,720_000]});expect(qa.ok).toBe(true)
    const registry=createPromotionRegistryV1();const confirmation={schemaVersion:'sanverse.promotion-registration-confirmation/v1' as const,id:'confirm:1',candidateId:x.candidate.id,candidateRevision:x.candidate.revision,authority:'owner' as const,confirmedAt:'2026-08-26T00:00:00.000Z'}
    expect(registerPromotedCapabilityV1(registry,x.product,qa,confirmation,{posterRef:'',reviewRef:'review://r'})).toMatchObject({ok:false,refusal:{code:'PROMOTION_REVIEW_ARTIFACT_REQUIRED'}});expect(registry.entries).toHaveLength(0)
    const registered=registerPromotedCapabilityV1(registry,x.product,qa,confirmation,{posterRef:'frame://p',reviewRef:'review://r'});expect(registered).toMatchObject({ok:true,value:{registry:{revision:2},entry:{origin:'generated',reuseStatus:'promoted-reusable',version:1}}})
    if(!registered.ok)throw new Error('register')
    expect(registered.value.registry.entries[0]?.lineage.sourceProjectId).toBe('project:a')
    expect(validatePromotedCapabilityLineageV1(registered.value.entry.lineage)).toMatchObject({ok:true})
    const json=serializePromotedCapabilityLineageV1(registered.value.entry.lineage);expect(parsePromotedCapabilityLineageV1(json)).toEqual({ok:true,value:registered.value.entry.lineage})
    expect(parsePromotedCapabilityLineageV1(JSON.stringify({...registered.value.entry.lineage,schemaVersion:'sanverse.promoted-capability-lineage/v2'}))).toMatchObject({ok:false,refusal:{code:'UNSUPPORTED_PROMOTION_LINEAGE_VERSION'}})
    const oldLineage=JSON.stringify(registered.value.entry.lineage)
    const v2={...x.product,version:2,lineage:{...x.product.lineage,promotionRevision:2}} as never
    const second=registerPromotedCapabilityV1(registered.value.registry,v2,qa,{...confirmation,id:'confirm:2',candidateRevision:2},{posterRef:'frame://p2',reviewRef:'review://r2'});expect(second).toMatchObject({ok:true})
    expect(JSON.stringify(registered.value.registry.entries[0]?.lineage)).toBe(oldLineage)
  })
})
