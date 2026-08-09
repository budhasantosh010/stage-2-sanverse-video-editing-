# Motion Library Failure Registry

Record real Plan A failures with what, where, when, reproduction, root cause, impact, attempts, status and one-line solution. Passing tests do not erase visual or browser failures.

## MOTION-FAIL-001 — Missing Lab tick query became exact tick zero

- Status: FIXED
- Severity: medium
- Milestone: MOTION-A2
- Date: 2026-08-07

WHAT: Opening a Motion Lab fixture URL without a `tick` parameter showed the component at tick 0 instead of its configured settled preview point.

WHERE: `apps/motion-lab/src/MotionLabApp.tsx` initial URL preset parsing.

WHEN/HOW: Found in the first real Edge screenshot of Checklist Card V1. The screenshot was blank although Checklist tests and state logic were green.

WHY: `Number(initialSearch.get('tick'))` converts JavaScript `null` to numeric `0`. Missing and explicit-zero queries were therefore indistinguishable.

IMPACT: Development visual inspection could misleadingly look like a component rendering failure. Exact user-entered tick 0 itself was always valid.

ROOT CAUSE: Missing-query parsing, not component animation or layout.

ATTEMPTS: Reproduced in real Edge, inspected exact tick behavior, isolated the parser conversion.

ONE-LINE SOLUTION: `resolveInitialTick(rawValue, durationTicks, defaultProgress)` handles `null` before numeric conversion and has a regression test proving missing query ≠ explicit `0`.

## MOTION-FAIL-002 — Advanced inspector stretched the Lab beyond the viewport

- Status: FIXED
- Severity: medium
- Milestone: MOTION-A4.5
- Date: 2026-08-08

WHAT: Switching Motion Lab from Creator to Advanced made the preview appear blank and pushed the event strip and transport below the visible browser viewport.

WHERE: `apps/motion-lab/src/styles.css` outer `.motion-lab` grid height authority.

WHEN/HOW: Found in the first real Edge screenshot after the schema-driven Advanced inspector was wired. DOM inspection proved the graph-backed Headline was still rendered correctly; it had simply been centered far below the visible viewport.

WHY: `.motion-lab` had only `min-height: 100vh`. The much taller Advanced inspector was allowed to grow the outer grid row instead of scrolling inside its own pane.

IMPACT: Advanced graph editing looked like it had broken rendering even though the component and graph were healthy, and transport controls became unreachable without page scrolling.

ROOT CAUSE: Missing fixed viewport-height authority in the internal workshop shell, not Motion Graph evaluation.

ATTEMPTS: Verified the rendered component existed with `data-motion-graph-backed="true"`, inspected the calculated preview size in Edge DOM, then constrained the outer grid.

ONE-LINE SOLUTION: `.motion-lab` now owns `height: 100vh`, `grid-template-rows: auto minmax(0, 1fr)` and `overflow: hidden`, so Browser/Inspector scroll internally while Stage and transport remain visible.

## MOTION-FAIL-003 — Structural node removal left stale semantic references

- Status: FIXED
- Severity: high
- Milestone: MOTION-C0
- Date: 2026-08-08

WHAT: `remove-node` could delete a visual node from `scene.nodes` and its parent hierarchy but leave the removed node ID inside semantic parts, exposures, or responsive-layout metadata.

WHERE: `packages/motion-graph/src/patches.ts` structural patch application.

WHEN/HOW: Found while executing the required C0 Cost Card mutation proof: removing `cost-card.direction-indicator` caused the resulting scene to fail validation because semantic part `directionIndicator` still referenced the deleted node.

WHY: The original patch layer treated normalized nodes and hierarchy as the only structural references. It did not reconcile other graph records that address nodes by stable ID.

IMPACT: Published graph-backed components could not safely support Level-4 structural deletion even though basic add/remove patch types existed. This was a real compositor-readiness blocker.

ROOT CAUSE: Structural reference reconciliation was missing from add/remove patch application.

ATTEMPTS: Reproduced with the Cost / Value Card, confirmed validation correctly refused the stale reference, then fixed the patch layer rather than weakening validation.

ONE-LINE SOLUTION: structural add/remove now maintain semantic coverage and prune removed-node references from semantic parts, exposures and layout metadata before the resulting scene is revalidated.

## MOTION-FAIL-004 — Mask reorder operation was typed but not executed

- Status: FIXED
- Severity: medium
- Milestone: MOTION-C1
- Date: 2026-08-08

WHAT: the C1 operation contract and low-level patch union included `reorder-mask`, but the patch application switch initially lacked the corresponding branch.

WHERE: `packages/motion-graph/src/patches.ts`.

WHEN/HOW: The first exhaustive C1 operation test run passed 48/49 tests and failed only the deterministic mask-order assertion. The operation fell through to the generic sibling-node reorder branch, so mask order stayed unchanged.

WHY: The patch type expansion landed before the implementation branch was completed.

IMPACT: A future mask stack UI could report a valid operation while leaving the ordered mask stack unchanged.

ROOT CAUSE: Missing `reorder-mask` application branch and indexed mask insertion support.

ATTEMPTS: Kept the failing assertion, inspected the patch dispatcher, and implemented ordered `add-mask` plus `reorder-mask` through the existing immutable `insertAt` primitive.

ONE-LINE SOLUTION: mask insertion and reordering now use deterministic ordered-array updates, and the complete graph suite passes 49/49.

## MOTION-FAIL-005 — Visual baseline batch captured browser connection-refused pages

- Status: FIXED / invalid evidence deleted
- Severity: low for product, high for evidence integrity
- Milestone: Plan A continuation component batch
- Date: 2026-08-08

WHAT: the first 12-shot A17 browser-baseline batch wrote Edge connection-refused pages instead of Motion Lab renders.

WHERE: local Edge headless capture pipeline, not component/runtime source.

WHEN/HOW: every generated PNG had the exact same byte size. Manual inspection of the first file showed `127.0.0.1 refused to connect`.

WHY: the dedicated Motion Lab dev process had exited before the screenshot batch started. The capture command initially checked only file existence, so a valid PNG did not necessarily mean valid Motion evidence.

IMPACT: Had the files been accepted blindly, visual evidence could have been false even though tests/builds were green.

ROOT CAUSE: capture pipeline did not prove Lab availability before each screenshot.

ATTEMPTS: Deleted all invalid A17 screenshots, restarted the dedicated-worktree Vite server, verified strict port 2010 and HTTP 200, then recaptured with an HTTP-200 preflight before each case and manually inspected all 12 final images.

ONE-LINE SOLUTION: visual baseline capture now requires a live Motion Lab HTTP preflight plus manual image inspection; the invalid connection-refused PNGs were removed and never committed as evidence.

## MOTION-FAIL-006 — First C2 performance harness mixed unrelated stress paths and timed out

- Status: FIXED / invalid measurement discarded
- Severity: low for product, medium for evidence quality
- Milestone: MOTION-C2
- Date: 2026-08-08

WHAT: the first C2 benchmark attempted the required 4,000,000 direct keyframe-property evaluations and, in the same run, 1,000 repeated full-scene evaluations of a synthetic 100-node / 100-keyframe-per-property scene plus 1,000 validated graph mutations. The Harness command timed out before returning a complete result.

WHERE: temporary local C2 benchmark harness, not product source.

WHY: the measurement combined three different costs and made full scene validation dominate the run, so the timeout could not be attributed to the keyframe evaluator.

IMPACT: no valid performance number existed from that attempt; accepting a partial/assumed number would have been misleading.

ONE-LINE SOLUTION: benchmark paths were separated: the required direct keyframe evaluator stress remained at 100 properties × 10,000 arbitrary ticks for each representative keyframe count, while full-scene and graph-operation measurements use smaller independently labelled samples.

## MOTION-FAIL-007 — Headless Edge throttled the first next-paint Lab benchmark

- Status: FIXED / metric redefined honestly
- Severity: low for product, medium for evidence quality
- Milestone: MOTION-C2
- Date: 2026-08-08

WHAT: the first real-browser Motion Lab performance script waited on `requestAnimationFrame` after every exact-tick edit and timed out in headless/background Edge.

WHERE: temporary C2 browser measurement harness.

WHY: background/headless browser scheduling can throttle animation-frame callbacks independently of Motion Graph evaluation or React commit cost.

IMPACT: the run could not be used as a preview-frame-time or FPS measurement.

ONE-LINE SOLUTION: the retained browser metric measures exact-tick input dispatch to the next macrotask/DOM commit and is labelled that way; no FPS or paint claim is inferred from it.

## MOTION-FAIL-008 — First standalone A18 performance runner lacked the JSX React global

- Status: FIXED / invalid measurement discarded
- Severity: low for product, medium for evidence quality
- Milestone: MOTION-A18
- Date: 2026-08-09

WHAT: the first standalone A18 performance script failed before producing usable numbers with `ReferenceError: React is not defined` while server-rendering an existing JSX component through `tsx`.

WHERE: temporary `tmp/a18-performance-review.ts` measurement harness, not Motion product source.

WHY: the temporary standalone runner did not provide the classic JSX `React` global expected by an existing component module. Normal Vitest/Vite/TypeScript workspace execution was already green.

IMPACT: no performance number from that failed attempt could be accepted.

ATTEMPTS: Kept the failed run as invalid evidence, fixed only the temporary benchmark harness by providing the required React global, then reran the same measurement successfully.

ONE-LINE SOLUTION: standalone benchmark setup now matches the JSX runtime expectation; only the corrected 69-component/A18 measurements are retained.

## MOTION-FAIL-009 — Stacked Hook portrait type was too small in first browser review

- Status: FIXED
- Severity: medium for visual quality
- Milestone: MOTION-A18
- Date: 2026-08-09

WHAT: the first `sanverse.stacked-hook` 9:16 baseline rendered without clipping but the three hook lines were too small relative to the real 1080×1920 composition to meet the intended short-form emphasis hierarchy.

WHERE: `packages/motion-library/src/components/component-families.tsx`, A18 `stacked-hook` visual branch.

WHY: the initial compact-layout font sizes were inherited from card-like family proportions rather than being large enough for a full-screen portrait kinetic hook.

IMPACT: the component was technically valid but visually underpowered; accepting it would have weakened the A18 quality gate.

ATTEMPTS: Increased the actual composition-space compact line sizes, reran all 18 focused A18 tests plus the motion-library build, recaptured the 9:16 Dark Minimal baseline from a live HTTP-200 Motion Lab URL, and manually inspected it again.

ONE-LINE SOLUTION: Stacked Hook portrait now uses materially larger compact typography while preserving three-line hierarchy and no clipping; the weak first screenshot is not retained as evidence.

## MOTION-FAIL-010 — First C3 hierarchy stress fixture was malformed

- Status: FIXED
- Severity: low for product, medium for verification quality
- Milestone: MOTION-C3
- Date: 2026-08-09

WHAT: the first depth/width stress test generated invalid synthetic Text nodes and invalid parent links, so all ten new hierarchy-stress cases failed scene validation before Layer projection could be measured.

WHERE: `packages/motion-graph/src/layers.test.ts` synthetic test helpers only.

WHY: the existing local `text(id, name, parentId, value)` helper was called with arguments in the wrong positions while creating synthetic depth/sibling scenes.

IMPACT: the failed run did not say anything about Layer projection scalability; accepting it as a product failure would have been false.

ATTEMPTS: Kept validation strict, corrected only the synthetic fixture constructor calls, then reran the same unchanged depth `1/3/5/10/20` and sibling `10/50/100/500/1000` matrix. All 17 Layer tests passed at that point; the final Layer suite later reached 18/18 after native-node-family coverage was added.

ONE-LINE SOLUTION: fix the test data rather than weakening validation; the identical hierarchy stress matrix now passes.

## MOTION-FAIL-011 — Timer-based C3 selection benchmark timed out in headless Edge

- Status: FIXED / invalid measurement discarded
- Severity: low for product, medium for evidence quality
- Milestone: MOTION-C3
- Date: 2026-08-09

WHAT: the first real-browser Layer→Preview selection benchmark performed 100 iterations and awaited `setTimeout(0)` after each click. In headless/background Edge those timers were throttled enough to exceed the command timeout.

WHERE: temporary C3 browser measurement harness, not product source.

WHY: background browser timer scheduling is not a reliable proxy for React/DOM selection commit time.

IMPACT: the timed-out run produced no valid selection-latency number and is not used as performance evidence.

ATTEMPTS: Replaced timer polling with a `MutationObserver` that waits for the actual `data-motion-selection-node-id` overlay mutation, then ran 50 alternating real Layer selections successfully.

ONE-LINE SOLUTION: retained browser metric is mutation-to-DOM-commit based: 50 commits averaged 23.804 ms, p95 38.9 ms, worst 49.9 ms in the local headless Edge development environment.

## MOTION-FAIL-012 — First A19 hierarchy renderer looked like a flat card grid

- Status: FIXED
- Severity: medium for visual/structural communication quality
- Milestone: MOTION-A19
- Date: 2026-08-09

WHAT: the first real Edge Decision Tree and Journey Map review was mechanically valid but visually read as adjacent cards. The graph already contained nested relationships and connector paths, yet the renderer collapsed relationship evidence into a generic arrow footer.

WHERE: `packages/motion-library/src/components/a19-hierarchy-explainers.tsx` initial A19 renderer.

WHY: the first implementation proved graph structure before giving each variant its own relationship visualization.

IMPACT: accepting it would have met schema tests while failing the actual A19 goal: hierarchy-heavy explainers that visually communicate their structure.

ATTEMPTS: rejected the first screenshots, kept the graph/data contract, then redesigned the renderer by variant: parent-depth Decision levels, explicit Swimlane handoffs, numbered Journey flow, a real 2×2 Priority Matrix, staged Value Chain arrows, dependency-width Layer Stack, core→region Ecosystem structure and dependency levels. Visible cards were also mapped to their real Surface/Label/Detail graph nodes for C3 selection/effects.

ONE-LINE SOLUTION: retain one nested Motion Graph, but render its relationships explicitly instead of treating hierarchy as a card collection.

## MOTION-FAIL-013 — First A19 portrait scale was technically valid but underpowered

- Status: FIXED
- Severity: medium for visual quality
- Milestone: MOTION-A19
- Date: 2026-08-10

WHAT: the first 9:16 A19 review had correct layouts with no clipping, but compact typography inherited card-scale sizes (34px title, ~20px node labels) and left the 1080×1920 compositions visually too small, especially Journey Map, Priority Matrix and Value Chain.

WHERE: `packages/motion-library/src/components/a19-hierarchy-explainers.tsx` compact renderer dimensions.

WHY: the initial compact values optimized for fitting dense hierarchy rather than real short-form composition readability.

IMPACT: content remained correct but the portrait graphics did not use enough composition space to be useful on mobile video.

ATTEMPTS: increased composition-space compact typography, node padding, matrix region height, connector labels, ecosystem labels/members and portrait surface height; widened the Decision root; reran A19 tests/build; recaptured all eight portrait cases across all eight style packs, including busy-background and reduced-motion cases.

ONE-LINE SOLUTION: portrait now uses purpose-built compact composition sizing while 16:9 sizing remains unchanged.

## MOTION-FAIL-014 — Headless Edge screenshot paths were initially parsed as multiple targets

- Status: FIXED / evidence harness only
- Severity: low for product, low for evidence quality
- Milestone: MOTION-A19
- Date: 2026-08-09

WHAT: the first A19 headless Edge capture exited with code 13 and produced no PNG. Edge stderr reported `Multiple targets are not supported in headless mode.`

WHERE: temporary PowerShell screenshot command, not product source.

WHY: the worktree path contains spaces and the `--user-data-dir` / `--screenshot` arguments were not quoted as single arguments by `Start-Process`.

IMPACT: no product/browser rendering failure occurred; the invalid capture was discarded.

ONE-LINE SOLUTION: quote the profile and screenshot arguments explicitly; subsequent real Edge captures succeeded.

