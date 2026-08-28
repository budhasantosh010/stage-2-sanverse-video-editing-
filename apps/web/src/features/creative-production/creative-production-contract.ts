import type { ChangeSet } from '@sanverse/edit-domain'

export type ProductionApplyMetadata = Readonly<{
  provenance?: ChangeSet['provenance']
  extensions?: ChangeSet['extensions']
  expectedBaseRevision?: number
}>

export type CreativeProductionApply = (
  operations: readonly import('@sanverse/edit-domain').EditOperation[],
  changeSetId: string,
  metadata?: ProductionApplyMetadata,
) => Promise<string | null>
