import { useEffect, useMemo, useState } from 'react'
import { CreativeSceneSurface, loadCreativeSceneArtifact, type CreativeSceneLoadState } from './CreativeSceneSurface'

declare global {
  interface Window { __sanverseSetCreativeTick?: (tick: number) => boolean }
}

const parameter = (params: URLSearchParams, name: string): string => params.get(name)?.trim() ?? ''

export function CreativeSceneRenderPage() {
  const request = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    const tickText = parameter(params, 'tick')
    const surfaceText = parameter(params, 'surface')
    return Object.freeze({
      projectId: parameter(params, 'projectId'),
      artifactId: parameter(params, 'artifactId'),
      sha256: parameter(params, 'sha256'),
      tick: /^\d+$/u.test(tickText) ? Number(tickText) : Number.NaN,
      surface: surfaceText === 'preview' ? 'preview' as const : 'export' as const,
    })
  }, [])
  const [state, setState] = useState<CreativeSceneLoadState>({ status: 'loading' })
  const [renderTick, setRenderTick] = useState(request.tick)

  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.margin = '0'
    document.body.style.overflow = 'hidden'
    document.body.style.background = 'transparent'
  }, [])

  useEffect(() => {
    if (!/^project_[a-z0-9]{16,64}$/u.test(request.projectId) || !/^creativeart_[a-f0-9]{64}$/u.test(request.artifactId) || !/^[a-f0-9]{64}$/u.test(request.sha256) || !Number.isSafeInteger(request.tick) || request.tick < 0) {
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

  if (state.status === 'error') return <main data-creative-frame-error="true" style={{ color: '#fff', background: '#400', padding: 16 }}>{state.message}</main>
  if (state.status === 'loading') return <main data-creative-frame-loading="true" />
  return (
    <main
      data-creative-frame-ready="true"
      data-creative-frame-artifact={request.artifactId}
      data-creative-frame-tick={renderTick}
      style={{ width: state.artifact.source.width, height: state.artifact.source.height, position: 'relative', overflow: 'hidden', background: 'transparent' }}
    >
      <CreativeSceneSurface artifact={state.artifact} localTicks={renderTick} surface={request.surface} />
    </main>
  )
}
