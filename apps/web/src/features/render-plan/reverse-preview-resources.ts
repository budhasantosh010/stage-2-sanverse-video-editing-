import { assetVersionFromSha256, type MediaAnalysisClient, type ReversePreviewRequestV1 } from '../media-analysis'
import { sourceSpanOf, type PlaybackSegment } from './segment-playback'

export type ReversePreviewTarget = Readonly<{ key: string; segmentIndex: number; preparedAssetId: string; request: ReversePreviewRequestV1 }>
export type ReverseResourceState = Readonly<{ status: 'idle' | 'preparing' }> | Readonly<{ status: 'ready'; url: string }> | Readonly<{ status: 'error'; message: string }>
type Options = Readonly<{ request?: MediaAnalysisClient['reversePreview']; createUrl?: (blob: Blob) => string; revokeUrl?: (url: string) => void; onChange?: () => void; capacity?: number }>
export function reversePreviewTargets(segments: readonly PlaybackSegment[], assets: readonly Readonly<{ assetId: string; sha256: string }>[], ticks: number): readonly ReversePreviewTarget[] {
  return segments.flatMap((segment, segmentIndex) => {
    if (!segment.reversed || (!segment.videoEnabled && !segment.audioEnabled) ||
      ticks < segment.startTicks || ticks >= segment.startTicks + segment.durationTicks) return []
    const asset = assets.find(candidate => candidate.assetId === segment.assetId)
    if (!asset) return []
    const assetVersion = assetVersionFromSha256(asset.sha256)
    if (!assetVersion) return []
    const request = { assetId: segment.assetId, assetVersion, sourceStartTicks: segment.sourceStartTicks,
      sourceEndTicks: segment.sourceStartTicks + sourceSpanOf(segment) }
    // Array position and composition position are not source-resource identity.
    const key = JSON.stringify([segment.nodeId ?? segment.assetId, request.assetId, assetVersion, request.sourceStartTicks, request.sourceEndTicks])
    return [{ key, segmentIndex, preparedAssetId: `reverse-preview:${key}`, request }]
  })
}

const IDLE: ReverseResourceState = Object.freeze({ status: 'idle' })
type Entry = { controller: AbortController; state: ReverseResourceState }

/** Owns only disposable media resources, never the project, history or playhead. */
export function createReversePreviewResources(options: Options) {
  const entries = new Map<string, Entry>()
  const capacity = options.capacity ?? 8
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Invalid reverse preview capacity.')
  let projectId: string | null = null
  const createUrl = options.createUrl ?? (typeof URL.createObjectURL === 'function' ? URL.createObjectURL.bind(URL) : undefined)
  const revokeUrl = options.revokeUrl ?? ((url: string) => URL.revokeObjectURL(url))
  function release(key: string, entry: Entry) {
    entries.delete(key)
    entry.controller.abort()
    if (entry.state.status === 'ready') revokeUrl(entry.state.url)
  }
  return {
    update(nextProjectId: string, targets: readonly ReversePreviewTarget[]) {
      if (targets.length > capacity) throw new Error(`Reverse preview capacity is ${capacity} simultaneous clips.`)
      const keys = new Set(targets.map(target => target.key))
      if (keys.size !== targets.length) throw new Error('Duplicate reverse preview resource identity.')
      for (const [key, entry] of entries) {
        if (projectId !== nextProjectId || !keys.has(key)) release(key, entry)
      }
      projectId = nextProjectId
      for (const target of targets) {
        if (entries.has(target.key)) continue
        const entry: Entry = { controller: new AbortController(), state: { status: 'preparing' } }
        entries.set(target.key, entry)
        const request = options.request
        if (!request || !createUrl) {
          entry.state = { status: 'error', message: 'Backwards preview is unavailable in this browser.' }
          continue
        }
        const current = () => entries.get(target.key) === entry && !entry.controller.signal.aborted
        const failed = (error: unknown) => {
          if (!current()) return
          entry.state = { status: 'error', message: error instanceof Error ? error.message : 'Backwards preview could not be prepared.' }
          options.onChange?.()
        }
        try {
          void request(nextProjectId, target.request, entry.controller.signal).then(blob => {
            if (!current()) return
            entry.state = { status: 'ready', url: createUrl(blob) }
            options.onChange?.()
          }).catch(failed)
        } catch (error) { failed(error) }
      }
      options.onChange?.()
    },
    get(key: string): ReverseResourceState { return entries.get(key)?.state ?? IDLE },
    dispose() {
      for (const [key, entry] of entries) release(key, entry)
      projectId = null
    },
  }
}
