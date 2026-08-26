import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ClosedLoopReviewLab } from './ClosedLoopReviewLab.tsx'

describe('ClosedLoopReviewLab', () => {
  it('renders the real graph-native review surface with canonical semantic identity and 1x evidence markers', () => {
    const markup = renderToStaticMarkup(<ClosedLoopReviewLab />)
    expect(markup).toContain('data-closed-loop-review="true"')
    expect(markup).toContain('data-motion-component-id="sanverse.cost-value-card"')
    expect(markup).toContain('data-motion-node-id="cost-card.value"')
    expect(markup).toContain('Canonical 1× Review')
    expect(markup).toContain('C3 Layers · C4 Dope Sheet · C5 Curves · C6 Node Graph · C8 Masks/Mattes')
  })
})
