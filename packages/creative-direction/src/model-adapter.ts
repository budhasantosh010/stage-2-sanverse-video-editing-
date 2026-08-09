import type { CreativeDirectionDocumentV1 } from './document.ts'
import type { CreativeEditProposalV1, CreativeResolutionCatalogV1 } from './proposal.ts'

export interface CreativePlanningInputV1 {
  readonly document: CreativeDirectionDocumentV1
  readonly catalog: CreativeResolutionCatalogV1
  /** Optional human-readable context only. B0 does not perform video understanding. */
  readonly contextSummary?: string
}

/**
 * Vendor-neutral future AI boundary. Implementations may call a model later,
 * but the domain contract never exposes provider SDKs, prompts, CSS or DOM.
 */
export interface CreativePlanningModelV1 {
  readonly id: string
  propose(input: CreativePlanningInputV1): Promise<CreativeEditProposalV1>
}
