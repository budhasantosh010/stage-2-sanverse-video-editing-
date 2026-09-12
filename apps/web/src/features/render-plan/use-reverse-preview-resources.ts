import { useEffect, useMemo, useReducer, useState } from 'react'
import type { MediaAnalysisClient } from '../media-analysis'
import { withPreparedReversePreview, type PlaybackSegment } from './segment-playback'
import { createReversePreviewResources, reversePreviewTargets } from './reverse-preview-resources'

export function useReversePreviewResources(projectId: string, segments: readonly PlaybackSegment[], assets: readonly Readonly<{ assetId: string; sha256: string }>[], ticks: number, request: MediaAnalysisClient['reversePreview']) {
  const [version, refresh] = useReducer((value: number) => value + 1, 0)
  const [capacityError, setCapacityError] = useState<string | null>(null)
  const pool = useMemo(() => createReversePreviewResources({ ...(request ? { request } : {}), onChange: refresh }), [projectId, request])
  const targets = useMemo(() => reversePreviewTargets(segments, assets, ticks), [segments, assets, ticks])
  const resourceKeys = JSON.stringify(targets.map(target => target.key).sort())
  // Requests depend on source identity, not every playhead tick or clip order.
  const requestedTargets = useMemo(() => targets, [resourceKeys])
  useEffect(() => {
    try { pool.update(projectId, requestedTargets); setCapacityError(null) }
    catch (error) { setCapacityError(error instanceof Error ? error.message : 'Backwards preview capacity exceeded.') }
  }, [pool, projectId, requestedTargets])
  useEffect(() => () => pool.dispose(), [pool])
  return useMemo(() => {
    const prepared: { segmentIndex: number; preparedAssetId: string }[] = []
    const urls = new Map<string, string>()
    const errors = new Map<string, string>()
    for (const target of targets) {
      const state = pool.get(target.key)
      if (state.status === 'ready') {
        prepared.push({ segmentIndex: target.segmentIndex, preparedAssetId: target.preparedAssetId })
        urls.set(target.preparedAssetId, state.url)
      } else if (state.status === 'error') errors.set(target.key, state.message)
    }
    const browserSegments = prepared.reduce<readonly PlaybackSegment[]>((current, resource) => withPreparedReversePreview(current, resource), segments)
    return { targets, prepared, browserSegments, urls, errors, capacityError }
  }, [pool, targets, segments, version, capacityError])
}
