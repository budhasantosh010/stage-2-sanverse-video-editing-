import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import type { AnalysisProvenanceRefV1 } from './provenance.ts'

export interface TranscriptWordV1 {
  readonly id: string
  readonly startTicks: number
  readonly endTicks: number
  readonly text: string
  readonly confidence?: number
}

export interface TranscriptSegmentV1 {
  readonly id: string
  readonly startTicks: number
  readonly endTicks: number
  readonly text: string
  readonly speakerId?: string
  readonly words?: readonly TranscriptWordV1[]
  readonly provenance: AnalysisProvenanceRefV1
}

const ticks = (seconds: number): number => Math.round(seconds * PROJECT_TIMESCALE)
const normalizeText = (text: string): string => text.replace(/\s+/gu, ' ').trim()
const parseClock = (value: string): number | null => {
  const match = value.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[,.](\d{1,3}))?$/u)
  if (!match) return null
  const hours = Number(match[1] ?? 0), minutes = Number(match[2]), seconds = Number(match[3]), ms = Number((match[4] ?? '0').padEnd(3, '0'))
  if (![hours, minutes, seconds, ms].every(Number.isFinite) || minutes > 59 || seconds > 59) return null
  return hours * 3600 + minutes * 60 + seconds + ms / 1000
}

export const normalizeTranscriptSegments = (segments: readonly TranscriptSegmentV1[]): readonly TranscriptSegmentV1[] => Object.freeze(segments.map((segment, index) => Object.freeze({
  ...segment,
  id: segment.id.trim() || `transcript:${segment.startTicks}:${index}`,
  text: normalizeText(segment.text),
  ...(segment.speakerId ? { speakerId: segment.speakerId.trim() } : {}),
  ...(segment.words ? { words: Object.freeze(segment.words.map((word, wordIndex) => Object.freeze({ ...word, id: word.id.trim() || `${segment.id}:word:${wordIndex}`, text: normalizeText(word.text) }))) } : {}),
})))

export interface StructuredTranscriptInputV1 {
  readonly startSeconds: number
  readonly endSeconds: number
  readonly text: string
  readonly speakerId?: string
}

export const transcriptFromStructuredJson = (input: readonly StructuredTranscriptInputV1[], provenance: AnalysisProvenanceRefV1): readonly TranscriptSegmentV1[] => normalizeTranscriptSegments(input.map((entry, index) => ({
  id: `transcript:${index + 1}`,
  startTicks: ticks(entry.startSeconds),
  endTicks: ticks(entry.endSeconds),
  text: entry.text,
  ...(entry.speakerId ? { speakerId: entry.speakerId } : {}),
  provenance,
})))

export const parseSrtOrVttTranscript = (source: string, provenance: AnalysisProvenanceRefV1): readonly TranscriptSegmentV1[] => {
  const cleaned = source.replace(/^WEBVTT[^\n]*\n/iu, '').replace(/\r\n?/gu, '\n').trim()
  if (!cleaned) return Object.freeze([])
  const blocks = cleaned.split(/\n{2,}/u)
  const output: TranscriptSegmentV1[] = []
  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
    const timeIndex = lines.findIndex((line) => line.includes('-->'))
    if (timeIndex < 0) continue
    const [left, rightWithSettings] = lines[timeIndex]!.split('-->')
    const right = rightWithSettings?.trim().split(/\s+/u)[0] ?? ''
    const startSeconds = parseClock(left ?? ''), endSeconds = parseClock(right)
    if (startSeconds === null || endSeconds === null) continue
    const text = normalizeText(lines.slice(timeIndex + 1).join(' ').replace(/<[^>]+>/gu, ''))
    if (!text) continue
    output.push(Object.freeze({ id: `transcript:${output.length + 1}`, startTicks: ticks(startSeconds), endTicks: ticks(endSeconds), text, provenance }))
  }
  return normalizeTranscriptSegments(output)
}
