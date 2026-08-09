import type { CreativeDirectiveV1 } from './directives.ts'
import type { CreativeDirectionTrackV1 } from './tracks.ts'

export interface CreativeDirectionVersionV1 {
  readonly id: string
  readonly label: string
  readonly sequence: number
  readonly parentVersionId: string | null
  readonly reason: 'initial' | 'graphics-revision' | 'style-revision' | 'motion-revision' | 'feedback-revision' | 'manual-save'
  readonly summary: string
  readonly tracksSnapshot: readonly CreativeDirectionTrackV1[]
  readonly directivesSnapshot: readonly CreativeDirectiveV1[]
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export const createCreativeDirectionVersion = (input: Readonly<{
  id: string
  label: string
  sequence: number
  parentVersionId: string | null
  reason: CreativeDirectionVersionV1['reason']
  summary: string
  tracks: readonly CreativeDirectionTrackV1[]
  directives: readonly CreativeDirectiveV1[]
}>): CreativeDirectionVersionV1 => Object.freeze({
  id: input.id,
  label: input.label,
  sequence: input.sequence,
  parentVersionId: input.parentVersionId,
  reason: input.reason,
  summary: input.summary,
  tracksSnapshot: Object.freeze(clone(input.tracks)),
  directivesSnapshot: Object.freeze(clone(input.directives)),
})

export interface CreativeVersionDiffV1 {
  readonly addedDirectiveIds: readonly string[]
  readonly removedDirectiveIds: readonly string[]
  readonly changedDirectiveIds: readonly string[]
}

const canonical = (value: unknown): string => JSON.stringify(value)

export const compareCreativeDirectionVersions = (from: CreativeDirectionVersionV1, to: CreativeDirectionVersionV1): CreativeVersionDiffV1 => {
  const fromById = new Map(from.directivesSnapshot.map((directive) => [directive.id, directive] as const))
  const toById = new Map(to.directivesSnapshot.map((directive) => [directive.id, directive] as const))
  const added = [...toById.keys()].filter((id) => !fromById.has(id)).sort()
  const removed = [...fromById.keys()].filter((id) => !toById.has(id)).sort()
  const changed = [...toById.keys()].filter((id) => fromById.has(id) && canonical(fromById.get(id)) !== canonical(toById.get(id))).sort()
  return Object.freeze({
    addedDirectiveIds: Object.freeze(added),
    removedDirectiveIds: Object.freeze(removed),
    changedDirectiveIds: Object.freeze(changed),
  })
}

export const restoreCreativeDirectionVersionContent = (version: CreativeDirectionVersionV1): Readonly<{
  tracks: readonly CreativeDirectionTrackV1[]
  directives: readonly CreativeDirectiveV1[]
}> => Object.freeze({
  tracks: Object.freeze(clone(version.tracksSnapshot)),
  directives: Object.freeze(clone(version.directivesSnapshot)),
})
