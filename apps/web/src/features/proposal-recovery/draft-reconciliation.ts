/**
 * What happens to a half-finished proposal when the project moves underneath it.
 *
 * ── THE SITUATION ────────────────────────────────────────────────────────────
 *
 * A proposal is an edit that has been worked out but not yet approved. It sits
 * on screen waiting for the user to press Accept. While it sits there, the
 * project can change — the user trims a clip, presses Undo, drags something.
 *
 * The proposal was worked out against the project as it was a moment ago. So
 * when the user finally presses Accept, the server compares the revision the
 * proposal was built on against the revision the project is actually at, sees
 * they differ, and refuses. The user was shown:
 *
 *     This project changed while that edit was being prepared.
 *     Reopen it and try again.
 *
 * "Reopen it" is an enormous thing to ask. It means leaving the editor, going
 * back to the project list, opening the project again, and finding your place —
 * for something completely routine. Making a normal edit while a proposal is
 * on screen is not a mistake; it is how people work.
 *
 * ── WHY MOST OF THOSE REFUSALS WERE UNNECESSARY ──────────────────────────────
 *
 * A proposal does not name a clip. It names a piece of the ORIGINAL RECORDING:
 * "the nameplate goes over the stretch of the recording from 4s to 9s". Where
 * that stretch currently sits in the finished video is worked out fresh, every
 * time, from the current project.
 *
 * That means almost every edit a user can make leaves the proposal perfectly
 * answerable. Trimming a different clip, moving something, muting a track,
 * pressing Undo — none of them change what "4s to 9s of that recording" means.
 * The proposal only genuinely dies when the thing it points at stops existing.
 *
 *   the project moves from revision 11 to revision 12
 *          │
 *          ├── does the recording it names still exist?      no ──► cancel
 *          │                                                yes
 *          ├── does that stretch still appear in the video?  no ──► cancel
 *          │                                                yes
 *          ├── is it still a valid edit on its own?          no ──► cancel
 *          │                                                yes
 *          └──────────────────────────────────────────► carry it forward
 *
 * Carrying it forward is not a rewrite. Nothing about the proposal changes: it
 * is re-checked against the new project and re-pointed at the new revision. The
 * user's typed words, positions and timings are exactly what they were.
 *
 * ── THE RULE THAT MUST NOT BE BROKEN ─────────────────────────────────────────
 *
 * If the thing a proposal named is gone, the proposal is CANCELLED. It is never
 * quietly re-pointed at some other clip that happens to be nearby. Approving
 * something and getting it applied somewhere else is far worse than being told
 * it could not be applied — the user would have to notice the difference
 * themselves, and they would have no reason to look.
 */

import {
  effectiveComposition,
  placeSourceSpan,
  validateOperation,
  type EditProject,
} from '@sanverse/edit-domain'

import type { PendingProposal } from '../../app/app-state'

/** The closed list of reasons a proposal genuinely cannot be carried forward. */
export const DRAFT_CANCELLATION_REASONS = Object.freeze([
  'TARGET_SOURCE_REMOVED',
  'TARGET_INTERVAL_REMOVED',
  'EDIT_NO_LONGER_VALID',
  'EDIT_ID_ALREADY_USED',
  'PROJECT_REPLACED',
] as const)
export type DraftCancellationReason = (typeof DRAFT_CANCELLATION_REASONS)[number]

export type DraftReconciliationResult =
  | Readonly<{ status: 'current'; draft: PendingProposal; revision: number }>
  | Readonly<{
      status: 'rebased'
      draft: PendingProposal
      fromRevision: number
      toRevision: number
    }>
  | Readonly<{
      status: 'cancelled'
      reason: DraftCancellationReason
      retryAvailable: boolean
    }>

/**
 * What the user reads when a proposal could not be carried forward.
 *
 * Each one names the thing that disappeared, so the user knows what they did and
 * what would happen if they asked again. None of them says "reopen".
 */
export const draftCancellationMessage = (reason: DraftCancellationReason): string => {
  switch (reason) {
    case 'TARGET_SOURCE_REMOVED':
      return 'That proposal was about a clip that is no longer in this project, so it was cancelled. Nothing else changed.'
    case 'TARGET_INTERVAL_REMOVED':
      return 'The part of the video that proposal was about has been cut out, so it was cancelled. Nothing else changed.'
    case 'EDIT_NO_LONGER_VALID':
      return 'That proposal no longer fits this project, so it was cancelled. Nothing else changed.'
    case 'EDIT_ID_ALREADY_USED':
      return 'That proposal had already been applied, so it was not applied a second time.'
    case 'PROJECT_REPLACED':
      return 'You are now in a different project, so that proposal was cancelled.'
  }
}

/**
 * Whether asking again from the project as it is now would be worth the user's
 * time. It would for everything except an edit that has already landed — asking
 * again there would just produce the change they already have.
 */
export const draftRetryIsWorthwhile = (reason: DraftCancellationReason): boolean =>
  reason !== 'EDIT_ID_ALREADY_USED'

/**
 * Decide what to do with a pending proposal against a newly accepted project.
 *
 * Pure. It reads the proposal and the project and returns a decision; it does
 * not apply anything, does not touch the screen and does not talk to the server.
 * The accepted project is never an output here, which is the structural reason
 * this cannot damage the user's work: the worst it can do is say "cancelled".
 */
export const reconcileDetachedDraft = (input: Readonly<{
  draft: PendingProposal
  baseRevision: number
  baseProjectId: string
  nextProject: EditProject
}>): DraftReconciliationResult => {
  const { draft, baseRevision, baseProjectId, nextProject } = input

  const cancel = (reason: DraftCancellationReason): DraftReconciliationResult =>
    Object.freeze({
      status: 'cancelled' as const,
      reason,
      retryAvailable: draftRetryIsWorthwhile(reason),
    })

  // A different project entirely. Nothing about the old one can be carried into
  // it, and pretending otherwise would apply an edit to the wrong video.
  if (nextProject.projectId !== baseProjectId) return cancel('PROJECT_REPLACED')

  // Nothing moved. Say so rather than pretending work was done.
  if (nextProject.revision === baseRevision) {
    return Object.freeze({ status: 'current' as const, draft, revision: baseRevision })
  }

  // Already applied. This is the case where the user pressed Accept twice, or a
  // slow reply arrived after the edit had already landed. Applying it again
  // would duplicate the user's edit without them asking.
  //
  // The id being looked for is the EDIT's own id, which lives inside a change
  // set, so this walks the change sets rather than the list of change-set ids.
  // Those are two different sets of names, and checking the wrong one would let
  // an already-applied edit through.
  const alreadyApplied = nextProject.changeSets.some((record) =>
    record.changeSet.operations.some((operation) => operation.operationId === draft.operation.operationId),
  )
  if (alreadyApplied) return cancel('EDIT_ID_ALREADY_USED')

  // The recording it is about must still be in the project.
  if (!nextProject.assets.some((asset) => asset.assetId === draft.operation.assetId)) {
    return cancel('TARGET_SOURCE_REMOVED')
  }

  // The stretch of that recording it is about must still appear somewhere in the
  // finished video. If the user cut exactly that part out, there is nowhere left
  // to put the nameplate, and choosing somewhere else for them would be a guess.
  const placements = placeSourceSpan(
    effectiveComposition(nextProject),
    draft.operation.assetId,
    draft.operation.sourceInterval,
  )
  if (placements.length === 0) return cancel('TARGET_INTERVAL_REMOVED')

  // Finally, the same check a brand-new proposal gets. A proposal carried
  // forward is not trusted more than one that has just arrived.
  const validated = validateOperation(draft.operation)
  if (!validated.ok) return cancel('EDIT_NO_LONGER_VALID')

  return Object.freeze({
    status: 'rebased' as const,
    draft,
    fromRevision: baseRevision,
    toRevision: nextProject.revision,
  })
}

/**
 * What the user reads when a proposal WAS carried forward.
 *
 * Shown rather than kept quiet on purpose. The user watched the project change
 * with a proposal sitting on screen; telling them it still applies is what
 * stops them wondering whether it is now about the wrong thing.
 */
export const draftRebasedMessage = (fromRevision: number, toRevision: number): string =>
  `The project changed while that proposal was on screen (change ${fromRevision} to ${toRevision}). ` +
  'The proposal still applies and is unchanged.'
