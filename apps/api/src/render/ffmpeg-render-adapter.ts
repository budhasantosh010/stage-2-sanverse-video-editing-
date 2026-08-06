import { createHash, randomUUID } from 'node:crypto'
import { constants, createReadStream } from 'node:fs'
import { chmod, copyFile, link, lstat, mkdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'

import { DEFAULT_VISUAL_PROPERTIES, evaluateVisualProperties } from '@sanverse/edit-domain'
import { MAX_REVERSE_SOURCE_DURATION_TICKS } from '@sanverse/edit-domain/clip-time'
import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import {
  validateRenderPlan,
  type CalloutOverlayNode,
  type CaptionOverlayNode,
  type FootageMotionNode,
  type RenderPlan,
  type TextOverlayNode,
  type TitleOverlayNode,
  type VisualPropertiesNode,
} from '@sanverse/render-contract'
import { normalizationFilterSteps } from '@sanverse/render-contract/visual-normalization'
import {
  audioSpeedSteps,
  panFilter,
  segmentRate,
  segmentSourceDurationTicks,
  segmentTransitionColor,
  videoSpeedSteps,
} from './ffmpeg-retiming.ts'
import {
  calloutLabelTop,
  calloutRectPixels,
  resolveCalloutMetrics,
  resolveCalloutStyle,
  resolveTitleMetrics,
  resolveTitleStyle,
  titleLineTop,
} from '@sanverse/render-contract/overlay-style'
import {
  NAMEPLATE_STYLE_V1,
  anchorFraction,
  ffmpegBoxPositionExpression,
  ffmpegTextInsetExpression,
  resolveNameplateMetrics,
  toFfmpegColor,
} from '@sanverse/render-contract/nameplate-style'
import {
  captionLineTop,
  ffmpegCaptionXExpression,
  resolveCaptionMetrics,
  resolveCaptionStyle,
} from '@sanverse/render-contract/caption-style'

import { createCommandRunner, type CommandRunner } from '../process/command-runner.ts'
import { createFfprobeMediaProbe, type MediaProbePort } from '../media/media-probe.ts'
import { RenderError, type RenderPort, type RenderRequest, type RenderResult } from './render-port.ts'

const DURATION_TOLERANCE_MS = 100
const MAX_TEXT_BYTES = 4096

export type { CommandInvocation, CommandResult, CommandRunner } from '../process/command-runner.ts'
export { createCommandRunner } from '../process/command-runner.ts'

type AdapterOptions = {
  readonly fontPath: string
  readonly ffmpegExecutable?: string
  readonly ffprobeExecutable?: string
  readonly runCommand?: CommandRunner
  readonly mediaProbe?: MediaProbePort
}

type BuildArgumentsInput = {
  readonly sourcePath: string
  readonly outputPath: string
  readonly fontPath: string
  readonly plan: RenderPlan
  /** The source's own frame rate, so generated black matches it exactly. */
  readonly frameRate: Readonly<{ numerator: number; denominator: number }>
  /** False when the source has no sound at all, so no audio is built. */
  readonly hasAudio: boolean
  /**
   * Where every extra file lives, keyed by asset id. Empty for a project with
   * no B-roll, pictures, or music.
   */
  readonly extraSourcePaths?: Readonly<Record<string, string>>
}

/**
 * Which FFmpeg input number each file gets.
 *
 * The main footage is always input 0, and every other file follows in the plan's
 * own `sources` order. Computed in one place because the filter graph refers to
 * inputs by number, and a graph that disagreed with the command line by one
 * would silently composite the wrong clip.
 */
export function planInputs(plan: RenderPlan): readonly { assetId: string; mediaKind: string; index: number }[] {
  return Object.freeze(plan.sources.map((source, index) => ({
    assetId: source.assetId,
    mediaKind: source.mediaKind,
    index,
  })))
}

/** The latest instant any node needs from one extra file, in ticks. */
function latestUseTicks(plan: RenderPlan, assetId: string): number {
  let latest = 0
  for (const node of plan.overlays) {
    if (node.kind !== 'media-overlay' || node.assetId !== assetId) continue
    latest = Math.max(latest, node.sourceStartTicks + node.interval.duration.ticks)
  }
  for (const node of plan.music) {
    if (node.assetId !== assetId) continue
    latest = Math.max(latest, node.sourceStartTicks + node.interval.duration.ticks)
  }
  return latest
}

/**
 * Every piece of audio is resampled to this before anything is joined.
 *
 * Joining two pieces of audio that disagree about sample rate or channel count
 * is not something FFmpeg guesses at; it fails. Conforming everything first is
 * also what replaced `-c:a copy`, which could only cut audio at its own
 * compression block boundaries and therefore drifted out of sync with the
 * picture at the first cut.
 */
const AUDIO_SAMPLE_RATE = 48_000
const AUDIO_CHANNEL_LAYOUT = 'stereo'

function renderError(code: RenderError['code'], message: string): RenderError {
  return new RenderError(code, message)
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

function isInside(root: string, candidate: string): boolean {
  const path = relative(root, candidate)
  return path === '' || (!path.startsWith('..') && !isAbsolute(path))
}

/**
 * Nine decimals is finer than one tick (about 0.69 microseconds), so the
 * conversion to FFmpeg's seconds cannot lose a tick at the boundary.
 */
const ticksToSeconds = (ticks: number): string => (ticks / PROJECT_TIMESCALE).toFixed(9)

const compactNumber = (value: number): string => {
  const rounded = Math.abs(value) < 0.0000005 ? 0 : Number(value.toFixed(6))
  return String(rounded)
}

const visualForNode = (plan: RenderPlan, nodeId: string): VisualPropertiesNode | undefined =>
  plan.visuals.find((visual) => visual.nodeIds.includes(nodeId))

/**
 * Translate the renderer-neutral visual state into native FFmpeg filters.
 *
 * This deliberately uses the shared evaluator at t=0 rather than copying
 * defaults into the renderer. Enter/exit transitions are neutralized for that
 * base evaluation because FFmpeg applies them as separate frame-timed filters
 * below. Applying the transition twice would turn an authored opacity of 1 into
 * permanent alpha 0 before the FFmpeg fade ever had pixels to reveal.
 * Time-varying translation is handled by the overlay expression below.
 */
const mediaVisualFilters = (
  visual: VisualPropertiesNode | undefined,
  durationTicks: number,
  baseOpacity: number,
  fadeStartTicks = 0,
): readonly string[] => {
  if (visual === undefined) {
    return baseOpacity < 1
      ? Object.freeze(['format=pix_fmts=yuva420p', `colorchannelmixer=aa=${compactNumber(baseOpacity)}`])
      : Object.freeze([])
  }

  const evaluated = evaluateVisualProperties(
    Object.freeze({ ...visual, transition: DEFAULT_VISUAL_PROPERTIES.transition }),
    0,
    durationTicks,
  )
  const filters: string[] = []
  const crop = evaluated.crop
  if (crop.top > 0 || crop.right > 0 || crop.bottom > 0 || crop.left > 0) {
    const widthFraction = compactNumber(1 - crop.left - crop.right)
    const heightFraction = compactNumber(1 - crop.top - crop.bottom)
    filters.push(
      `crop=w='max(2,trunc(iw*${widthFraction}/2)*2)':` +
        `h='max(2,trunc(ih*${heightFraction}/2)*2)':` +
        `x='trunc(iw*${compactNumber(crop.left)})':` +
        `y='trunc(ih*${compactNumber(crop.top)})'`,
    )
  }

  if (evaluated.transform.scale !== 1) {
    filters.push(
      `scale=trunc(iw*${compactNumber(evaluated.transform.scale)}/2)*2:` +
        `trunc(ih*${compactNumber(evaluated.transform.scale)}/2)*2`,
    )
  }
  for (const effect of evaluated.effects) {
    if (effect.kind === 'blur') filters.push(`gblur=sigma=${compactNumber(effect.amount * 100)}`)
    if (effect.kind === 'brightness') filters.push(`eq=brightness=${compactNumber(effect.amount)}`)
    if (effect.kind === 'contrast') filters.push(`eq=contrast=${compactNumber(effect.amount)}`)
    if (effect.kind === 'saturation') filters.push(`eq=saturation=${compactNumber(effect.amount)}`)
    if (effect.kind === 'grayscale') {
      filters.push(`hue=s=${compactNumber(1 - effect.amount)}`)
    }
  }

  const opacity = baseOpacity * evaluated.transform.opacity
  const requiresAlpha =
    opacity < 1 ||
    evaluated.transform.rotationDegrees !== 0 ||
    evaluated.mask.shape !== 'none' ||
    visual.transition.enter.kind === 'fade' ||
    visual.transition.exit.kind === 'fade'
  if (requiresAlpha) filters.push('format=pix_fmts=yuva420p')
  if (opacity < 1) filters.push(`colorchannelmixer=aa=${compactNumber(opacity)}`)

  if (evaluated.mask.shape === 'ellipse') {
    filters.push(
      "geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':" +
        "a='if(lte(pow((X-W/2)/(W/2),2)+pow((Y-H/2)/(H/2),2),1),alpha(X,Y),0)'",
    )
  }
  if (evaluated.transform.rotationDegrees !== 0) {
    filters.push(
      `rotate=${compactNumber(evaluated.transform.rotationDegrees)}*PI/180:` +
        'ow=rotw(iw):oh=roth(ih):c=black@0',
    )
  }

  const enter = visual.transition.enter
  if (enter.kind === 'fade' && enter.duration.ticks > 0) {
    filters.push(
      `fade=t=in:st=${ticksToSeconds(fadeStartTicks)}` +
        `:d=${ticksToSeconds(enter.duration.ticks)}:alpha=1`,
    )
  }
  const exit = visual.transition.exit
  if (exit.kind === 'fade' && exit.duration.ticks > 0) {
    filters.push(
      `fade=t=out:st=${ticksToSeconds(fadeStartTicks + durationTicks - exit.duration.ticks)}` +
        `:d=${ticksToSeconds(exit.duration.ticks)}:alpha=1`,
    )
  }
  return Object.freeze(filters)
}

const mediaOverlayPosition = (
  visual: VisualPropertiesNode | undefined,
  axis: 'x' | 'y',
  startTicks: number,
  durationTicks: number,
  boxStart: number,
  boxSize: number,
  frameSize: number,
): string => {
  const base = `${boxStart}+(${boxSize}-overlay_${axis === 'x' ? 'w' : 'h'})/2`
  if (visual === undefined) return base
  const property = axis === 'x' ? 'translateX' : 'translateY'
  const trackProperty = axis === 'x' ? 'translate-x' : 'translate-y'
  const hasTrack = visual.tracks.some((track) => track.property === trackProperty)
  if (!hasTrack) {
    const value = evaluateVisualProperties(visual, 0, durationTicks).transform[property]
    return `${base}+${compactNumber(value * frameSize)}`
  }

  // Sampling the canonical evaluator at each source frame supports every
  // bounded easing kind without maintaining a second spring/bezier engine in
  // FFmpeg expressions. The expression is stored in the filter script, not the
  // Windows command line.
  const sampleCount = Math.max(
    2,
    Math.ceil((durationTicks / PROJECT_TIMESCALE) * 30) + 1,
  )
  const samples: string[] = []
  for (let index = 0; index < sampleCount; index += 1) {
    const relativeTicks = Math.min(durationTicks, Math.round((durationTicks * index) / (sampleCount - 1)))
    const value = evaluateVisualProperties(visual, relativeTicks, durationTicks).transform[property]
    samples.push(compactNumber(value * frameSize))
  }
  const startSeconds = startTicks / PROJECT_TIMESCALE
  const frameSeconds = durationTicks / PROJECT_TIMESCALE / (sampleCount - 1)
  let expression = samples.at(-1) as string
  for (let index = samples.length - 2; index >= 0; index -= 1) {
    const boundary = compactNumber(startSeconds + frameSeconds * (index + 0.5))
    expression = `if(lt(t,${boundary}),${samples[index]},${expression})`
  }
  return `${base}+${expression}`
}

/**
 * Build the drawtext filters for one nameplate.
 *
 * Every number here comes from the shared style contract. This file decides
 * nothing about how a nameplate looks; it only translates the contract into
 * FFmpeg's dialect. The browser preview translates the same contract into CSS,
 * and a test evaluates both and fails if they disagree.
 */
function nameplateFilters(node: TextOverlayNode, index: number, plan: RenderPlan, fontPath: string): string[] {
  const metrics = resolveNameplateMetrics(plan.width, plan.height)
  const fraction = anchorFraction(node.target.anchor)
  const startSeconds = ticksToSeconds(node.interval.start.ticks)
  const endSeconds = ticksToSeconds(node.interval.start.ticks + node.interval.duration.ticks)
  const enable = `gte(t\\,${startSeconds})*lt(t\\,${endSeconds})`

  const hasSecondary = node.secondaryText.length > 0

  const boxPosition = (axis: 'x' | 'y', lineHeight: number) =>
    ffmpegBoxPositionExpression({
      axis,
      point: axis === 'x' ? node.target.point.x : node.target.point.y,
      anchorFraction: axis === 'x' ? fraction.x : fraction.y,
      frameSize: axis === 'x' ? plan.width : plan.height,
      safeMargin: metrics.safeMargin,
      padding: metrics.padding,
      lineHeight,
    })

  // Each line is anchored on its own, exactly as the preview measures and
  // places each of its two boxes.
  const primaryX = `${boxPosition('x', metrics.primaryFontSize)}${ffmpegTextInsetExpression('x', metrics.padding, metrics.primaryFontSize)}`
  const primaryY = `${boxPosition('y', metrics.primaryFontSize)}${ffmpegTextInsetExpression('y', metrics.padding, metrics.primaryFontSize)}`
  const secondaryX = `${boxPosition('x', metrics.secondaryFontSize)}${ffmpegTextInsetExpression('x', metrics.padding, metrics.secondaryFontSize)}`
  // The second line's box sits a fixed distance below the first line's box.
  const secondaryY = `${boxPosition('y', metrics.primaryFontSize)}+${metrics.primaryFontSize + metrics.lineGap}` +
    ffmpegTextInsetExpression('y', metrics.padding, metrics.secondaryFontSize)

  const background = toFfmpegColor(NAMEPLATE_STYLE_V1.backgroundColor, NAMEPLATE_STYLE_V1.backgroundOpacity)
  const shared =
    `fontfile='${fontPath}':box=1:boxcolor=${background}:boxborderw=${metrics.padding}` +
    `:fix_bounds=1:expansion=none:enable='${enable}'`

  const filters = [
    `drawtext=${shared}:textfile='primary-${index}.txt'` +
      `:fontcolor=${toFfmpegColor(NAMEPLATE_STYLE_V1.primaryColor, NAMEPLATE_STYLE_V1.primaryOpacity)}` +
      `:fontsize=${metrics.primaryFontSize}:x=${primaryX}:y=${primaryY}`,
  ]
  if (hasSecondary) {
    filters.push(
      `drawtext=${shared}:textfile='secondary-${index}.txt'` +
        `:fontcolor=${toFfmpegColor(NAMEPLATE_STYLE_V1.secondaryColor, NAMEPLATE_STYLE_V1.secondaryOpacity)}` +
        `:fontsize=${metrics.secondaryFontSize}:x=${secondaryX}:y=${secondaryY}`,
    )
  }
  return filters
}

/**
 * Build the drawtext filters for one caption.
 *
 * One filter per LINE, because FFmpeg's drawtext draws a single line and has no
 * way to wrap. The wrapping decision was already made, deterministically, in
 * the domain (`segmentTranscript`), so both renderers receive the lines already
 * split and neither can wrap them differently.
 *
 * Every number comes from the shared caption style. This file decides nothing
 * about how a caption looks.
 */
function captionFilters(node: CaptionOverlayNode, index: number, plan: RenderPlan, fontPath: string): string[] {
  const style = resolveCaptionStyle(node.styleId)
  const metrics = resolveCaptionMetrics(plan.width, plan.height, style)
  const startSeconds = ticksToSeconds(node.interval.start.ticks)
  const endSeconds = ticksToSeconds(node.interval.start.ticks + node.interval.duration.ticks)
  const enable = `gte(t\\,${startSeconds})*lt(t\\,${endSeconds})`
  const x = ffmpegCaptionXExpression(plan.width)

  return node.lines.map((_line, lineIndex) => {
    const boxTop = captionLineTop(lineIndex, node.lines.length, plan.height, metrics)
    // Same em-box correction as the nameplate: FFmpeg's `text_h` measures the
    // glyphs while CSS measures the line box, so the difference is split evenly
    // to land the glyphs where the browser puts them.
    const y = `${boxTop + metrics.padding}+(${metrics.fontSize}-text_h)/2`

    const parts = [
      `fontfile='${fontPath}'`,
      `textfile='caption-${index}-${lineIndex}.txt'`,
      `fontcolor=${toFfmpegColor(style.textColor, style.textOpacity)}`,
      `fontsize=${metrics.fontSize}`,
      `x=${x}`,
      `y=${y}`,
      'fix_bounds=1',
      'expansion=none',
      `enable='${enable}'`,
    ]
    if (style.backgroundColor !== null) {
      parts.push('box=1', `boxcolor=${toFfmpegColor(style.backgroundColor, style.backgroundOpacity)}`)
      parts.push(`boxborderw=${metrics.padding}`)
    }
    if (metrics.outlineWidth > 0) {
      parts.push(`borderw=${metrics.outlineWidth}`, `bordercolor=${toFfmpegColor(style.outlineColor, 1)}`)
    }
    return `drawtext=${parts.join(':')}`
  })
}

/**
 * Build the drawtext filters for one title.
 *
 * One filter per line, like a caption, and for the same reason: drawtext draws
 * a single line. Every number comes from the shared style contract.
 */
function titleFilters(node: TitleOverlayNode, index: number, plan: RenderPlan, fontPath: string): string[] {
  const style = resolveTitleStyle(node.styleId)
  const metrics = resolveTitleMetrics(plan.width, plan.height, style)
  const startSeconds = ticksToSeconds(node.interval.start.ticks)
  const endSeconds = ticksToSeconds(node.interval.start.ticks + node.interval.duration.ticks)
  const enable = `gte(t\\,${startSeconds})*lt(t\\,${endSeconds})`
  const hasSubhead = node.subhead.length > 0

  const line = (lineIndex: number, fontSize: number, file: string): string => {
    const boxTop = titleLineTop(lineIndex, hasSubhead, node.placement, plan.height, metrics)
    // Same em-box correction the nameplate and caption use: FFmpeg measures the
    // glyphs, CSS measures the line box, so the difference is split evenly.
    const y = `${boxTop + metrics.padding}+(${fontSize}-text_h)/2`
    const parts = [
      `fontfile='${fontPath}'`,
      `textfile='${file}'`,
      `fontcolor=${toFfmpegColor(style.textColor, style.textOpacity)}`,
      `fontsize=${fontSize}`,
      `x=round((${plan.width}-text_w)/2)`,
      `y=${y}`,
      'fix_bounds=1',
      'expansion=none',
      `enable='${enable}'`,
    ]
    if (style.backgroundColor !== null) {
      parts.push('box=1', `boxcolor=${toFfmpegColor(style.backgroundColor, style.backgroundOpacity)}`)
      parts.push(`boxborderw=${metrics.padding}`)
    }
    return `drawtext=${parts.join(':')}`
  }

  const filters = [line(0, metrics.headlineFontSize, `title-${index}-0.txt`)]
  if (hasSubhead) filters.push(line(1, metrics.subheadFontSize, `title-${index}-1.txt`))
  return filters
}

/**
 * Build the filters for one callout: a rectangle, and optionally a label.
 *
 * `drawbox` is used rather than an overlaid image because it needs no extra
 * input file and its geometry is plain arithmetic the preview can reproduce
 * exactly in CSS.
 */
function calloutFilters(node: CalloutOverlayNode, index: number, plan: RenderPlan, fontPath: string): string[] {
  const style = resolveCalloutStyle(node.styleId)
  const metrics = resolveCalloutMetrics(plan.width, plan.height, style)
  const rect = calloutRectPixels(node.region, plan.width, plan.height)
  const startSeconds = ticksToSeconds(node.interval.start.ticks)
  const endSeconds = ticksToSeconds(node.interval.start.ticks + node.interval.duration.ticks)
  const enable = `gte(t\\,${startSeconds})*lt(t\\,${endSeconds})`

  const filters = [
    `drawbox=x=${rect.x}:y=${rect.y}:w=${rect.width}:h=${rect.height}` +
      `:color=${toFfmpegColor(style.borderColor, style.borderOpacity)}` +
      `:t=${metrics.borderWidth}:enable='${enable}'`,
  ]
  if (node.label.length > 0) {
    const labelTop = calloutLabelTop(rect, metrics)
    filters.push(
      `drawtext=fontfile='${fontPath}':textfile='callout-${index}.txt'` +
        `:fontcolor=${toFfmpegColor(style.labelColor, 1)}` +
        `:fontsize=${metrics.labelFontSize}` +
        `:x=${rect.x + metrics.labelPadding}` +
        `:y=${labelTop + metrics.labelPadding}+(${metrics.labelFontSize}-text_h)/2` +
        `:box=1:boxcolor=${toFfmpegColor(style.labelBackgroundColor, style.labelBackgroundOpacity)}` +
        `:boxborderw=${metrics.labelPadding}:fix_bounds=1:expansion=none:enable='${enable}'`,
    )
  }
  return filters
}

const MAX_FOOTAGE_MOTION_SAMPLES = 1_024

const motionStateAtSourceTick = (motion: FootageMotionNode, sourceTicks: number) => {
  const relativeTicks = Math.max(0, sourceTicks - motion.sourceInterval.start.ticks)
  return evaluateVisualProperties(Object.freeze({
    transform: motion.transform,
    crop: motion.crop,
    layer: 0,
    mask: DEFAULT_VISUAL_PROPERTIES.mask,
    tracks: motion.tracks,
    transition: DEFAULT_VISUAL_PROPERTIES.transition,
    effects: Object.freeze([]),
  }), relativeTicks, motion.sourceInterval.duration.ticks)
}

const balancedStepExpression = (
  values: readonly string[],
  durationSeconds: number,
  timeVariable: 't' | 'T',
): string => {
  if (values.length === 1 || values.every((value) => value === values[0])) return values[0]
  const step = durationSeconds / Math.max(1, values.length - 1)
  const build = (start: number, end: number): string => {
    if (start === end) return values[start]
    const middle = Math.floor((start + end) / 2)
    const boundary = compactNumber((middle + 0.5) * step)
    return `if(lt(${timeVariable},${boundary}),${build(start, middle)},${build(middle + 1, end)})`
  }
  return build(0, values.length - 1)
}

const motionExpression = (
  motion: FootageMotionNode,
  sourceStartTicks: number,
  durationTicks: number,
  frameRate: Readonly<{ numerator: number; denominator: number }>,
  select: (state: ReturnType<typeof motionStateAtSourceTick>) => number,
  timeVariable: 't' | 'T' = 't',
): string => {
  const frames = Math.ceil(
    (durationTicks / PROJECT_TIMESCALE) * frameRate.numerator / frameRate.denominator,
  )
  const sampleCount = Math.max(2, Math.min(MAX_FOOTAGE_MOTION_SAMPLES, frames + 1))
  const values: string[] = []
  for (let index = 0; index < sampleCount; index += 1) {
    const offset = Math.round((durationTicks * index) / (sampleCount - 1))
    values.push(compactNumber(select(motionStateAtSourceTick(motion, sourceStartTicks + offset))))
  }
  return balancedStepExpression(values, durationTicks / PROJECT_TIMESCALE, timeVariable)
}

const footageMotionExpressions = (
  motion: FootageMotionNode,
  sourceStartTicks: number,
  durationTicks: number,
  frameRate: Readonly<{ numerator: number; denominator: number }>,
) => Object.freeze({
  translateX: motionExpression(
    motion, sourceStartTicks, durationTicks, frameRate,
    (state) => state.transform.translateX,
  ),
  translateY: motionExpression(
    motion, sourceStartTicks, durationTicks, frameRate,
    (state) => state.transform.translateY,
  ),
  scale: motionExpression(
    motion, sourceStartTicks, durationTicks, frameRate,
    (state) => state.transform.scale,
  ),
  rotation: motionExpression(
    motion, sourceStartTicks, durationTicks, frameRate,
    (state) => state.transform.rotationDegrees,
  ),
  cropTop: motionExpression(
    motion, sourceStartTicks, durationTicks, frameRate,
    (state) => state.crop.top,
    'T',
  ),
  cropRight: motionExpression(
    motion, sourceStartTicks, durationTicks, frameRate,
    (state) => state.crop.right,
    'T',
  ),
  cropBottom: motionExpression(
    motion, sourceStartTicks, durationTicks, frameRate,
    (state) => state.crop.bottom,
    'T',
  ),
  cropLeft: motionExpression(
    motion, sourceStartTicks, durationTicks, frameRate,
    (state) => state.crop.left,
    'T',
  ),
})

const primaryFootageMotionFilters = (
  segment: RenderPlan['segments'][number],
  inputLabel: string,
  outputLabel: string,
  index: number,
  width: number,
  height: number,
  rate: string,
  frameRate: Readonly<{ numerator: number; denominator: number }>,
  durationTicks: number,
): readonly string[] => {
  const motion = segment.footageMotions[0]
  if (!motion) return Object.freeze([`[${inputLabel}]format=pix_fmts=yuv420p,setsar=1[${outputLabel}]`])

  const expressions = footageMotionExpressions(
    motion,
    segment.sourceStartTicks,
    durationTicks,
    frameRate,
  )
  const masked = `motion_masked_${index}`
  const scaled = `motion_scaled_${index}`
  const transformed = `motion_transformed_${index}`
  const background = `motion_background_${index}`
  const composited = `motion_composited_${index}`
  const durationSeconds = ticksToSeconds(durationTicks)
  const hasCrop = [
    expressions.cropTop,
    expressions.cropRight,
    expressions.cropBottom,
    expressions.cropLeft,
  ].some((expression) => expression !== '0')
  const hasRotation = expressions.rotation !== '0'
  const needsAlpha = hasCrop || hasRotation
  const filters: string[] = []
  let current = inputLabel

  if (hasCrop) {
    const alpha =
      `if(gte(X,W*(${expressions.cropLeft}))*lt(X,W*(1-(${expressions.cropRight})))*` +
      `gte(Y,H*(${expressions.cropTop}))*lt(Y,H*(1-(${expressions.cropBottom}))),alpha(X,Y),0)`
    filters.push(
      `[${current}]format=pix_fmts=rgba,` +
        `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${alpha}'[${masked}]`,
    )
    current = masked
  }

  filters.push(
    `[${current}]scale=` +
      `w='max(2,trunc(iw*(${expressions.scale})/2)*2)':` +
      `h='max(2,trunc(ih*(${expressions.scale})/2)*2)':eval=frame[${scaled}]`,
  )
  current = scaled

  if (hasRotation) {
    filters.push(
      `[${current}]${hasCrop ? '' : 'format=pix_fmts=rgba,'}` +
        `rotate='(${expressions.rotation})*PI/180':` +
        `ow='hypot(iw,ih)':oh='hypot(iw,ih)':c=black@0[${transformed}]`,
    )
    current = transformed
  }

  filters.push(
    `color=c=black:s=${width}x${height}:r=${rate}:d=${durationSeconds},` +
      `format=pix_fmts=${needsAlpha ? 'rgba' : 'yuv420p'}[${background}]`,
    `[${background}][${current}]overlay=` +
      `x='(W-w)/2+(${expressions.translateX})*W':` +
      `y='(H-h)/2+(${expressions.translateY})*H':` +
      `eval=frame:shortest=1:eof_action=pass[${composited}]`,
    `[${composited}]format=pix_fmts=yuv420p,setsar=1[${outputLabel}]`,
  )
  return Object.freeze(filters)
}

const splitSegmentForMotion = (
  segment: RenderPlan['segments'][number],
): readonly RenderPlan['segments'][number][] => {
  if (segment.footageMotions.length === 0) return Object.freeze([segment])
  const sourceStart = segment.sourceStartTicks
  const sourceEnd = sourceStart + segmentSourceDurationTicks(segment)
  const motionRate = segmentRate(segment)
  /** Where a point in the recording lands on screen, relative to this piece. */
  const onScreenOffset = (sourceTicks: number): number =>
    Math.round(((sourceTicks - sourceStart) * motionRate.denominator) / motionRate.numerator)
  const boundaries = new Set<number>([sourceStart, sourceEnd])
  for (const motion of segment.footageMotions) {
    const start = Math.max(sourceStart, motion.sourceInterval.start.ticks)
    const end = Math.min(sourceEnd, motion.sourceInterval.start.ticks + motion.sourceInterval.duration.ticks)
    if (end > start) {
      boundaries.add(start)
      boundaries.add(end)
    }
  }
  const ordered = [...boundaries].sort((left, right) => left - right)
  return Object.freeze(ordered.slice(0, -1).map((start, index) => {
    const end = ordered[index + 1]
    const active = segment.footageMotions.filter((motion) =>
      motion.sourceInterval.start.ticks <= start &&
      start < motion.sourceInterval.start.ticks + motion.sourceInterval.duration.ticks,
    )
    const first = index === 0
    const last = index === ordered.length - 2
    return Object.freeze({
      ...segment,
      nodeId: `${segment.nodeId}.motion.${index}`,
      // Both edges are converted to on-screen time separately and then
      // subtracted, exactly as the timeline itself does it, so the sub-pieces
      // still add up to the whole piece with no tick lost between them.
      interval: Object.freeze({
        start: Object.freeze({
          ticks: segment.interval.start.ticks + onScreenOffset(start),
          timescale: segment.interval.start.timescale,
        }),
        duration: Object.freeze({
          ticks: Math.max(1, onScreenOffset(end) - onScreenOffset(start)),
          timescale: segment.interval.duration.timescale,
        }),
      }),
      sourceStartTicks: start,
      sourceDurationTicks: end - start,
      footageMotions: Object.freeze(active),
      fadeInTicks: first ? segment.fadeInTicks : 0,
      fadeOutTicks: last ? segment.fadeOutTicks : 0,
      videoFadeInTicks: first ? segment.videoFadeInTicks : 0,
      videoFadeOutTicks: last ? segment.videoFadeOutTicks : 0,
      transitionAudioFadeInTicks: first ? segment.transitionAudioFadeInTicks : 0,
      transitionAudioFadeOutTicks: last ? segment.transitionAudioFadeOutTicks : 0,
    })
  }))
}

/** One stretch of the finished video: either real footage or a deliberate hole. */
type TimelinePiece =
  | { readonly kind: 'footage'; readonly durationTicks: number; readonly segment: RenderPlan['segments'][number] }
  | { readonly kind: 'hole'; readonly durationTicks: number }

/**
 * Lay the finished video out end to end, filling every hole explicitly.
 *
 * A hole is what "take this out but leave the space" produces. It has to become
 * real black and real silence, because FFmpeg joins pieces one after another
 * and has no notion of a gap between them; without this, removing a middle
 * section without rippling would silently shorten the export and every later
 * nameplate would land in the wrong place.
 */
export function layOutTimeline(plan: RenderPlan): readonly TimelinePiece[] {
  const ordered = [...plan.segments].sort((left, right) => left.interval.start.ticks - right.interval.start.ticks)
  const pieces: TimelinePiece[] = []
  let cursor = 0
  for (const segment of ordered) {
    if (segment.interval.start.ticks > cursor) {
      pieces.push({ kind: 'hole', durationTicks: segment.interval.start.ticks - cursor })
    }
    for (const motionSegment of splitSegmentForMotion(segment)) {
      pieces.push({
        kind: 'footage',
        durationTicks: motionSegment.interval.duration.ticks,
        segment: motionSegment,
      })
    }
    cursor = segment.interval.start.ticks + segment.interval.duration.ticks
  }
  if (cursor < plan.durationTicks) {
    pieces.push({ kind: 'hole', durationTicks: plan.durationTicks - cursor })
  }
  return Object.freeze(pieces)
}

/**
 * The filter graph is written to a file, not put on the command line.
 *
 * A captioned ten-minute talk produces roughly 200 cues, each up to two lines,
 * each one drawtext filter of about 250 characters — some 100,000 characters of
 * graph. Windows caps a whole command line at 32,767 characters, so the inline
 * form would have worked for nameplates and then failed the first time a real
 * video was captioned, with an error from the operating system that says
 * nothing about captions.
 *
 * Writing the graph to a file removes the ceiling entirely, and it is used for
 * every export rather than only the large ones, so there is one code path and
 * no size at which behaviour changes.
 */
export const FILTER_GRAPH_FILENAME = 'filtergraph.txt'

/** The whole filter graph as one string: cuts, holes, and everything drawn on top. */
export function buildFilterGraph(input: BuildArgumentsInput): string {
  const plan = validateRenderPlan(input.plan)
  if (!plan.ok) {
    throw renderError('RENDER_INPUT_INVALID', 'The render plan is invalid.')
  }
  if (plan.value.segments.some((segment) =>
    segment.direction === 'reverse' &&
    segmentSourceDurationTicks(segment) > MAX_REVERSE_SOURCE_DURATION_TICKS)) {
    throw renderError(
      'RENDER_INPUT_INVALID',
      'A backwards clip is longer than the thirty-second render safety limit.',
    )
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(input.fontPath)) {
    throw renderError('RENDER_INPUT_INVALID', 'The render font reference must be a fixed workspace filename.')
  }
  if (
    !Number.isSafeInteger(input.frameRate.numerator) || input.frameRate.numerator <= 0 ||
    !Number.isSafeInteger(input.frameRate.denominator) || input.frameRate.denominator <= 0
  ) {
    throw renderError('RENDER_INPUT_INVALID', 'The source frame rate is not usable.')
  }

  const { width, height } = plan.value
  const rate = `${input.frameRate.numerator}/${input.frameRate.denominator}`
  const pieces = layOutTimeline(plan.value)
  const segmentInputIndex = new Map(planInputs(plan.value).map((source) => [source.assetId, source.index]))
  const graph: string[] = []
  const concatInputs: string[] = []

  pieces.forEach((piece, index) => {
    const videoLabel = `v${index}`
    const audioLabel = `a${index}`
    const seconds = ticksToSeconds(piece.durationTicks)

    if (piece.kind === 'hole') {
      graph.push(`color=c=black:s=${width}x${height}:r=${rate}:d=${seconds},format=pix_fmts=yuv420p,setsar=1[${videoLabel}]`)
      if (input.hasAudio) {
        graph.push(
          `anullsrc=channel_layout=${AUDIO_CHANNEL_LAYOUT}:sample_rate=${AUDIO_SAMPLE_RATE}:d=${seconds}` +
            `,asetpts=PTS-STARTPTS[${audioLabel}]`,
        )
      }
    } else {
      // How much RECORDING to take. Before speed existed this was the same
      // number as how long the piece lasts on screen, and the exporter simply
      // reused that. A 2x piece takes twice as much recording as it occupies,
      // so the two numbers are now asked for separately.
      const from = ticksToSeconds(piece.segment.sourceStartTicks)
      const to = ticksToSeconds(piece.segment.sourceStartTicks + segmentSourceDurationTicks(piece.segment))
      const retimeVideo = videoSpeedSteps(piece.segment)
      const retimeAudio = audioSpeedSteps(piece.segment, AUDIO_SAMPLE_RATE)
      const transitionColor = segmentTransitionColor(piece.segment)
      const sourceVideoLabel = `source_video_${index}`
      const motionVideoLabel = `motion_video_${index}`
      /**
       * Which of FFmpeg's inputs holds THIS piece of footage.
       *
       * It used to be input zero, always, because the main sequence could only
       * ever be made of one recording. Now that it can hold several, the piece
       * says which recording it came from and this looks up the input that was
       * opened for it. Every file the plan needs is already listed in
       * `plan.sources` and already opened; the exporter simply never asked.
       */
      const segmentInput = segmentInputIndex.get(piece.segment.assetId)
      if (segmentInput === undefined) {
        throw renderError('RENDER_INPUT_INVALID', 'A piece of footage names a file the plan does not open.')
      }

      if (!piece.segment.videoEnabled) {
        // A hidden picture is black for exactly as long, produced without
        // decoding the footage at all — an export the user is waiting on should
        // not spend time drawing something they asked not to see. The piece
        // keeps its full length, so switching V1 back on restores the same
        // video rather than a differently-timed one.
        graph.push(
          `color=c=black:s=${width}x${height}:r=${rate}:d=${seconds},format=pix_fmts=yuv420p,setsar=1[${videoLabel}]`,
        )
      } else {
        // ── Make this piece the same shape as every other piece ──────────────
        //
        // `concat` below joins the pieces end to end, and it refuses outright
        // unless every piece is already the same width, the same height and the
        // same pixel shape. Nothing used to make that true: footage went in at
        // whatever size it was recorded at. That was invisible while a project
        // could only hold one recording — "the size of the footage" and "the
        // size of the finished video" were the same number by accident — and it
        // failed the ENTIRE export the moment a second recording of a different
        // size arrived:
        //
        //   Input link in0:v0 parameters (size 714x1280, SAR 1:1) do not match
        //   the corresponding output link in0:v0 parameters (1920x1080, SAR 1:1)
        //
        // That is FAIL-051. It was recorded as "portrait phone footage cannot
        // export", but it was never only about portrait: 1080p next to 720p
        // failed identically.
        //
        // The framing rule itself is not written here. It lives in one file that
        // the browser preview reads too, so the two cannot drift apart — see
        // `visual-normalization.ts`.
        //
        // It happens BEFORE the motion filters on purpose. Motion moves and
        // scales the picture relative to the canvas; running it against a
        // picture that is not yet canvas-shaped would scale an upright phone
        // clip relative to its own 714x1280 instead, and "no motion" would not
        // mean the same framing as "motion that changes nothing".
        const normalizedLabel = `normalized_video_${index}`
        // Reverse and speed sit between "take this part of the recording" and
        // "make it this many frames per second". Reversing after the frame
        // rate was fixed would reverse frames that had already been duplicated
        // or dropped, and the last frame would land at the wrong instant.
        graph.push(
          `[${segmentInput}:v]trim=start=${from}:end=${to},setpts=PTS-STARTPTS` +
            `${retimeVideo.length > 0 ? `,${retimeVideo.join(',')}` : ''},fps=${rate}[${sourceVideoLabel}]`,
        )
        graph.push(
          `[${sourceVideoLabel}]${normalizationFilterSteps({
            canvasWidth: width,
            canvasHeight: height,
            fitMode: plan.value.framing ?? 'fit',
          }).join(',')}[${normalizedLabel}]`,
        )
        graph.push(...primaryFootageMotionFilters(
          piece.segment,
          normalizedLabel,
          motionVideoLabel,
          index,
          width,
          height,
          rate,
          input.frameRate,
          piece.durationTicks,
        ))
        const videoSteps: string[] = []
        if (piece.segment.videoFadeInTicks > 0) {
          videoSteps.push(`fade=t=in:st=0:d=${ticksToSeconds(piece.segment.videoFadeInTicks)}:color=${transitionColor}`)
        }
        if (piece.segment.videoFadeOutTicks > 0) {
          videoSteps.push(
            `fade=t=out:st=${ticksToSeconds(piece.durationTicks - piece.segment.videoFadeOutTicks)}` +
              `:d=${ticksToSeconds(piece.segment.videoFadeOutTicks)}:color=${transitionColor}`,
          )
        }
        videoSteps.push('format=pix_fmts=yuv420p', 'setsar=1')
        graph.push(`[${motionVideoLabel}]${videoSteps.join(',')}[${videoLabel}]`)
      }

      if (input.hasAudio && !piece.segment.audioEnabled) {
        // Muted dialogue is real silence of the same length, not the clip at a
        // very low volume. Very low is still audible on headphones.
        graph.push(
          `anullsrc=channel_layout=${AUDIO_CHANNEL_LAYOUT}:sample_rate=${AUDIO_SAMPLE_RATE}:d=${seconds}` +
            `,asetpts=PTS-STARTPTS[${audioLabel}]`,
        )
      } else if (input.hasAudio) {
        const steps = [
          `[${segmentInput}:a]atrim=start=${from}:end=${to}`,
          'asetpts=PTS-STARTPTS',
          `aresample=${AUDIO_SAMPLE_RATE}`,
          `aformat=sample_fmts=fltp:channel_layouts=${AUDIO_CHANNEL_LAYOUT}`,
        ]
        // Speed and direction come BEFORE loudness, ramps and left/right, so
        // that a half-second fade is half a second of FINISHED VIDEO. Applied
        // the other way round, a fade on a 2x piece would last a quarter of a
        // second on screen and the ramp the user dragged would be wrong.
        steps.push(...retimeAudio)
        // Timestamps are restated after retiming: `atempo` and `areverse` both
        // leave the stream starting somewhere other than zero, and `concat`
        // joins on timestamps.
        if (retimeAudio.length > 0) steps.push('asetpts=PTS-STARTPTS')
        if (piece.segment.gainDb !== 0) steps.push(`volume=${piece.segment.gainDb}dB`)
        const pan = panFilter(piece.segment.pan ?? 0)
        if (pan !== null) steps.push(pan)
        if (piece.segment.fadeInTicks > 0) {
          steps.push(`afade=t=in:st=0:d=${ticksToSeconds(piece.segment.fadeInTicks)}`)
        }
        if (piece.segment.fadeOutTicks > 0) {
          const start = piece.durationTicks - piece.segment.fadeOutTicks
          steps.push(`afade=t=out:st=${ticksToSeconds(start)}:d=${ticksToSeconds(piece.segment.fadeOutTicks)}`)
        }
        if (piece.segment.transitionAudioFadeInTicks > 0) {
          steps.push(`afade=t=in:st=0:d=${ticksToSeconds(piece.segment.transitionAudioFadeInTicks)}`)
        }
        if (piece.segment.transitionAudioFadeOutTicks > 0) {
          const start = piece.durationTicks - piece.segment.transitionAudioFadeOutTicks
          steps.push(
            `afade=t=out:st=${ticksToSeconds(start)}:` +
              `d=${ticksToSeconds(piece.segment.transitionAudioFadeOutTicks)}`,
          )
        }
        graph.push(`${steps.join(',')}[${audioLabel}]`)
      }
    }

    concatInputs.push(`[${videoLabel}]`)
    if (input.hasAudio) concatInputs.push(`[${audioLabel}]`)
  })

  const audioStreams = input.hasAudio ? 1 : 0
  graph.push(
    `${concatInputs.join('')}concat=n=${pieces.length}:v=1:a=${audioStreams}` +
      `[vcat]${input.hasAudio ? '[acat]' : ''}`,
  )

  const inputIndex = new Map(planInputs(plan.value).map((source) => [source.assetId, source.index]))
  const totalSeconds = ticksToSeconds(plan.value.durationTicks)

  // ── Layer one: B-roll and pictures, composited UNDER everything written ────
  //
  // Done before any text so a clip dropped over a caption cannot hide it. Each
  // overlay consumes the previous picture and produces the next, so they stack
  // in the plan's own order.
  let videoLabel = 'vcat'
  const mediaOverlays = plan.value.overlays.filter((node) => node.kind === 'media-overlay')
  mediaOverlays.forEach((node, index) => {
    const source = inputIndex.get(node.assetId)
    if (source === undefined) {
      throw renderError('RENDER_INPUT_INVALID', 'An overlay names a file the plan does not list.')
    }
    const boxX = Math.round(node.region.x * width)
    const boxY = Math.round(node.region.y * height)
    const boxWidth = Math.max(2, Math.round(node.region.width * width))
    const boxHeight = Math.max(2, Math.round(node.region.height * height))
    const from = ticksToSeconds(node.sourceStartTicks)
    const to = ticksToSeconds(node.sourceStartTicks + node.interval.duration.ticks)

    const startSeconds = ticksToSeconds(node.interval.start.ticks)
    const endSeconds = ticksToSeconds(node.interval.start.ticks + node.interval.duration.ticks)
    const visual = visualForNode(plan.value, node.nodeId)

    const steps = [
      `[${source}:v]trim=start=${from}:end=${to}`,
      // Moved to the moment it actually appears, not reset to zero.
      //
      // `setpts=PTS-STARTPTS` alone puts the trimmed clip at time 0. A four
      // second clip then exists only from 0s to 4s — so an overlay enabled at
      // 11s had NOTHING to composite and silently drew nothing. The export
      // succeeded, the file was the right length, and the B-roll was simply
      // absent. Adding the start time shifts the clip onto the moment it
      // belongs to, which is what makes `enable` and the frames agree.
      // `decrease` fits the clip inside the box while keeping its own shape, so
      // a tall phone clip in a wide box is letterboxed rather than squashed.
      // This is the same rule `fitInsideRegion` states for the preview.
      `scale=${boxWidth}:${boxHeight}:force_original_aspect_ratio=decrease`,
      // H.264 with 4:2:0 colour cannot encode an odd dimension.
      'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      'setsar=1',
      ...mediaVisualFilters(visual, node.interval.duration.ticks, node.opacity),
      `setpts=PTS-STARTPTS+${startSeconds}/TB`,
    ]
    graph.push(`${steps.join(',')}[b${index}]`)

    const next = `vm${index}`
    // `overlay=` and not `overlay:` — a filter's FIRST option is joined to its
    // name with an equals sign, and only the options after it are separated by
    // colons. Getting this wrong produced a graph that read correctly to a
    // human and was rejected by FFmpeg with "No option name near…".
    graph.push(
      `[${videoLabel}][b${index}]overlay` +
        `=x='${mediaOverlayPosition(
          visual,
          'x',
          node.interval.start.ticks,
          node.interval.duration.ticks,
          boxX,
          boxWidth,
          width,
        )}'` +
        `:y='${mediaOverlayPosition(
          visual,
          'y',
          node.interval.start.ticks,
          node.interval.duration.ticks,
          boxY,
          boxHeight,
          height,
        )}'` +
        `:eof_action=pass:shortest=0` +
        `:enable='gte(t\\,${startSeconds})*lt(t\\,${endSeconds})'[${next}]`,
    )
    videoLabel = next
  })

  // ── Layer two: everything written on the picture ──────────────────────────
  const written = plan.value.overlays
    .map((node, index) => ({ node, index, visual: visualForNode(plan.value, node.nodeId) }))
    .filter((entry) => entry.node.kind !== 'media-overlay')
    .sort((left, right) =>
      (left.visual?.layer ?? 0) - (right.visual?.layer ?? 0) || left.index - right.index,
    )
  written.forEach(({ node, index, visual }, writtenIndex) => {
    if (node.kind === 'media-overlay') return
    const filters: string[] = []
    if (node.kind === 'caption-overlay') {
      for (const line of node.lines) {
        if (Buffer.byteLength(line, 'utf8') > MAX_TEXT_BYTES) {
          throw renderError('RENDER_INPUT_INVALID', 'A caption exceeds the render text limit.')
        }
      }
      filters.push(...captionFilters(node, index, plan.value, input.fontPath))
    } else if (node.kind === 'title-overlay') {
      if (
        Buffer.byteLength(node.headline, 'utf8') > MAX_TEXT_BYTES ||
        Buffer.byteLength(node.subhead, 'utf8') > MAX_TEXT_BYTES
      ) {
        throw renderError('RENDER_INPUT_INVALID', 'A title exceeds the render text limit.')
      }
      filters.push(...titleFilters(node, index, plan.value, input.fontPath))
    } else if (node.kind === 'callout-overlay') {
      if (Buffer.byteLength(node.label, 'utf8') > MAX_TEXT_BYTES) {
        throw renderError('RENDER_INPUT_INVALID', 'A callout label exceeds the render text limit.')
      }
      filters.push(...calloutFilters(node, index, plan.value, input.fontPath))
    } else {
      if (
        Buffer.byteLength(node.primaryText, 'utf8') > MAX_TEXT_BYTES ||
        Buffer.byteLength(node.secondaryText, 'utf8') > MAX_TEXT_BYTES
      ) {
        throw renderError('RENDER_INPUT_INVALID', 'A nameplate exceeds the render text limit.')
      }
      filters.push(...nameplateFilters(node, index, plan.value, input.fontPath))
    }

    const base = `wtbase${writtenIndex}`
    const drawn = `wtdrawn${writtenIndex}`
    const styled = `wtstyled${writtenIndex}`
    graph.push(
      `color=c=black@0.0:s=${width}x${height}:r=${rate}:d=${totalSeconds},` +
        `format=pix_fmts=rgba,setsar=1[${base}]`,
    )
    graph.push(`[${base}]${filters.join(',')}[${drawn}]`)
    const visualFilters = mediaVisualFilters(
      visual,
      node.interval.duration.ticks,
      1,
      node.interval.start.ticks,
    )
    graph.push(`[${drawn}]${visualFilters.length > 0 ? visualFilters.join(',') : 'null'}[${styled}]`)

    const next = `vw${writtenIndex}`
    const startSeconds = ticksToSeconds(node.interval.start.ticks)
    const endSeconds = ticksToSeconds(node.interval.start.ticks + node.interval.duration.ticks)
    graph.push(
      `[${videoLabel}][${styled}]overlay` +
        `=x='${mediaOverlayPosition(
          visual,
          'x',
          node.interval.start.ticks,
          node.interval.duration.ticks,
          0,
          width,
          width,
        )}'` +
        `:y='${mediaOverlayPosition(
          visual,
          'y',
          node.interval.start.ticks,
          node.interval.duration.ticks,
          0,
          height,
          height,
        )}'` +
        ':eof_action=pass:shortest=0' +
        `:enable='gte(t\\,${startSeconds})*lt(t\\,${endSeconds})'[${next}]`,
    )
    videoLabel = next
  })
  graph.push(`[${videoLabel}]null[vout]`)

  // ── Sound ─────────────────────────────────────────────────────────────────
  //
  // Music and B-roll sound are laid UNDER the footage's own audio rather than
  // replacing it. A project whose footage is silent still gets a real audio
  // track when music is added, because a file with no audio stream at all
  // behaves differently in every player and uploader.
  const brollAudio = mediaOverlays.filter((node) => node.useOverlayAudio)
  const extraAudio: string[] = []

  const delayedAudio = (
    label: string,
    sourceIndexValue: number,
    startTicks: number,
    sourceStartTicks: number,
    durationTicks: number,
    gainDb: number,
    fadeInTicks: number,
    fadeOutTicks: number,
  ): void => {
    const from = ticksToSeconds(sourceStartTicks)
    const to = ticksToSeconds(sourceStartTicks + durationTicks)
    const steps = [
      `[${sourceIndexValue}:a]atrim=start=${from}:end=${to}`,
      'asetpts=PTS-STARTPTS',
      `aresample=${AUDIO_SAMPLE_RATE}`,
      `aformat=sample_fmts=fltp:channel_layouts=${AUDIO_CHANNEL_LAYOUT}`,
    ]
    if (gainDb !== 0) steps.push(`volume=${gainDb}dB`)
    if (fadeInTicks > 0) steps.push(`afade=t=in:st=0:d=${ticksToSeconds(fadeInTicks)}`)
    if (fadeOutTicks > 0) {
      steps.push(`afade=t=out:st=${ticksToSeconds(durationTicks - fadeOutTicks)}:d=${ticksToSeconds(fadeOutTicks)}`)
    }
    if (startTicks > 0) {
      // adelay takes whole milliseconds, one value per channel. One tick is
      // about 0.0007 ms, so rounding here is far below anything audible.
      const delayMs = Math.round(startTicks / (PROJECT_TIMESCALE / 1000))
      steps.push(`adelay=${delayMs}|${delayMs}`)
    }
    graph.push(`${steps.join(',')}[${label}]`)
    extraAudio.push(`[${label}]`)
  }

  plan.value.music.forEach((node, index) => {
    const source = inputIndex.get(node.assetId)
    if (source === undefined) {
      throw renderError('RENDER_INPUT_INVALID', 'Music names a file the plan does not list.')
    }
    delayedAudio(
      `mus${index}`,
      source,
      node.interval.start.ticks,
      node.sourceStartTicks,
      node.interval.duration.ticks,
      node.gainDb,
      node.fadeInTicks,
      node.fadeOutTicks,
    )
  })

  brollAudio.forEach((node, index) => {
    const source = inputIndex.get(node.assetId)
    if (source === undefined) return
    delayedAudio(
      `bra${index}`,
      source,
      node.interval.start.ticks,
      node.sourceStartTicks,
      node.interval.duration.ticks,
      0,
      0,
      0,
    )
  })

  if (extraAudio.length > 0) {
    let base = 'acat'
    if (!input.hasAudio) {
      // Silence the exact length of the finished video, so the mix below has a
      // first input whose duration governs the result.
      graph.push(
        `anullsrc=channel_layout=${AUDIO_CHANNEL_LAYOUT}:sample_rate=${AUDIO_SAMPLE_RATE}:d=${totalSeconds}` +
          ',asetpts=PTS-STARTPTS[asilent]',
      )
      base = 'asilent'
    }
    graph.push(
      `[${base}]${extraAudio.join('')}amix=inputs=${extraAudio.length + 1}` +
        // `duration=first` keeps the export exactly as long as the picture, so a
        // long song cannot stretch the file. `normalize=0` stops FFmpeg quietly
        // halving the speech to make room for the music.
        ':duration=first:dropout_transition=0:normalize=0[aout]',
    )
  } else if (input.hasAudio) {
    graph.push('[acat]anull[aout]')
  }

  return graph.join(';')
}

/** True when the finished file will carry a sound track. */
export function planHasAudio(plan: RenderPlan, sourceHasAudio: boolean): boolean {
  return (
    sourceHasAudio ||
    plan.music.length > 0 ||
    plan.overlays.some((node) => node.kind === 'media-overlay' && node.useOverlayAudio)
  )
}

/**
 * The full FFmpeg command, reading its filter graph from
 * `FILTER_GRAPH_FILENAME` in the working directory the adapter creates.
 */
export function buildFfmpegArguments(input: BuildArgumentsInput): string[] {
  // Built and discarded here purely so an invalid plan or frame rate is refused
  // by the same code path whether a caller wants the graph or the command.
  buildFilterGraph(input)

  const paths = input.extraSourcePaths ?? {}
  const rate = `${input.frameRate.numerator}/${input.frameRate.denominator}`
  const extraInputs: string[] = []
  // Input 0 is the main footage; every other source follows in the plan's own
  // order, which is exactly the order `planInputs` reports to the filter graph.
  for (const source of planInputs(input.plan).slice(1)) {
    const path = paths[source.assetId]
    if (path === undefined) {
      throw renderError('RENDER_INPUT_INVALID', 'A file the plan needs was not supplied to the renderer.')
    }
    if (source.mediaKind === 'image') {
      // A still picture is one frame. `-loop 1` turns it into a stream, and
      // `-t` bounds that stream to the last instant anything actually needs it,
      // because an unbounded looping input would never finish on its own.
      const seconds = (latestUseTicks(input.plan, source.assetId) / PROJECT_TIMESCALE).toFixed(9)
      extraInputs.push('-loop', '1', '-framerate', rate, '-t', seconds, '-i', path)
    } else {
      extraInputs.push('-i', path)
    }
  }

  const hasOutputAudio = planHasAudio(input.plan, input.hasAudio)

  return [
    '-hide_banner',
    '-loglevel', 'error',
    '-nostdin',
    '-n',
    '-i', input.sourcePath,
    ...extraInputs,
    '-filter_complex_script', FILTER_GRAPH_FILENAME,
    '-map', '[vout]',
    ...(hasOutputAudio ? ['-map', '[aout]'] : []),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    // Measured on the representative 1080p fixture: four fixed threads reduced
    // a 10-second encode from 33.1s to 13.9s (2.38x) at the same CRF/preset,
    // while remaining bounded and predictable on an ordinary local machine.
    '-threads', '4',
    '-pix_fmt', 'yuv420p',
    // Audio is re-encoded from the conformed graph above. It is no longer
    // copied, because copied audio can only be cut at its own block boundaries
    // and drifts out of sync with the picture at the first cut.
    ...(hasOutputAudio
      ? ['-c:a', 'aac', '-b:a', '192k', '-ar', String(AUDIO_SAMPLE_RATE), '-ac', '2']
      : ['-an']),
    '-map_metadata', '-1',
    '-movflags', '+faststart',
    input.outputPath,
  ]
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw renderError('RENDER_CANCELLED', 'Export was cancelled.')
}

async function sha256(path: string, signal?: AbortSignal): Promise<string> {
  throwIfCancelled(signal)
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) {
    throwIfCancelled(signal)
    hash.update(chunk)
  }
  throwIfCancelled(signal)
  return hash.digest('hex')
}

async function validatePaths(request: RenderRequest, fontPath: string) {
  const work = await realpath(request.trustedWorkDir).catch(() => {
    throw renderError('RENDER_PATH_INVALID', 'The trusted render workspace does not exist.')
  })
  const sourcePath = await realpath(request.sourcePath).catch(() => {
    throw renderError('RENDER_PATH_INVALID', 'The controlled source media does not exist.')
  })
  const source = await stat(sourcePath)
  if (!source.isFile()) throw renderError('RENDER_PATH_INVALID', 'The controlled source media is not a file.')
  const font = await realpath(fontPath).catch(() => {
    throw renderError('RENDER_PATH_INVALID', 'The configured renderer font does not exist.')
  })
  if (!(await stat(font)).isFile()) throw renderError('RENDER_PATH_INVALID', 'The configured renderer font is not a file.')

  const requestedOutputPath = resolve(request.outputPath)
  const outputParent = await realpath(dirname(requestedOutputPath)).catch(() => {
    throw renderError('RENDER_PATH_INVALID', 'The render output directory does not exist.')
  })
  const outputPath = resolve(outputParent, basename(requestedOutputPath))
  if (!isInside(work, outputParent) || outputPath === sourcePath || !/\.mp4$/i.test(basename(outputPath))) {
    throw renderError('RENDER_PATH_INVALID', 'The render output must be a distinct MP4 inside the trusted workspace.')
  }
  try {
    await lstat(outputPath)
    throw renderError('RENDER_PATH_INVALID', 'The render output already exists.')
  } catch (error) {
    if (!isMissing(error)) throw error
  }
  return { work, sourcePath, outputPath, fontPath: font }
}

async function cleanupPrivatePartial(path: string): Promise<void> {
  try {
    const info = await lstat(path)
    if (info.isFile() && info.nlink === 1) await chmod(path, 0o600).catch(() => undefined)
    await rm(path, { force: true })
  } catch (error) {
    if (!isMissing(error)) throw error
  }
}

export function createFfmpegRenderAdapter(options: AdapterOptions): RenderPort {
  const ffmpegExecutable = options.ffmpegExecutable ?? 'ffmpeg'
  const runCommand = options.runCommand ?? createCommandRunner()
  const mediaProbe = options.mediaProbe ?? createFfprobeMediaProbe({
    ffprobeExecutable: options.ffprobeExecutable,
    runCommand,
  })

  return {
    async render(request): Promise<RenderResult> {
      if (request.signal?.aborted) throw renderError('RENDER_CANCELLED', 'Export was cancelled.')
      const plan = validateRenderPlan(request.plan)
      if (!plan.ok) throw renderError('RENDER_INPUT_INVALID', 'The render plan is invalid.')

      const paths = await validatePaths(request, options.fontPath)
      const sourceProbe = await mediaProbe.probe({ path: paths.sourcePath, cwd: paths.work, signal: request.signal })

      // The plan was compiled against the project's own record of the media.
      // If the file on disk disagrees, something replaced it, and rendering
      // would silently produce a video that does not match what was approved.
      if (sourceProbe.width !== plan.value.width || sourceProbe.height !== plan.value.height) {
        throw renderError('RENDER_INPUT_INVALID', 'The source media no longer matches the project composition.')
      }
      // Black filling a deliberate hole has to be generated at the source's own
      // frame rate, or the joined pieces disagree and the export stutters. If
      // the rate cannot be read, that is refused rather than guessed at.
      const frameRate = sourceProbe.frameRate
      if (frameRate === null) {
        throw renderError('RENDER_INPUT_INVALID', 'The source media frame rate could not be read.')
      }
      // Every extra file the plan names must exist and be a real file before a
      // single frame is encoded. Checking here rather than letting FFmpeg fail
      // means a missing B-roll clip produces a sentence about a missing clip,
      // not a wall of encoder output.
      const extraPaths: Record<string, string> = {}
      for (const source of planInputs(plan.value).slice(1)) {
        const supplied = request.extraSourcePaths?.[source.assetId]
        if (supplied === undefined) {
          throw renderError('RENDER_INPUT_INVALID', 'A file this export needs was not provided.')
        }
        const canonical = await realpath(supplied).catch(() => {
          throw renderError('RENDER_PATH_INVALID', 'A file this export needs is missing.')
        })
        if (!(await stat(canonical)).isFile()) {
          throw renderError('RENDER_PATH_INVALID', 'A file this export needs is not a file.')
        }
        extraPaths[source.assetId] = canonical
      }

      /**
       * Every piece of footage must exist inside ITS OWN file on disk.
       *
       * This used to measure every piece against the FIRST recording, which was
       * right while the main sequence could only be made of one. The moment it
       * could hold two, a perfectly valid forty-second second recording was
       * refused for being longer than the thirty-second first one, and the user
       * was told their edit "extends beyond the source duration" — about an edit
       * that fitted perfectly.
       *
       * Each recording is now measured against itself.
       */
      const sourceDurationTicks = new Map<string, number>()
      sourceDurationTicks.set(plan.value.sources[0].assetId, sourceProbe.duration.ticks)
      for (const source of planInputs(plan.value).slice(1)) {
        // Only footage is laid out as segments; a picture has no length of its
        // own and music is measured on the finished video, not on itself.
        if (source.mediaKind !== 'video') continue
        const probe = await mediaProbe.probe({
          path: extraPaths[source.assetId],
          cwd: paths.work,
          signal: request.signal,
        })
        sourceDurationTicks.set(source.assetId, probe.duration.ticks)
      }
      // Overlays no longer need this check: they are positioned from the
      // segments, so a segment that fits guarantees an overlay that fits.
      for (const segment of plan.value.segments) {
        const available = sourceDurationTicks.get(segment.assetId)
        if (available === undefined) {
          throw renderError('RENDER_INPUT_INVALID', 'A piece of footage names a file this export did not open.')
        }
        const endTicks = segment.sourceStartTicks + segmentSourceDurationTicks(segment)
        if (endTicks > available) {
          throw renderError('RENDER_INPUT_INVALID', 'An accepted edit extends beyond the source duration.')
        }
      }

      const renderTempDir = resolve(paths.work, `.render-${randomUUID()}`)
      const partialPath = resolve(renderTempDir, 'output.mp4')
      try {
        await mkdir(renderTempDir, { recursive: false, mode: 0o700 })
        const canonicalRenderTempDir = await realpath(renderTempDir)
        if (canonicalRenderTempDir !== renderTempDir || !isInside(paths.work, canonicalRenderTempDir)) {
          throw renderError('RENDER_PATH_INVALID', 'The private render workspace is not safe.')
        }
        await copyFile(paths.fontPath, resolve(renderTempDir, 'font.ttf'), constants.COPYFILE_EXCL)
        // Text is handed to FFmpeg in files rather than on the command line, so
        // nothing a user typed can be read as filter syntax.
        const write = (name: string, contents: string) =>
          writeFile(resolve(renderTempDir, name), contents, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
        await Promise.all(plan.value.overlays.flatMap((node, index) => {
          if (node.kind === 'media-overlay') return []
          if (node.kind === 'caption-overlay') {
            return node.lines.map((line, lineIndex) => write(`caption-${index}-${lineIndex}.txt`, line))
          }
          if (node.kind === 'title-overlay') {
            const files = [write(`title-${index}-0.txt`, node.headline)]
            if (node.subhead.length > 0) files.push(write(`title-${index}-1.txt`, node.subhead))
            return files
          }
          if (node.kind === 'callout-overlay') {
            return node.label.length > 0 ? [write(`callout-${index}.txt`, node.label)] : []
          }
          const files = [write(`primary-${index}.txt`, node.primaryText)]
          if (node.secondaryText.length > 0) files.push(write(`secondary-${index}.txt`, node.secondaryText))
          return files
        }))

        const buildInput = {
          sourcePath: paths.sourcePath,
          outputPath: partialPath,
          fontPath: 'font.ttf',
          plan: plan.value,
          frameRate,
          hasAudio: sourceProbe.hasAudio,
          extraSourcePaths: extraPaths,
        }
        await write(FILTER_GRAPH_FILENAME, buildFilterGraph(buildInput))
        const command = buildFfmpegArguments(buildInput)
        request.onMilestone?.('rendering')
        const rendered = await runCommand({
          executable: ffmpegExecutable,
          args: command,
          cwd: renderTempDir,
          signal: request.signal,
        })
        if (rendered.exitCode !== 0) {
          throw renderError('RENDER_FAILED', 'FFmpeg could not render the accepted edits.')
        }
        // FFmpeg has exited successfully. Everything after this point reads the
        // produced file rather than encoding, so a stall here is a verification
        // stall and is attributable as one.
        request.onMilestone?.('verifying')
        const outputInfo = await lstat(partialPath).catch((error) => {
          if (isMissing(error)) throw renderError('RENDER_OUTPUT_MISSING', 'FFmpeg completed without producing an output file.')
          throw error
        })
        const canonicalPartial = await realpath(partialPath).catch(() => '')
        if (!outputInfo.isFile() || outputInfo.size <= 0 || outputInfo.nlink !== 1 || canonicalPartial !== partialPath) {
          throw renderError('RENDER_OUTPUT_INVALID', 'FFmpeg did not produce a private regular output file.')
        }
        const outputProbe = await mediaProbe.probe({ path: partialPath, cwd: paths.work, signal: request.signal })
        // The length to check against is the PLAN's, not the source file's.
        // After a cut the export is deliberately shorter, and comparing it to
        // the original would reject every successful cut.
        const expectedDurationMs = plan.value.durationTicks / (PROJECT_TIMESCALE / 1000)
        if (
          outputProbe.width !== sourceProbe.width ||
          outputProbe.height !== sourceProbe.height ||
          Math.abs(outputProbe.durationMs - expectedDurationMs) > DURATION_TOLERANCE_MS ||
          (planHasAudio(plan.value, sourceProbe.hasAudio) && !outputProbe.hasAudio)
        ) {
          throw renderError('RENDER_OUTPUT_INVALID', 'The rendered output did not match the approved dimensions, length, and audio.')
        }
        const outputSha256 = await sha256(partialPath, request.signal)
        throwIfCancelled(request.signal)
        await chmod(partialPath, 0o444)
        const currentOutputParent = await realpath(dirname(paths.outputPath)).catch(() => '')
        if (currentOutputParent !== dirname(paths.outputPath)) {
          throw renderError('RENDER_PATH_INVALID', 'The render output directory changed before publication.')
        }
        throwIfCancelled(request.signal)
        await link(partialPath, paths.outputPath)
        await rm(partialPath, { force: true }).catch(() => undefined)
        return Object.freeze({
          outputPath: paths.outputPath,
          width: outputProbe.width,
          height: outputProbe.height,
          durationMs: outputProbe.durationMs,
          hasAudio: outputProbe.hasAudio,
          sha256: outputSha256,
          projectRevision: plan.value.projectRevision,
        })
      } catch (error) {
        await cleanupPrivatePartial(partialPath).catch(() => undefined)
        if (request.signal?.aborted) throw renderError('RENDER_CANCELLED', 'Export was cancelled.')
        if (error instanceof RenderError) throw error
        throw renderError('RENDER_FAILED', 'The renderer failed safely before publishing an export.')
      } finally {
        await rm(renderTempDir, { recursive: true, force: true }).catch(() => undefined)
      }
    },
  }
}
