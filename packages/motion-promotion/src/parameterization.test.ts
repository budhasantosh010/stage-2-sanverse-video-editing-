import { describe,expect,it } from 'vitest'
import { createPromotionCandidateV1 } from './contracts.ts'
import { proposeParameterizationPlanV1,reviewParameterCandidateV1,validateParameterizationPlanV1 } from './parameterization.ts'
import { promotionSource } from './test-fixtures.ts'

const plan=()=>{const candidate=createPromotionCandidateV1(promotionSource(),['scene','motion-recipe'],'candidate:a');if(!candidate.ok)throw new Error('candidate');const result=proposeParameterizationPlanV1(candidate.value,promotionSource().scene,'params:a');if(!result.ok)throw new Error(result.refusal.message);return result.value}

describe('Promotion V1 conservative parameterization',()=>{
  it('extracts visible content, media, semantic accent and meaningful motion intensity while freezing design constants',()=>{
    const value=plan()
    expect(value.schemaVersion).toBe('sanverse.parameterization-plan/v1')
    expect(value.parameters.map(item=>item.proposedPublicPath)).toEqual(expect.arrayContaining(['content.headline','content.metric','content.supporting-label','media.hero-media','style.accent','motion.intensity']))
    expect(value.parameters.find(item=>item.proposedPublicPath==='content.metric')).toMatchObject({valueType:'string',confidence:'high',status:'accepted',sourceBindings:[{nodeId:'metric',propertyPath:'text.text',transform:'identity'}]})
    expect(value.parameters.find(item=>item.proposedPublicPath==='style.accent')).toMatchObject({valueType:'color',confidence:'high',sourceBindings:[{nodeId:'metric',propertyPath:'text.fillColor',transform:'semantic-color-role'}]})
    expect(value.parameters.find(item=>item.proposedPublicPath==='motion.intensity')).toMatchObject({valueType:'number',defaultValue:1,confidence:'medium'})
    expect(value.frozenDesignProperties.length).toBeGreaterThan(0)
    expect(value.frozenDesignProperties.some(binding=>binding.nodeId==='surface'&&binding.propertyPath==='shape.radius')).toBe(true)
    expect(value.parameters.some(item=>item.proposedPublicPath.includes('radius'))).toBe(false)
    expect(validateParameterizationPlanV1(value)).toMatchObject({ok:true})
  })

  it('maps parameters to Creator/Designer/Advanced exposure without exposing internal design numbers',()=>{
    const value=plan()
    expect(value.parameters.find(item=>item.proposedPublicPath==='content.headline')?.exposureLevel).toBe('creator')
    expect(value.parameters.find(item=>item.proposedPublicPath==='style.accent')?.exposureLevel).toBe('designer')
    expect(value.parameters.find(item=>item.proposedPublicPath==='motion.intensity')?.exposureLevel).toBe('advanced')
  })

  it('supports explicit accept/reject/edit review without manufacturing owner approval',()=>{
    const value=plan();const target=value.parameters.find(item=>item.proposedPublicPath==='content.supporting-label')!
    const rejected=reviewParameterCandidateV1(value,target.id,{status:'rejected'});expect(rejected).toMatchObject({ok:true,value:{revision:2}})
    if(!rejected.ok)throw new Error('review')
    expect(rejected.value.parameters.find(item=>item.id===target.id)?.status).toBe('rejected')
    const edited=reviewParameterCandidateV1(rejected.value,target.id,{status:'edited',publicPath:'content.context-label'});expect(edited).toMatchObject({ok:true,value:{revision:3}})
    if(!edited.ok)throw new Error('edit')
    expect(edited.value.parameters.find(item=>item.id===target.id)?.proposedPublicPath).toBe('content.context-label')
  })
})
