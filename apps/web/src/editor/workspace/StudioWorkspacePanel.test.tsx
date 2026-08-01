import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_VISUAL_PROPERTIES } from '@sanverse/edit-domain'

import type { SharedVisualDraftController } from '../canvas'
import type { InspectorSelection } from '../inspector'
import { StudioWorkspacePanel } from './StudioWorkspacePanel'

afterEach(cleanup)

const controller = (update = vi.fn(), reset = vi.fn()): SharedVisualDraftController => ({
  draft: {
    selectionKey: 'timeline:title',
    projectRevision: 0,
    authoritative: DEFAULT_VISUAL_PROPERTIES,
    value: DEFAULT_VISUAL_PROPERTIES,
    dirty: false,
    interaction: null,
    notice: null,
  },
  update,
  reset,
  beginInteraction: vi.fn(() => true),
  endInteraction: vi.fn(),
  reportNotice: vi.fn(),
  markApplied: vi.fn(),
})

const titleSelection = {
  kind: 'title',
  label: 'Launch title',
  durationTicks: 1_440_000,
} as InspectorSelection
const videoSelection = {
  kind: 'video',
  label: 'owner.mp4',
  durationTicks: 14_400_000,
  assetLabel: 'owner.mp4',
} as InspectorSelection
const musicSelection = {
  kind: 'music',
  label: 'bed.wav',
  durationTicks: 7_200_000,
  assetLabel: 'bed.wav',
} as InspectorSelection

describe('StudioWorkspacePanel', () => {
  it('lists only current real Effects capabilities and edits the shared visual draft locally', async () => {
    const user = userEvent.setup()
    const update = vi.fn()
    render(<StudioWorkspacePanel workspace="effects" selection={titleSelection} visualDraftController={controller(update)} />)

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Blur', 'Brightness', 'Contrast', 'Saturation', 'Grayscale',
      'Rectangle mask', 'Ellipse mask', 'Fade', 'Slide', 'Zoom transition',
    ])
    expect(screen.queryByText(/marketplace|glow|particle/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Blur' }))
    expect(update).toHaveBeenCalledOnce()
    expect(update.mock.calls[0][0].effects).toEqual([{ kind: 'blur', amount: 0.04 }])
  })

  it('is truthful about unsupported primary-video Color instead of faking grading controls', () => {
    render(<StudioWorkspacePanel workspace="color" selection={videoSelection} visualDraftController={{ ...controller(), draft: null }} />)
    expect(screen.getByText('Primary-video color controls are coming in the Creator Color milestone.')).toBeInTheDocument()
    expect(screen.getByText(/Scopes, LUTs, curves, HSL and color wheels are not implemented/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows current A2 audio context and explicitly excludes future mixer features', () => {
    render(<StudioWorkspacePanel workspace="audio" selection={musicSelection} visualDraftController={{ ...controller(), draft: null }} />)
    expect(screen.getAllByText('bed.wav')).toHaveLength(2)
    expect(screen.getByText(/Use Audio controls in the Tool dock for gain, fades and enabled state/i)).toBeInTheDocument()
    expect(screen.getByText(/Waveforms, EQ, compression, mixing and noise cleanup are not part of this milestone/i)).toBeInTheDocument()
  })

  it('shows one truthful unsupported Effects state', () => {
    render(<StudioWorkspacePanel workspace="effects" selection={videoSelection} visualDraftController={{ ...controller(), draft: null }} />)
    expect(screen.getByText('This item does not support visual effects yet.')).toBeInTheDocument()
  })
})
