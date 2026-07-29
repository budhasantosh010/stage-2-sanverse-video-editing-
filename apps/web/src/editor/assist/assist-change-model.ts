import type { EditProject } from '@sanverse/edit-domain'

import { proposalPlacement, type PendingProposal } from '../../app/app-state'
import { presentOperation } from './assist-operation-presentation'

export type AssistChangeStatus = 'accepted' | 'pending' | 'blocked'

export type AssistChangeItem = Readonly<{
  id: string
  changeSetId: string | null
  operationId: string
  status: AssistChangeStatus
  label: string
  detail: string | null
  startTicks: number | null
  durationTicks: number | null
  seekTicks: number | null
  blockedReason: string | null
  operationKind: string
}>

export function buildAssistChangeItems(input: {
  project: EditProject
  proposal: PendingProposal | null
}): readonly AssistChangeItem[] {
  const accepted = input.project.changeSets.flatMap((record) =>
    record.changeSet.operations.map((operation) => {
      const presentation = presentOperation(input.project, operation)
      const blocked = record.blockedReason !== null
      return Object.freeze({
        id: `${record.changeSet.changeSetId}:${operation.operationId}`,
        changeSetId: record.changeSet.changeSetId,
        operationId: operation.operationId,
        status: blocked ? ('blocked' as const) : ('accepted' as const),
        label: presentation.label,
        detail: presentation.detail,
        startTicks: presentation.interval?.startTicks ?? null,
        durationTicks: presentation.interval?.durationTicks ?? null,
        seekTicks: presentation.interval?.startTicks ?? null,
        blockedReason: record.blockedReason,
        operationKind: operation.kind,
      })
    }),
  )

  if (!input.proposal) return Object.freeze(accepted)

  const presentation = presentOperation(input.project, input.proposal.operation)
  const placement = proposalPlacement(input.project, input.proposal.operation)
  return Object.freeze([
    ...accepted,
    Object.freeze({
      id: `pending:${input.proposal.operation.operationId}`,
      changeSetId: null,
      operationId: input.proposal.operation.operationId,
      status: 'pending' as const,
      label: presentation.label,
      detail: input.proposal.origin.explanation,
      startTicks: placement?.startTicks ?? null,
      durationTicks: placement?.durationTicks ?? null,
      seekTicks: placement?.startTicks ?? null,
      blockedReason: null,
      operationKind: input.proposal.operation.kind,
    }),
  ])
}
