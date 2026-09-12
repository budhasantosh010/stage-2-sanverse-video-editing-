# Primary track transfer implementation plan

Goal: remove the blanket vertical-drag refusal without making preview or export lie.

September 8 follow-up: previously blocked title-over-V2 browser proof passed at revisions 38/39/40, with fresh decoded MP4 and actual frame inspection. Opening-gap monitor/transport defects FAIL-078/079 repaired and verified (45 affected tests, 8 final integration tests, production build). No arbitrary-overlap or independent-dialogue completion claim. See PRIMARY_TRANSFER_VERIFICATION.md.

Status: BOUNDED SLICE VERIFIED LOCALLY September 7. Candidate resumed after approval recovered. Owning-track output (FAIL-074), linked-audio routing (FAIL-075), and source-retiming mismatch (FAIL-076) are fixed. Domain 567/567 and render-contract 142/142 passed during this continuation sequence; focused preview/planner 22/22, followed by affected retiming/preview 57/57, passed. All-workspace build and final web build passed. Real transfer, Undo/Redo, visibility, sideways linked move and fresh exported media proved below. Full arbitrary layered composition is NOT complete; T5.5 remains OPEN.

Architecture: keep the existing Clip, Composition, typed move operation, change-set replay and render plan. Extend move-primary-clip with optional destinationTrackId; absent means the historical same-track move. Resolve the destination from accepted track state, not UI labels. No conversion to B-roll, no duplicate project, no Motion integration.

Execution: local, test-first, no subagents requested; preserve all prior dirty work. No remote push. Rollback is the inverse of this scoped diff, not a reset of the worktree.

Owner authority: September 7 request to fix remaining timeline reliability; REQ-003/005/007/009 and existing Multi-asset Primary Sequence ADR. Acceptance is an actual V1 → V2 → Undo → Redo → export workflow, stable clip/audio identity and source timing. This slice is not full competitor parity.

## Critical boundary

The current FFmpeg primary path concatenates segments. Therefore this slice must reject overlapping primary picture intervals across tracks, including later trims/moves that would introduce overlap. Layer compositing and independent extracted audio remain follow-up work, explicitly not claimed complete. B-roll continues through the existing visual compositor. Follow-up FAIL-077 now permits authored visuals on the same or higher track than all primary footage; lower-track visual interleaving remains refused. This conservative shared rule includes legacy nameplates and applies in both replay and drag preview. Automated proof passes; last visual-order browser check is blocked by INFRA-014.

## Tasks

- [x] Add RED domain tests in packages/edit-domain/src/primary-track-transfer.test.ts: transfer to an existing video track with identity preserved, Undo/Redo, invalid destination, overlap refusal, legacy operation unchanged.
- [x] Extend validation/application in packages/edit-domain/src/timeline-operations.ts. Replay tracks and composition transactionally in packages/edit-domain/src/project.ts; never invent a track from an arbitrary operation string.
- [x] Add RED planner tests in apps/web/src/features/timeline/timeline-body-drag-plan.test.ts; route vertical video moves, keep dialogue on its linked audio track, preserve lock/revision guards.
- [x] Prove shared compiler output and track-output routing in apps/web/src/features/render-plan/primary-track-transfer.test.ts, using accepted domain operations.
- [x] Run targeted tests then relevant edit-domain/render-contract suites, production build, real browser transfer/Undo/Redo/export; log failures and remaining boundaries.
- [x] Update CURRENT_STATE, BUILD_TRACKER, PROJECT_LOG, FAILURE_REGISTRY and evidence. Leave confidence gate OPEN where evidence is missing.

Commands (repository root):

    npx vitest run --root packages/edit-domain src/primary-track-transfer.test.ts
    npx vitest run --root apps/web src/features/timeline/timeline-body-drag-plan.test.ts
    npx vitest run --root apps/web src/features/render-plan/primary-track-transfer.test.ts
    npm run build

Red tests must fail because transfer is absent before implementation. Green tests must use accepted change sets, not fabricated UI state. Restart API after domain changes before browser proof.
