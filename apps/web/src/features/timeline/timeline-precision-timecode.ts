export type PrecisionFrameRateV1 = Readonly<{ numerator: number; denominator: number }>

export type PrecisionTimecodeResult =
  | Readonly<{ ok: true; relative: boolean; ticks: number; frames: number | null }>
  | Readonly<{ ok: false; message: string }>

const invalid = (message: string): PrecisionTimecodeResult => Object.freeze({ ok: false as const, message })

const validRate = (frameRate: PrecisionFrameRateV1): boolean =>
  Number.isSafeInteger(frameRate.numerator)
  && Number.isSafeInteger(frameRate.denominator)
  && frameRate.numerator > 0
  && frameRate.denominator > 0

export const frameDeltaToTicks = (
  frames: number,
  timescale: number,
  frameRate: PrecisionFrameRateV1,
): number => {
  if (!Number.isSafeInteger(frames) || !Number.isSafeInteger(timescale) || timescale <= 0 || !validRate(frameRate)) {
    throw new RangeError('Frame conversion requires safe integers and a positive rational frame rate.')
  }
  return Math.round(frames * timescale * frameRate.denominator / frameRate.numerator)
}

export const ticksToFrameCount = (
  ticks: number,
  timescale: number,
  frameRate: PrecisionFrameRateV1,
): number => {
  if (!Number.isSafeInteger(ticks) || !Number.isSafeInteger(timescale) || timescale <= 0 || !validRate(frameRate)) {
    throw new RangeError('Frame conversion requires safe integers and a positive rational frame rate.')
  }
  return Math.round(ticks * frameRate.numerator / (timescale * frameRate.denominator))
}

/**
 * Exact Timeline-local input parser. It produces integer project ticks only;
 * floating seconds never enter accepted state.
 *
 * Accepted examples:
 *   00:01:13:12  absolute project timecode
 *   123f         absolute frame count
 *   +12f / -8f   relative frame delta
 *   +00:00:01:00 relative timecode delta
 */
export const parsePrecisionTimeInput = (input: Readonly<{
  text: string
  timescale: number
  frameRate: PrecisionFrameRateV1
}>): PrecisionTimecodeResult => {
  const text = input.text.trim()
  if (!Number.isSafeInteger(input.timescale) || input.timescale <= 0 || !validRate(input.frameRate)) {
    return invalid('This project does not have a usable frame-rate clock.')
  }
  if (text.length === 0) return invalid('Enter a timecode or frame count.')

  const frameMatch = /^([+-]?)(\d+)f$/i.exec(text)
  if (frameMatch) {
    const magnitude = Number(frameMatch[2])
    if (!Number.isSafeInteger(magnitude)) return invalid('That frame count is too large.')
    const sign = frameMatch[1] === '-' ? -1 : 1
    const relative = frameMatch[1] === '+' || frameMatch[1] === '-'
    const frames = sign * magnitude
    return Object.freeze({
      ok: true as const,
      relative,
      ticks: frameDeltaToTicks(frames, input.timescale, input.frameRate),
      frames,
    })
  }

  const timecode = /^([+-]?)(\d{1,3}):(\d{2}):(\d{2}):(\d{2})$/.exec(text)
  if (!timecode) {
    return invalid('Use project timecode like 00:01:13:12, frames like 120f, or a relative value like +12f.')
  }
  const sign = timecode[1] === '-' ? -1 : 1
  const relative = timecode[1] === '+' || timecode[1] === '-'
  const hours = Number(timecode[2])
  const minutes = Number(timecode[3])
  const seconds = Number(timecode[4])
  const frames = Number(timecode[5])
  const nominalFramesPerSecond = Math.ceil(input.frameRate.numerator / input.frameRate.denominator)
  if (minutes >= 60 || seconds >= 60 || frames >= nominalFramesPerSecond) {
    return invalid(`That timecode is outside this project's ${input.frameRate.numerator}/${input.frameRate.denominator} frame rate.`)
  }
  const wholeSeconds = hours * 3600 + minutes * 60 + seconds
  if (!Number.isSafeInteger(wholeSeconds)) return invalid('That timecode is too large.')
  const ticks = wholeSeconds * input.timescale + frameDeltaToTicks(frames, input.timescale, input.frameRate)
  if (!Number.isSafeInteger(ticks)) return invalid('That timecode is too large.')
  return Object.freeze({ ok: true as const, relative, ticks: sign * ticks, frames: null })
}

export const resolvePrecisionTimeInput = (input: Readonly<{
  text: string
  baseTicks: number
  minTicks: number
  maxTicks: number
  timescale: number
  frameRate: PrecisionFrameRateV1
}>): PrecisionTimecodeResult => {
  const parsed = parsePrecisionTimeInput(input)
  if (!parsed.ok) return parsed
  const resolved = parsed.relative ? input.baseTicks + parsed.ticks : parsed.ticks
  if (!Number.isSafeInteger(resolved) || resolved < input.minTicks || resolved > input.maxTicks) {
    return invalid('That time is outside the available Timeline or source range.')
  }
  return Object.freeze({ ...parsed, ticks: resolved })
}
