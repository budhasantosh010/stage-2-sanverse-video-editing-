export const CREATIVE_DIRECTION_TRACK_TYPES = Object.freeze([
  'STYLE',
  'GRAPHICS',
  'MOTION',
  'FOOTAGE',
  'TRANSITION',
  'EMPHASIS',
  'NOTES',
  'CONSTRAINTS',
] as const)

export type CreativeDirectionTrackTypeV1 = (typeof CREATIVE_DIRECTION_TRACK_TYPES)[number]

export interface CreativeDirectionTrackV1 {
  readonly id: string
  readonly type: CreativeDirectionTrackTypeV1
  readonly label: string
  readonly order: number
  readonly enabled: boolean
}

const labels: Readonly<Record<CreativeDirectionTrackTypeV1, string>> = Object.freeze({
  STYLE: 'Style',
  GRAPHICS: 'Graphics',
  MOTION: 'Motion',
  FOOTAGE: 'Footage',
  TRANSITION: 'Transition',
  EMPHASIS: 'Emphasis',
  NOTES: 'Notes',
  CONSTRAINTS: 'Constraints',
})

export const createDefaultCreativeDirectionTracks = (): readonly CreativeDirectionTrackV1[] => Object.freeze(
  CREATIVE_DIRECTION_TRACK_TYPES.map((type, index) => Object.freeze({
    id: `creative-track:${type.toLowerCase()}`,
    type,
    label: labels[type],
    order: index,
    enabled: true,
  })),
)
