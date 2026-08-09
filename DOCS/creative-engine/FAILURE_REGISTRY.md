# Creative Engine Failure Registry

## CREATIVE-FAIL-001 — First B0 validator write was refused by the coding harness

- Status: FIXED
- Milestone: B0
- Date: 2026-08-10
- What: one very large `validation.ts` write was blocked before file creation because the harness could not confidently classify the oversized operation.
- Impact: no product source was partially written and no validation rule was accepted weakened.
- Fix: split validation into `validation-shared.ts`, `validation-directives.ts`, `validation-proposal.ts` and a public re-export boundary.
- One-line solution: smaller cohesive validators preserved the same fail-closed rules and improved reviewability.

## CREATIVE-FAIL-002 — Directive track helper widened to plain string

- Status: FIXED
- Milestone: B0
- Date: 2026-08-10
- What: first TypeScript build rejected `directiveTrackForKind` because object-index inference widened the track value.
- Impact: compile-time only; no B0 behavior executed with an invalid type.
- Fix: introduced a frozen `TRACK_BY_DIRECTIVE_KIND` map using `satisfies Readonly<Record<CreativeDirectiveKindV1, CreativeDirectionTrackTypeV1>>`.
- One-line solution: preserve literal track types at the map boundary instead of casting downstream.

## CREATIVE-FAIL-003 — Negative validation tests tried to mutate readonly fixture types

- Status: FIXED
- Milestone: B0
- Date: 2026-08-10
- What: TypeScript correctly rejected test-only mutations of a deeply readonly fixture after JSON cloning.
- Impact: test construction only; domain source already compiled.
- Fix: malformed-input tests now use an explicitly mutable untyped JSON copy while runtime payloads remain identical.
- One-line solution: make only the negative-test payload mutable, never the production contract.

## CREATIVE-FAIL-004 — Proposal fixture count test expected eight instead of nine graphic placements

- Status: FIXED
- Milestone: B0
- Date: 2026-08-10
- What: first behavior run was 25/26 because the test forgot the later callback notification is a second graphic placement.
- Impact: implementation correctly preserved all nine; changing the compiler to satisfy the mistaken count would have dropped intent.
- Fix: corrected expected placement count 8 → 9.
- One-line solution: fix bookkeeping, keep the complete proposal.

## CREATIVE-FAIL-005 — Strict Motion Lab port was occupied by an old same-worktree Vite process

- Status: FIXED
- Milestone: B0
- Date: 2026-08-10
- What: new strict-port Vite launch refused port 2010.
- Investigation: listener PID command line proved it was Vite from this exact Motion worktree, not another editor-agent worktree.
- Fix: stopped only that verified stale process, restarted Motion Lab on strict port 2010, and captured HTTP/browser evidence.
- One-line solution: verify process ownership before restart; never kill an ambiguous listener.
