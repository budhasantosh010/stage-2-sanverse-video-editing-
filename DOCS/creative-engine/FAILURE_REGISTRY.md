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

## CREATIVE-FAIL-006 — B0 long edit region exceeded an A20 component's local motion window

- Status: FIXED at development integration seam
- Milestone: ABC-1 integration
- Date: 2026-08-10
- What: the first all-placement ABC test correctly refused the 25-second `product-ui-story` B0 region because the A20 Product UI Story component intentionally supports 1.5–12 seconds of local authored animation.
- Why: Creative Direction region duration and component-local motion duration are different authorities. The B region answers how long the graphic belongs in the edit; the A component duration answers how its internal motion progresses.
- Impact: two explicit retiming proofs already passed, but the generic all-nine preview chain stopped at the 25-second region.
- Fix: the development bridge preserves exact `sourceStartTicks/sourceEndTicks` from B0 and chooses the component's own default local animation duration only when the source region falls outside the component's authoring window. The 25-second region remains 25 seconds; Product UI Story previews with its 7-second local motion window.
- Boundary: this is a preview/integration seam, not the future production compiler. A future compiler still owns hold/loop/exit scheduling across the full placement region.
- One-line solution: preserve B timing and A timing separately instead of weakening either contract.

## CREATIVE-FAIL-007 — Percentage rule rejected the percent-symbol form

- Status: FIXED
- Milestone: B1
- Date: 2026-08-10
- What: the first deterministic semantic-rule test detected `65 percent` but missed `65%` because the regex required a word boundary after `%`, which is not a word character.
- Impact: an explicit statistic could disappear from source understanding and therefore never become traceable creative evidence.
- Fix: made the percent-symbol branch terminate on `%` itself while retaining a word boundary for the spelled `percent` form; kept the original failing test.
- One-line solution: treat `%` as punctuation, not a word token.

## CREATIVE-FAIL-008 — First B1 browser proof captured before source understanding resolved

- Status: FIXED
- Milestone: B1
- Date: 2026-08-10
- What: the first real-Edge screenshot showed `Analyzing deterministic fixture…` because the headless capture happened before the async local fixture promise committed to React.
- Impact: code/tests were green but the screenshot did not prove the Source Understanding UI.
- Fix: rejected the capture and recaptured with a bounded virtual-time budget; retained evidence shows all five lanes and the selected 68% observation/provenance inspector.
- One-line solution: browser evidence must wait for the state it claims to prove.

## CREATIVE-FAIL-009 — First ABC-2 statistic target had no explicit C2 keys for C5

- Status: FIXED
- Milestone: ABC-2 integration
- Date: 2026-08-11
- What: the first source-statistic proof resolved the real B1 68% observation to `sanverse.single-metric`. The component is valid and graph-native, but it predates the keyframe-native Family authoring added later, so C4/C5 correctly projected zero explicit keys/curves.
- Impact: B1→B0→Plan-A traceability passed, but the required source→curve proof could not truthfully demonstrate a C5 edit.
- Rejected fix: do not inject fake keyframes into Single Metric only to satisfy the test, and do not weaken the C5 requirement.
- Fix: percentage statistics in the ABC-2 integration resolve to the new A21 `sanverse.donut-breakdown`, which is exact C2-keyframe-native and expresses the real 68% as `Observed · 68` plus the deterministic complement `Remaining · 32`.
- Verification: focused ABC-2 integration is 4/4; final full release gate is 439/439 tests + 9/9 builds; the real browser Donut screenshot shows the source-derived 68% content and active C5 curves.
- One-line solution: choose a semantically correct keyframe-native Plan-A capability instead of manufacturing curve authority on a legacy component.

## CREATIVE-FAIL-010 — Vite review persistence crossed the Node/TSX compiler boundary

- Status: FIXED
- Milestone: L1 Creative Library
- Date: 2026-08-11
- What: the first local review-persistence Vite plugin imported the full Motion Library. The Node-only Vite config compiler then traversed React `.tsx` component modules without JSX configured.
- Impact: Motion Lab build failed even though the browser implementation itself was valid.
- Fix: keep the Vite persistence endpoint as a bounded Node structural write barrier and keep canonical component/review validation in the browser/domain package that already owns the registry.
- Verification: Motion Lab build passes; root all-workspace build passes; invalid structural POST receives 422; browser domain loads 89 validated persisted reviews.
- One-line solution: do not make Node configuration compile the React component graph just to persist development review JSON.

## CREATIVE-FAIL-011 — One long headless Edge audit session accumulated navigation latency

- Status: FIXED
- Milestone: L1 Creative Library
- Date: 2026-08-11
- What: the first 89-item real-playback audit completed several components and then a later navigation exceeded the page-readiness timeout even though that same component passed immediately in a fresh browser.
- Impact: a browser-session buildup could have been falsely reported as an animation failure.
- Fix: make the real audit resumable with `--from` / `--limit` and restart Edge in bounded chunks while preserving the exact 1× full-playback requirement.
- Verification: 89 unique components, 89 `fullPlaybackVerified=true`, zero duplicate component IDs.
- One-line solution: isolate long browser-session buildup from the component-quality signal.

## CREATIVE-FAIL-012 — Persisted review badge and edit fields could disagree after async load

- Status: FIXED
- Milestone: L1 Creative Library
- Date: 2026-08-11
- What: detail/showreel review controls initialized before persisted review data returned, so the component badge could show `Passed` while the form still displayed `Unreviewed / Experimental`.
- Impact: the review UI could mislead a human reviewer even though the stored artifact was correct.
- Fix: synchronize status/tier/scores/notes whenever the persisted review for the active component arrives or changes.
- Verification: retained `l1-library-detail.png` shows `S · PASSED`, stored 1× verification, S scores and stored review note consistently.
- One-line solution: async persisted review data must hydrate the editable form, not only the summary badge.
