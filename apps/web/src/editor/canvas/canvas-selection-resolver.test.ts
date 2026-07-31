import { describe, expect, it } from 'vitest'
import { DEFAULT_VISUAL_PROPERTIES } from '@sanverse/edit-domain'
import type { InspectorSelection } from '../inspector'
import { resolveCanvasSelection } from './canvas-selection-resolver'

const base = {
  timelineItemId: 'item_title',
  timelineItemKind: 'title',
  laneKind: 'overlay',
  state: 'committed',
  label: 'Launch title',
  startTicks: 1_440_000,
  durationTicks: 4_320_000,
  projectRevision: 3,
} as const

const title = {
  ...base,
  kind: 'title',
  visualId: 'title_abcd1234',
  visualProperties: DEFAULT_VISUAL_PROPERTIES,
  operation: {
    schemaVersion: 'sanverse.operation/v3', operationId: 'operation_abcd1234', kind: 'add-title',
    capabilityId: 'sanverse.title/v1', assetId: 'asset_aaaaaaaa', titleId: 'title_abcd1234',
    sourceInterval: { start: { ticks: 1_440_000, timescale: 1_440_000 }, duration: { ticks: 4_320_000, timescale: 1_440_000 } },
    headline: 'Launch', subhead: '', placement: 'center', styleId: 'sanverse.title.boxed/v1', extensions: {},
  },
  asset: { assetId: 'asset_aaaaaaaa', mediaKind: 'video', duration: { ticks: 10_000_000, timescale: 1_440_000 }, storageRef: 'asset/source.mp4', sha256: 'a'.repeat(64), extensions: {} },
  assetLabel: 'source.mp4',
} as unknown as InspectorSelection

describe('canvas selection resolver', () => {
  it('resolves a visible Timeline title to the exact canvas node and shared visual ID', () => {
    expect(resolveCanvasSelection(title, new Set(['title_abcd1234']))).toMatchObject({
      kind: 'supported',
      selection: {
        timelineItemId: 'item_title',
        visualId: 'title_abcd1234',
        nodeId: 'title_abcd1234',
        kind: 'title',
        state: 'committed',
      },
    })
  })

  it.each([
    ['callout', 'callout_abcd1234'],
    ['media-overlay', 'broll_abcd1234'],
    ['nameplate', 'operation_abcd1234'],
  ] as const)('resolves %s using its explicit visual identity', (kind, visualId) => {
    const selection = {
      ...title,
      kind,
      visualId,
      operation: kind === 'callout'
        ? { ...((title as any).operation), kind: 'add-callout', calloutId: visualId }
        : kind === 'media-overlay'
          ? { ...((title as any).operation), kind: 'add-media-overlay', overlayId: visualId }
          : { ...((title as any).operation), kind: 'add-nameplate', operationId: visualId },
    } as unknown as InspectorSelection
    const result = resolveCanvasSelection(selection, new Set([visualId]))
    expect(result).toMatchObject({ kind: 'supported', selection: { kind, visualId, nodeId: visualId } })
  })

  it('resolves a caption cue node while keeping the caption-set visual ID', () => {
    const selection = {
      ...title,
      kind: 'caption',
      visualId: 'captions_abcd1234',
      captionSet: { captionSetId: 'captions_abcd1234' },
      cue: { cueId: 'cue_0001' },
    } as unknown as InspectorSelection
    expect(resolveCanvasSelection(selection, new Set(['captions_abcd1234.cue_0001']))).toMatchObject({
      kind: 'supported',
      selection: { kind: 'caption-set', visualId: 'captions_abcd1234', nodeId: 'captions_abcd1234.cue_0001' },
    })
  })

  it('keeps a truthful stale pending proposal detached', () => {
    const proposal = {
      ...base,
      state: 'proposed',
      kind: 'proposal',
      proposalId: 'proposal_1',
      proposalBaseRevision: 2,
      operation: null,
    } as unknown as InspectorSelection
    expect(resolveCanvasSelection(proposal)).toEqual({ kind: 'unsupported', reason: 'This proposal has no canvas geometry.' })
  })

  it.each(['video', 'dialogue', 'music', 'gap'] as const)('shows no fake handles for %s', (kind) => {
    expect(resolveCanvasSelection({ ...base, kind } as unknown as InspectorSelection)).toEqual({
      kind: 'unsupported', reason: 'This item does not have canvas controls yet.',
    })
  })

  it('fails closed outside the selected item visible interval', () => {
    expect(resolveCanvasSelection(title, new Set())).toEqual({
      kind: 'unsupported', reason: 'Move the playhead into this item to use canvas controls.',
    })
  })
})
