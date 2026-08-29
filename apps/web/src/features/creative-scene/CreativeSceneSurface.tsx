import { useEffect, useMemo, useState } from 'react'
import type { MotionComponentModuleV1, MotionRenderContextV1 } from '@sanverse/motion-contract'
import { MOTION_COMPONENT_MODULES } from '@sanverse/motion-library'
import { MotionComponentHost, MotionCompositionFrame } from '@sanverse/motion-native-runtime'
import type { CreativeSceneOverlayNode } from '@sanverse/render-contract'
import {
  validateCreativeSceneArtifactV1,
  type CreativeSceneArtifactV1,
} from '@sanverse/render-contract/creative-scene-artifact'

export const creativeSceneArtifactUrl = (projectId: string, artifactId: string): string =>
  `/api/projects/${encodeURIComponent(projectId)}/creative-artifacts/${encodeURIComponent(artifactId)}`

export type CreativeSceneLoadState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready'; artifact: CreativeSceneArtifactV1 }>
  | Readonly<{ status: 'error'; message: string }>

export const loadCreativeSceneArtifact = async (input: Readonly<{
  projectId: string
  artifactId: string
  expectedSha256: string
  signal?: AbortSignal
}>): Promise<CreativeSceneArtifactV1> => {
  const response = await fetch(creativeSceneArtifactUrl(input.projectId, input.artifactId), { signal: input.signal, cache: 'no-store' })
  if (!response.ok) throw new Error(`Creative scene artifact could not be loaded (${response.status}).`)
  const payload = await response.json() as { artifactRef?: { artifactId?: unknown; sha256?: unknown }; artifact?: unknown }
  if (payload.artifactRef?.artifactId !== input.artifactId || payload.artifactRef?.sha256 !== input.expectedSha256) throw new Error('Creative scene artifact identity no longer matches the accepted render plan.')
  const validated = validateCreativeSceneArtifactV1(payload.artifact)
  if (!validated.ok || validated.value.projectId !== input.projectId) throw new Error(validated.ok ? 'Creative scene artifact belongs to a different project.' : validated.refusal.message)
  return validated.value
}

const moduleFor = (artifact: CreativeSceneArtifactV1): MotionComponentModuleV1<unknown, unknown> => {
  const module = (MOTION_COMPONENT_MODULES as Readonly<Record<string, MotionComponentModuleV1<unknown, unknown>>>)[artifact.componentId]
  if (!module) throw new Error(`Creative scene component ${artifact.componentId} is not installed.`)
  if (module.definition.version !== artifact.componentVersion) throw new Error(`Creative scene component ${artifact.componentId} requires version ${artifact.componentVersion}, but version ${module.definition.version} is installed.`)
  if (!('createScene' in module) || typeof (module as { createScene?: unknown }).createScene !== 'function') throw new Error(`Creative scene component ${artifact.componentId} does not support the canonical Motion Graph runtime.`)
  const props = module.validateProps(artifact.component.props)
  if (!props.ok) throw new Error(`Creative scene component props no longer validate for ${artifact.componentId}.`)
  const style = module.validateStyle(artifact.component.style)
  if (!style.ok) throw new Error(`Creative scene component style no longer validates for ${artifact.componentId}.`)
  return module
}

export function CreativeSceneSurface({
  artifact,
  localTicks,
  displayScale = 1,
  surface = 'preview',
}: Readonly<{
  artifact: CreativeSceneArtifactV1
  localTicks: number
  displayScale?: number
  surface?: 'preview' | 'export'
}>) {
  const module = useMemo(() => moduleFor(artifact), [artifact])
  const props = useMemo(() => {
    const validated = module.validateProps(artifact.component.props)
    if (!validated.ok) throw new Error('Creative scene props became invalid after module selection.')
    return validated.value
  }, [artifact, module])
  const style = useMemo(() => {
    const validated = module.validateStyle(artifact.component.style)
    if (!validated.ok) throw new Error('Creative scene style became invalid after module selection.')
    return validated.value
  }, [artifact, module])
  const boundedTick = Math.max(0, Math.min(artifact.source.durationTicks, Math.trunc(localTicks)))
  const context: MotionRenderContextV1 = Object.freeze({
    localTicks: boundedTick,
    durationTicks: artifact.source.durationTicks,
    ticksPerSecond: 1_440_000,
    composition: Object.freeze({
      width: artifact.source.width,
      height: artifact.source.height,
      fpsNumerator: artifact.source.fpsNumerator,
      fpsDenominator: artifact.source.fpsDenominator,
    }),
    reducedMotion: false,
  })
  return (
    <div
      data-creative-scene-surface={surface}
      data-creative-scene-id={artifact.sceneId}
      data-creative-scene-component={artifact.componentId}
      data-creative-scene-local-tick={boundedTick}
      style={{ position: 'relative', width: artifact.source.width * displayScale, height: artifact.source.height * displayScale, overflow: 'hidden', pointerEvents: 'none' }}
    >
      <MotionCompositionFrame composition={context.composition} displayScale={displayScale} background="transparent">
        <MotionComponentHost
          module={module}
          props={props}
          style={style}
          context={context}
          sceneOverride={artifact.motion.scene}
          selectedGraphNodeId={null}
          selectedGraphNodeIds={[]}
        />
      </MotionCompositionFrame>
    </div>
  )
}

export function CreativeSceneOverlay({
  projectId,
  node,
  compositionTicks,
  scale,
}: Readonly<{
  projectId: string
  node: CreativeSceneOverlayNode
  compositionTicks: number
  scale: number
}>) {
  const [state, setState] = useState<CreativeSceneLoadState>({ status: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    setState({ status: 'loading' })
    loadCreativeSceneArtifact({ projectId, artifactId: node.artifactId, expectedSha256: node.artifactSha256, signal: controller.signal })
      .then((artifact) => { if (!controller.signal.aborted) setState({ status: 'ready', artifact }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setState({ status: 'error', message: error instanceof Error ? error.message : 'Creative scene could not be loaded.' }) })
    return () => controller.abort()
  }, [node.artifactId, node.artifactSha256, projectId])
  const localTicks = compositionTicks - node.interval.start.ticks
  if (state.status === 'loading') return <div data-creative-scene-loading={node.sceneId} aria-hidden="true" />
  if (state.status === 'error') return <div data-creative-scene-error={node.sceneId} data-message={state.message} aria-hidden="true" />
  return (
    <div data-creative-scene-overlay={node.sceneId} style={{ position: 'absolute', inset: 0, zIndex: 40 + node.layer, pointerEvents: 'none' }}>
      <CreativeSceneSurface artifact={state.artifact} localTicks={localTicks} displayScale={scale} surface="preview" />
    </div>
  )
}
