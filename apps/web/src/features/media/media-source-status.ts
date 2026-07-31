import type { MediaStatus } from './media-contract'

export type MediaSourceProbe = (url: string) => Promise<MediaStatus>

export const probeMediaSourceStatus = async (
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<MediaStatus> => {
  const controller = new AbortController()
  try {
    const response = await fetcher(url, {
      method: 'GET',
      headers: { range: 'bytes=0-0' },
      signal: controller.signal,
    })
    controller.abort()
    if (response.ok) return 'available'
    if (response.status === 415) return 'unsupported'
    return 'missing'
  } catch {
    return controller.signal.aborted ? 'available' : 'missing'
  }
}

export const probeMediaAssetStatuses = async (
  sources: readonly Readonly<{ assetId: string; url: string }>[],
  probe: MediaSourceProbe,
  concurrency = 4,
): Promise<Readonly<Record<string, MediaStatus>>> => {
  const statuses: Record<string, MediaStatus> = {}
  let nextIndex = 0
  const workerCount = Math.max(1, Math.min(Math.floor(concurrency), sources.length || 1))
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < sources.length) {
      const index = nextIndex
      nextIndex += 1
      const source = sources[index]
      statuses[source.assetId] = await probe(source.url)
    }
  })
  await Promise.all(workers)
  return Object.freeze(statuses)
}
