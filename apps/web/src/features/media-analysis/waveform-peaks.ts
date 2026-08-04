/**
 * Turning a stretch of sound into something that can be drawn.
 *
 * ## What a waveform actually is
 *
 * A second of sound is 48,000 numbers. A second of timeline is maybe 100 pixels
 * wide. So drawing sound means answering, for each pixel: **of the ~480 numbers
 * that fall under it, how loud was the loudest?**
 *
 * That is the only honest summary. The alternative — taking every 480th number
 * and drawing that — misses the peaks between them, so a loud snare drum can
 * vanish entirely and the waveform shows a quiet passage where there was a
 * bang. Averaging is just as wrong in the other direction: it flattens
 * everything towards the middle and a busy passage looks the same as silence.
 *
 * So: the largest absolute value in each bucket, which is what every editor
 * draws and what a person recognises as the shape of their own audio.
 *
 * ## Why the peaks are computed against the FILE, not the timeline
 *
 * Exactly the reason filmstrip frames are. A block of peaks is named by which
 * moment of which recording it covers, so trimming, moving or splitting a piece
 * of music reuses every block it already had. Peaks tied to timeline position
 * would be thrown away and recomputed on every drag.
 */

/** One value per pixel-ish bucket, each between 0 (silence) and 1 (as loud as it gets). */
export type WaveformPeaks = readonly number[]

/**
 * The most peaks one block may hold.
 *
 * A block covers one second. More than this is finer than any screen can draw,
 * so it would be memory spent on detail nobody can see — and on a sixty-minute
 * project that is 3,600 blocks of it.
 */
export const MAX_PEAKS_PER_BLOCK = 256

/**
 * Summarise samples into `peakCount` buckets by taking the loudest in each.
 *
 * Bucket boundaries are computed from the exact sample count rather than by
 * stepping a fixed width, so the last bucket is never short and no samples at
 * the end are silently dropped.
 */
export const computePeaks = (
  samples: Readonly<{ length: number; [index: number]: number }>,
  peakCount: number,
): WaveformPeaks => {
  const buckets = Math.max(1, Math.min(MAX_PEAKS_PER_BLOCK, Math.floor(peakCount)))
  if (samples.length === 0) return Object.freeze(new Array<number>(buckets).fill(0))

  const peaks = new Array<number>(buckets).fill(0)
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const from = Math.floor((bucket * samples.length) / buckets)
    const to = Math.min(samples.length, Math.floor(((bucket + 1) * samples.length) / buckets))
    let loudest = 0
    for (let index = from; index < to; index += 1) {
      const magnitude = Math.abs(samples[index])
      if (magnitude > loudest) loudest = magnitude
    }
    // Clamped, because a file can legitimately contain values slightly past 1
    // and a bar drawn past the top of its lane looks like a rendering fault.
    peaks[bucket] = loudest > 1 ? 1 : loudest
  }
  return Object.freeze(peaks)
}

/**
 * The peaks for one stretch of a recording, taken from the blocks that cover it.
 *
 * This is the part that makes trimming and splitting truthful: a piece of music
 * starting four seconds into the song must draw the shape of the song FROM four
 * seconds, not from the beginning. Reading whole blocks and then slicing gives
 * exactly that, and it is why blocks are named by their moment in the file.
 */
export const slicePeaks = (
  peaks: WaveformPeaks,
  input: Readonly<{
    /** Where the block begins in the recording. */
    blockStartTicks: number
    blockSpanTicks: number
    /** The stretch actually wanted, in the recording's own time. */
    fromTicks: number
    toTicks: number
  }>,
): WaveformPeaks => {
  if (peaks.length === 0 || input.blockSpanTicks <= 0) return Object.freeze([])
  const blockEnd = input.blockStartTicks + input.blockSpanTicks
  const from = Math.max(input.fromTicks, input.blockStartTicks)
  const to = Math.min(input.toTicks, blockEnd)
  if (to <= from) return Object.freeze([])

  const first = Math.floor(((from - input.blockStartTicks) / input.blockSpanTicks) * peaks.length)
  const last = Math.ceil(((to - input.blockStartTicks) / input.blockSpanTicks) * peaks.length)
  return Object.freeze(peaks.slice(Math.max(0, first), Math.min(peaks.length, Math.max(first + 1, last))))
}

/**
 * Which blocks a stretch of a recording needs.
 *
 * Bounded, because a request for an hour of sound at once would be 3,600 blocks
 * and several seconds of decoding on the main thread. When the ceiling bites the
 * caller is told, rather than being handed a short list that looks complete.
 */
export const MAX_WAVEFORM_BLOCKS_PER_PLAN = 120

export const planWaveformBlocks = (input: Readonly<{
  fromTicks: number
  toTicks: number
  blockSpanTicks: number
  maxBlocks?: number
}>): Readonly<{ blockStartTicks: readonly number[]; truncated: boolean }> => {
  const max = input.maxBlocks ?? MAX_WAVEFORM_BLOCKS_PER_PLAN
  const span = Math.max(1, input.blockSpanTicks)
  if (input.toTicks <= input.fromTicks) {
    return Object.freeze({ blockStartTicks: Object.freeze([]), truncated: false })
  }
  const first = Math.floor(Math.max(0, input.fromTicks) / span) * span
  const starts: number[] = []
  for (let start = first; start < input.toTicks; start += span) {
    if (starts.length >= max) {
      return Object.freeze({ blockStartTicks: Object.freeze(starts), truncated: true })
    }
    starts.push(start)
  }
  return Object.freeze({ blockStartTicks: Object.freeze(starts), truncated: false })
}
