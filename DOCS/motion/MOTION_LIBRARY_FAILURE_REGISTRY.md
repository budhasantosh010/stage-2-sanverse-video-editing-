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

## MOTION-FAIL-015 — First C4 standalone performance harness lacked the classic JSX React global

- Status: FIXED / evidence harness only
- Severity: low for product, medium for performance-evidence quality
- Milestone: MOTION-C4
- Date: 2026-08-10

WHAT: the first C4 10→10,000-key performance run failed before measurements with `ReferenceError: React is not defined` while server-rendering the existing `AnimationDopeSheet.tsx` from a temporary `tsx` script.

WHERE: `tmp/c4-performance-review.ts`, not production or Motion Lab runtime source.

WHY: the standalone `tsx` invocation compiled the imported existing TSX using the classic JSX runtime, while the normal Vite/TypeScript app build supplies its configured JSX runtime.

IMPACT: the failed run yielded no performance numbers and is not retained as evidence.

ATTEMPTS: supplied `globalThis.React` only inside the temporary benchmark harness, then reran the identical 10/50, 50/500, 100/1000, 500/5000 and 500/10000 matrix successfully.

ONE-LINE SOLUTION: fix the measurement harness runtime rather than changing C4 product code; only the corrected stress results are documented.

## MOTION-FAIL-016 — Real Edge exposed lower-frame-only C4 snapping

- Status: FIXED
- Severity: medium for animation-editing correctness
- Milestone: MOTION-C4
- Date: 2026-08-10

WHAT: the first real Edge multi-key drag preserved relative spacing but landed the primary key at `3,586,963` ticks even though snapping was enabled and the closer 30fps frame boundary was `3,600,000`.

WHERE: `packages/motion-graph/src/dope-sheet.ts`, initial frame snap candidate.

WHY: `frameForTicks(raw)` floors to the previous frame. The first implementation tested only that lower frame boundary, so a raw tick in the second half of a frame could be farther from the lower boundary than the snap threshold while still being close to the next frame.

IMPACT: frame snapping was directionally asymmetric and could fail during ordinary rightward drags.

ATTEMPTS: retained the failed browser result as diagnostic evidence only, changed snapping to compare lower and upper frame ticks and choose the nearest, added an upper-half regression test, then repeated the same CDP multi-select/drag.

VERIFIED FIX: the retained second browser proof moved the selected pair from `3,024,000 / 4,320,000` to exact snapped `3,600,000 / 4,896,000` while preserving the original `1,296,000`-tick spacing.

ONE-LINE SOLUTION: nearest-frame snapping now chooses the closer lower/upper frame boundary before applying the existing threshold.

## MOTION-FAIL-017 — First A20 Toast Stack collapsed text into an avatar-width column

- Status: FIXED
- Severity: medium for visual/readability quality
- Milestone: MOTION-A20
- Date: 2026-08-10

WHAT: the first real Edge Toast Stack rendered each notification almost one word per line and pushed the title toward the bottom crop.

WHERE: the initial `conversation-toast-stack` render branch in `component-families.tsx`.

WHY: each toast used a three-column CSS grid (`42px 1fr auto`) but supplied one text child, so the text occupied only the first 42px column.

IMPACT: tests and graph structure were valid, but the actual product-story hook was unusable on footage.

ATTEMPTS: rejected the screenshot, replaced the false three-column row with a single readable block layout, strengthened compact typography/surface presence, reran A20 tests/builds and recaptured both 16:9 Editorial/busy and 9:16 Creator Energetic/busy cases.

VERIFIED FIX: both retained captures show normal message lines, complete title/subtitle and safe placement with no clipping.

ONE-LINE SOLUTION: visible notification rows now match their actual one-child semantic structure instead of pretending an avatar/timestamp DOM structure exists.

## MOTION-FAIL-018 — C5 10,000-key Fit Track overflowed the JavaScript call stack

- Status: FIXED
- Severity: medium for large-curve development tooling
- Milestone: MOTION-C5
- Date: 2026-08-10

WHAT: the required 10,000-key Value Graph development render failed with `Maximum call stack size exceeded`.

WHERE: `fitMotionCurveValueRange(...)` in `packages/motion-graph/src/curves.ts` while the C5 React view constructed its fitted value range.

WHY: the first implementation used `Math.min(...finite)` and `Math.max(...finite)`. Spreading a large array into function arguments is limited by the JavaScript engine's call stack/argument handling.

IMPACT: pure curve projection was valid, but the actual development Value Graph could not construct the required 10,000-key stress view.

ATTEMPTS: the stress size was not reduced. The min/max implementation was changed to a bounded loop and the identical 10/100/1k/5k/10k tests were rerun.

VERIFIED FIX: 10,000-key pure projection/path/operation measurement and 10,000-key development React/SVG construction both pass; the fresh full C5 gate is 422/422 tests.

ONE-LINE SOLUTION: compute large-track min/max iteratively instead of spreading every value into `Math.min/Math.max`.

## MOTION-FAIL-019 — Shared C4/C5 controlled selection caused an infinite React update loop

- Status: FIXED
- Severity: high for C5 browser usability
- Milestone: MOTION-C5
- Date: 2026-08-10

WHAT: the first real Edge run after wiring one shared C4/C5 keyframe selection rendered a blank Motion Lab and logged `Maximum update depth exceeded`.

WHERE: C4's projection-reconciliation effect in `apps/motion-lab/src/AnimationDopeSheet.tsx`.

WHY: Motion Lab regenerates the derived scene/projection as normal React state changes occur. The controlled C4 reconciliation path published a freshly allocated selection object even when the retained stable IDs, primary ID and anchor ID had not changed. Parent state updated, projection regenerated, and the effect repeated.

IMPACT: unit behavior was green, but the real browser compositor was unusable; the screenshot correctly failed visual acceptance.

ATTEMPTS: browser console logging identified the React maximum-depth error. The reconciliation path now compares retained stable IDs/primary/anchor and publishes only when the controlled selection actually changes.

VERIFIED FIX: a repeat real Edge console run contains no `Uncaught`, `Maximum update`, or React error, and `motion/visual-baselines/c5-value-graph.png` shows the real Cost Card Value Graph, selected key, Bezier handle and Inspector.

ONE-LINE SOLUTION: controlled C4 selection reconciliation is now idempotent—unchanged stable selection is not re-published.

## MOTION-FAIL-020 — A21 portrait Terminal Command Story passed mechanics but failed readability

- Status: FIXED
- Severity: medium visual-quality failure
- Milestone: MOTION-A21
- Date: 2026-08-10

WHAT: the first retained 9:16 Creator Energetic Terminal Command Story rendered the correct command/output hierarchy, but compact typography was too small at realistic preview scale.

WHERE: the compact branch of `terminal-command-story` in `packages/motion-library/src/components/component-families.tsx`.

WHY: the first renderer reused near-desktop monospace sizes (17px command / 14px output / 13px result) even though the 9:16 composition is displayed substantially smaller inside the desktop Motion Lab shell.

IMPACT: all automated ratio/style/graph tests passed, but the real creator-facing visual did not meet the manual readability/WOW gate.

FIX: increased compact terminal chrome, command, output and result typography and spacing without changing the content contract, graph node IDs, C2 timing, or desktop layout.

VERIFIED FIX: `motion/visual-baselines/a21-terminal-command-story.png` was recaptured at 9:16 Creator Energetic on a busy footage-like background with reduced motion and is readable at the retained preview scale.

ONE-LINE SOLUTION: portrait terminal typography now scales for viewing distance instead of merely satisfying layout bounds.

