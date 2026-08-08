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

