import { describe,expect,it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildPromotionReviewModel,PromotionReviewLab } from './PromotionReviewLab.tsx'

describe('PromotionReviewLab',()=>{
  it('renders source/default/Project-B reuse, promotion truth, Library detail and deep-editability markers',()=>{
    const model=buildPromotionReviewModel()
    expect(model.qa.ok).toBe(true)
    expect(model.registered).toMatchObject({origin:'generated',reuseStatus:'promoted-reusable'})
    expect(model.parameterization.parameters.length).toBeGreaterThan(0)
    const markup=renderToStaticMarkup(<PromotionReviewLab />)
    expect(markup).toContain('data-promotion-review="true"')
    expect(markup).toContain('data-promotion-preview="source"')
    expect(markup).toContain('data-promotion-preview="promoted-default"')
    expect(markup).toContain('data-promotion-preview="project-b"')
    expect(markup).toContain('data-origin="generated"')
    expect(markup).toContain('data-reuse-status="promoted-reusable"')
    expect(markup).toContain('data-default-parity="true"')
    expect(markup).toContain('data-library-promoted-detail="true"')
    expect(markup).toContain('C3 Layers · C4 Timeline · C5 Curves · C6 Nodes')
    expect(markup).toContain('cost-card.value')
  })
})
