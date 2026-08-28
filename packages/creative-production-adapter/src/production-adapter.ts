import {
  DEFAULT_TITLE_STYLE_ID,
  DEFAULT_VISUAL_PROPERTIES,
  TITLE_COMPONENT_ID,
  VISUAL_PROPERTIES_PRIMITIVE_ID,
  clipTimeToSource,
  compositionTimeToClip,
  effectiveComposition,
  mediaTime,
  OPERATION_SCHEMA_VERSION,
  type AddTitleOperation,
  type ChangeSet,
  type EditOperation,
  type EditProject,
  type SetVisualPropertiesOperation,
} from '@sanverse/edit-domain'
import { findAsset } from '@sanverse/edit-domain/assets'
import { clipCompositionEndTicks } from '@sanverse/edit-domain/composition'
import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import { createCreativeEngineV15ToolRegistryV1, createSanverseToolRegistryV1, type SanverseToolSummaryV1 } from '@sanverse/motion-agent-tools'
import type { MotionAspectRatio, MotionRenderContextV1 } from '@sanverse/motion-contract'
import {
  applyMotionOperations,
  buildMotionCurvePresetOperations,
  deriveNodeGraphProjection,
  evaluateScene,
  projectMotionCurves,
  projectMotionDopeSheet,
  projectMotionLayers,
  type MotionCurvePresetIdV1,
  type MotionSceneV1,
} from '@sanverse/motion-graph'
import {
  KineticHeadlineModule,
  MOTION_COMPONENT_CATALOG,
  type KineticHeadlineProps,
  type KineticHeadlineStyle,
} from '@sanverse/motion-library'

export const CREATIVE_PRODUCTION_ADAPTER_SCHEMA_V16 = 'sanverse.creative-production-adapter/v1.6' as const
export const CREATIVE_PRODUCTION_LINEAGE_KEY = 'sanverse.creative/lineage' as const

export type CreativeProductionRefusalCodeV16 =
  | 'PROJECT_REVISION_INVALID'
  | 'NO_ACTIVE_PRIMARY_SOURCE'
  | 'SOURCE_ASSET_MISSING'
  | 'UNSUPPORTED_SOURCE_TIME_TRANSFORM'
  | 'INSUFFICIENT_SOURCE_DURATION'
  | 'HEADLINE_INVALID'
  | 'MOTION_EDIT_INVALID'
  | 'PRODUCTION_ADAPTER_UNSUPPORTED'

export type CreativeProductionResultV16<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; refusal: Readonly<{ code: CreativeProductionRefusalCodeV16; message: string }> }>

export interface CreativeProductionSourceContextV16 {
  readonly schemaVersion: 'sanverse.creative-production-source/v1.6'
  readonly projectId: string
  readonly projectRevision: number
  readonly clipId: string
  readonly assetId: string
  readonly compositionTicks: number
  readonly sourceTicks: number
  readonly sourceStartTicks: number
  readonly sourceEndTicks: number
  readonly durationTicks: number
  readonly composition: Readonly<{ width: number; height: number; fpsNumerator: number; fpsDenominator: number }>
}

export interface CreativeProductionCandidateV16 {
  readonly schemaVersion: typeof CREATIVE_PRODUCTION_ADAPTER_SCHEMA_V16
  readonly id: string
  readonly componentId: 'sanverse.kinetic-headline'
  readonly componentVersion: number
  readonly source: CreativeProductionSourceContextV16
  readonly headline: string
  readonly subhead: string
  readonly scene: MotionSceneV1
  readonly renderContext: MotionRenderContextV1
  readonly selectedNodeId: string
  readonly semanticNodeIds: readonly string[]
}

export interface CreativeProjectionSummaryV16 {
  readonly selectedNodeId: string
  readonly layerCount: number
  readonly dopeTrackCount: number
  readonly keyframeCount: number
  readonly curveTrackCount: number
  readonly nodeGraphCount: number
  readonly c3HasSelection: boolean
  readonly c4HasSelection: boolean
  readonly c5HasSelection: boolean
  readonly c6HasSelection: boolean
}

export interface CreativeProjectionDetailsV16 {
  readonly selectedNodeId: string
  readonly layers: readonly Readonly<{
    nodeId: string
    parentNodeId: string | null
    displayName: string
    nodeType: string
    depth: number
    hasKeyframes: boolean
    hasMotionDriver: boolean
    hasBinding: boolean
    effectCount: number
    maskCount: number
  }>[]
  readonly dopeTracks: readonly Readonly<{
    trackId: string
    nodeId: string
    label: string
    animationKind: string
    keyframes: readonly Readonly<{ selectionId: string; tick: number; value: string | number | boolean; interpolation: string }>[]
  }>[]
  readonly curveTracks: readonly Readonly<{
    trackId: string
    nodeId: string
    label: string
    property: string
    editable: boolean
    readOnlyReason: string | null
    keyframes: readonly Readonly<{ selectionId: string; keyframeId: string; tick: number; value: number; interpolation: string }>[]
  }>[]
  readonly nodes: readonly Readonly<{
    nodeId: string
    name: string
    type: string
    parentNodeId: string | null
    childNodeIds: readonly string[]
    effectIds: readonly string[]
    maskIds: readonly string[]
    bindingSourceNodeIds: readonly string[]
  }>[]
}

export interface CreativeLibraryOpportunityV16 {
  readonly componentId: string
  readonly name: string
  readonly purpose: string
  readonly category: string
  readonly productionStatus: 'native-production-adapter' | 'creative-preview-only'
  readonly reason: string
}

export interface CreativeProductionApplyBundleV16 {
  readonly operations: readonly EditOperation[]
  readonly changeSetId: string
  readonly provenance: Readonly<{ source: 'ai'; requestId: string }>
  readonly extensions: ChangeSet['extensions']
  readonly lineage: Readonly<{
    candidateId: string
    componentId: string
    componentVersion: number
    selectedNodeId: string
    semanticNodeIds: readonly string[]
  }>
}

const ok = <T>(value: T): CreativeProductionResultV16<T> => Object.freeze({ ok: true as const, value })
const refusal = <T>(code: CreativeProductionRefusalCodeV16, message: string): CreativeProductionResultV16<T> => Object.freeze({ ok: false as const, refusal: Object.freeze({ code, message }) })
const idTail = (input: string): string => {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36).padStart(8, '0').slice(0, 12)
}

const aspectRatio = (width: number, height: number): MotionAspectRatio => {
  const ratio = width / height
  if (ratio > 1.35) return '16:9'
  if (ratio < 0.72) return '9:16'
  if (ratio < 0.92) return '4:5'
  return '1:1'
}

export const resolveCreativeProductionSourceV16 = (input: Readonly<{
  project: EditProject
  compositionTicks: number
  preferredDurationTicks?: number
}>): CreativeProductionResultV16<CreativeProductionSourceContextV16> => {
  if (!Number.isSafeInteger(input.project.revision) || input.project.revision < 0) return refusal('PROJECT_REVISION_INVALID', 'The production project revision is invalid.')
  if (!Number.isSafeInteger(input.compositionTicks) || input.compositionTicks < 0) return refusal('NO_ACTIVE_PRIMARY_SOURCE', 'Choose a visible moment in the primary footage first.')
  const composition = effectiveComposition(input.project)
  const preferred = Math.max(PROJECT_TIMESCALE, Math.min(input.preferredDurationTicks ?? PROJECT_TIMESCALE * 3, PROJECT_TIMESCALE * 8))
  for (const track of composition.tracks) {
    for (const clip of track.clips) {
      if (!clip.enabled || input.compositionTicks < clip.compositionStart.ticks || input.compositionTicks >= clipCompositionEndTicks(clip)) continue
      if (clip.timeTransform.direction !== 'forward' || clip.timeTransform.playbackRate.numerator !== clip.timeTransform.playbackRate.denominator) {
        return refusal('UNSUPPORTED_SOURCE_TIME_TRANSFORM', 'V1.6 Creative production apply is bounded to forward 1× primary footage. The Creative preview remains available, but this source timing cannot be accepted into production yet.')
      }
      const asset = findAsset(input.project.assets, clip.assetId)
      if (!asset || asset.mediaKind !== 'video' || !asset.frameRate) return refusal('SOURCE_ASSET_MISSING', 'The primary source asset or its frame-rate metadata is unavailable.')
      const clipTime = compositionTimeToClip(clip, mediaTime(input.compositionTicks))
      const source = clipTimeToSource(clip, clipTime)
      const clipSourceEnd = clip.sourceRange.start.ticks + clip.sourceRange.duration.ticks
      const assetEnd = asset.duration.ticks
      const available = Math.min(clipSourceEnd, assetEnd) - source.ticks
      const durationTicks = Math.min(preferred, available)
      if (durationTicks < PROJECT_TIMESCALE) return refusal('INSUFFICIENT_SOURCE_DURATION', 'Choose a moment with at least one second of source footage remaining.')
      return ok(Object.freeze({
        schemaVersion: 'sanverse.creative-production-source/v1.6' as const,
        projectId: input.project.projectId,
        projectRevision: input.project.revision,
        clipId: clip.clipId,
        assetId: clip.assetId,
        compositionTicks: input.compositionTicks,
        sourceTicks: source.ticks,
        sourceStartTicks: source.ticks,
        sourceEndTicks: source.ticks + durationTicks,
        durationTicks,
        composition: Object.freeze({ width: input.project.composition.width, height: input.project.composition.height, fpsNumerator: asset.frameRate.numerator, fpsDenominator: asset.frameRate.denominator }),
      }))
    }
  }
  return refusal('NO_ACTIVE_PRIMARY_SOURCE', 'Choose a visible moment in the primary footage first.')
}

export const buildKineticHeadlineCandidateV16 = (input: Readonly<{
  project: EditProject
  compositionTicks: number
  headline: string
  subhead?: string
  preferredDurationTicks?: number
  reducedMotion?: boolean
}>): CreativeProductionResultV16<CreativeProductionCandidateV16> => {
  const source = resolveCreativeProductionSourceV16(input)
  if (!source.ok) return source
  const text = input.headline.trim()
  const words = text.split(/\s+/u).filter(Boolean)
  if (!text || text.length > 60 || words.length === 0) return refusal('HEADLINE_INVALID', 'The production headline must contain 1–60 characters.')
  const props: KineticHeadlineProps = Object.freeze({ ...KineticHeadlineModule.defaultProps, text, emphasisIndices: Object.freeze([Math.max(0, words.length - 1)]), emphasisTreatment: 'highlight-box' })
  const style: KineticHeadlineStyle = Object.freeze({ ...KineticHeadlineModule.defaultStyle })
  const renderContext: MotionRenderContextV1 = Object.freeze({
    localTicks: 0,
    durationTicks: source.value.durationTicks,
    ticksPerSecond: PROJECT_TIMESCALE,
    composition: Object.freeze({ ...source.value.composition }),
    reducedMotion: input.reducedMotion === true,
  })
  const validated = KineticHeadlineModule.validateProps(props)
  if (!validated.ok) return refusal('HEADLINE_INVALID', validated.issues[0]?.message ?? 'The headline cannot fit this composition.')
  let scene: MotionSceneV1
  try { scene = KineticHeadlineModule.createScene(validated.value, style, renderContext) }
  catch (error) { return refusal('HEADLINE_INVALID', error instanceof Error ? error.message : 'The headline cannot be built.') }
  const semantic = scene.semanticParts.find((part) => part.id === 'headline')?.nodeIds ?? Object.freeze([scene.rootNodeId])
  const dope = projectMotionDopeSheet(scene)
  const curves = projectMotionCurves(scene)
  // C3/C6 can select a semantic group even when the animation tracks live on
  // its children. V1.6 keeps one actual semantic node selected everywhere by
  // preferring the first headline descendant that is present in both C4 and C5.
  const selectedNodeId = semantic.find((nodeId) =>
    dope.layers.some((layer) => layer.nodeId === nodeId && layer.tracks.length > 0)
    && curves.tracks.some((track) => track.nodeId === nodeId),
  ) ?? semantic.find((nodeId) => scene.nodes[nodeId]) ?? scene.rootNodeId
  const candidateId = `creative_${idTail(`${source.value.projectId}:${source.value.projectRevision}:${source.value.sourceStartTicks}:${text}`)}`
  return ok(Object.freeze({
    schemaVersion: CREATIVE_PRODUCTION_ADAPTER_SCHEMA_V16,
    id: candidateId,
    componentId: 'sanverse.kinetic-headline' as const,
    componentVersion: KineticHeadlineModule.definition.version,
    source: source.value,
    headline: text,
    subhead: (input.subhead ?? '').trim().slice(0, 90),
    scene,
    renderContext,
    selectedNodeId,
    semanticNodeIds: Object.freeze([...semantic]),
  }))
}

export const projectCreativeCandidateV16 = (candidate: CreativeProductionCandidateV16): CreativeProjectionSummaryV16 => {
  const resolved = evaluateScene(candidate.scene, candidate.renderContext)
  const layers = projectMotionLayers({ scene: candidate.scene, resolvedScene: resolved })
  const dope = projectMotionDopeSheet(candidate.scene)
  const curves = projectMotionCurves(candidate.scene)
  const graph = deriveNodeGraphProjection(candidate.scene)
  return Object.freeze({
    selectedNodeId: candidate.selectedNodeId,
    layerCount: layers.preorderNodeIds.length,
    dopeTrackCount: dope.totalTracks,
    keyframeCount: dope.totalKeyframes,
    curveTrackCount: curves.tracks.length,
    nodeGraphCount: graph.nodes.length,
    c3HasSelection: Boolean(layers.layersById[candidate.selectedNodeId]),
    c4HasSelection: dope.layers.some((layer) => layer.nodeId === candidate.selectedNodeId),
    c5HasSelection: curves.tracks.some((track) => track.nodeId === candidate.selectedNodeId),
    c6HasSelection: graph.nodes.some((node) => node.nodeId === candidate.selectedNodeId),
  })
}

export const projectCreativeCandidateDetailsV16 = (candidate: CreativeProductionCandidateV16): CreativeProjectionDetailsV16 => {
  const resolved = evaluateScene(candidate.scene, candidate.renderContext)
  const layers = projectMotionLayers({ scene: candidate.scene, resolvedScene: resolved })
  const dope = projectMotionDopeSheet(candidate.scene)
  const curves = projectMotionCurves(candidate.scene)
  const graph = deriveNodeGraphProjection(candidate.scene)
  return Object.freeze({
    selectedNodeId: candidate.selectedNodeId,
    layers: Object.freeze(layers.preorderNodeIds.map((nodeId) => {
      const layer = layers.layersById[nodeId]!
      return Object.freeze({
        nodeId: layer.nodeId,
        parentNodeId: layer.parentNodeId,
        displayName: layer.displayName,
        nodeType: layer.nodeType,
        depth: layer.depth,
        hasKeyframes: layer.hasKeyframes,
        hasMotionDriver: layer.hasMotionDriver,
        hasBinding: layer.hasBinding,
        effectCount: layer.effectCount,
        maskCount: layer.maskCount,
      })
    })),
    dopeTracks: Object.freeze(dope.layers.flatMap((layer) => layer.tracks.map((track) => Object.freeze({
      trackId: track.trackId,
      nodeId: track.nodeId,
      label: track.label,
      animationKind: track.animationKind,
      keyframes: Object.freeze(track.keyframeRefs.map((keyframe) => Object.freeze({
        selectionId: keyframe.selectionId,
        tick: keyframe.tick,
        value: keyframe.value,
        interpolation: keyframe.interpolation,
      }))),
    })))),
    curveTracks: Object.freeze(curves.tracks.map((track) => Object.freeze({
      trackId: track.trackId,
      nodeId: track.nodeId,
      label: track.label,
      property: track.property,
      editable: track.editable,
      readOnlyReason: track.readOnlyReason,
      keyframes: Object.freeze(track.keyframes.map((keyframe) => Object.freeze({
        selectionId: keyframe.selectionId,
        keyframeId: keyframe.keyframeId,
        tick: keyframe.tick,
        value: keyframe.value,
        interpolation: keyframe.interpolation,
      }))),
    }))),
    nodes: Object.freeze(graph.nodes.map((node) => Object.freeze({
      nodeId: node.nodeId,
      name: node.name,
      type: node.type,
      parentNodeId: node.parentNodeId,
      childNodeIds: Object.freeze([...node.childNodeIds]),
      effectIds: Object.freeze([...node.effectIds]),
      maskIds: Object.freeze([...node.maskIds]),
      bindingSourceNodeIds: Object.freeze([...node.bindingSourceNodeIds]),
    }))),
  })
}

/**
 * Apply one C5 curve preset through the existing canonical Motion Graph
 * operation builder and atomic graph mutator. Production project/history state
 * is untouched. The caller must start a fresh review/approval chain for the
 * returned candidate because its exact Motion Graph revision changed.
 */
export const applyCreativeCurvePresetV16 = (input: Readonly<{
  candidate: CreativeProductionCandidateV16
  trackId: string
  leftKeyframeId: string
  preset: MotionCurvePresetIdV1
}>): CreativeProductionResultV16<CreativeProductionCandidateV16> => {
  try {
    let operationIndex = 0
    const nextOperationId = (prefix: string) => `operation_${idTail(`${input.candidate.id}:${input.trackId}:${input.leftKeyframeId}:${input.preset}:${prefix}:${operationIndex++}`)}`
    const operations = buildMotionCurvePresetOperations({
      scene: input.candidate.scene,
      trackId: input.trackId,
      leftKeyframeId: input.leftKeyframeId,
      preset: input.preset,
      nextOperationId,
    })
    const applied = applyMotionOperations(input.candidate.scene, operations)
    if (!applied.ok) return refusal('MOTION_EDIT_INVALID', applied.error.message)
    const curve = projectMotionCurves(applied.scene).tracksById[input.trackId]
    if (!curve) return refusal('MOTION_EDIT_INVALID', 'The selected curve no longer exists after the edit.')
    const editTail = idTail(`${input.candidate.id}:${input.trackId}:${input.leftKeyframeId}:${input.preset}`)
    return ok(Object.freeze({
      ...input.candidate,
      id: `${input.candidate.id}:c5:${editTail}`,
      scene: applied.scene,
      selectedNodeId: curve.nodeId,
    }))
  } catch (error) {
    return refusal('MOTION_EDIT_INVALID', error instanceof Error ? error.message : 'The curve edit could not be applied.')
  }
}

export const listCreativeProductionOpportunitiesV16 = (): readonly CreativeLibraryOpportunityV16[] => Object.freeze(MOTION_COMPONENT_CATALOG.map((definition) => Object.freeze({
  componentId: definition.id,
  name: definition.name,
  purpose: definition.purpose,
  category: definition.category,
  productionStatus: definition.id === 'sanverse.kinetic-headline' ? 'native-production-adapter' as const : 'creative-preview-only' as const,
  reason: definition.id === 'sanverse.kinetic-headline'
    ? 'V1.6 has a deterministic production adapter into the existing title + visual-properties render path.'
    : 'Available in the Creative Library and canonical Motion Graph, but V1.6 does not silently flatten this component into a production primitive.',
})))

export const listCreativeInternalToolsV16 = (): readonly SanverseToolSummaryV1[] => createCreativeEngineV15ToolRegistryV1(createSanverseToolRegistryV1()).list()

export const buildCreativeProductionApplyBundleV16 = (candidate: CreativeProductionCandidateV16): CreativeProductionResultV16<CreativeProductionApplyBundleV16> => {
  if (candidate.componentId !== 'sanverse.kinetic-headline') return refusal('PRODUCTION_ADAPTER_UNSUPPORTED', `No production adapter exists for ${candidate.componentId}.`)
  const tail = idTail(candidate.id)
  const titleId = `title_${tail}`
  const lineage = Object.freeze({ candidateId: candidate.id, componentId: candidate.componentId, componentVersion: candidate.componentVersion, selectedNodeId: candidate.selectedNodeId, semanticNodeIds: Object.freeze([...candidate.semanticNodeIds]) })
  const extensions = Object.freeze({ [CREATIVE_PRODUCTION_LINEAGE_KEY]: Object.freeze({ ...lineage, sourceStartTicks: candidate.source.sourceStartTicks, sourceEndTicks: candidate.source.sourceEndTicks }) })
  const title: AddTitleOperation = Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION, operationId: `operation_${tail}title`, kind: 'add-title', capabilityId: TITLE_COMPONENT_ID, titleId,
    assetId: candidate.source.assetId,
    sourceInterval: Object.freeze({ start: mediaTime(candidate.source.sourceStartTicks), duration: mediaTime(candidate.source.durationTicks) }),
    headline: candidate.headline, subhead: candidate.subhead, placement: 'center', styleId: DEFAULT_TITLE_STYLE_ID, extensions,
  })
  const visual: SetVisualPropertiesOperation = Object.freeze({
    schemaVersion: OPERATION_SCHEMA_VERSION, operationId: `operation_${tail}visual`, kind: 'set-visual-properties', capabilityId: VISUAL_PROPERTIES_PRIMITIVE_ID, visualId: titleId,
    transform: DEFAULT_VISUAL_PROPERTIES.transform, crop: DEFAULT_VISUAL_PROPERTIES.crop, layer: 2, mask: DEFAULT_VISUAL_PROPERTIES.mask,
    tracks: Object.freeze([
      Object.freeze({ property: 'scale' as const, keyframes: Object.freeze([
        Object.freeze({ at: mediaTime(0), value: 0.94, easing: Object.freeze({ kind: 'cubic-bezier' as const, x1: 0.2, y1: 0.84, x2: 0.35, y2: 1 }) }),
        Object.freeze({ at: mediaTime(Math.min(360_000, Math.floor(candidate.source.durationTicks / 3))), value: 1, easing: Object.freeze({ kind: 'linear' as const }) }),
      ]) }),
      Object.freeze({ property: 'opacity' as const, keyframes: Object.freeze([
        Object.freeze({ at: mediaTime(0), value: 0, easing: Object.freeze({ kind: 'cubic-bezier' as const, x1: 0.2, y1: 0.84, x2: 0.35, y2: 1 }) }),
        Object.freeze({ at: mediaTime(Math.min(240_000, Math.floor(candidate.source.durationTicks / 4))), value: 1, easing: Object.freeze({ kind: 'linear' as const }) }),
        Object.freeze({ at: mediaTime(Math.max(480_000, candidate.source.durationTicks - 240_000)), value: 1, easing: Object.freeze({ kind: 'linear' as const }) }),
        Object.freeze({ at: mediaTime(candidate.source.durationTicks), value: 0, easing: Object.freeze({ kind: 'linear' as const }) }),
      ]) }),
    ]),
    transition: DEFAULT_VISUAL_PROPERTIES.transition, effects: DEFAULT_VISUAL_PROPERTIES.effects, extensions,
  })
  const changeSetId = `changeset_${tail}creative`
  return ok(Object.freeze({ operations: Object.freeze([title, visual]), changeSetId, provenance: Object.freeze({ source: 'ai' as const, requestId: `creative:${candidate.id}` }), extensions, lineage }))
}

export const creativeAspectRatioForProjectV16 = (project: EditProject): MotionAspectRatio => aspectRatio(project.composition.width, project.composition.height)
