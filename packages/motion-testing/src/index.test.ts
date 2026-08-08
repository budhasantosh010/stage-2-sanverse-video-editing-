import { describe, expect, it } from 'vitest'
import { RATIO_COMPOSITIONS, evaluateDeterminism, findForbiddenAnimationAuthorities, ratioMatrix, validateDefinition } from './index.ts'

describe('motion testing tools',()=>{
  it('detects repeated-tick nondeterminism',()=>{ let counter=0; const report=evaluateDeterminism((tick)=>({tick,counter:counter++}),[0,10,0]); expect(report.ok).toBe(false) })
  it('passes pure repeated-tick state',()=>{ const report=evaluateDeterminism((tick)=>({tick,square:tick*tick}),[0,250,40,250]); expect(report.ok).toBe(true); expect(report.repeatedTicks).toEqual([250]) })
  it('builds four-ratio matrix',()=>{ expect(ratioMatrix((_r,c)=>`${c.width}x${c.height}`)).toEqual({'16:9':'1920x1080','9:16':'1080x1920','1:1':'1080x1080','4:5':'1080x1350'}); expect(RATIO_COMPOSITIONS['9:16'].height).toBe(1920) })
  it('finds forbidden animation authorities',()=>{ expect(findForbiddenAnimationAuthorities('const x = Date.now(); Math.random();')).toEqual(['Date.now','Math.random']); expect(findForbiddenAnimationAuthorities('context.localTicks / context.durationTicks')).toEqual([]) })
  it('validates definition metadata',()=>{ expect(validateDefinition({id:'sanverse.test',version:1,name:'Test',purpose:'test',category:'accent',performanceClass:'light',supportedAspectRatios:['16:9'],minDurationTicks:1,defaultDurationTicks:2,maxDurationTicks:3,events:[{name:'settled',normalizedTime:0.3}],contentLimits:[]})).toEqual([]) })
})
