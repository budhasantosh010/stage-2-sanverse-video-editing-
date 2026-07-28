import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CAPTION_STYLE_BOXED,
  CAPTION_STYLE_PLAIN_ID,
  captionLineTop,
  resolveCaptionMetrics,
} from '@sanverse/render-contract/caption-style'
import type { CaptionOverlayNode } from '@sanverse/render-contract'

import { CaptionOverlay } from './CaptionOverlay'
import { captionCssVariables } from '../render-plan/render-plan-preview'

const node = (overrides: Partial<CaptionOverlayNode> = {}): CaptionOverlayNode => ({
  nodeId: 'captions_aaaaaaaa.cue_0001',
  kind: 'caption-overlay',
  interval: {
    start: { ticks: 1_440_000, timescale: 1_440_000 },
    duration: { ticks: 1_440_000, timescale: 1_440_000 },
  },
  lines: ['hello there'],
  styleId: CAPTION_STYLE_BOXED.styleId,
  ...overrides,
})

afterEach(cleanup)

describe('CaptionOverlay', () => {
  it('draws the line it is given', () => {
    render(<CaptionOverlay node={node()} compositionWidth={1920} compositionHeight={1080} scale={1} />)
    expect(screen.getByTestId('caption-overlay')).toHaveTextContent('hello there')
  })

  it('draws one box per line, exactly as the exporter does', () => {
    const { container } = render(
      <CaptionOverlay
        node={node({ lines: ['first line', 'second line'] })}
        compositionWidth={1920}
        compositionHeight={1080}
        scale={1}
      />,
    )
    expect(container.querySelectorAll('.caption-overlay__line')).toHaveLength(2)
  })

  it('puts each line where the shared contract says the exporter will', () => {
    const metrics = resolveCaptionMetrics(1920, 1080, CAPTION_STYLE_BOXED)
    const { container } = render(
      <CaptionOverlay
        node={node({ lines: ['one', 'two'] })}
        compositionWidth={1920}
        compositionHeight={1080}
        scale={1}
      />,
    )
    const lines = container.querySelectorAll<HTMLElement>('.caption-overlay__line')
    expect(lines[0].style.top).toBe(`${captionLineTop(0, 2, 1080, metrics)}px`)
    expect(lines[1].style.top).toBe(`${captionLineTop(1, 2, 1080, metrics)}px`)
  })

  it('scales with the video, not with the browser window', () => {
    const metrics = resolveCaptionMetrics(1920, 1080, CAPTION_STYLE_BOXED)
    const half = render(
      <CaptionOverlay node={node()} compositionWidth={1920} compositionHeight={1080} scale={0.5} />,
    )
    const line = half.container.querySelector<HTMLElement>('.caption-overlay__line')
    expect(line?.style.top).toBe(`${captionLineTop(0, 1, 1080, metrics) * 0.5}px`)
  })

  it('draws nothing before the video has been measured', () => {
    const { container } = render(
      <CaptionOverlay node={node()} compositionWidth={1920} compositionHeight={1080} scale={0} />,
    )
    expect(container.querySelector('.caption-overlay')).toBeNull()
  })

  it('never re-wraps: the lines it is handed are the lines it draws', () => {
    // The break was decided once, deterministically, in the domain. A preview
    // that wrapped on its own would show a different number of lines from the
    // exported file.
    const long = 'a very long caption line that a browser would happily wrap on its own if allowed to'
    const { container } = render(
      <CaptionOverlay node={node({ lines: [long] })} compositionWidth={1920} compositionHeight={1080} scale={1} />,
    )
    const lines = container.querySelectorAll('.caption-overlay__line')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toHaveTextContent(long)
  })
})

describe('captionCssVariables', () => {
  it('takes every value from the shared style, scaled to the display', () => {
    const metrics = resolveCaptionMetrics(1920, 1080, CAPTION_STYLE_BOXED)
    const variables = captionCssVariables(CAPTION_STYLE_BOXED.styleId, 1920, 1080, 0.5)
    expect(variables['--caption-size']).toBe(`${metrics.fontSize * 0.5}px`)
    expect(variables['--caption-padding']).toBe(`${metrics.padding * 0.5}px`)
    expect(variables['--caption-bottom']).toBe(`${metrics.bottomMargin * 0.5}px`)
  })

  it('gives the boxed look a plate and the plain look an outline', () => {
    const boxed = captionCssVariables(CAPTION_STYLE_BOXED.styleId, 1920, 1080, 1)
    expect(boxed['--caption-background']).not.toBe('transparent')
    expect(boxed['--caption-outline']).toBe('none')

    const plain = captionCssVariables(CAPTION_STYLE_PLAIN_ID, 1920, 1080, 1)
    expect(plain['--caption-background']).toBe('transparent')
    expect(plain['--caption-outline']).not.toBe('none')
  })

  it('falls back to the safe look rather than refusing to draw', () => {
    const unknown = captionCssVariables('sanverse.caption.neon/v9', 1920, 1080, 1)
    expect(unknown['--caption-background']).not.toBe('transparent')
  })
})
