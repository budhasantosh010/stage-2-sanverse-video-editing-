import { PROJECT_TIMESCALE, type AddNameplateOperation, type EditProject } from '@sanverse/edit-domain'
import { compileProjectToRenderPlan } from '@sanverse/render-contract/compile-project'
import type {
  CalloutOverlayNode,
  CaptionOverlayNode,
  MediaOverlayNode,
  RenderNode,
  RenderPlan,
  TextOverlayNode,
  TitleOverlayNode,
} from '@sanverse/render-contract'
import {
  NAMEPLATE_STYLE_V1,
  anchorFraction,
  resolveNameplateMetrics,
  resolveNameplatePlacement,
  toCssColor,
} from '@sanverse/render-contract/nameplate-style'
import {
  captionLineTop,
  resolveCaptionMetrics,
  resolveCaptionStyle,
} from '@sanverse/render-contract/caption-style'
import {
  calloutLabelTop,
  calloutRectPixels,
  resolveCalloutMetrics,
  resolveCalloutStyle,
  resolveTitleMetrics,
  resolveTitleStyle,
  titleLineTop,
} from '@sanverse/render-contract/overlay-style'

/**
 * The preview is compiled from the same project, by the same compiler, into the
 * same plan the exporter renders. There is no second description of the video.
 */
export const compilePreviewPlan = (project: EditProject): RenderPlan | null => {
  const compiled = compileProjectToRenderPlan(project)
  return compiled.ok ? compiled.value : null
}

/**
 * A throwaway view of the project with the pending proposal layered on, used
 * only to compile a preview. Saved state is not touched, and this value is
 * never persisted, sent, or accepted — accepting goes through the server.
 */
export const withPendingProposal = (
  project: EditProject,
  proposal: AddNameplateOperation,
): EditProject => Object.freeze({
  ...project,
  changeSets: Object.freeze([
    ...project.changeSets,
    Object.freeze({
      changeSet: Object.freeze({
        schemaVersion: 'sanverse.change-set/v1' as const,
        changeSetId: 'changeset_pendingpreview',
        baseRevision: project.revision,
        operations: Object.freeze([proposal]),
        provenance: Object.freeze({ source: 'direct' as const, requestId: null }),
        extensions: Object.freeze({}),
      }),
      active: true,
      blockedReason: null,
    }),
  ]),
})

export const millisecondsToTicks = (milliseconds: number): number =>
  Math.round((milliseconds / 1000) * PROJECT_TIMESCALE)

/** Half-open, exactly as the exporter's enable expression is. */
export const isNodeVisible = (node: RenderNode, ticks: number): boolean =>
  ticks >= node.interval.start.ticks && ticks < node.interval.start.ticks + node.interval.duration.ticks

export const visibleNodes = (plan: RenderPlan, ticks: number): readonly RenderNode[] =>
  plan.overlays.filter((node) => isNodeVisible(node, ticks))

/** Nameplates only, for the preview layer that draws them. */
export const visibleNameplates = (plan: RenderPlan, ticks: number): readonly TextOverlayNode[] =>
  plan.overlays.filter(
    (node): node is TextOverlayNode => node.kind === 'text-overlay' && isNodeVisible(node, ticks),
  )

/**
 * Captions only.
 *
 * At most one caption is ever on screen — the domain refuses a set whose cues
 * overlap — but this returns a list rather than one node, because two different
 * caption SETS could exist once a project holds more than one piece of footage
 * (G5-C). Returning a list now means that day changes nothing here.
 */
export const visibleCaptions = (plan: RenderPlan, ticks: number): readonly CaptionOverlayNode[] =>
  plan.overlays.filter(
    (node): node is CaptionOverlayNode => node.kind === 'caption-overlay' && isNodeVisible(node, ticks),
  )

export const visibleTitles = (plan: RenderPlan, ticks: number): readonly TitleOverlayNode[] =>
  plan.overlays.filter(
    (node): node is TitleOverlayNode => node.kind === 'title-overlay' && isNodeVisible(node, ticks),
  )

export const visibleCallouts = (plan: RenderPlan, ticks: number): readonly CalloutOverlayNode[] =>
  plan.overlays.filter(
    (node): node is CalloutOverlayNode => node.kind === 'callout-overlay' && isNodeVisible(node, ticks),
  )

export const visibleMediaOverlays = (plan: RenderPlan, ticks: number): readonly MediaOverlayNode[] =>
  plan.overlays.filter(
    (node): node is MediaOverlayNode => node.kind === 'media-overlay' && isNodeVisible(node, ticks),
  )

export type TitleCssVariables = Readonly<Record<string, string>>

/** The title style contract as CSS values, scaled to the displayed size. */
export const titleCssVariables = (
  styleId: string,
  compositionWidth: number,
  compositionHeight: number,
  scale: number,
): TitleCssVariables => {
  const style = resolveTitleStyle(styleId)
  const metrics = resolveTitleMetrics(compositionWidth, compositionHeight, style)
  return Object.freeze({
    '--title-headline-size': `${metrics.headlineFontSize * scale}px`,
    '--title-subhead-size': `${metrics.subheadFontSize * scale}px`,
    '--title-padding': `${metrics.padding * scale}px`,
    '--title-color': toCssColor(style.textColor, style.textOpacity),
    '--title-background': style.backgroundColor === null
      ? 'transparent'
      : toCssColor(style.backgroundColor, style.backgroundOpacity),
  })
}

/** The top of one title line's plate, in DISPLAY pixels. */
export const titleLineTopPx = (
  styleId: string,
  lineIndex: number,
  hasSubhead: boolean,
  placement: 'center' | 'lower-third',
  compositionWidth: number,
  compositionHeight: number,
  scale: number,
): number => {
  const style = resolveTitleStyle(styleId)
  const metrics = resolveTitleMetrics(compositionWidth, compositionHeight, style)
  return titleLineTop(lineIndex, hasSubhead, placement, compositionHeight, metrics) * scale
}

export type CalloutBoxStyle = Readonly<{
  left: number
  top: number
  width: number
  height: number
  borderWidth: number
  borderColor: string
  labelTop: number
  labelFontSize: number
  labelPadding: number
  labelColor: string
  labelBackground: string
}>

/**
 * Everything the preview needs to draw one callout, in DISPLAY pixels.
 *
 * The rectangle is computed in composition pixels by the shared contract and
 * only scaled here, so the browser and FFmpeg draw the same box in the same
 * place rather than two boxes that happen to look similar.
 */
export const calloutBoxStyle = (
  node: CalloutOverlayNode,
  compositionWidth: number,
  compositionHeight: number,
  scale: number,
): CalloutBoxStyle => {
  const style = resolveCalloutStyle(node.styleId)
  const metrics = resolveCalloutMetrics(compositionWidth, compositionHeight, style)
  const rect = calloutRectPixels(node.region, compositionWidth, compositionHeight)
  return Object.freeze({
    left: rect.x * scale,
    top: rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
    borderWidth: metrics.borderWidth * scale,
    borderColor: toCssColor(style.borderColor, style.borderOpacity),
    labelTop: calloutLabelTop(rect, metrics) * scale,
    labelFontSize: metrics.labelFontSize * scale,
    labelPadding: metrics.labelPadding * scale,
    labelColor: toCssColor(style.labelColor, 1),
    labelBackground: toCssColor(style.labelBackgroundColor, style.labelBackgroundOpacity),
  })
}

/**
 * The box a B-roll clip or picture occupies, in DISPLAY pixels.
 *
 * The clip is drawn with `object-fit: contain` inside this box, which is the
 * browser's name for exactly what FFmpeg's
 * `scale=…:force_original_aspect_ratio=decrease` does: fit inside, keep the
 * clip's own shape, centre what is left over.
 */
export const mediaOverlayBox = (
  node: MediaOverlayNode,
  compositionWidth: number,
  compositionHeight: number,
  scale: number,
): Readonly<{ left: number; top: number; width: number; height: number; opacity: number }> => Object.freeze({
  left: Math.round(node.region.x * compositionWidth) * scale,
  top: Math.round(node.region.y * compositionHeight) * scale,
  width: Math.max(2, Math.round(node.region.width * compositionWidth)) * scale,
  height: Math.max(2, Math.round(node.region.height * compositionHeight)) * scale,
  opacity: node.opacity,
})

export type CaptionCssVariables = Readonly<Record<string, string>>

/**
 * Turn the caption style contract into CSS values, scaled to the size the video
 * is being displayed at.
 *
 * Exactly the same rule as the nameplate: every size comes from the video's own
 * dimensions and is then scaled, so resizing the browser window changes nothing
 * about what the export will contain.
 */
export const captionCssVariables = (
  styleId: string,
  compositionWidth: number,
  compositionHeight: number,
  scale: number,
): CaptionCssVariables => {
  const style = resolveCaptionStyle(styleId)
  const metrics = resolveCaptionMetrics(compositionWidth, compositionHeight, style)
  return Object.freeze({
    '--caption-size': `${metrics.fontSize * scale}px`,
    '--caption-padding': `${metrics.padding * scale}px`,
    '--caption-line-gap': `${metrics.lineGap * scale}px`,
    '--caption-bottom': `${metrics.bottomMargin * scale}px`,
    '--caption-color': toCssColor(style.textColor, style.textOpacity),
    '--caption-background': style.backgroundColor === null
      ? 'transparent'
      : toCssColor(style.backgroundColor, style.backgroundOpacity),
    // An outline is drawn as four offset shadows, which is the only way CSS can
    // produce the same even outline FFmpeg's `borderw` does.
    '--caption-outline': metrics.outlineWidth > 0
      ? outlineShadow(metrics.outlineWidth * scale, toCssColor(style.outlineColor, 1))
      : 'none',
  })
}

const outlineShadow = (width: number, color: string): string =>
  [`${width}px 0 ${color}`, `-${width}px 0 ${color}`, `0 ${width}px ${color}`, `0 -${width}px ${color}`].join(', ')

/**
 * The top of one caption line's plate, in DISPLAY pixels.
 *
 * The arithmetic lives in the shared contract and is only scaled here, so the
 * browser cannot arrive at a different stacking order from the exporter.
 */
export const captionLineTopPx = (
  styleId: string,
  lineIndex: number,
  lineCount: number,
  compositionWidth: number,
  compositionHeight: number,
  scale: number,
): number => {
  const style = resolveCaptionStyle(styleId)
  const metrics = resolveCaptionMetrics(compositionWidth, compositionHeight, style)
  return captionLineTop(lineIndex, lineCount, compositionHeight, metrics) * scale
}

export type NameplateCssVariables = Readonly<Record<string, string>>

/**
 * Turn the style contract into CSS values for one composition, scaled to the
 * size the video is actually being displayed at.
 *
 * `scale` is display pixels per composition pixel. Every size is derived from
 * the video's own dimensions and then scaled, so the preview never changes
 * when the browser window does — which is exactly what the old `2vw` rule got
 * wrong, and why the preview and the export used to disagree.
 */
export const nameplateCssVariables = (
  compositionWidth: number,
  compositionHeight: number,
  scale: number,
): NameplateCssVariables => {
  const metrics = resolveNameplateMetrics(compositionWidth, compositionHeight)
  return Object.freeze({
    '--nameplate-primary-size': `${metrics.primaryFontSize * scale}px`,
    '--nameplate-secondary-size': `${metrics.secondaryFontSize * scale}px`,
    '--nameplate-padding': `${metrics.padding * scale}px`,
    '--nameplate-line-gap': `${metrics.lineGap * scale}px`,
    '--nameplate-primary-color': toCssColor(NAMEPLATE_STYLE_V1.primaryColor, NAMEPLATE_STYLE_V1.primaryOpacity),
    '--nameplate-secondary-color': toCssColor(NAMEPLATE_STYLE_V1.secondaryColor, NAMEPLATE_STYLE_V1.secondaryOpacity),
    '--nameplate-background': toCssColor(NAMEPLATE_STYLE_V1.backgroundColor, NAMEPLATE_STYLE_V1.backgroundOpacity),
  })
}

/**
 * How far below its anchored position the second line is drawn, in composition
 * pixels. Mirrors the exporter, which offsets the secondary drawtext by exactly
 * the primary font size plus the line gap.
 */
export const secondaryLineOffset = (compositionWidth: number, compositionHeight: number): number => {
  const metrics = resolveNameplateMetrics(compositionWidth, compositionHeight)
  return metrics.primaryFontSize + metrics.lineGap
}

export type PreviewPlacement = Readonly<{ left: number; top: number }>

/**
 * Where to draw the box, in display pixels.
 *
 * The measured box is converted back into composition pixels first, so the
 * shared placement rule sees exactly the numbers FFmpeg's `text_w`/`text_h`
 * would give it. That is what makes preview and export agree rather than
 * approximately agree.
 */
export const previewPlacement = (input: {
  readonly node: TextOverlayNode
  readonly compositionWidth: number
  readonly compositionHeight: number
  readonly measuredWidth: number
  /** The line's em-box height in composition pixels: its font size. */
  readonly lineHeight: number
  readonly scale: number
}): PreviewPlacement => {
  const metrics = resolveNameplateMetrics(input.compositionWidth, input.compositionHeight)
  const placement = resolveNameplatePlacement({
    pointX: input.node.target.point.x,
    pointY: input.node.target.point.y,
    anchor: input.node.target.anchor,
    frameWidth: input.compositionWidth,
    frameHeight: input.compositionHeight,
    // Width is measured, because only the browser knows how wide its own text
    // is — and FFmpeg measures its own the same way.
    boxWidth: input.scale > 0 ? input.measuredWidth / input.scale : 0,
    // Height is derived, not measured, so both renderers use the same number.
    // FFmpeg's text_h is the glyph box and CSS's is the em box; deriving it
    // from the font size removes that difference entirely.
    boxHeight: input.lineHeight + metrics.padding * 2,
    safeMargin: metrics.safeMargin,
  })
  return Object.freeze({ left: placement.x * input.scale, top: placement.y * input.scale })
}

export { anchorFraction }
