import { expect, it } from 'vitest'
import { acceptChangeSet } from '@sanverse/edit-domain'
import { changeSetOf, testProject, testSetTimeTransform } from '@sanverse/edit-domain/test-fixtures'
import { buildTimelineViewModel } from '../timeline/timeline-view-model'
import { derivedMediaClipFor } from './timeline-item-clip'
import { clipDerivedMedia } from './timeline-derived-media'
import { FILMSTRIP_GRID_TICKS } from './media-analysis-key'

it('preserves source span and direction from accepted edit through picture and dialogue decorations', () => {
  const base = testProject()
  const changed = acceptChangeSet(base, changeSetOf('changeset_decoration', base.revision, [testSetTimeTransform({ direction: 'reverse' })]))
  if (!changed.ok) throw new Error(JSON.stringify(changed.error))
  const model = buildTimelineViewModel({ project: changed.value, selectedItemIds: [], pending: null })
  const asset = base.assets[0]
  if (!asset.duration) throw new Error('test source duration missing')
  const facts = { [asset.assetId]: { mediaKind: 'video' as const, hasAudio: true, assetVersion: 'a'.repeat(16) } }
  for (const lane of model.lanes.filter(lane => lane.kind === 'video' || lane.kind === 'dialogue')) {
    const item = lane.items.find(item => item.kind === 'clip')!
    const clip = derivedMediaClipFor(item, lane.kind, facts)!
    expect(clip).toMatchObject({ sourceDurationTicks: asset.duration.ticks, sourceDirection: 'reverse' })
    const media = clipDerivedMedia({ clip, timescale: base.timescale, pixelsPerSecond: 100, density: 'full' })
    if (lane.kind === 'dialogue') expect(media).toMatchObject({ kind: 'waveform', toTicks: asset.duration.ticks, sourceDirection: 'reverse' })
    else {
      if (media.kind !== 'filmstrip') throw new Error('expected filmstrip')
      expect(media.cells[0].key.sourceTicks).toBe(asset.duration.ticks - FILMSTRIP_GRID_TICKS)
    }
  }
})
