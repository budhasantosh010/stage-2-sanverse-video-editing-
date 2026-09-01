import { useEffect, useMemo, useState } from 'react'
import { CreativeSceneSurface, loadCreativeSceneArtifact, type CreativeSceneLoadState } from './CreativeSceneSurface'

declare global {
  interface Window { __sanverseSetCreativeTick?: (tick: number) => boolean }
}

const parameter = (params: URLSearchParams, name: string): string => params.get(name)?.trim() ?? ''
const SOURCE_TREATMENTS = new Set(['normal','dim','blur','reframe','mask','subject-only','hidden'])
const sourceFilter = (treatment: string): string => treatment === 'dim' ? 'brightness(.55)' : treatment === 'blur' ? 'blur(12px)' : 'none'
const REVIEW_SOURCE_FRAME_MAX_WIDTH = 640
export const creativeReviewSourceFrameUrlV1 = (input: Readonly<{ projectId:string; assetId:string; assetVersion:string; sourceStartTick:number; localTick:number; width:number }>): string => {
  const sourceTicks = input.sourceStartTick + input.localTick
  const width = Math.max(16, Math.min(REVIEW_SOURCE_FRAME_MAX_WIDTH, Math.floor(input.width)))
  return `/api/projects/${encodeURIComponent(input.projectId)}/media-analysis/frame?assetId=${encodeURIComponent(input.assetId)}&assetVersion=${encodeURIComponent(input.assetVersion)}&sourceTicks=${sourceTicks}&width=${width}`
}

export function CreativeSceneRenderPage() {
  const request = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    const tickText = parameter(params, 'tick')
    const surfaceText = parameter(params, 'surface')
    const sourceStartTickText = parameter(params, 'sourceStartTick')
    return Object.freeze({
      projectId: parameter(params, 'projectId'),
      artifactId: parameter(params, 'artifactId'),
      sha256: parameter(params, 'sha256'),
      tick: /^\d+$/u.test(tickText) ? Number(tickText) : Number.NaN,
      surface: surfaceText === 'preview' ? 'preview' as const : 'export' as const,
      sourceVisible: parameter(params, 'sourceVisible') === '1',
      sourceAssetId: parameter(params, 'sourceAssetId'),
      sourceAssetVersion: parameter(params, 'sourceAssetVersion'),
      sourceStartTick: /^\d+$/u.test(sourceStartTickText) ? Number(sourceStartTickText) : Number.NaN,
      sourceTreatment: parameter(params, 'sourceTreatment') || 'normal',
    })
  }, [])
  const [state, setState] = useState<CreativeSceneLoadState>({ status: 'loading' })
  const [renderTick, setRenderTick] = useState(request.tick)
  const [sourceLoadedTick, setSourceLoadedTick] = useState<number | null>(null)
  const [sourceError, setSourceError] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.margin = '0'
    document.body.style.overflow = 'hidden'
    document.body.style.background = 'transparent'
  }, [])

  useEffect(() => {
    const sourceValid = !request.sourceVisible || (
      /^asset_[a-z0-9]{8,128}$/u.test(request.sourceAssetId) &&
      /^[a-f0-9]{16}$/u.test(request.sourceAssetVersion) &&
      Number.isSafeInteger(request.sourceStartTick) && request.sourceStartTick >= 0 &&
      SOURCE_TREATMENTS.has(request.sourceTreatment) && request.sourceTreatment !== 'hidden'
    )
    if (!/^project_[a-z0-9]{16,64}$/u.test(request.projectId) || !/^creativeart_[a-f0-9]{64}$/u.test(request.artifactId) || !/^[a-f0-9]{64}$/u.test(request.sha256) || !Number.isSafeInteger(request.tick) || request.tick < 0 || !sourceValid) {
      setState({ status: 'error', message: 'Creative frame request is invalid.' })
      return
    }
    const controller = new AbortController()
    loadCreativeSceneArtifact({ projectId: request.projectId, artifactId: request.artifactId, expectedSha256: request.sha256, signal: controller.signal })
      .then((artifact) => { if (!controller.signal.aborted) setState({ status: 'ready', artifact }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setState({ status: 'error', message: error instanceof Error ? error.message : 'Creative frame could not be loaded.' }) })
    return () => controller.abort()
  }, [request])

  useEffect(() => {
    window.__sanverseSetCreativeTick = (tick: number) => {
      if (!Number.isSafeInteger(tick) || tick < 0 || state.status !== 'ready' || tick > state.artifact.source.durationTicks) return false
      setRenderTick(tick)
      return true
    }
    return () => { delete window.__sanverseSetCreativeTick }
  }, [state])

  const sourceFrameTick = request.sourceVisible ? request.sourceStartTick + renderTick : null
  useEffect(() => {
    setSourceLoadedTick(null)
    setSourceError(null)
  }, [sourceFrameTick])

  if (state.status === 'error') return <main data-creative-frame-error="true" style={{ color: '#fff', background: '#400', padding: 16 }}>{state.message}</main>
  if (state.status === 'loading') return <main data-creative-frame-loading="true" />
  if (sourceError) return <main data-creative-frame-error="true" style={{ color: '#fff', background: '#400', padding: 16 }}>{sourceError}</main>

  const sourceReady = sourceFrameTick === null || sourceLoadedTick === sourceFrameTick
  const sourceUrl = sourceFrameTick === null ? null : creativeReviewSourceFrameUrlV1({ projectId:request.projectId, assetId:request.sourceAssetId, assetVersion:request.sourceAssetVersion, sourceStartTick:request.sourceStartTick, localTick:renderTick, width:state.artifact.source.width })
  return (
    <main
      data-creative-frame-ready={sourceReady ? 'true' : undefined}
      data-creative-frame-artifact={request.artifactId}
      data-creative-frame-tick={renderTick}
      data-creative-source-frame-tick={sourceFrameTick ?? undefined}
      style={{ width: state.artifact.source.width, height: state.artifact.source.height, position: 'relative', overflow: 'hidden', background: 'transparent' }}
    >
      {sourceUrl ? <img
        key={sourceFrameTick ?? 0}
        data-creative-source-frame="true"
        src={sourceUrl}
        alt=""
        onLoad={() => setSourceLoadedTick(sourceFrameTick)}
        onError={() => setSourceError(`Exact source frame ${sourceFrameTick} could not be loaded for Creative review.`)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: sourceFilter(request.sourceTreatment), transform: request.sourceTreatment === 'blur' ? 'scale(1.03)' : undefined }}
      /> : null}
      <div style={{ position: 'absolute', inset: 0 }}>
        <CreativeSceneSurface artifact={state.artifact} localTicks={renderTick} surface={request.surface} />
      </div>
    </main>
  )
}
