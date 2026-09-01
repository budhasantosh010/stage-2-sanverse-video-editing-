import type { CreativeVideoContextV1 } from '@sanverse/creative-direction'
import { PROJECT_TIMESCALE } from '@sanverse/edit-domain/time'
import type { SourceTranscriptV1, SourceUnderstandingPacketV1 } from './external-orchestration.ts'

export const deriveCreativeVideoContextV1 = (
  packet: SourceUnderstandingPacketV1,
  transcript?: SourceTranscriptV1,
): CreativeVideoContextV1 => {
  const durationSeconds = Math.max(0.001, packet.sourceDurationTicks / PROJECT_TIMESCALE)
  const cueRate = (transcript?.cues.length ?? 0) / durationSeconds
  const informationDensity: CreativeVideoContextV1['informationDensity'] = cueRate > 0.65 ? 'high' : cueRate > 0.18 ? 'medium' : 'low'
  const talkingHead = packet.observations.some((item) => item.kind === 'speech-present') || Boolean(transcript?.cues.length)
  // V1 Source Understanding does not contain trustworthy subject geometry or
  // negative-space analysis. Preserve that absence rather than inventing it.
  return Object.freeze({
    talkingHead,
    informationDensity,
    negativeSpace: 'unknown',
    subjectPriority: talkingHead ? 'high' : 'medium',
  })
}
