import { createHash, randomUUID } from 'node:crypto'
import { constants, createReadStream } from 'node:fs'
import { chmod, copyFile, link, lstat, mkdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path'

import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import {
  validateRenderPlan,
  type CalloutOverlayNode,
  type CaptionOverlayNode,
  type RenderPlan,
  type TextOverlayNode,
  type TitleOverlayNode,
} from '@sanverse/render-contract'
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
    pieces.push({ kind: 'footage', durationTicks: segment.interval.duration.ticks, segment })
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
      const from = ticksToSeconds(piece.segment.sourceStartTicks)
      const to = ticksToSeconds(piece.segment.sourceStartTicks + piece.durationTicks)
      graph.push(
        `[0:v]trim=start=${from}:end=${to},setpts=PTS-STARTPTS,fps=${rate},format=pix_fmts=yuv420p,setsar=1[${videoLabel}]`,
      )
      if (input.hasAudio) {
        const steps = [
          `[0:a]atrim=start=${from}:end=${to}`,
          'asetpts=PTS-STARTPTS',
          `aresample=${AUDIO_SAMPLE_RATE}`,
          `aformat=sample_fmts=fltp:channel_layouts=${AUDIO_CHANNEL_LAYOUT}`,
        ]
        if (piece.segment.gainDb !== 0) steps.push(`volume=${piece.segment.gainDb}dB`)
        if (piece.segment.fadeInTicks > 0) {
          steps.push(`afade=t=in:st=0:d=${ticksToSeconds(piece.segment.fadeInTicks)}`)
        }
        if (piece.segment.fadeOutTicks > 0) {
          const start = piece.durationTicks - piece.segment.fadeOutTicks
          steps.push(`afade=t=out:st=${ticksToSeconds(start)}:d=${ticksToSeconds(piece.segment.fadeOutTicks)}`)
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

    const steps = [
      `[${source}:v]trim=start=${from}:end=${to}`,
      'setpts=PTS-STARTPTS',
      // `decrease` fits the clip inside the box while keeping its own shape, so
      // a tall phone clip in a wide box is letterboxed rather than squashed.
      // This is the same rule `fitInsideRegion` states for the preview.
      `scale=${boxWidth}:${boxHeight}:force_original_aspect_ratio=decrease`,
      // H.264 with 4:2:0 colour cannot encode an odd dimension.
      'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      'setsar=1',
    ]
    if (node.opacity < 1) {
      steps.push('format=pix_fmts=yuva420p', `colorchannelmixer=aa=${node.opacity}`)
    }
    graph.push(`${steps.join(',')}[b${index}]`)

    const startSeconds = ticksToSeconds(node.interval.start.ticks)
    const endSeconds = ticksToSeconds(node.interval.start.ticks + node.interval.duration.ticks)
    const next = `vm${index}`
    graph.push(
      `[${videoLabel}][b${index}]overlay` +
        `:x='${boxX}+(${boxWidth}-overlay_w)/2'` +
        `:y='${boxY}+(${boxHeight}-overlay_h)/2'` +
        `:eof_action=pass:shortest=0` +
        `:enable='gte(t\\,${startSeconds})*lt(t\\,${endSeconds})'[${next}]`,
    )
    videoLabel = next
  })

  // ── Layer two: everything written on the picture ──────────────────────────
  const overlayFilters: string[] = []
  plan.value.overlays.forEach((node, index) => {
    if (node.kind === 'media-overlay') return
    if (node.kind === 'caption-overlay') {
      for (const line of node.lines) {
        if (Buffer.byteLength(line, 'utf8') > MAX_TEXT_BYTES) {
          throw renderError('RENDER_INPUT_INVALID', 'A caption exceeds the render text limit.')
        }
      }
      overlayFilters.push(...captionFilters(node, index, plan.value, input.fontPath))
      return
    }
    if (node.kind === 'title-overlay') {
      if (
        Buffer.byteLength(node.headline, 'utf8') > MAX_TEXT_BYTES ||
        Buffer.byteLength(node.subhead, 'utf8') > MAX_TEXT_BYTES
      ) {
        throw renderError('RENDER_INPUT_INVALID', 'A title exceeds the render text limit.')
      }
      overlayFilters.push(...titleFilters(node, index, plan.value, input.fontPath))
      return
    }
    if (node.kind === 'callout-overlay') {
      if (Buffer.byteLength(node.label, 'utf8') > MAX_TEXT_BYTES) {
        throw renderError('RENDER_INPUT_INVALID', 'A callout label exceeds the render text limit.')
      }
      overlayFilters.push(...calloutFilters(node, index, plan.value, input.fontPath))
      return
    }
    if (
      Buffer.byteLength(node.primaryText, 'utf8') > MAX_TEXT_BYTES ||
      Buffer.byteLength(node.secondaryText, 'utf8') > MAX_TEXT_BYTES
    ) {
      throw renderError('RENDER_INPUT_INVALID', 'A nameplate exceeds the render text limit.')
    }
    overlayFilters.push(...nameplateFilters(node, index, plan.value, input.fontPath))
  })
  // `null` is a real filter that passes frames through unchanged. It keeps the
  // graph one shape whether or not anything is drawn, so an export with cuts
  // but no nameplates takes exactly the same code path.
  graph.push(`[${videoLabel}]${overlayFilters.length > 0 ? overlayFilters.join(',') : 'null'}[vout]`)

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
    // Pinned so a rendered file's hash is reproducible. Raising this changes
    // output bytes, so it is a deliberate contract, not a performance dial to
    // be turned casually. See ADR-003.
    '-threads', '1',
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
      // Every piece of footage must actually exist inside the file on disk.
      // Overlays no longer need this check: they are positioned from the
      // segments, so a segment that fits guarantees an overlay that fits.
      for (const segment of plan.value.segments) {
        const endTicks = segment.sourceStartTicks + segment.interval.duration.ticks
        if (endTicks > sourceProbe.duration.ticks) {
          throw renderError('RENDER_INPUT_INVALID', 'An accepted edit extends beyond the source duration.')
        }
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
        const rendered = await runCommand({
          executable: ffmpegExecutable,
          args: command,
          cwd: renderTempDir,
          signal: request.signal,
        })
        if (rendered.exitCode !== 0) {
          throw renderError('RENDER_FAILED', 'FFmpeg could not render the accepted edits.')
        }
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
