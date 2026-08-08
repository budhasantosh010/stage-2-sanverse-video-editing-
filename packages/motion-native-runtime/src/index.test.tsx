import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MotionCompositionFrame, MotionSafeArea } from './index.tsx'
const composition={width:1920,height:1080,fpsNumerator:30,fpsDenominator:1} as const

describe('native runtime',()=>{
  it('keeps composition dimensions authoritative while scaling only display',()=>{ const markup=renderToStaticMarkup(<MotionCompositionFrame composition={composition} displayScale={0.5}><span>hello</span></MotionCompositionFrame>); expect(markup).toContain('width:960px'); expect(markup).toContain('height:540px'); expect(markup).toContain('width:1920px'); expect(markup).toContain('height:1080px'); expect(markup).toContain('scale(0.5)') })
  it('derives safe area from composition dimensions',()=>{ const markup=renderToStaticMarkup(<MotionSafeArea composition={composition} insetRatio={0.1}/>); expect(markup).toContain('left:192px'); expect(markup).toContain('top:108px') })
})
