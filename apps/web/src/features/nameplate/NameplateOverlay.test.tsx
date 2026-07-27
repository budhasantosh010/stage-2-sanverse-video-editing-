import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { resolveNameplateMetrics, resolveNameplatePlacement } from '@sanverse/render-contract/nameplate-style'

import { NameplateOverlay } from './NameplateOverlay'
import { compilePreviewPlan, isNodeVisible, millisecondsToTicks } from '../render-plan/render-plan-preview'
import { ms, testOperation, testProjectWithNameplate } from '../../test-fixtures'

const plan = () => {
  const compiled = compilePreviewPlan(testProjectWithNameplate())
  if (!compiled) throw new Error('fixture failed')
  return compiled
}

afterEach(cleanup)

describe('NameplateOverlay', () => {
  it('renders both lines of the node it is given', () => {
    render(
      <NameplateOverlay node={plan().nodes[0]} compositionWidth={1920} compositionHeight={1080} scale={1} />,
    )

    const overlay = screen.getByTestId('nameplate-overlay')
    expect(overlay).toHaveTextContent('Santosh')
    expect(overlay).toHaveTextContent('Founder')
  })

  it('omits the optional line when it is empty', () => {
    const compiled = compilePreviewPlan(testProjectWithNameplate('changeset_aaaaaaaa', { secondaryText: '' }))
    if (!compiled) throw new Error('fixture failed')

    render(
      <NameplateOverlay node={compiled.nodes[0]} compositionWidth={1920} compositionHeight={1080} scale={1} />,
    )

    expect(screen.getByText('Santosh')).toBeInTheDocument()
    expect(screen.queryByText('Founder')).not.toBeInTheDocument()
  })

  it('stays hidden until it has measured itself, so it is never seen in the wrong place', () => {
    const { container } = render(
      <NameplateOverlay node={plan().nodes[0]} compositionWidth={1920} compositionHeight={1080} scale={0} />,
    )

    expect(container.querySelector('.nameplate-overlay__primary')).toHaveStyle({ visibility: 'hidden' })
  })

  it('draws one box per line, exactly as the exporter does', () => {
    // FFmpeg's drawtext draws a box per line. One box wrapped around both lines
    // would look tidier in the preview and would not match the exported video.
    const { container } = render(
      <NameplateOverlay node={plan().nodes[0]} compositionWidth={1920} compositionHeight={1080} scale={1} />,
    )

    expect(container.querySelectorAll('.nameplate-overlay__primary')).toHaveLength(1)
    expect(container.querySelectorAll('.nameplate-overlay__secondary')).toHaveLength(1)
  })
})

describe('when a nameplate is on screen', () => {
  it('includes its start instant and excludes its end instant', () => {
    // Half-open, identical to the exporter's enable expression. Back-to-back
    // nameplates therefore never overlap by a frame or leave a frame's gap.
    const node = plan().nodes[0]
    expect(isNodeVisible(node, millisecondsToTicks(1_000))).toBe(true)
    expect(isNodeVisible(node, millisecondsToTicks(999))).toBe(false)
    expect(isNodeVisible(node, millisecondsToTicks(5_999))).toBe(true)
    expect(isNodeVisible(node, millisecondsToTicks(6_000))).toBe(false)
  })

  it('measures visibility in exact ticks rather than rounded milliseconds', () => {
    const node = plan().nodes[0]
    expect(node.interval.start).toEqual(ms(1_000))
    expect(node.interval.duration).toEqual(ms(5_000))
  })
})

describe('placement follows the shared rule the exporter uses', () => {
  it('centres the box on the point the user chose', () => {
    const metrics = resolveNameplateMetrics(1920, 1080)
    const placement = resolveNameplatePlacement({
      pointX: 0.5,
      pointY: 0.5,
      anchor: 'center',
      frameWidth: 1920,
      frameHeight: 1080,
      boxWidth: 200,
      boxHeight: 60,
      safeMargin: metrics.safeMargin,
    })

    expect(placement).toEqual({ x: 860, y: 510 })
  })

  it('keeps a nameplate clicked at the very edge inside the safe area', () => {
    const metrics = resolveNameplateMetrics(1920, 1080)
    const operation = testOperation({
      target: { coordinateSpace: 'composition-normalized', point: { x: 1, y: 1 }, anchor: 'center' },
    })
    const placement = resolveNameplatePlacement({
      pointX: operation.target.point.x,
      pointY: operation.target.point.y,
      anchor: operation.target.anchor,
      frameWidth: 1920,
      frameHeight: 1080,
      boxWidth: 200,
      boxHeight: 60,
      safeMargin: metrics.safeMargin,
    })

    expect(placement.x + 200).toBeLessThanOrEqual(1920 - metrics.safeMargin)
    expect(placement.y + 60).toBeLessThanOrEqual(1080 - metrics.safeMargin)
  })
})
