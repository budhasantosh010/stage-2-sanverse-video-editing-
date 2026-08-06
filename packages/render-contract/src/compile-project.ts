import {
  activeCaptionSets,
  activeOverlayOperations,
  activeOperations,
  activeTrackOutputs,
  activeVisualProperties,
  compositionDuration,
  effectiveComposition,
  effectiveFootageMotions,
  findAsset,
  isNameplateOperation,
  mediaTime,
  placeSourceSpan,
  type EditProject,
} from '@sanverse/edit-domain'
import { clipCompositionDurationTicks, clipIsRetimed } from '@sanverse/edit-domain/composition'

import { NAMEPLATE_STYLE_ID } from './nameplate-style.ts'
import { isVisualFitMode, type VisualFitMode } from './visual-normalization.ts'

/**
 * Where a project records whether footage of a different shape should be shown
 * whole with black bars, or filled edge to edge with the overhang cut off.
 *
 * It lives in the project's `extensions` bag rather than as a new field on the
 * composition, and that is deliberate. The composition's field list is closed:
 * adding to it would mean rewriting every project already saved on disk, and a
 * rewrite that touches the user's stored edits to add a preference is a bad
 * trade. The extensions bag exists precisely so a preference can be added
 * without touching anything already saved. A project that has never been asked
 * simply has no key, which reads as 'fit'.
 */
export const PROJECT_FRAMING_EXTENSION_KEY = 'sanverse.render/framing'

export const projectFraming = (project: EditProject): VisualFitMode => {
  const stored = project.extensions[PROJECT_FRAMING_EXTENSION_KEY]
  return isVisualFitMode(stored) ? stored : 'fit'
}
import {
  MAX_MUSIC_NODES,
  RENDER_PLAN_SCHEMA_VERSION,
  validateRenderPlan,
  type MusicNode,
  type RenderNode,
  type RenderPlan,
  type RenderPlanError,
  type RenderSource,
  type SourceSegmentNode,
  type VisualPropertiesNode,
} from './render-plan.ts'

export type CompileResult =
  | { readonly ok: true; readonly value: RenderPlan }
  | { readonly ok: false; readonly error: RenderPlanError | { readonly code: 'COMPILE_FAILED'; readonly reason: string } }

/**
 * Turn a project into the single description both renderers consume.
 *
 * Only operations from change sets that are switched on and not blocked reach
 * the plan. A change set the user turned off, or one the system marked blocked
 * because it no longer fits, contributes nothing — and is not silently
 * repaired to make it contribute.
 *
 * Cuts are resolved first, because everything drawn on top is anchored to the
 * original footage and can only be positioned once it is known which parts of
 * that footage survived.
 */
export const compileProjectToRenderPlan = (project: EditProject): CompileResult => {
  const composition = effectiveComposition(project)
  const duration = compositionDuration(composition)
  if (duration.ticks <= 0) {
    return { ok: false, error: { code: 'COMPILE_FAILED', reason: 'The composition is empty.' } }
  }
  const operations = activeOperations(project)
  const footageMotions = effectiveFootageMotions(project)
  /**
   * Which of the five tracks reach the finished video.
   *
   * Read once, here, and applied in exactly one place per track below. A
   * renderer never sees this state and never has to reapply it: what it gets is
   * a plan that already describes the video the user asked for.
   */
  const trackOutputs = activeTrackOutputs(project)
  type TransitionEdge = { video: number; audio: number; color: 'black' | 'white' }
  const transitionIn = new Map<string, TransitionEdge>()
  const transitionOut = new Map<string, TransitionEdge>()
  for (const operation of operations) {
    if (operation.kind !== 'set-clip-transition') continue
    // 'none' is how a transition is REMOVED: the same operation, with no
    // length and no colour. There is no separate delete, which is what keeps
    // one edit point from ever having two disagreeing answers.
    const dipping = operation.style === 'dip-to-black' || operation.style === 'dip-to-white'
    const video = dipping ? operation.duration.ticks : 0
    const audio = operation.audio === 'fade-through-silence' ? operation.duration.ticks : 0
    const color: 'black' | 'white' = operation.style === 'dip-to-white' ? 'white' : 'black'
    transitionOut.set(operation.clipId, { video, audio, color })
    transitionIn.set(operation.nextClipId, { video, audio, color })
  }

  // Every file the renderer must open, in the order they are first needed.
  // Footage always comes first so the main input keeps a stable position.
  const sources: RenderSource[] = []
  const seenSources = new Set<string>()
  const useSource = (assetId: string): boolean => {
    if (seenSources.has(assetId)) return true
    const asset = findAsset(project.assets, assetId)
    if (!asset) return false
    seenSources.add(assetId)
    sources.push(Object.freeze({ assetId, mediaKind: asset.mediaKind }))
    return true
  }

  /**
   * The recording this project was made from always takes position zero.
   *
   * The exporter opens that file as its first input and every other file after
   * it, in this list's order. Once the main sequence can hold more than one
   * recording, the first SEGMENT is no longer necessarily the original — so if
   * the list were built purely in segment order, position zero could name one
   * file while the exporter opened another, and the finished video would show
   * the wrong footage without a single error.
   */
  const primaryAsset = project.assets.find((asset) => asset.mediaKind === 'video')
  if (primaryAsset) useSource(primaryAsset.assetId)

  const segments: SourceSegmentNode[] = []
  for (const track of composition.tracks) {
    for (const clip of track.clips) {
      // A hidden piece leaves a hole rather than shifting everything after it,
      // so that switching it back on restores the exact video the user saw.
      if (!clip.enabled) continue
      if (!useSource(clip.assetId)) {
        return { ok: false, error: { code: 'COMPILE_FAILED', reason: 'A piece of footage is missing.' } }
      }
      // Retiming is written into the plan ONLY when the piece was actually
      // retimed, and pan only when it was actually moved off centre. A piece
      // nobody touched produces byte-for-byte the plan it always produced, so
      // its finished export is still valid and is handed straight back.
      const retimed = clipIsRetimed(clip)
      const transition = transitionOut.get(clip.clipId) ?? transitionIn.get(clip.clipId)
      const retiming = retimed
        ? {
            sourceDurationTicks: clip.sourceRange.duration.ticks,
            playbackRateNumerator: clip.timeTransform.playbackRate.numerator,
            playbackRateDenominator: clip.timeTransform.playbackRate.denominator,
            direction: clip.timeTransform.direction,
            maintainAudioPitch: clip.timeTransform.maintainAudioPitch,
          }
        : {}
      segments.push(Object.freeze({
        nodeId: clip.clipId,
        kind: 'source-segment' as const,
        interval: Object.freeze({
          start: clip.compositionStart,
          duration: mediaTime(clipCompositionDurationTicks(clip)),
        }),
        assetId: clip.assetId,
        sourceStartTicks: clip.sourceRange.start.ticks,
        ...retiming,
        ...(clip.pan === 0 ? {} : { pan: clip.pan }),
        ...(transition && transition.color === 'white' ? { transitionColor: 'white' as const } : {}),
        // V1 carries the picture, A1 the sound that came with it. Turning one
        // off leaves the other exactly as it was, and leaves the piece the same
        // length so nothing after it moves.
        videoEnabled: trackOutputs.V1,
        audioEnabled: trackOutputs.A1,
        footageMotions: Object.freeze(
          footageMotions
            .filter((motion) =>
              motion.assetId === clip.assetId &&
              motion.sourceInterval.start.ticks < clip.sourceRange.start.ticks + clip.sourceRange.duration.ticks &&
              clip.sourceRange.start.ticks < motion.sourceInterval.start.ticks + motion.sourceInterval.duration.ticks,
            )
            .map((motion) => Object.freeze({
              motionId: motion.motionId,
              sourceInterval: motion.sourceInterval,
              transform: motion.transform,
              crop: motion.crop,
              tracks: motion.tracks,
            })),
        ),
        gainDb: clip.gainDb,
        fadeInTicks: clip.fadeIn.ticks,
        fadeOutTicks: clip.fadeOut.ticks,
        videoFadeInTicks: transitionIn.get(clip.clipId)?.video ?? 0,
        videoFadeOutTicks: transitionOut.get(clip.clipId)?.video ?? 0,
        transitionAudioFadeInTicks: transitionIn.get(clip.clipId)?.audio ?? 0,
        transitionAudioFadeOutTicks: transitionOut.get(clip.clipId)?.audio ?? 0,
      }))
    }
  }
  segments.sort((left, right) => left.interval.start.ticks - right.interval.start.ticks)

  if (segments.length === 0) {
    return { ok: false, error: { code: 'COMPILE_FAILED', reason: 'Every piece of footage is switched off.' } }
  }

  const overlays: RenderNode[] = []
  const music: MusicNode[] = []

  /**
   * One overlay operation can produce two on-screen appearances if a cut passed
   * through the middle of it: it stays with the footage on both sides. Every
   * source-anchored family is placed by this one function, so a nameplate, a
   * caption, a title, a callout, and a piece of B-roll can never disagree about
   * where a cut left them.
   */
  const placeAnchored = (
    assetId: string,
    sourceInterval: { start: { ticks: number }; duration: { ticks: number } },
    build: (nodeIdSuffix: string, interval: RenderNode['interval'], sourceOffsetTicks: number) => RenderNode,
  ): void => {
    const placements = placeSourceSpan(composition, assetId, sourceInterval as never)
    for (const [index, placement] of placements.entries()) {
      if (!placement.clip.enabled) continue
      // How far into the original span this surviving piece begins. A B-roll
      // clip cut in half must resume where it left off, not restart.
      const offset = placement.sourceRange.start.ticks - sourceInterval.start.ticks
      overlays.push(build(index === 0 ? '' : `.${placement.clip.clipId}`, placement.compositionRange, offset))
    }
  }

  // V2 holds everything laid on top of the picture: B-roll, pictures, titles,
  // callouts, and nameplates. Switching it off draws none of them. They are
  // left out of the plan rather than drawn transparent, because a renderer that
  // still opens a B-roll file to draw nothing wastes the time of an export the
  // user is waiting on.
  for (const operation of trackOutputs.V2 ? operations : []) {
    if (isNameplateOperation(operation)) {
      placeAnchored(operation.assetId, operation.sourceInterval, (suffix, interval) => Object.freeze({
        nodeId: `${operation.operationId}${suffix}`,
        kind: 'text-overlay' as const,
        interval,
        target: operation.target,
        primaryText: operation.primaryText,
        secondaryText: operation.secondaryText,
        styleId: NAMEPLATE_STYLE_ID,
      }))
    }
  }

  for (const operation of activeOverlayOperations(project)) {
    // Music sits on A2 and everything else in this family sits on V2, so each
    // is asked about its own track rather than sharing one answer.
    const onTrack = operation.kind === 'add-music' ? trackOutputs.A2 : trackOutputs.V2
    if (!onTrack) continue

    if (operation.kind === 'add-title') {
      placeAnchored(operation.assetId, operation.sourceInterval, (suffix, interval) => Object.freeze({
        nodeId: `${operation.titleId}${suffix}`,
        kind: 'title-overlay' as const,
        interval,
        headline: operation.headline,
        subhead: operation.subhead,
        placement: operation.placement,
        styleId: operation.styleId,
      }))
      continue
    }

    if (operation.kind === 'add-callout') {
      placeAnchored(operation.assetId, operation.sourceInterval, (suffix, interval) => Object.freeze({
        nodeId: `${operation.calloutId}${suffix}`,
        kind: 'callout-overlay' as const,
        interval,
        region: Object.freeze({
          x: operation.region.x,
          y: operation.region.y,
          width: operation.region.width,
          height: operation.region.height,
        }),
        label: operation.label,
        styleId: operation.styleId,
      }))
      continue
    }

    if (operation.kind === 'add-media-overlay') {
      if (!useSource(operation.overlayAssetId)) continue
      const asset = findAsset(project.assets, operation.overlayAssetId)
      const isStill = asset?.mediaKind === 'image'
      placeAnchored(operation.assetId, operation.sourceInterval, (suffix, interval, offset) => Object.freeze({
        nodeId: `${operation.overlayId}${suffix}`,
        kind: 'media-overlay' as const,
        interval,
        assetId: operation.overlayAssetId,
        // A still picture has nowhere to seek to, so it always starts at zero.
        // A B-roll video resumes where the cut interrupted it.
        sourceStartTicks: isStill ? 0 : operation.overlaySourceStart.ticks + offset,
        region: Object.freeze({
          x: operation.region.x,
          y: operation.region.y,
          width: operation.region.width,
          height: operation.region.height,
        }),
        opacity: operation.opacity,
        useOverlayAudio: operation.useOverlayAudio,
      }))
      continue
    }

    if (operation.kind === 'add-music') {
      if (music.length >= MAX_MUSIC_NODES) continue
      const asset = findAsset(project.assets, operation.assetId)
      if (!asset || asset.mediaKind !== 'audio') continue
      // Music is measured on the FINISHED video, so cutting the middle out does
      // not cut the middle out of the song. It plays for as long as there is
      // both video left to cover and song left to play, whichever runs out
      // first — never looped, because a loop point nobody chose is audible.
      //
      // A length the user set is a third limit alongside those two, never an
      // override of them: asking for thirty seconds of a song with two seconds
      // left gets two seconds, not thirty seconds padded with silence.
      const videoLeft = duration.ticks - operation.compositionStart.ticks
      const songLeft = asset.duration.ticks - operation.sourceStart.ticks
      const asked = operation.durationTicks === null ? Number.MAX_SAFE_INTEGER : operation.durationTicks.ticks
      const playable = Math.min(videoLeft, songLeft, asked)
      if (playable <= 0) continue
      if (!useSource(operation.assetId)) continue
      const fadeIn = Math.min(operation.fadeIn.ticks, playable)
      const fadeOut = Math.min(operation.fadeOut.ticks, playable - fadeIn)
      music.push(Object.freeze({
        nodeId: operation.musicId,
        kind: 'music' as const,
        interval: Object.freeze({
          start: operation.compositionStart,
          duration: Object.freeze({ ticks: playable, timescale: duration.timescale }),
        }),
        assetId: operation.assetId,
        sourceStartTicks: operation.sourceStart.ticks,
        gainDb: operation.gainDb,
        fadeInTicks: fadeIn,
        fadeOutTicks: fadeOut,
      }))
    }
  }

  // Captions, placed by exactly the same rule as everything else drawn on top.
  //
  // One cue can become two nodes when a cut passed through it, so node ids are
  // qualified by the piece of footage they landed on. A cue whose footage was
  // deleted simply produces no node — it is not an error, and the rest of the
  // captions are unaffected. See `validateOperationAgainstComposition` for why
  // that differs from a nameplate.
  for (const set of trackOutputs.C1 ? activeCaptionSets(project) : []) {
    for (const cue of set.cues) {
      placeAnchored(set.assetId, cue.sourceInterval, (suffix, interval) => Object.freeze({
        nodeId: `${set.captionSetId}.${cue.cueId}${suffix}`,
        kind: 'caption-overlay' as const,
        interval,
        lines: cue.lines,
        styleId: set.styleId,
      }))
    }
  }

  // Drawing order is the order of this list, and it is sorted by when each
  // thing appears. Within one instant, B-roll must sit UNDER the words, or a
  // clip dropped over a caption would hide it. Media overlays are therefore
  // pulled ahead of everything else that starts at the same moment.
  const drawRank = (node: RenderNode): number => (node.kind === 'media-overlay' ? 0 : 1)
  overlays.sort((left, right) =>
    left.interval.start.ticks - right.interval.start.ticks || drawRank(left) - drawRank(right),
  )

  // A visual adjustment always names something drawn on V2. With V2 switched
  // off there is nothing on screen for it to adjust — which is the expected
  // outcome, not a broken project, so the list is simply empty. Failing here
  // would mean that hiding a track made Export stop working altogether.
  //
  // An adjustment that names something no longer on screen is the SAME
  // situation and gets the same answer. Deleting an overlay you had previously
  // moved or scaled leaves its adjustment behind with nothing to adjust; that
  // is an ordinary edit, not a broken project.
  //
  // This used to fail the whole compile, and the cost was far worse than a
  // failed Export. The preview asks this same compiler whether footage exists
  // at a moment, so one dangling adjustment made the monitor report "No media
  // at this time" across the ENTIRE project — over footage plainly on screen.
  // The owner recorded exactly that. An adjustment pointing at nothing now
  // draws nothing, which is what it already meant.
  const visuals: VisualPropertiesNode[] = []
  for (const operation of trackOutputs.V2 ? activeVisualProperties(project) : []) {
    const nodeIds = overlays
      .filter((node) => node.nodeId === operation.visualId || node.nodeId.startsWith(`${operation.visualId}.`))
      .map((node) => node.nodeId)
    if (nodeIds.length === 0) continue
    visuals.push(Object.freeze({
      visualId: operation.visualId,
      nodeIds: Object.freeze(nodeIds),
      transform: operation.transform,
      crop: operation.crop,
      layer: operation.layer,
      mask: operation.mask,
      tracks: operation.tracks,
      transition: operation.transition,
      effects: operation.effects,
    }))
  }

  const plan = {
    schemaVersion: RENDER_PLAN_SCHEMA_VERSION,
    projectId: project.projectId,
    projectRevision: project.revision,
    compositionId: composition.compositionId,
    width: composition.width,
    height: composition.height,
    framing: projectFraming(project),
    durationTicks: duration.ticks,
    sources: Object.freeze(sources),
    segments: Object.freeze(segments),
    overlays: Object.freeze(overlays),
    visuals: Object.freeze(visuals),
    music: Object.freeze(music),
  }

  // Compiled output is checked by the same validator that guards a plan
  // arriving from anywhere else, so the compiler cannot be the one component
  // allowed to emit something a renderer would choke on.
  return validateRenderPlan(plan)
}
