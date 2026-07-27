import { PROJECT_TIMESCALE, type AddNameplateOperation, type EditProject } from '@sanverse/edit-domain'
import { compileProjectToRenderPlan } from '@sanverse/render-contract/compile-project'
import type { RenderPlan, TextOverlayNode } from '@sanverse/render-contract'
import {
  NAMEPLATE_STYLE_V1,
  anchorFraction,
  resolveNameplateMetrics,
  resolveNameplatePlacement,
  toCssColor,
} from '@sanverse/render-contract/nameplate-style'

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
export const isNodeVisible = (node: TextOverlayNode, ticks: number): boolean =>
  ticks >= node.interval.start.ticks && ticks < node.interval.start.ticks + node.interval.duration.ticks

export const visibleNodes = (plan: RenderPlan, ticks: number): readonly TextOverlayNode[] =>
  plan.overlays.filter((node) => isNodeVisible(node, ticks))

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
