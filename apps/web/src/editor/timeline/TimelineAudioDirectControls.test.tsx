import type { ComponentProps } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const dispatchPointer = (
  target: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  values: Readonly<Record<string, number | boolean>>,
) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(event, key, { configurable: true, value })
  }
  fireEvent(target, event)
}
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TimelineAudioDirectControls, type TimelineAudioState } from './TimelineAudioDirectControls'

const accepted: TimelineAudioState = Object.freeze({
  gainDb: -6,
  fadeInTicks: 1_000,
  fadeOutTicks: 2_000,
  pan: 2_500,
})

const normalization = Object.freeze({
  projectId: 'project_audio0001',
  request: Object.freeze({
    assetId: 'asset_audio0001',
    assetVersion: 'a'.repeat(16),
    sourceStartTicks: 0,
    sourceEndTicks: 14_400_000,
  }),
})

const evidence = Object.freeze({
  schemaVersion: 'sanverse.audio-normalization-evidence/v1',
  assetId: normalization.request.assetId,
  assetVersion: normalization.request.assetVersion,
  sourceStartTicks: normalization.request.sourceStartTicks,
  sourceEndTicks: normalization.request.sourceEndTicks,
  analysisVersion: 'ffmpeg-loudnorm-v1',
  integratedLufs: -23.2,
  loudnessRangeLufs: 4.1,
  truePeakDb: -7.5,
  recommendedGainDb: 6.5,
  targetIntegratedLufs: -16,
  targetTruePeakDb: -1,
})

const renderControls = (overrides: Partial<ComponentProps<typeof TimelineAudioDirectControls>> = {}) => {
  const onCommit = vi.fn()
  const view = render(
    <TimelineAudioDirectControls
      accepted={accepted}
      durationTicks={14_400_000}
      disabled={false}
      muted={false}
      supportsPan
      normalization={normalization}
      onCommit={onCommit}
      {...overrides}
    />,
  )
  const root = screen.getByTestId('timeline-audio-direct-controls')
  Object.defineProperty(root, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 100, width: 400, height: 100, toJSON: () => ({}) }),
  })
  for (const button of root.querySelectorAll('button')) {
    Object.defineProperty(button, 'setPointerCapture', { value: vi.fn(), configurable: true })
    Object.defineProperty(button, 'releasePointerCapture', { value: vi.fn(), configurable: true })
    Object.defineProperty(button, 'hasPointerCapture', { value: vi.fn(() => true), configurable: true })
  }
  return { ...view, root, onCommit }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TimelineAudioDirectControls', () => {
  it('keeps pointer movement detached and commits the whole audio state once on release', () => {
    const { onCommit } = renderControls({ normalization: null })
    const gain = screen.getByRole('slider', { name: 'Clip gain' })
    dispatchPointer(gain, 'pointerdown', { pointerId: 1, button: 0, clientY: 60 })
    dispatchPointer(gain, 'pointermove', { pointerId: 1, clientY: 10 })
    expect(onCommit).not.toHaveBeenCalled()
    dispatchPointer(gain, 'pointerup', { pointerId: 1, clientY: 10 })
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit.mock.calls[0][0]).toMatchObject({
      fadeInTicks: accepted.fadeInTicks,
      fadeOutTicks: accepted.fadeOutTicks,
      pan: accepted.pan,
    })
  })

  it('Escape and pointer cancellation restore accepted state without an edit', () => {
    const { onCommit } = renderControls({ normalization: null })
    const gain = screen.getByRole('slider', { name: 'Clip gain' })
    dispatchPointer(gain, 'pointerdown', { pointerId: 2, button: 0 })
    dispatchPointer(gain, 'pointermove', { pointerId: 2, clientY: 10 })
    fireEvent.keyDown(gain, { key: 'Escape' })
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText('-6.0 dB')).toBeInTheDocument()

    dispatchPointer(gain, 'pointerdown', { pointerId: 3, button: 0 })
    dispatchPointer(gain, 'pointermove', { pointerId: 3, clientY: 90 })
    dispatchPointer(gain, 'pointercancel', { pointerId: 3 })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('shows gain and fades for A2 without inventing a pan control', () => {
    renderControls({ supportsPan: false, normalization: null })
    expect(screen.getByRole('slider', { name: 'Clip gain' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fade in duration' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fade out duration' })).toBeInTheDocument()
    expect(screen.queryByRole('slider', { name: 'Clip pan' })).not.toBeInTheDocument()
  })

  it('analyzes without editing, then applies one full-state audio operation only after approval', async () => {
    const fetchMock = vi.fn(async (_input: string, _init: { signal: AbortSignal }) => new Response(JSON.stringify(evidence), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const { onCommit } = renderControls()

    fireEvent.click(screen.getByRole('button', { name: 'Analyze loudness' }))
    expect(onCommit).not.toHaveBeenCalled()
    await screen.findByText(/-23\.2 LUFS/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/media-analysis/normalization?')
    expect(onCommit).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Apply normalization' }))
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(Object.freeze({
      gainDb: 6.5,
      fadeInTicks: accepted.fadeInTicks,
      fadeOutTicks: accepted.fadeOutTicks,
      pan: accepted.pan,
    }))
  })

  it('cancels an in-flight analysis and creates no edit', async () => {
    let observedSignal: AbortSignal | null = null
    vi.stubGlobal('fetch', vi.fn((_input: string, init: { signal: AbortSignal }) => {
      observedSignal = init.signal
      return new Promise<Response>((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      })
    }))
    const { onCommit } = renderControls()
    fireEvent.click(screen.getByRole('button', { name: 'Analyze loudness' }))
    await screen.findByText('Measuring loudness…')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel analysis' }))
    await waitFor(() => expect(observedSignal?.aborted).toBe(true))
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Analyze loudness' })).toBeInTheDocument()
  })
})
