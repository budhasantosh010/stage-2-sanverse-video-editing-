export type CreativeCommentSourceV1 = 'human' | 'ai' | 'system'

export type CreativeCommentTargetV1 =
  | Readonly<{ kind: 'region'; startTicks: number; endTicks: number }>
  | Readonly<{ kind: 'directive'; directiveId: string }>
  | Readonly<{ kind: 'proposal'; proposalId: string }>
  | Readonly<{ kind: 'version'; versionId: string }>

export interface CreativeCommentV1 {
  readonly id: string
  readonly source: CreativeCommentSourceV1
  readonly text: string
  /** Deterministic document-local ordering. This is not project-time authority. */
  readonly sequence: number
  readonly target: CreativeCommentTargetV1
  readonly resolved: boolean
}
