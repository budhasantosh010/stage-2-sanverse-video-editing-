# Project Log

## 2026-08-27 — Creative Engine V1.3 camera/depth + preference intelligence release candidate green

- Implemented `@sanverse/motion-camera-depth` as a narrow exact-tick C10 layer over the existing Motion Graph. C9 tracking resolves first into ordinary graph transforms; C10 then evaluates one camera rig plus per-node depth bindings at the same canonical tick and emits ordinary graph transform operations. No CameraGraph, second clock, renderer or timeline was introduced.
- Added B8 owner-preference/failure intelligence as evidence-only recommendation state. The review fixture promotes `camera-policy = restrained` from 3 explicit positive owner signals across 2 projects and surfaces a recurring `CAMERA_TOO_AGGRESSIVE` lesson from 2 failure signals; automatic mutation remains off and all rights/locks/approval/canonical-state authorities remain unchanged.
- Extended the existing external bridge with truthful Rive support: deterministic `sanverse.rive-subset/v1` exports can materialize to native Motion Graph state, while raw `.riv` binaries/state machines refuse as `RIVE_RUNTIME_REQUIRED`. Internal V1.3 operations land in the existing agent-tool registry first; MCP remains a thin generic adapter.
- Added development-only `/camera-depth-review` and a real Edge audit. Final browser proof ran true 1× for **5021 ms**, captured **155** frames, reached **7,200,000/7,200,000** ticks, proved C9 composed + graph-backed C10, four depth layers with four distinct transforms, B8 `restrained`, Rive `native-materialize`, and zero release console/network failures. Retained frames were manually inspected and visibly show the foreground responding most strongly while the C9-tracked callout continues its independent path.
- Focused gates are camera/depth **10/10**, Creative Direction **43/43**, external bridge **15/15**, agent tools **22/22**, MCP **13/13**, Motion Lab **63/63**. Complete final repository matrix: **2,883/2,883 PASS**, including protected Web **1,231/1,231**; root all-workspace build **PASS / exit 0**.
- The first heavily loaded root run produced one 5-second timeout in unchanged protected `StudioPreviewReliability`; the exact file then passed **6/6** alone with the ten-cycle stress at **815 ms**, and the complete final root rerun passed with that stress at **1.46 s**. No protected-web source or assertion changed.
- Release hygiene is green and V1.3 is now sealed locally: actual `apps/web/**` content diff 0, no raw source media, no GitHub remote/Actions work, and the separately versioned `sites/` repository is explicitly root-ignored so stage-all cannot accidentally absorb it. Implementation/evidence commit `6821ff0930beff8e260f172ab4b24011334f4d49` and immutable local tag `sanverse-creative-engine-v1.3` resolve to the same SHA. V1.4 Expert Motion is unlocked from this exact baseline.

## 2026-08-27 — Creative Engine corrective V1.2.1 closes semantic-pack release gap

- A post-tag contract audit found that the immutable `sanverse-creative-engine-v1.2` release marker existed before every exact semantic operation family named by the owner brief had been exposed. The tag is preserved; it is not rewritten or moved.
- Added the missing exact semantic M5/M6/M7 setup/control contracts, all required easing commands, all eight stagger modes including seeded deterministic-random, and source-aware placement commands for negative space, face/subject avoidance, split balance, PIP, tracked callouts, readable labels and subject wrapping. These compile into existing C5/C8/C9/Motion Graph authorities; there is no new runtime/graph/timeline.
- Focused gates: source-aware **17/17**, agent tools **18/18**, MCP **10/10**, all builds PASS. The complete corrective repository matrix is **2,854/2,854 PASS**, including protected `apps/web` **1,231/1,231**; root all-workspace production build PASS.
- Fresh real Edge proof on the corrective tree ran the temporary 1280×720 30fps 5.000s VP9/WebM at true **1×** for **4994ms**, captured **149** frames, reached **7,200,000/7,200,000** ticks, and mechanically plus visually re-proved M5 tracked attachment, M6 surface perspective and M7 C8 matte compositing. Release console/network failures are zero after excluding automatic favicon noise.
- Corrective implementation commit is `7cfe929`; the release is sealed by immutable local tag `sanverse-creative-engine-v1.2.1`. V1.3 is unlocked only from that corrected baseline. `apps/web/**` remains untouched; `sites/` remains a separate excluded repository; no GitHub remote/Actions work is used.

## 2026-08-27 — Creative Engine V1.2 Source-Aware + Cohesive Motion release candidate green

- Executed V1.2 as the first independently gated release of the owner-approved V1.2→V1.4 continuous program. V1.3 remained blocked throughout V1.2 implementation and verification.
- Added `@sanverse/motion-source-aware` with Sanverse-owned exact-tick point/object/subject/surface `MotionTrackV1`, `TrackBindingV1`, tracking QA/repair, imported canonical subject mattes and a real deterministic RGBA color-marker tracking provider. Provider output is materialized data; provider/runtime state never becomes animation authority.
- M5 composes track base transform + explicit user offset + ordinary Motion Graph motion. M6 computes a deterministic four-corner homography and materializes graph-native `perspectiveMatrix3d` with the correct top-left transform origin. M7 materializes canonical subject matte data into the existing C8 mask/compositing path. All three prove direct/backward/repeated/random seek equality and fail closed on unresolved QA.
- Added B6 Style Intelligence recommendations/reasons with locked-style protection and B7 nine-dimension video cohesion scoring with explicit deliberate hero/payoff exceptions. Neither intelligence layer mutates canonical state or bypasses rights/locks/approvals.
- Extended the existing external-source bridge with bounded deterministic React/SVG and Remotion subsets. Static SVG JSX and supported Remotion timing/interpolation/spring-like scale materialize to native graph/keyframes; hooks, browser/network/time/random/event runtime behavior and unsupported constructs are rejected/partial rather than embedded as a second render authority.
- Extended the existing internal tool registry with source-aware T0/T1 operations and proved the existing MCP remains only a thin generic adapter over those tools. No MCP tracking store, alternate clock, project state, owner approval or Undo authority was introduced.
- Real Edge `/source-aware-review` used a temporary VP9/WebM **1280×720, 30fps, exactly 5.000s** source, ran true **1×** for **5003ms**, captured **149** browser frames, reached exactly **7,200,000 / 7,200,000 ticks**, and left all three video elements at 5.000s. Final human-readable evidence visibly shows M5 tracked callout following the target, M6 cyan surface content warped onto the tracked blue quad, and M7 purple environment/foreground graphics wrapping around the orange subject cutout through C8. Temporary raw media was removed after the audit.
- Browser/regression verification found and fixed four real blockers before acceptance: perspective-only transforms skipped by the native runtime (`MOTION-FAIL-028`); M6 homography applied around a center origin (`MOTION-FAIL-029`); entity-escaped/implicit-mode C8 SVG browser masks (`MOTION-FAIL-030`); and the new perspective property missing from generic keyframe capability classification, crashing C2 (`MOTION-FAIL-031`).
- The first heavily loaded root test run also produced two 5-second timeouts inside protected `apps/web`; no assertion failed and no web source changed. The exact files passed 10/10 in the repository-documented Windows single-fork mode, then the complete deterministic all-workspace matrix passed **2,846 / 2,846** including protected Web **1,231 / 1,231**. Root `npm run build` exits 0 across all workspaces.
- Release hygiene: `git diff --check` PASS; `apps/web/**` diff 0; no raw source media; separately versioned `sites/` remains excluded; no GitHub remote/PR/Actions operation. Implementation/evidence commit `327c4e8`; immutable local release tag `sanverse-creative-engine-v1.2`. Continuous status: `DOCS/motion/creative-engine-v1.2-v1.4/STATUS.md`. V1.3 is now unlocked.

## 2026-08-26 — Creative Engine V1.1 Promotion / Parameterization / Reuse complete locally

- Added narrow `@sanverse/motion-promotion` over the existing Creative/Motion authorities: exact approved-source validation, isolated revisioned promotion workspace, atomic/idempotent transactions, conservative parameterization, frozen design properties, classification/productization, semantic Style Lock, role-based Motion Recipe extraction, immutable lineage, most-restrictive rights aggregation, promotion QA and atomic versioned registration.
- Origin and reuse status remain independent. Generated Project-A work stays `origin = generated`; after successful registration it becomes `reuseStatus = promoted-reusable`. No second graph, renderer, keyframe engine, timeline, Library registry, accepted-project state or Undo system was introduced.
- Extended B2/Library only through typed promoted-capability views/metadata. The static 99-component registry remains the existing authority; promoted capabilities join normal capability retrieval/ranking and receive deterministic explanations rather than automatic “newest wins” preference.
- Closed the required registry-driven Project A → Project B loop: exact motion-approved A → candidate → parameterization → scene productization + Motion Recipe → QA → registration → B2 retrieval → isolated B reuse → content/style/recipe adaptation → C3/C4/C5/C6 identity/direct-seek proof → exact reuse approval → one accepted-project merge → one inverse Undo restoring original Project B. Stale sandbox writes and forged/stale approvals are refused before mutation.
- Extended the one internal registry from 17 to **37 tools**. MCP V1.1 exposes the same registry generically; it owns no promotion/project/approval/Undo state. MCP tests prove fake source-approval JSON cannot manufacture a promotable source and approval-bearing reuse calls still require host-resolved opaque proof.
- Added development-only `/promotion-review` with Project-A source, promoted-default parity, Project-B adapted reuse, parameters/frozen properties, classification/recipe, lineage, QA/Library state and C3/C4/C5/C6 deep-editability truth.
- The first real Edge run correctly failed release evidence because Project B's canonical graph contained the new title while `CostValueCard` still rendered title/metric-label text from stale props (`MOTION-FAIL-027`). The renderer now treats resolved Motion Graph text as display authority and reuses existing responsive text fitting; a dedicated regression test locks the fix.
- Final real Edge proof completed at exactly **1×**, **7,200,000 / 7,200,000 ticks**, capturing **80** frames. Project A and promoted default stay preserved; Project B visibly shows `Retention compounds faster`, `82%` and the adapted orange semantic accent; `cost-card.value` remains graph-backed/deep-editable; origin/reuse truth is generated/promoted-reusable. Entrance/middle/exit frames were manually inspected.
- Fresh final affected matrix: **551/551 PASS** and the root all-workspace production build is **PASS**. `apps/web/**` remains untouched; separately versioned `sites/` remains excluded; local Git only. Durable closeout: `DOCS/motion/creative-engine-promotion-v1/STATUS.md`; local release tag: `sanverse-creative-engine-promotion-reuse-v1.1`.

## 2026-08-26 — Creative Engine Closed-Loop V1 + MCP V1 complete locally

- Reconciled the complete verified CH1 foundation into the requested Motion worktree before new architecture work and preserved the pre-existing portable-Library changes plus the separately versioned nested `sites/creative-library-site` repository.
- Extended shared contracts with the closed presentation/source/background/scope/lock/editability/result vocabulary; added C6 node projection and bounded C8 matte/compositing to the existing Motion Graph rather than creating parallel authorities.
- Added narrow Storyboard/Animatic sandbox, external-source bridge and UI-independent agent-tool packages. Storyboard writes are revision-fenced and atomic; approvals target exact revisions; reopening invalidates old approval; external SVG/Lottie support is explicitly bounded and unsupported features fail closed; alpha video remains an external exact-time asset.
- Motion Forge produces inspectable `MotionPlanV1` beats/intents and compiles the locked 27-operation semantic vocabulary into existing Motion Graph keyframe/mask operations. Structural QA covers graph/semantic IDs/assets/capabilities/provenance/locks/unsupported operations/exact ticks/direct-seek parity; repairs are localized and reversible.
- The registry-driven acceptance test executes Storyboard → QA → owner approval → Animatic → QA → owner approval → MotionPlan/Motion Draft → QA → canonical review → owner approval → one atomic accepted-project merge → one inverse Undo. A forged revision approval is refused, and the same `hero` semantic identity remains visible through C3 Layers, C4 Dope Sheet, C5 Curves and C6 Node Graph.
- Added the development-only `/closed-loop-review` Motion Lab route and real Edge/CDP audit. One canonical 1× playback completed at exactly **7,200,000 / 7,200,000 ticks**, captured **194** browser frames, remained graph-backed and exposed stable semantic node `cost-card.value`. Entrance/payoff/exit frames were visually inspected and retained under `motion/visual-baselines/closed-loop-v1/`.
- Added `@sanverse/motion-mcp` as a thin adapter over the same internal registry. MCP exposes the actual 17 Closed-Loop tools, carries explicit sandbox context, serves a real localhost `/mcp` request, and cannot create owner approval from client JSON, elicitation response, guessed request state or fake proof; only host-resolved opaque approval proof is accepted.
- Final release gate: **525 affected tests PASS** plus root all-workspace build PASS. `apps/web/**` diff is **0**. The existing Motion Lab/web large-chunk warnings and runtime-resolved nameplate-font warning remain non-blocking pre-existing build warnings. Local Git only; nested `sites/` repository is excluded from this release.
- Durable closeout: `DOCS/motion/creative-engine-closed-loop-v1/STATUS.md`, `REQ-016`, `DEC-014`, Build Tracker row `CREATIVE-CLOSED-LOOP-V1`.

## 2026-08-14 — Plan-A Approved Component Ingest V1 + Frosted Icon Rail pilot ready for owner parity

- Added one fail-closed `@sanverse/motion-ingest` pipeline and internal CLI for inspect → immutable ingest → productize → parity → register. Source kinds are closed; public registration is atomic and cannot occur before owner-reviewed integrated parity.
- Recorded the owner's explicit approval of all ten CH1 source visuals. All ten inspect as deterministic/direct-seek-safe foreign components suitable for lossless normalization; only Component 01 advanced as the required first pilot.
- Frosted Icon Rail now has one canonical Motion Scene with 14 semantic nodes, 15 meaningful exposures, real C2 keyframes/formulas, C3/C4/C5 projection and seven typed AI-edit intents while preserving the approved CH1 default visual/timing.
- Added exact deterministic `back-out` scalar expression support because the approved CH1 item scale uses that mathematical easing; replacing it with a convenient generic ease was rejected.
- Immutable pilot source hash: `428e6e328f366417f3e13fb8dcbca388238e1d196f78ec5243fa97a3e374ce39`. No creator/reference MP4 was copied into the repository.
- Real Edge parity page compares the immutable approved renderer and integrated Sanverse renderer on one exact playhead. A 31-frame/30-fps canonical comparison plus temporal contact sheet preserves entrance, stagger, hold and exit; full-video SSIM 0.996780 is supporting evidence, not the visual authority.
- Fresh scoped gate: **469/469 tests**; root all-workspace build PASS. `apps/web` diff 0. A deliberate pre-owner registration attempt correctly refused, so the public catalog remains 89.
- Next action is owner visual verification of the integrated Frosted Icon Rail. Stop before public registration/bulk CH1 ingestion and before A22/B2/B3/C6.


## 2026-08-11 — Sanverse Creative Engine L1 Creative Library complete locally

- Added a one-registry development Creative Library over all 89 public Plan-A components with typed discovery metadata, search/filter/sort/tabs/collections and future-B2 pure lookup boundaries.
- Added deterministic 480×270 generated posters plus preview hashes/freshness manifest; the grid rests with zero live players and permits at most one inline real Motion preview.
- Added exact component detail playback/scrub, ratio/style/background/reduced-motion controls, Component Lab/C3-C5 deep links, full-catalog/collection showreel and durable local review queue/persistence.
- Completed a real local Edge audit for every public component from tick 0 to canonical end at exactly 1×, then visually inspected temporal progression. Final durable result: **89/89 Passed = 13 S / 35 A / 41 B**.
- Final poster freshness: 89 selected, 0 regenerated, 89 fresh. Real browser route checks found 0 unnamed controls and 0 images without alt; first inline live preview measured 208.4 ms in the local engineering run.
- Fresh affected Creative/Motion/B1 suites: **459/459 tests**. Root all-workspace production build passes. `apps/web` has zero diff; no forbidden external animation runtime was added.
- Evidence: `DOCS/creative-engine/evidence/L1-CREATIVE-LIBRARY.md`; architecture: `DOCS/motion/CREATIVE_LIBRARY_ARCHITECTURE.md`.
- Owner requested local-only Git closeout because the current GitHub CI/CD monthly minutes are exhausted. Preserve local commit/tag `sanverse-creative-library-l1`; do not push until the owner re-authorizes next month. Stop before A22/B2/B3/C6.

## 2026-08-11 — Sanverse Creative Engine ABC-2 source-to-curve integration complete

- Added a development-only B1→B0 trace adapter that resolves stable Video Understanding observation IDs into exact evidence ticks/provenance, creates deterministic source-statistic Creative Direction, and links verified B1 observations to existing B0 directives without introducing a Motion dependency into the B0 package.
- Extended the existing proposal→Motion bridge with semantic family-value mapping and exact reversible B0 placement↔Plan-A local tick projection; both continue to use the canonical 1,440,000-tick authorities rather than a new clock.
- Required statistic proof: real B1 `68%` at 4–8s → B0 source-statistic directive/proposal → A21 Donut Breakdown (`Observed 68`, deterministic `Remaining 32`) → one Motion Scene → C3/C4/C5. A real C5 `soft` preset edit preserves observation/directive/component/node/keyframe identity.
- Required security proof: real B1 security evidence at 49–57s is linked to existing B0 Scoped Access at 72–80s → `sanverse.scoped-access-comparison` → C3/C4/C5. A real C5 `smooth` edit preserves all Motion IDs and the B1 trace, proving evidence time, edit placement time and local component time can remain intentionally distinct.
- The first statistic proof truthfully failed its C5 requirement because legacy `Single Metric` has no explicit C2 keys. The proof was not weakened or backfilled with fake keys; percentage statistics in this integration use keyframe-native A21 Donut instead (`CREATIVE-FAIL-009`).
- Real Edge retained `abc2-source-statistic-c5.png` and `abc2-scoped-security-c5.png`, paired with the B1 source-understanding screenshot. Fresh final gate: **439/439 tests**, **9/9 builds**. Evidence: `DOCS/creative-engine/evidence/ABC-2.md`. `apps/web` remains untouched. ABC-2 stops before A22/B2/B3/C6.


## 2026-08-10 — MOTION-A21 Creator Utility + Advanced Visual Pack complete

- Re-audited all 83 public components after C5 and rejected duplicate jobs: generic bar chart, another roadmap/timeline, another screenshot/cursor focus, another KPI dashboard, another logo cloud and another before/after card.
- Added exactly six distinct first-party creator/explainer components: Trend Line Chart, Donut Breakdown, Venn Intersection, Feature Comparison Table, Code Diff Spotlight and Terminal Command Story. Public catalog: **83 → 89**.
- All six reuse the existing Family Creator/Designer/Advanced shell and one Motion Graph; they are exact C2-keyframe-native, C3 Layer-ready, C4 dope-sheet-ready and expose editable numeric C5 curve tracks. Shared authoring window is 1–10 seconds with reduced-motion final constants and fail-closed content bounds.
- Automated coverage spans all **6 × 4 ratios × 8 styles = 192** combinations, deterministic seeks, maximum valid text density and original/generic fixture checks. A21's dedicated 576-iteration measurement includes create/evaluate/C3/C4/C5 plus SSR markup.
- Real Edge retained all six across varied ratios/styles/hostile backgrounds plus a real Trend C3+C5 compositor view. The first portrait Terminal capture passed mechanics but failed readability; compact terminal typography was enlarged and recaptured (`MOTION-FAIL-020`).
- Fresh release gate: **435/435 Creative + Motion + B1 tests**, **9/9 builds**. Evidence: `DOCS/motion/evidence/MOTION-A21.md`; coverage: `DOCS/motion/COMPONENT_COVERAGE_MATRIX.md`. `apps/web` remains untouched. Next and final ABC-2 gate is source → B1 → B0 → Plan A → C3 → C4 → C5 proof.


## 2026-08-10 — MOTION-C5 Professional Curve Editor complete

- Added a pure C5 Value Graph projection over the same C2 numeric keyframe authority; no second graph, keyframe store, Layer tree or animation clock exists.
- C4 Timeline and C5 Curves now share one stable keyframe selection, selected animation track and Motion Lab playhead. Selecting either surface selects/seeks the same real C2 key.
- Added Hold/Linear/Bezier curve visualization, real incoming/outgoing Bezier handles, deterministic easing presets, exact tick/value/interpolation/handle Inspector, Fit Track/Fit Selection, time/value zoom-pan and read-only authored-driver tracks.
- C5 handle/preset/value/time edits compile only to existing typed Motion Graph operations and reuse the compositor Undo/Redo journal as one transaction per user action.
- The required 10,000-key stress exposed a real large-array call-stack bug in Fit Track; the implementation now computes min/max iteratively (`MOTION-FAIL-018`). Real Edge then exposed an unchanged controlled-selection React loop; C4 reconciliation is now idempotent (`MOTION-FAIL-019`).
- Real Edge retained `motion/visual-baselines/c5-value-graph.png`, showing the real Cost Card `transform.scaleX` key at tick 3,024,000/value 1.08, its Bezier handle, shared playhead and Curve Inspector. Repeat console evidence contained no React/Uncaught error.
- Fresh C5 release candidate: **422/422 Creative + Motion + B1 tests**, **9/9 builds**. Evidence: `DOCS/motion/evidence/MOTION-C5.md`; architecture: `DOCS/motion/CURVE_EDITOR_ARCHITECTURE.md`. `apps/web` remains untouched. Next lane is A21, then the ABC-2 source-to-curve integration proof.


## 2026-08-10 — Sanverse Creative Engine Plan B1 Video Understanding Foundation complete

- Added one bounded `@sanverse/video-understanding` package using the existing Sanverse exact-tick authority. V1 source understanding includes source metadata, timed transcript/optional word timing, shots, overlapping visual regions, normalized spatial observations, semantic moments, generic observations, finite confidence and required provenance.
- Added structured JSON and SRT/VTT transcript ingestion plus vendor-neutral shot/visual/spatial/semantic analyzer boundaries. The deterministic offline semantic analyzer conservatively recognizes explicit percentages, money, questions, comparisons, process/list language, CTA, security, feature and benefit language without any provider/API requirement.
- Added fail-closed validation and JSON round-trip serialization. Shots may contain honest gaps but cannot overlap; normalized spatial rectangles must remain inside 0..1 source space; semantic transcript references and provenance must exist.
- Added original 72-second product-launch and scalable synthetic fixtures. The development Creative Direction Lab now exposes SHOTS/VISUAL/TRANSCRIPT/SEMANTICS/SPATIAL source lanes and an observation inspector. Real Edge retains the loaded 68% statistic with transcript-rule provenance at `motion/visual-baselines/b1-source-understanding.png`.
- Extended B0 directive/proposal contracts with optional `sourceObservationIds`; fixture compilation preserves them while Creative Direction remains independent of the B1 package. Cross-document existence remains an integration responsibility rather than creating a reverse dependency.
- Measured 1/10/30/60-minute transcript fixtures separately for analysis/validation/serialization/timeline projection and Source Understanding React construction; results are recorded without inventing a product SLA in `DOCS/creative-engine/evidence/B1.md`.
- B1 implementation found and fixed a `%` regex boundary bug and a typed normalized-bounds validation issue; the first too-early browser screenshot was rejected and recaptured after the async fixture loaded.
- Fresh B1 release candidate: **401/401 Creative + Motion + B1 tests**, **9/9 builds**. `apps/web`, production editor, B2/B3/C6/A22 and external model/runtime dependencies remain untouched.

## 2026-08-10 — Sanverse Creative Engine ABC-1 integrated workflow complete

- Added a development-only proposal→Motion bridge in Motion Lab; the `@sanverse/creative-direction` package remains independent of Motion internals. Resolved B0 proposal rows now expose `Preview in Motion Lab ↗` and carry their actual semantic text/items/placement into the chosen Plan-A component.
- Added a cross-plan architecture suite proving all **9** product-launch placements flow `Creative Directive → Creative Proposal → Plan-A component → Motion Scene → C3 Layers → C4 tracks` with valid stable references.
- Required proof 1: `semantic-highlight-statement` resolves to Kinetic Headline; C4 moves a real highlighted-word opacity key by exactly one frame through typed C2 operations while component ID, node IDs and keyframe ID remain unchanged.
- Required proof 2: `scoped-access-comparison` resolves to Scoped Access; one atomic C4 operation array moves left card, right card, title and emphasis/value keys by exactly two frames while all graph/keyframe IDs remain unchanged.
- The first all-placement run exposed a real duration-semantics boundary: B0's Product UI Story belongs to the edit for 25 seconds while its A20 local authored motion supports 1.5–12 seconds/default 7. The integration bridge now preserves exact B source-region ticks separately from A local motion ticks; future production compiler scheduling of hold/loop/exit remains deferred (`CREATIVE-FAIL-006`).
- Real Edge retained the B0 typed proposal with direct Motion Lab links plus matching Semantic Highlight and Legal/Engineering Scoped Access C3+C4 screens.
- Fresh final integrated release gate: **381/381 Creative + Motion tests**, **8/8 builds**. No `apps/web`, production editor, provider API, copied reference asset, B1, C5 or A21 implementation was added. Evidence: `DOCS/creative-engine/evidence/ABC-1.md`. The integrated rollback checkpoint is `sanverse-creative-engine-abc1`.


## 2026-08-10 — Sanverse Creative Engine MOTION-A20 Product Storytelling pack complete

- Re-audited the 77-component library before implementation. Rejected duplicate public modules for Semantic Highlight, Picture-in-Picture, Soft Product Backdrop, Application Window Reveal and Lower Third; those jobs are handled by an existing Kinetic Headline variant, reusable primitives/treatments, Browser Demo/window vocabulary and existing Lower Third.
- Added six genuinely distinct first-party product-story components: Conversation Toast Stack, Floating Prompt Composer, Product UI Story Scene, Agent Work Log, Scoped Access Comparison and Keyword-to-Brand Lockup. Public catalog: **77 → 83**.
- Added deterministic seven-anchor footage-safe placement and analytic picture-in-picture transition primitives. A20 Family props expose placement and bounded safe offset without introducing another layout store.
- Strengthened Kinetic Headline with typed `highlight-box` emphasis and real C2 opacity/scale tracks. The six new modules are C2 keyframe-native with exact 1.5–12s durations, reduced-motion final constants and product-story motion events for future Plan-B alignment.
- Real Edge review spans all eight style packs and all four ratios across busy/white/neutral/black footage-like backgrounds. The first Toast Stack failed visual QA because one text child occupied a false 42px grid column; it was rejected, fixed and recaptured (`MOTION-FAIL-017`). Reduced-motion Agent Log and Product UI Story in real C3 Layers + C4 timeline are retained.
- A20 performance across 192 component/style/ratio combinations repeated five times: graph creation + exact evaluation + C3 + C4 averaged **0.739 ms** (p95 1.333 ms); SSR markup averaged **1.110 ms** (p95 2.189 ms). Average scene: 11.83 nodes / 26.33 tracks / 107.33 keys. These are local engineering timings, not FPS claims.
- Fresh A20 release candidate: **378/378 combined Creative + Motion tests**, **8/8 builds**. Evidence: `DOCS/motion/evidence/MOTION-A20.md`. No `apps/web` or production editor source changed; next gate is the separate `motion-library-v1.4` checkpoint followed by ABC integration.


## 2026-08-10 — Sanverse Creative Engine MOTION-C4 Professional Animation Timeline complete

- Added `projectMotionDopeSheet(...)` as a pure derived control projection over existing C2 `deriveTimelineTrackGroups(...)`. C4 stores no second keyframes, Layers or animation clock; stable track/key selection IDs point back to the real typed C2 targets/keyframe IDs.
- Added C4 keyframe UI selection helpers plus bounded frame/start/end/key/event snapping and collision-safe atomic multi-key move/delete operation builders. Positive same-track multi-moves apply later→earlier and negative moves earlier→later to avoid transient key collisions while preserving IDs/spacing.
- Added the development `AnimationDopeSheet` inside existing Compositor mode. It shares the Motion Lab playhead and C3 node selection and provides seconds/frames/ticks ruler, keyframe/driver distinction, single/Ctrl/Shift selection, pointer multi-drag, add/delete, ±1/±10-frame nudge, 1–16× zoom, horizontal pan/fit, vertical track navigation, UI-only collapse, event markers and numeric keyframe/Bezier Inspector.
- All C4 edits route through existing C2 `MotionGraphOperationV1` and `applyMotionOperations(...)`. The entire selected operation array enters `appendGraphOperations(...)` once, so a five-key drag is one bounded Compositor history transaction/Undo rather than five.
- Added a full 77-component × 4-ratio C4 projection gate. Every projected track references its real scene node; driver/binding tracks never fabricate keyframes; all keyframes remain inside owning duration.
- Real Edge on strict Motion Lab port 2010 proved two selected Cost/Value scale keys, actual pointer multi-drag, C3 Layer sync, event markers and zoom. The first browser drag exposed lower-frame-only snap logic; the fix compares both neighboring frame boundaries. Corrected result moved `3,024,000 / 4,320,000` → exact snapped `3,600,000 / 4,896,000` while preserving `1,296,000` ticks spacing.
- Required stress matrix measured 10 tracks/50 keys, 50/500, 100/1000, 500/5000 and 500/10000. At 10k keys projection averaged 15.214 ms while SSR construction averaged 353.590 ms; 50-key immutable drag on the synthetic 500-track scene averaged 1,170.088 ms. Current real components are far smaller, so C4 does not add premature virtualization or weaken validation.
- Fresh C4 release candidate: **361/361 combined Creative + Motion tests**, **8/8 builds**. Evidence: `DOCS/motion/evidence/MOTION-C4.md`; architecture: `DOCS/motion/DOPE_SHEET_ARCHITECTURE.md`; failures: `MOTION-FAIL-015/016`.
- No `apps/web` or production video-timeline source was changed. The lane is preserved by the dedicated `motion-compositor-c4` checkpoint; A20 begins from that boundary.

## 2026-08-10 — Sanverse Creative Engine Plan B0 Creative Direction Foundation complete

- Created the unified Creative Engine program document: Plan A = Creative Capability, Plan B = Creative Intelligence, Plan C = Creative Control. Normal future cycles explicitly combine an A milestone, B milestone, C milestone and cross-plan proof unless a stabilization reason is recorded.
- Added one `@sanverse/creative-direction` package rather than fragmenting Plan B. It reuses the canonical `PROJECT_TIMESCALE = 1,440,000` ticks/second and represents every Creative Direction region with exact `startTicks`/`endTicks`.
- Added STYLE, GRAPHICS, MOTION, FOOTAGE, TRANSITION, EMPHASIS, NOTES and CONSTRAINTS tracks plus typed directive source/priority/status, semantic style/graphic/motion/footage/transition/emphasis/constraint vocabularies, comments and creative-plan versions with compare/restore lineage.
- Added `sanverse.creative-edit-proposal/v1`: typed component placements, style assignments, motion assignments, footage treatments, constraints and explicit unresolved directives. Resolved component/style references fail closed against a supplied Plan-A catalog.
- Added vendor-neutral `CreativePlanningModelV1` and a deterministic offline `FixtureCreativePlanner`. B0 has no provider SDK, API key, internet requirement, CSS/DOM generation or direct Motion Graph mutation.
- Added an original 95-second product-launch textual reference fixture with notification hook, semantic headline, presenter/lower-third, prompt, product workflow, agent progress, scoped comparison, callback and generic Sanverse lockup. No source commercial media, logos, screenshots or extracted frames were committed.
- Added immutable exact-tick Creative Direction operations for add/remove/move/resize/duplicate/type-change/property replacement. Validation rejects fractional/negative/reversed/out-of-range regions, duplicate IDs, unknown types/tracks, broken references, version cycles and detectable overlapping required conflicts.
- Added development-only `?mode=creative-direction` inside Motion Lab. Real Edge on strict port 2010 shows all eight tracks, selected semantic region, exact ticks, typed inspector and 9-placement fixture proposal. Five UI tests exercise real region add/move/resize/duplicate/type/delete flows.
- B0 release-candidate matrix: **346/346 combined Creative + Motion tests**, **8/8 workspace builds**. Existing C2/C3/A19 suites remain green. Evidence: `DOCS/creative-engine/evidence/CREATIVE-B0.md`; failures: `DOCS/creative-engine/FAILURE_REGISTRY.md`.
- No `apps/web` or production editor source was changed. The lane is preserved by the dedicated `creative-direction-b0` checkpoint; C4 begins from that boundary.

## 2026-08-10 — Parallel Motion Program MOTION-A19 hierarchy-heavy explainer pack complete

- Re-read the 69-component coverage matrix before implementation. Rejected Org / Hierarchy Map, Feedback Loop and Roadmap Milestones as overlaps with existing Hierarchy Diagram, Flywheel Diagram and milestone/sequence/step patterns.
- Added eight genuinely distinct hierarchy-heavy first-party scenarios: Decision Tree, Swimlane Process, Journey Map, Priority Matrix, Value Chain, Layer Stack Explainer, Ecosystem Regions Map and Dependency Map. Public catalog: **69 → 77 components**.
- Reused the mature Family Creator/Designer/Advanced editing shell without reusing the flat graph structure. A19 switches at one common factory boundary into variant-specific nested Motion Graph scenes with stable data-derived IDs, semantic parts, real child Surface/Label/Detail nodes and relationship connector paths.
- Added typed structured-data validation: stable IDs, duplicate detection, active-ID validation, bounded per-variant density, Swimlane step IDs, Priority quadrants, decision/dependency references and explicit cycle refusal. Scene duration is bounded to **1.5–12 seconds** and canonical Sanverse ticks remain mandatory.
- Authored A19 entrances use C2 exact-tick keyframes for opacity, Y position, scale and connector trim/reveal. Direct/backward/random seek equality passes. Reduced motion swaps those entrance tracks for stable final constants while preserving semantic content.
- C3 integration is real rather than cosmetic: all 77 public components project at all four ratios; A19 tests exercise rename/eye/group/lock through the C1/C3 operation boundary; dense Swimlane reaches **127 graph nodes**. Real Edge Compositor selects nested `a19.decision-tree.node:automate.surface` and the Preview outline lands on that exact child.
- Browser review rejected two technically valid but visually weak passes before acceptance: the first renderer flattened relationships into cards (`MOTION-FAIL-012`), and the first portrait scale was too small (`MOTION-FAIL-013`). The accepted renderer has distinct relationship visuals and purpose-built 9:16 typography. All eight final 16:9 baselines and all eight final 9:16 baselines were manually inspected across all eight style packs; busy-background and reduced-motion cases are included.
- Measured A19 separately: 256 module/style/ratio graph create+evaluate combinations averaged **1.506 ms**; SSR markup averaged **4.813 ms**. Dense 127-node Swimlane create+evaluate+C3 projection averaged **10.308 ms**. These are local engineering timings, not FPS claims.
- Final A19 release-candidate gate: **315/315 Motion tests**, **7/7 Motion workspace builds**, clean `apps/web`, runtime-authority, prohibited-dependency, Plan-B and C4 scans. Evidence: `DOCS/motion/evidence/MOTION-A19.md`. The dedicated immutable release checkpoint is tagged `motion-library-v1.3`.

## 2026-08-09 — Parallel Motion Program MOTION-C3 Professional Layer Hierarchy complete

- Added a backward-compatible constant node `enabled` render switch so Layer eye toggles no longer destroy animated `visible`/opacity/keyframe state. Resolved nodes publish local/effective enabled state and sibling stacking index; parent disable does not mutate child-local switches.
- Added serializable `MotionAuthoringMetadataV1` for locks only. Effective ancestor lock is enforced at the C1 operation boundary; locked descendants cannot be deleted indirectly through an unlocked parent. Locking remains pixel-neutral, while the visibility eye stays independently usable.
- Added pure `projectMotionLayers(...)` and one canonical selection state. Layers derive stable IDs, human display labels, parent/child order, semantic membership, enable/lock state, C2 keyframe/authored-motion indicators and effect/mask counts from the same Motion Graph. Group/Text/Shape/Path/Image are covered; all **69 components × 4 ratios** project successfully.
- Added Motion Lab `Compositor` mode with search/expand Layers, single/Ctrl/Shift selection, Layer↔Preview selection synchronization, composition-space bounds overlays, conservative node Inspector, `◆/~ / fx / M` indicators, context actions, explicit Before/Inside/After drag intent and high-value shortcuts. No production Studio integration was added.
- All mutations continue through C1 operations: enable, rename, reorder, local-transform reparent, duplicate, atomic delete, group/ungroup, effects and masks. Reparent deliberately does not fake animated world-transform preservation or rewrite component-authored layout templates; the exact C3 boundary is documented in `DOCS/motion/LAYER_ARCHITECTURE.md`.
- Added a bounded 50-transaction **Motion Lab-only** snapshot journal to prove one user action = one Undo/Redo transaction without importing production Studio history. Real Edge proved Group → Undo → Redo.
- Real Edge also proved Layer→Preview and Preview→Layer selection, selection survival through seek/ratio/style changes, multi-selection, ancestor lock, hidden-parent/child-local-state behavior, stable-ID rename, explicit DROP INSIDE reparent and live effect/mask/keyframe badges. Cost Card composition-region PNG bytes are exactly identical before/after grouping with selection overlays cleared.
- Measured C3 hierarchy separately: pure projection averaged 0.1733/0.5669/0.7407/7.9139/11.1493 ms at 10/50/100/500/1000 nodes; real headless Edge Layer→Preview DOM selection commit averaged **23.804 ms**, p95 38.9 ms. Synthetic 1000-row React construction is slower, but current real trees are tens of nodes, so C3 intentionally avoids premature virtualization.
- Final C3 release-candidate gate: **304/304 Motion tests**, **7/7 Motion builds**, clean runtime/dependency/production/Plan-B/C4 scans. Evidence: `DOCS/motion/evidence/MOTION-C3.md`. C3 must be checkpointed/tagged separately before A19 begins.

## 2026-08-09 — Parallel Motion Program MOTION-A18 keyframe-native creator pack complete

- Re-read the full 60-component coverage matrix before implementation and rejected candidate ideas already solved by Question Title, Before / After, Myth vs Fact, Chapter Title, Single Metric, Comment Highlight, Cursor Callout, Milestone Status, Step List / Progress Status or existing comparison modules.
- Added nine genuinely distinct first-party scenarios: Keyword Slam, Three-Beat Headline, Stacked Hook, Sentence Deconstruction, Punch Word Reveal, Poll / Vote Result, Ranking Podium, App Feature Spotlight and Keyboard Shortcut Callout. Public catalog: **60 → 69 components**.
- Reused the mature family content/style/exposure contract while giving all nine distinct visual branches and default authored motion driven by C2 exact-tick keyframe tracks. Existing 60 component implementations remain on their established authored-motion paths.
- All nine are bounded to **0.75–8 seconds** with 1.8–2.4-second defaults; mechanical coverage explicitly includes 0.75/1/1.5/2/3/5-second durations, four reference ratios, eight shared styles, reduced motion, text stress/refusal, exact-seek determinism and Level-4 compositor readiness.
- Real Edge retained and manually inspected one baseline for each new component while intentionally distributing the batch across all eight style packs, all four ratios, busy backgrounds and reduced motion. The first Stacked Hook 9:16 review exposed undersized portrait typography; it was increased, retested, recaptured and accepted before closeout (`MOTION-FAIL-009`).
- Fresh local measured review: complete 69-component catalog graph create+evaluate averaged **0.4057 ms** and SSR markup **1.5638 ms**; the nine A18 modules across 8 styles × 4 ratios averaged **0.3281 ms** graph create+evaluate. Measurements are local engineering evidence, not frame-time guarantees. The first standalone benchmark runner failure was discarded and recorded as `MOTION-FAIL-008`.
- Final A18 Motion gate: **271/271 tests**, **7/7 Motion workspace builds**, nine manually inspected browser baselines, no `apps/web` integration and no Plan-B AI decision logic. Evidence: `DOCS/motion/evidence/MOTION-A18.md`. **MOTION-C3 remains not started.**

## 2026-08-08 — Parallel Motion Program MOTION-C2 deterministic keyframes complete

- Preserved the existing one-property/one-`Animatable` authority: constants may convert directly to keyframes; existing keyframe tracks remain editable; motion drivers and bindings refuse implicit replacement and require a later explicit bake/reset.
- Formalized stable-ID `MotionKeyframeV1` tracks with exact integer ticks, Hold/Linear/Bezier interpolation, bounded professional cubic-Bezier handles, typed node/effect/mask target capabilities, property/effect/mask range validation, and binary exact-tick segment lookup.
- Expanded universal graph operations from 21 to 28 with add/remove/move/value/interpolation/Bezier/clear keyframe operations, typed failures, atomic batch participation and inverse readiness.
- Upgraded Timeline projection to expose full typed keyframes for node, effect and mask tracks grouped by their real layer node, preparing later Layers/Dope Sheet work without introducing a second animation store.
- Added a developer-only Advanced Motion Lab keyframe timeline with property selection, `◇/◆` current-tick state, add/remove/move/value/interpolation/Bezier controls and the existing exact-tick transport. No auto-key or production Studio integration was added.
- Built the Cost / Value Card C2 proof entirely through graph operations: Surface opacity, Value X/Y scale, Arrow rotation, Glow intensity and whole-card Y position. Existing 60 component implementation files were not changed by C2.
- Real Edge edited a live `transform.scaleX` track, preserved stable keyframe identity through a move to tick 3,500,000, and proved identical DOM-resolved state after `3,500,000 → 120,000 → 6,800,000 → 3,500,000` direct/backward/random seeking.
- Performance evidence is separated by subsystem: required direct evaluator stress remains sub-millisecond per 100-property batch even at 1,000 keyframes/property in this local run; full-scene validation, graph-operation and Advanced Lab DOM-commit costs are recorded independently in `DOCS/motion/evidence/MOTION-C2.md`.
- Final C2 release-candidate gate: **253/253 Motion tests**, **7/7 Motion workspace builds**, clean authority/dependency scans, zero `apps/web` changes/imports, and zero Plan-B AI decision logic. C3 remains not started; A18 begins only after the separate C2 Git checkpoint.

## 2026-08-03 — P1-F.1A Gate B: Media Library V2 Essentials complete

- Media organization is a **server-owned sidecar**, `media-organization.json` beside the project, never in `EditProject` and never in the browser. Rejected localStorage (per-browser, silently cleared, invisible to the server) and rejected `EditProject` (Undo would step through folder renames, and moving the revision would move the export key so a rename would re-encode an identical MP4 for 60–90 s). Decision: `DOCS/decisions/ADR-MEDIA-ORGANIZATION-V1.md`.
- A folder is a label, not a container: deleting one returns its media to the top level and can never delete media. One level only, max 32 folders, names unique after trimming and case-folding.
- Five typed validated commands (create / rename / move-to-folder / move-to-root / delete) are the only way to change it, so a future AI calls exactly what the buttons call. Unknown shapes are refused, never repaired; a corrupt file is refused with its bytes left on disk so folders can be recovered.
- Refactored the hardened project-file reader into `readControlledProjectFile` / `writeControlledProjectFile` so project state and organization share ONE symlink, hard-link and file-identity check.
- Media panel rebuilt as MediaHeader / MediaSearchAndFilter / MediaResults with **only the results region scrolling**, compact density (28–32 px controls, 48–60 px rows, 40–48 px thumbnails, 12 px filenames), Import by kind with truthful accept filters behind one hidden input, operating-system file drop with per-file refusals, four sort fields in both directions with stable ties, and a filter that never renders five squeezed buttons.
- Presentation state (search, filter, sort, folder, selection) moved OUT of the panel to the Studio screen, because the panel is unmounted on every workspace switch and state held inside it vanishes silently.
- `sanverse.media-drag/v1` closed payload built and tested but **deliberately switched off** (`MEDIA_DRAG_ENABLED = false`): assetId, mediaKind, sourceDurationTicks only — no path, no URL, no object URL, no project or asset object. Gate C flips one boolean.
- Real browser on real video, image and audio: the project came out **byte-identical** (revision 4→4, changeSets 0→0, assets 5→5, same sha256) after create → duplicate refusal → rename → move in → move out → delete, and the filing survived a full page reload. Zero console errors, zero failed HTTP calls, zero object URLs in the panel.
- Suites: web 631, edit-domain 312, api 248, render-contract 65, intent-domain 27 — 1,283 total (Gate A baseline 1,203, floor 1,176). All-workspace build passes. No assertion weakened.
- Found and recorded but NOT fixed, because this gate fixes only Gate B blockers: FAIL-047 (resizing past 1100 px strands the user with no Media or Inspector until reload) and FAIL-048 (imported file names are forgotten on reload).
- Gate C, Gate D and P1-F.2 were not started.
- No screenshots exist for Gate B: the browser pane was not displayed, so layout is proved by measured DOM geometry and appearance is not proved.

## 2026-08-01 — P1-F.0.1 Studio Workspaces and Docking V1 complete

- Added accessible Studio-only Edit, Effects, Color, and Audio workspace views over the existing single editor, project, history, playhead, Timeline, selection, Canvas/Inspector draft, video, AI conversation, proposal, preview, and export authorities.
- Added a closed `sanverse.workspace-layout/v1` local presentation contract with strict validation, viewport clamps, fail-closed recovery, Edit/Motion/Timeline/Review/AI/Audio presets, reset, collapsible docks, and bounded pointer/keyboard splitters with Escape cancellation.
- Kept Tool and AI permanently mounted so hidden AI drafts and proposal state survive Assist/Studio, workspace, and dock switching; proposed Timeline items now reveal their authoritative Tool/Inspector actions.
- Reused only existing capabilities: Edit uses Media/Inspector, Effects uses current motion/visual effects, Color states unsupported primary-video grading truthfully, and Audio uses existing V1/A1/A2 controls without pretending waveforms, EQ, compression, mixing, or cleanup exist.
- Real Edge completed all workspaces, Tool/AI continuity, every preset, all splitters, dock collapse/reset, Point precedence, 1440×900 / 1024×768 / 390×844 responsive checks, export, and Home cleanup. One video and the AI draft survived; revision stayed 15→15; horizontal overflow and page/console/HTTP errors were zero.
- Export probe: H.264 High 1920×1080 at 30 fps, AAC-LC stereo 48 kHz, 18.033333 seconds, 10,789,990 bytes, SHA-256 `176c85e64e8c44dc99cb8f65e4ccb5a5a221ac96da045d5f178ec8971eb59451`.
- Final suites pass API 239/239, web 515/515, edit-domain 299/299, render-contract 65/65, intent-domain 27/27 — 1,145/1,145 total; all-workspace build passes.
- P1-F.1 and P1-F.2 were not started.

## 2026-08-01 — P1-F.0 Primary-Footage Motion V1 complete

- Added one stable, source-anchored `set-footage-motion` identity with full-state position, uniform scale, rotation, crop, and bounded keyframe/easing repairs.
- Preserved deterministic motion across split, trim, remove, gap, reorder, repeated placements, Undo, Redo, and selective deactivation without attaching state to temporary clip IDs.
- Raised the render plan to v6, compiled motion onto surviving source segments, and made browser Canvas plus FFmpeg expressions consume one shared source-time evaluator.
- Added Motion Inspector presets/numeric controls/keyframes/Apply/Reset/Remove, a V1 Timeline Motion indicator, and direct primary-footage Canvas move/scale/rotate/crop with detached movement, one release commit, Escape cancellation, and Point precedence.
- Kept exactly one native video and native controls; removed the false legacy overlay-Canvas unsupported message for video selection.
- Real Edge found and resolved `FAIL-034` invalid empty-filter syntax, `FAIL-035` unnecessary GEQ/rotation export cost, and `UX-014` misleading Canvas copy.
- Final Edge loop completed static motion, Canvas repair, Undo/Redo, Point, animated zoom, split/Undo/Redo, real export, tablet/mobile, and cleanup with zero page/console/HTTP errors.
- Probed export: 1920×1080 H.264 High, 30 fps, 901 frames, AAC-LC stereo 48 kHz, 30.033008 seconds, 17,261,471 bytes; render completed in 53.3 seconds and start/middle/end frames were inspected.
- Final suites pass API 239/239, web 484/484, edit-domain 299/299, render-contract 65/65, intent-domain 27/27; all-workspace build passes.
- P1-F.1 and P1-F.2 were not started.

## 2026-08-01 — P1-E.1 Studio Vertical Flow complete

- Replaced the desktop Studio's fixed `calc(100vh - 64px)` height and hidden overflow with natural document flow and two normal-height grid rows.
- Made the browser document the single outer vertical-scroll authority; Media, Inspector, and AI retain bounded internal scrolling without blocking scroll chaining.
- Kept the P1-D contained preview size, native controls, Timeline horizontal scroll/zoom, one shared selection/draft, one main video, and the existing single video `ResizeObserver`.
- Added one passive document-scroll refresh to the existing Studio geometry controller and removed it on unmount; page scrolling creates no operation, revision, project rebuild, or second geometry authority.
- Real Edge proved full Timeline reachability and no horizontal overflow at 1440×900, 1280×800, 1024×768, and 390×844. Playhead, selection, zoom, horizontal scroll, accepted revision, Canvas alignment, Point placement, and playback remained correct.
- Browser result: zero page errors, zero console errors, zero failed HTTP responses, one video, five lanes, and zero listener/video leak after returning Home.
- Final suites pass: web 476/476, edit-domain 265/265, API 235/235, render-contract 51/51, intent-domain 27/27; all-workspace build passes.
- `UX-013` is resolved. P1-F was not started in this change.

## 2026-07-31 — P1-E Media Bin V1 complete

- Added one immutable Media Bin view model over the accepted project with import, search, All/Video/Images/Audio/Missing filters, usage, source status, keyboard navigation, right-click/Shift+F10 actions, and responsive layouts.
- Centralized asset display names in one pure helper shared by Media, Timeline, Canvas, and Inspector, resolving `UX-011` without component-specific patches.
- Kept project/revision in App/server, accepted history in project change sets, editor selection in Studio, media selection presentation-only, and source probing App-owned with four-request concurrency.
- Reused existing `add-media-overlay`, `add-music`, and `set-music` operations; import remains outside Undo history and placement Undo/Redo retains imported assets.
- Real Edge used a talking-head MP4, image, secondary MP4, and WAV; completed Canvas image manipulation, B-roll, music repair, Undo/Redo, filters, keyboard/context menus, missing-source failure/restoration, export/download, frame/audio inspection, and cleanup with zero unexpected browser/HTTP errors.
- Final suites pass: web 473/473, edit-domain 265/265, API 235/235, render-contract 51/51, intent-domain 27/27; all-workspace build passes.
- Unused asset deletion remains deferred as `FEATURE-003`; `FAIL-021` and `INFRA-005` remain monitoring.
- P1-F was not started.

## 2026-07-31 — P1-D Canvas Direct Manipulation V1 complete

- Added one Canvas interaction layer driven by the existing Timeline selection and the Inspector's shared detached visual draft.
- Delivered move, Shift constraint, keyboard nudge, uniform/centre resize, rotation, crop, frame/safe snapping, proposal repair, Point precedence, and truthful unsupported states.
- Repaired `UX-010` collapsed preview, `FAIL-030` stale post-upload revision, and `FAIL-031` FFmpeg crop/export parity.
- Real Edge completed title/callout/image manipulation, Undo/Redo, proposal reject/accept, Point mode, export/download, responsive checks, and frame inspection with zero browser/HTTP errors and one video.
- Final suites pass: web 442/442, edit-domain 265/265, API 235/235, render-contract 51/51, intent-domain 27/27; all-workspace build passes.
- Recorded `UX-011` as open and assigned it to P1-E; no P1-E implementation was started.
- P1-E was not started.

## 2026-07-30 — P1-B.1 repository-wide test truth restored

- Resolved `FAIL-024` by registering three genuine contract suites with Vitest
  while preserving every existing assertion.
- Resolved `FAIL-025` by testing the current durable export lifecycle: 202 queued
  acceptance, bounded job polling, terminal success/result or safe failure/error,
  and successful ranged media access.
- Resolved `FAIL-026` by atomically changing the signed number input, verifying
  the displayed `-24`, and proving the repair callback receives `gainDb: -24`.
- Changed only tests and authority/evidence documents; no product source,
  dependency, schema, route, renderer, timeline, proposal, or history behavior.
- Full suites pass: web 332/332, edit-domain 265/265, API 233/233,
  render-contract 51/51, intent-domain 27/27, Timeline/Studio 79/79; the complete
  build produces the identical P1-B bundle.
- `FAIL-021` remains monitoring, `FEATURE-001` remains planned, and P1-C was not
  started.

## 2026-07-30 — P1-B Production Timeline V1 complete

- Replaced the old one-row proportional strip with a five-lane Studio timeline
  driven only by P1-A's immutable `TimelineViewModel`.
- Added one shared playhead, ruler, click/drag seek, zoom, Fit, horizontal scroll,
  visible-range overscan, stable selection, gaps, hidden/blocked states, and
  detached proposal ghosts.
- Connected split, trim, ripple/non-ripple removal, reorder, enable/disable, and
  audio gestures through the existing P1-A adapter and server-authoritative
  change-set path.
- Added deterministic boundary snapping with a visible guide, exact trim preview,
  a right-click/Shift+F10 menu, Delete focus safety, and keyboard playhead steps.
- Real Edge visual QA found and fixed desktop lane clipping, proposal-sheet
  interception, clipped trim feedback, hidden export readiness, compact-label
  problems, action/context-menu overflow, and favicon console noise.
- Fresh real-media walkthrough completed split, Undo, Redo, context menu, snap,
  trim, Undo, proposal ghost/reject, export, and MP4 download with zero page,
  console, or HTTP errors and clean 1440/1024/390 geometry.
- Focused timeline/Studio tests pass 79/79; affected domain tests pass 77/77;
  the all-workspace production build passes. Broad unrelated test-contract drift
  is recorded in the evidence and failure registry rather than hidden.
- P1-C was not started.

## 2026-07-30 — P1-A timeline presentation foundation complete

- Owner approved P0-E from commit `d48aabf34fdadbd6899807fa0c6de0c854a5dc5f`; resolved `UX-007`.
- Added a pure immutable timeline contract and deterministic projection from one authoritative `EditProject`.
- Added semantic overlay, per-domain-video, caption, dialogue, and music lanes; derived gaps; detached proposed items; and blocked/unsupported diagnostics.
- Reused one domain evaluation, folded caption/overlay helpers, and authoritative source-span placement; no second editor or replay engine was created.
- Added bounded pure viewport zoom/scroll math and a gesture adapter that returns existing validated operations without applying them.
- Proved 71/71 focused web tests, 77/77 affected domain tests, a representative 50-video/100-caption/20-overlay/1-music fixture, unchanged P0-E bundle sizes, and a passing all-workspace build.
- No production React/CSS/UI, schema, persistence, renderer, or P1-B work was started.

## 2026-07-29 — G6/G8 executable technical batch complete

- Completed G6-11 deterministic seek-boundary, easing, reduced-motion, and
  shared preview/export evaluator contracts.
- Completed G8-03 durable export jobs with revision snapshots, idempotency,
  progress, cancellation, results/errors, restart recovery, and diagnostics.
- Completed G8-04 content-addressed portable archives with closed-schema,
  compatibility, integrity, and matching-media restore gates.
- Completed G8-07 protected retention: only controlled exports are deletable.
- Completed G8-08 code/keyboard accessibility audit with skip links, live/focus
  semantics, reduced motion, and 44-pixel repair targets.
- Completed G8-09 corrupt/malicious media and recovery matrix; new direct
  contracts passed 5/5.
- Completed G8-10: four fixed encoder threads reduced the representative
  10-second encode from 33.090s to 13.917s, a 2.38x speedup.
- API build and web application TypeScript check passed. The managed environment
  still blocks Vitest/Vite worker creation with the recorded FAIL-011.
- Only owner/external-evidence G8 gates remain; G9 entry is not bypassed.

## 2026-07-29 — Second batch in progress: transitions, adapters, compatibility, local trust

- Completed G6-07 with a bounded adjacent-clip dip-to-black, explicit audio
  policy, exact preview opacity, render-plan v5 ramps, and FFmpeg filters.
- Completed G6-10 by isolating every written overlay on a transparent layer
  before applying shared transforms/effects; a real 90-frame callout fixture
  rendered successfully.
- Completed G7-10 with a v1 saved-project migration/reopen fixture that retains
  the exact component/style, words, point, and anchor.
- Confirmed G8-02 atomic autosave/recovery at the existing repository/service
  boundary and recorded its exact limits.
- Completed G8-06 safe local diagnostics at `GET /api/diagnostics`.
- Completed G8-05 as a measured no-proxy/no-cache decision; first-time CPU
  encoding, not repeated identical reads, is the observed bottleneck.
- Historical note: G6-11, G8-03, and G8-04 were open at this point; the later
  batch above completed them.

## 2026-07-29 — Ten-task batch: renderer evidence and compound components

- Completed G6-08 bounded basic effects and G6-09 measured renderer
  re-evaluation. The existing browser CSS/native FFmpeg hybrid remains selected.
- Added browser visual-property consumption for every overlay family and native
  FFmpeg visual-property consumption for media overlays.
- Produced a real 1280x720, 30 fps, 240-frame native export and focused
  exact-clock, reduced-motion, and normalized-translation evidence.
- Did not falsely close G6-07: visual enter/exit transitions are not the
  required adjacent/overlapping clip video/audio transition primitive.
- Did not falsely close G6-10/G6-11: written-overlay FFmpeg layering and full
  extracted-frame fidelity remain.
- Completed G7-02 through G7-09: exact component compatibility, five immutable
  recipes, idempotent/fail-closed migration, four workflow registry entries,
  atomic multi-action planning, dependency checks, detached compound preview,
  targeted action repair, and one-approval/one-Undo proof.
- Relevant edit-domain, web, and API TypeScript boundaries pass. Focused direct
  contracts and the real FFmpeg fixture pass.

## 2026-07-29 — Ten-task batch: G5B completion and G6 motion foundation

- Completed Studio controls for G5B-04 trim, G5B-05 remove-with-gap, G5B-07
  reorder, and G5B-09 clip loudness/fades behind one disclosure.
- Completed G5B-13 using real 30000/1001 audio, VFR audio, and three-frame
  silent fixtures; conformed outputs retained the expected duration, rate,
  frame count, and audio policy.
- Accepted ADR-008 and created the owner-pending G6 motion-quality rubric.
- Completed G6-02 through G6-06 at the domain/compiler boundary: transforms,
  crop/layer/masks, project-clock keyframes, cubic-Bezier easing, spring, and
  bounce.
- Raised the renderer-neutral plan to v4 and bound visual state to exact
  concrete overlay nodes after cuts.
- Focused direct RED/GREEN contracts passed. Edit-domain, render-contract, web,
  and API TypeScript boundaries pass.
- Browser/FFmpeg motion is not claimed; it remains G6-09/G6-10.

## 2026-07-29 — G5C-07 direct repair completed in code

- Added full-state `set-title`, `set-callout`, `set-media-overlay`, and
  `set-music` operations with closed validation.
- Added deterministic folding so repairs update one existing overlay family
  without creating duplicate render nodes.
- Preserved one repair as one history entry and one Undo.
- Changed the canonical render compiler to consume folded overlay state.
- Added one progressively disclosed adjustment panel for all four families.
- Focused direct domain/render contract passed; edit-domain, render-contract,
  and web TypeScript checks passed.
- Vitest and Vite packaging remain blocked inside the managed environment by
  existing FAIL-011 (`spawn EPERM`); not debugged again.
- Real browser click-through was not run and is not claimed.

## 2026-07-27 — G4-B tasks 01–09: the first AI-proposed edit, on a fake provider

- Added `@sanverse/intent-domain`: a closed request shape, an untrusted candidate
  shape with exactly four states, six bounded clarification fields, and the
  evaluation contract. 27 tests.
- Added the API intent boundary: the provider port (which returns `unknown` on
  purpose), a deterministic fake provider that misbehaves deliberately, the
  outbound data allowlist, and the fixed 13-step intent service.
- Added `POST /api/projects/:id/intents`. It never changes the project. It
  returns a pending proposal that must be accepted through the ordinary
  change-set route, so "AI proposes, code executes" is structural.
- Replaced the disabled chat placeholder with a working conversation panel, and
  added by-hand repair of a pending proposal that never re-asks the provider.
- Accepted AI edits are recorded with `source: "ai"` and their request ID, and
  labelled "Suggested by the assistant" on screen — including after repair.
- Added an 18-case prompt corpus asserting product behaviour, run on every test
  run. 0 of 8 adversarial cases produced a change set.
- Fixed an owner-reported problem: pressing Export looked like it did nothing,
  because the result was below the fold. It now scrolls into view and takes
  focus.
- Verified in a real browser on the owner's own video: clarification, proposal,
  repair, accept, on-disk provenance, and a real exported MP4 with the nameplate
  present at 2 s and gone at 6 s.
- 413 tests pass; all workspace builds clean.
- Decisions: `DOCS/adr/ADR-004-ai-proposes-code-executes.md`.
- Evidence: `DOCS/evidence/2026-07-27-g4b-first-ai-edit.md`.
- **Not done:** G4B-10, connecting a real provider. No data has ever left the
  machine.

## 2026-07-27 — G4-A built and verified: scale-ready chassis and one render contract

- Implemented `sanverse.project/v2` end to end, plus `@sanverse/render-contract`
  consumed by both the browser preview and the FFmpeg exporter.
- Migrated the owner's real 2026-07-25 v1 projects losslessly; migrated
  nameplates keep `top-left` so nothing moved in an already-approved video.
- Two defects were found by running the real browser, not by tests:
  `requestVideoFrameCallback` fired zero times so the preview silently showed
  nothing, and preview and export were offset by exactly the padding.
- Known open gap: the drawn plate is ~10 px shorter vertically in the export.
  Position is identical.
- Decisions: ADR-002, ADR-003. Evidence:
  `DOCS/evidence/2026-07-27-g4a-real-media.md`.

## 2026-07-27 — Complete macro and micro planning set drafted

- Added the proposed canonical macro roadmap, dependency graph, goal entry/exit gates, and first- through fourth-order consequence analysis.
- Added one tickable checklist spanning completed foundations, G4-A through G12, continuous quality tracks, and macro completion.
- Added the atomic G4-A implementation plan and detailed later-goal micro plans.
- Added cross-cutting creative-quality, real-user, real-media, fidelity, security, accessibility, migration, performance, observability, recovery, and evidence plans.
- Reconciled goal, current-state, plan-index, and start documents so planning is not misreported as implementation or approval.
- Preserved older plans as historical evidence.
- Product implementation changed: **none**.
- Approval state: **proposed; owner review required before implementation**.

## 2026-07-12 — G0 initiated

- Owner approved starting Stage 2 as a separate production-grade project.
- Clarified that “production SaaS infrastructure now” means sound code architecture and evolution boundaries, not implementing all operational SaaS features immediately.
- Confirmed the owner is the first real tester and the product must reduce editing from hours to minutes.
- Confirmed black-and-white minimal branding inspired by the cleanliness of OpenDesign.
- Audited the prior anti-drift template and selected only lightweight, deterministic safeguards for the initial baseline.
- Wrote the macro goal, requirements, decisions, goal map, interface principles, risks, and G1 plan.
- Product implementation remains intentionally unstarted until the G0 verification and owner gate close.

## 2026-07-12 — G0 closed and G1 authorized

- Owner created `budhasantosh010/stage-2-sanverse-video-editing-` and authorized direct Git/PowerShell access.
- Verified SSH access and inspected the GitHub initial commit before changing remote history.
- Preserved GitHub's placeholder initial commit using a non-destructive merge and pushed the verified G0 baseline.
- Remote baseline after merge: `751911f` on `main`.
- Owner explicitly instructed work to continue, satisfying the G1 entry gate.
- Active work is now limited to the interface workflow/wireframe and renderer feasibility spike defined in the approved G1 plan.

## 2026-07-12 — G1 first-edit design drafted

- Defined the first nameplate-edit job story around completing one edit in under a minute without editor terminology.
- Mapped empty, importing, ready, selecting, clarification, proposal, preview, accepted, undo/export, and recoverable-failure states.
- Produced and visually verified a black-and-white Studio wireframe.
- Preserved canvas-first interaction, plain-language proposal details, preview-before-acceptance, and a simple moment strip.
- G1-01 remains in progress until the owner reviews the workflow; no product behavior has been implemented.

## 2026-07-12 — Owner corrected the entry experience

- Owner clarified that the existing Studio wireframe is Screen 2, not the first-arrival experience.
- Screen 1 must use OpenDesign-like progressive disclosure: a calm Home centered on chat/upload, drag-and-drop entry, and recent projects.
- Editing tools, canvas, proposal/history panel, and time strip appear only after the user supplies or opens a video project.
- Updated the durable requirement, interface decision, active G1 plan, flow, and state model before continuing visual work.
- Created and visually checked a separate Home wireframe; preserved the original editing workspace as Screen 2.

## 2026-07-12 — Renderer Track B began with FFmpeg-native candidate

- Owner approved the Home and Studio designs and instructed work to continue.
- Verified local Python, pytest, Node, Chrome, FFmpeg, ffprobe, drawtext, and overlay capabilities.
- Primary-source research identified HyperFrames as OpenDesign's current HTML/Chromium video path; it remains a candidate, not a decision.
- Implemented a renderer-neutral static-nameplate spike contract with fail-closed bounds and timing.
- Completed eight RED/GREEN cycles including a real FFmpeg render, ffprobe validation, CLI report, and repeat-mode hash comparison.
- After independent-review fixes, three fresh FFmpeg-native runs produced the same output SHA-256; average edit render was 0.7155 seconds for the five-second synthetic fixture.
- Product capability remains E0; this is isolated renderer evidence only.
## 2026-07-12 — HyperFrames candidate prepared without package execution

- Pinned and statically inspected hyperframes@0.7.54; no package code was executed.
- Verified explicit telemetry, update-check, auto-install, and browser-path controls in the distributed CLI.
- Added a local-only composition adapter through RED/GREEN TDD; 9 focused tests and all 34 renderer tests pass.
- Generated the static-nameplate HTML and visually sanity-checked it using the existing system Chrome.
- This proves only project-owned HTML generation and layout. HyperFrames runtime behavior and MP4 rendering remain unverified pending explicit owner approval for third-party npm execution.

## 2026-07-12 — Owner prioritized runnable web validation

- Owner clarified that Stage 2 will be a web application.
- Owner reserved localhost port 2000 because ports 3000, 5000, and 8000 are already used on the laptop.
- Startup must fail visibly if port 2000 is occupied rather than silently choosing another port.
- Owner asked to test how the application looks, works, and feels before HyperFrames work continues.
- AOCS Omega Type 2/depth 1 analysis identified the missing runnable user loop as the current highest-impact bottleneck.
- Renderer evidence remains preserved; HyperFrames runtime and hybrid evaluation are paused, not discarded.

## 2026-07-12 — Runnable Home-to-Studio shell reached the owner review gate

- Implemented the browser-only React/TypeScript/Vite shell on strict local port 2000 with typed screen state and local MP4 object-URL handling.
- Added a calm Home, real browser video preview in Studio, a visible draft-not-executed state, disabled unavailable actions, recoverable media errors, Back cleanup, and a responsive grayscale visual system.
- Verified 46 of 46 automated tests, the production build, HTTP 200 at `127.0.0.1:2000`, and an accessible live Home at 1280 by 720 with a uniquely labeled controlled prompt.
- Verified a second server exits with status 1 and displays `Error: Port 2000 is already in use`.
- The browser-control surface could not attach a local file to the native file input. No full manual browser Studio walkthrough was performed by the agent.
- Fixed the governance verifier to scan Git-tracked and untracked non-ignored project files instead of recursively entering ignored dependencies and build output; a regression test proves both sides of that boundary.
- G1-01B remains in progress. The owner must still choose a real MP4, check playback and workflow, and record feedback before the E4 owner gate can close.
- No backend, upload, persistence, AI, real editing, render, or export exists.

## 2026-07-13 — First owner real-video review rejected the initial polish

- The owner successfully opened Home, selected a real MP4, reached Studio, and previewed the video.
- Owner-measured defects: the Home question was too large; button, upload, and screen changes felt like abrupt cuts; and Studio could not be used to point at the video or request an actual edit.
- AOCS Omega classified the next product bottleneck as closing one trustworthy edit loop, not attaching an AI provider to a disabled shell.
- Frontend comparison found only conceptual similarity to OpenDesign. The previous shell lacked its proportionate hierarchy, soft product surfaces, and continuous interaction feel.
- Added a shared restrained motion system, browser-native Home/Studio transitions with fail-safe and reduced-motion fallbacks, softer surfaces, and a smaller Home heading through RED/GREEN tests.
- Independent review found an asynchronous view-transition race that could reopen a revoked first video after a rapid second selection. Deferred-callback regression tests now prove stale transitions cannot commit, and transition-start failures fall back to a direct update.
- AI keys remain intentionally unnecessary until a deterministic edit proposal can be validated, previewed, accepted, and undone.

## 2026-07-13 - G1 renderer decision completed for the first loop

- Added the static-nameplate hybrid adapter through RED/GREEN TDD: one validated request now produces an offline browser preview document and a safe FFmpeg export argument list.
- Verified 11 focused hybrid tests and all 45 renderer tests, including the existing real FFmpeg and ffprobe integration coverage.
- Three measured preview documents and three measured exports had identical hashes on this Windows machine; the five-second output preserved 1280 x 720 at 30 fps and the source hash did not change.
- ADR-001 selects browser-native preview plus FFmpeg-native export for the first closed static-nameplate loop, behind renderer-neutral contracts.
- HyperFrames runtime remains uninstalled and unverified. Preview-to-export pixel fidelity, real owner footage, audio preservation, advanced motion, and cross-machine determinism remain open evidence gates.
- A spec review found that shared input alone did not prove translation fidelity and that deployment cost lacked local measurements. Follow-up RED/GREEN tests now parse both generated translations: text and timing match exactly, and the maximum normalized placement delta is 0.0005556 from pixel rounding.
- Local measurement now records project adapter bytes, preview-document bytes, and already-installed Chrome, FFmpeg, and Node executable facts without installing or executing HyperFrames.
- This completes the narrow G1-03 first-loop decision only. G1-02 remains in progress because pixel fidelity, representative real-video/audio behavior, approved motion coverage, and HyperFrames runtime evidence remain open. No product renderer, editing primitive, backend, or export workflow exists yet.

## 2026-07-13 — Second owner motion review exposed the unsupported-browser fallback

- The owner reported no meaningful improvement and specifically requested noticeable smooth navigation plus brief bouncy feedback on buttons and the text-entry surface.
- Live browser inspection verified that the current browser does not expose `document.startViewTransition`; the previous fallback updated state immediately, which explains the abrupt cut.
- A first CSS fallback attempt failed independent review because it could double-animate native browsers, conflicted in the Back-button cascade, and did not explicitly remove the new transforms for reduced motion.
- The corrected implementation marks native versus fallback support once, gates the CSS screen entry to fallback browsers, gives direct controls a separate brief spring token, and explicitly removes the new motion for reduced-motion users.
- Automated frontend and production-build evidence does not prove owner-perceived feel. The owner re-test remains the acceptance gate.

## 2026-07-13 — Canonical nameplate edit domain added

- Added a renderer- and interface-independent TypeScript workspace for the exact `sanverse.action/v1` point/nameplate contract.
- Used two RED/GREEN cycles: absent production modules first failed three suites, then a runtime-mutation test exposed that TypeScript `readonly` alone did not protect history.
- Validation now fails closed for unknown or missing fields, wrong schema/kind, non-finite or out-of-range coordinates/times, blank IDs/text, and non-positive duration.
- Proposal, acceptance, undo, redo, and project serialization are pure; duplicate IDs fail without mutation, and copied canonical history/actions are frozen at runtime.
- Quality review found that an ID could be reused after its redo entry was cleared and that structurally forged histories could reach project serialization. Follow-up RED/GREEN tests added a never-cleared issued-ID ledger, deep history/project validation, and a frozen project envelope.
- All 34 edit-domain tests, all 56 frontend tests, and both workspace builds pass. This is E2 domain evidence only; no Point UI, preview, renderer integration, persistence, or export was added.

## 2026-07-13 — Explicit rendered-video Point mode added

- Added a visible `Point` action to Studio instead of making ordinary video clicks ambiguous. Entering Point mode pauses playback and temporarily places an accessible capture layer over the video; `Cancel` or Escape exits without capturing.
- Point capture uses the actual contain-fitted video content rectangle, not the outer player box. Clicks in letterboxing or invalid geometry/time fail visibly while Point mode stays available for correction.
- A successful click records finite normalized `x`/`y` coordinates plus a non-negative source timestamp in milliseconds, removes the temporary capture layer, restores normal video controls, and displays a marker with a plain-language `Here · timestamp` summary.
- Independent review found marker drift after responsive resize and a misleading nonfunctional keyboard button. Follow-up RED/GREEN work now reprojects the normalized target through `ResizeObserver`, provides focused arrow-key positioning plus Enter capture, preserves native Enter on Cancel, and keeps Escape cancellation.
- Final evidence passes 11 pure point-target tests and 16 Studio tests (27 focused). The complete workspace passes 75 web tests plus 34 edit-domain tests (109 total); both builds, governance verification, and diff checks pass.
- This remains an isolated E2 interaction slice. It does not create a nameplate proposal, connect canonical history, preview an edit, render, or export. Owner live-browser usability and perceived interaction quality remain pending.

## 2026-07-13 — Bounded manual nameplate proposal added

- Linked to REQ-003, REQ-004, REQ-012, DEC-003, and DEC-005.
- Connected a captured point to canonical `proposeAddNameplate` validation without enabling free-form AI interpretation.
- Added a plain-language composer with required main text, optional smaller text, exact point/time mapping, and a fixed five-second default.
- Canonical validation fails closed; successful proposals are immutable and appear in Studio without entering accepted history.
- Adversarial review exposed two unsafe edges: a new target could leave a stale proposal visible, and action-ID generation could throw through the UI. New RED/GREEN tests now prove that retargeting clears the unaccepted proposal and open draft, while ID failures remain visible and recoverable.
- Ten composer tests and 18 Studio tests pass in the focused run. Preview, acceptance, undo/redo, renderer integration, export, and owner live-browser verification remain pending.

## 2026-07-13 — Typed preview and canonical in-memory history loop closed

- Linked to REQ-003, REQ-004, REQ-007, DEC-003, and DEC-005.
- Moved the pending proposal and canonical history to App-owned state, while keeping point-mode layout and focus details local to Studio.
- Added typed nameplate overlays over the contain-fitted video content. Pending proposals preview without entering accepted history; accepted history and the current proposal are never duplicated into CSS or ad hoc UI truth.
- Connected canonical exactly-once Accept, history-neutral Discard, Undo, and Redo. Redo-only actions never render, retargeting clears only a stale pending proposal, and Back/new project resets the in-memory edit state.
- Independent quality review rejected coarse `timeupdate`-only preview timing and hardcoded five-second approval copy. RED/GREEN corrections now use presented-video-frame callbacks when supported, a mutually exclusive media-event fallback otherwise, and duration copy derived from the typed action.
- Re-review then exposed a competing playback clock, invalid focus token, and status text that could become false after Undo. Further RED/GREEN corrections prove exclusive clock selection and cleanup, use the shared visible focus ring, and announce only the completed proposal resolution.
- Final evidence passes 54 focused Task 5 tests, 113 web tests plus 34 edit-domain tests (147 total), both production builds, both governance checks, `git diff --check`, independent spec review, and independent quality re-review.
- This is E2 automated evidence only. State is not persisted, no project-owned media copy exists, no product renderer or exported MP4 exists, and no owner real-media usability acceptance is claimed.
- The current top-left placement meaning is only a provisional renderer-compatibility assumption. It can clip near the right/bottom edge and must be owner-validated or made explicit in a versioned action schema before Task 7 or schema freeze.

## 2026-07-13 — Immutable local project intake completed

- Linked to REQ-003, REQ-005, REQ-009, REQ-013, and DEC-002.
- Resolved a governance ambiguity before implementation: the owner authorized continuing the approved Tasks 2–8 vertical slice while G1 owner/motion gates remain open; this does not claim G1 closure or G2/G3 completion.
- Added a loopback-only streaming API and HTTP-neutral project repository boundary. Root `npm run dev` now starts the web app on strict port 2000 plus its internal API on `127.0.0.1:2001`.
- Added bounded MP4 structure/brand validation, configured declared/actual size enforcement, SHA-256, generated opaque IDs, fixed internal paths, same-filesystem staging, complete-write handling, atomic publication, cleanup, and immutable-copy evidence.
- Added safe full/ranged media serving and connected Home intake to Studio only after a validated 201 response. Importing, cancellation, same-batch single-flight, and recoverable failure are explicit.
- Independent quality review rejected the first GREEN implementation for a ranged-stream leak, disconnect/post-header failure handling, range compliance, ignored partial writes, Windows child-process risk, untyped binary decode failure, and a same-batch upload race. Focused RED/GREEN corrections closed each issue and the re-review passed.
- Final automated evidence passes 30 API, 118 web, and 34 edit-domain tests (182 total), all three production builds, `git diff --check`, independent spec review, and independent quality/security re-review.
- The final real-runtime check caught a Node strip-only incompatibility in two TypeScript parameter properties that compile-time and in-process tests did not exercise. A narrow source-compatibility regression plus standard class fields closed it; the configured API entry graph then loaded successfully.
- A 142,738-byte MP4 derived from the supplied 189,751,984-byte MOV passed HTTP creation, immutable publication, full retrieval, and a 32-byte `206` range. Persisted/source/downloaded hashes matched. This proves the bounded real-video-derived path, not full-file performance or MOV intake.
- This remains below owner E4. Automated fixtures do not prove real large-file import speed, perceived usability, preview/export fidelity, or a completed edited export.

## 2026-07-14 — Deterministic FFmpeg renderer adapter completed

- Linked to REQ-003, REQ-004, REQ-005, REQ-007, REQ-009, DEC-003, DEC-005, and ADR-001.
- Added a replaceable renderer port and service that revalidates immutable accepted history and sends accepted actions only; redo-only and invalid history never reach the renderer.
- Added the production FFmpeg adapter with no-shell argument arrays, fixed private UTF-8 text/font files, bounded action/text counts, exact timing bounds, provisional top-left placement clamped inside the frame, audio copy, output probing, hashing, cancellation, cleanup, and create-if-absent atomic publication.
- Real evidence used a two-second 640 by 360 derivative of the supplied owner video plus audio. Two exports had identical SHA-256 `7c99b6e08c822fb828e38a22f2aec96d69bea0229dbb58b6d70868000b4c1356`, differed from the source, and preserved exact duration, dimensions, and audio.
- Direct adapter checks passed canonical junction rebuilding, private `-n` partial output, malicious hard-link rejection, post-spawn abort capture, close-before-settlement, cancellation before publication, accepted-history delegation, atomic publication, and private cleanup.
- API and edit-domain builds, web type-check, governance, static security scan, and `git diff --check` pass. Managed-sandbox `spawn EPERM` blocks Vite/Vitest before collection, so no fresh full-suite count is claimed for this slice.
- Independent review found and blocked three real issues across two correction cycles: early cancellation settlement, lexical output/reparse and partial-file races, and publication after cancellation during hashing. Final independent re-review reports no remaining blocker.
- Task 7 is backend capability, not a clickable export. Task 8 must connect project paths/history to the API, expose progress/failure/download in Studio, and complete owner E4 testing.

## 2026-07-14 — Windows root launcher corrected

- A final user-startup smoke check reproduced a real `spawn EINVAL` failure before the app could start.
- Root cause was direct no-shell execution of `npm.cmd` under Node 24 on Windows, not a missing dependency or occupied port.
- Added a focused regression and changed the runner to execute npm's JavaScript CLI through the current Node executable with fixed arguments.
- Direct launcher-selection assertions and the API build pass. The corrected root command remained active until intentionally stopped; the managed sandbox still prevents a fresh Vitest worker run with `spawn EPERM`.
- Created a separate 60-second H.264/AAC MP4 test derivative from the owner's MOV so the MP4-only intake can be exercised immediately without modifying the original source.

## 2026-07-14 — Task 8 owner-facing export connected

- Connected the opaque project ID and canonical accepted history from Studio to a bounded same-origin export request.
- Added controlled project-local export allocation, strict opaque export IDs, production renderer invocation, result-path verification, and full/range attachment serving.
- Export is disabled until at least one edit is accepted and no proposal is pending. Studio now shows rendering, recoverable error, verified result metadata, and **Download MP4** states; editing or leaving invalidates stale work.
- Test-first repository, API, browser-client, Studio, and App specifications were added. API/web TypeScript checks and the direct browser client contract pass.
- Direct HTTP composition passed real MP4 intake, empty-history rejection, validated history, controlled allocation/publication, full/range download, traversal rejection, matching hash, 640 by 360 dimensions, exact two-second duration, and audio.
- The managed sandbox blocked a fresh Node-spawned FFmpeg run and Vite/Vitest collection with `spawn EPERM`. Task 7's prior real FFmpeg evidence remains valid; no fresh combined-render or Vitest pass is claimed.
- Independent review blocked a pathname re-open race plus two test-contract defects. Export serving now streams only from the validated open handle, fails closed on unprovable file identity, rejects empty/multiply-linked outputs, and final re-review passed.
- Implementation is complete. Task 8 remains at an open owner E4 gate until the representative browser download is played and accepted.

## 2026-07-14 — Task 8 export failure made observable and recoverable

- The owner's first representative Export attempt reached a generic failure state. Because the original server terminal output was not retained, its exact cause remains unknown rather than being guessed.
- Replaying the accepted history against the existing project in the managed Codex environment failed in 72 ms before encoding. Captured server evidence identified `spawn EPERM` while starting `ffprobe`.
- A separate direct native FFmpeg render of the same 44.5-second H.264/AAC source succeeds and preserves media properties, but took about 151 seconds. That is performance evidence, not proof that the original browser failure was a timeout.
- Test-first contracts now cover emitted and synchronous `EPERM`/`EACCES`, sanitized API mapping, actionable browser copy, and a visible Retry action.
- Production code now maps blocked process launch to `RENDER_PROCESS_BLOCKED`, returns safe HTTP 503, keeps raw operating-system details local, and tells the owner that accepted edits are safe.
- The direct adapter/client/API observability contract passes. The API build and web TypeScript check pass. Vite/Vitest and a fresh combined browser render remain blocked before collection/startup by the managed environment's process policy.
- Task 8 remains **In progress** until the owner retries from normal PowerShell, downloads the MP4, plays it, and accepts output placement, audio, duration, and completion time.

## 2026-07-25 — Real-user end-to-end test closes the manual loop; 64-bit identity defect fixed

- Ran a full real-browser walkthrough on a 30-second 1080p clip instead of relying on unit tests: Home, intake, Studio, point, nameplate, preview, accept, undo, redo, export, download, and inspection of the exported MP4.
- Found a blocking defect that made every new upload unusable: the media/export identity guard required a safe-integer inode, and Windows 64-bit NTFS file IDs exceed `Number.MAX_SAFE_INTEGER`, so each newly created project returned 404 for its own source video while Studio blamed the file. Recorded as FAIL-006.
- Fixed both identity guards to read `{ bigint: true }` stats so identity compares exactly. The July 14 project worked only because it happened to receive a small inode; export downloads would have failed the same way.
- Replaced failure copy that blamed the browser and the video for a server-side cause (FAIL-008).
- Repaired 5 stale `App.test.tsx` contracts that the recent-projects listing had invalidated; no product code changed for that repair.
- Evidence: 220/220 tests (57 api + 129 web + 34 edit-domain), all three builds, live re-test showing 200 for all project media, project reopen with saved history, and a verified exported MP4 (1920x1080, 30.03s, audio, nameplate correct in and out of its window). Source SHA-256 unchanged.
- Realigned local `main` with `origin/main` after an earlier bridge-copy push, then committed and pushed `fcc41eb`. Local and remote are identical.
- Next capability is the first AI-operated edit. The deterministic foundation under it is now verified rather than assumed.

## 2026-07-26 — Immediate cleanup gate

- Root cause of the Node file-descriptor warnings was an incomplete repository ownership contract: `openMedia` and `openExport` returned an already-open handle behind an `AsyncIterable` without an explicit close operation for callers that did not consume it.
- Added an idempotent `OpenMediaResult.close()` contract. Complete iteration closes automatically, HTTP media/export routes close in `finally`, and repository tests explicitly release unopened bodies.
- Direct RED/GREEN API integration proved that successful HTTP media serving now invokes the explicit close boundary; the API TypeScript build passes.
- Reconciled `GOALS.md`, `CURRENT_STATE.md`, `START_HERE.md`, `BUILD_TRACKER.md`, and the plan registry. G2/G3 are recorded as complete, G1 retains its owner-only UX gate, and G4 is next but has no approved detailed plan yet.
- Removed the accidental empty `.sanverse-data/projects/projects` directory. Native human drag-and-drop and final owner UX acceptance remain open because automation cannot honestly supply that evidence.
- Independent pre-commit review found and blocked two remaining handle-release defects: pre-stream header errors were outside `finally`, and close rejection was swallowed. Focused RED/GREEN correction closed both; final independent re-review passed with no security or logic errors.
- Verification boundary: API/domain/web TypeScript builds and direct HTTP/filesystem checks pass. A fresh full Vitest/Vite run remains blocked by the managed session's `spawn EPERM` policy (FAIL-011); the last unrestricted baseline remains 220/220.

## 2026-07-29 — Dual-workspace UI kernel and persistent EditorShell

- Saved GPT's complete 1,606-line implementation context verbatim at `DOCS/plans/SANVERSE_DUAL_WORKSPACE_PRODUCT_AND_UI_IMPLEMENTATION_CONTEXT.md`.
- Verified the active repository truth before implementation: branch `agent/g6-g8-local-alpha`, starting commit `9f53005`; no assumption was made that `main` contains this branch.
- Added only P0-B/P0-C: shared Button, IconButton, SegmentedControl, Panel, Tabs and tokens; one persistent EditorShell; Assist/Studio selector; shared project/save/Undo/Redo/export top bar; restrained workspace-specific layout.
- Preserved one mounted `StudioScreen`. Switching changes presentation, not the project or editor instance, so playhead/video state, pending proposal, revision, history and export state are not converted or reset.
- RED evidence: the new shell module and workspace controls were absent. GREEN evidence: 12/12 focused continuity tests pass and the required web production build passes.
- Real-browser check: reopened `test-30s.mp4`; Assist was the default; switching to Studio kept the same project, 9 history entries and exactly one video element; Studio exposed the existing simple time strip.
- No domain schema, operation, render behavior, effect, professional timeline or provider was added. Timeline V1 remains the exact next task only after owner approval.
- Nonblocking Vite HMR hostname warning and stale authority documents are recorded as FAIL-017 and FAIL-018 rather than repaired in this focused batch.

## 2026-07-30 — P0-E Studio workspace structure

- Reframed the existing mounted StudioScreen into Project media, Program canvas,
  read-only Inspector, collapsible AI edits, and a meaningful Timeline workspace.
- Preserved the single editor authority and every existing state/export path.
- Browser continuity, Point/proposal repair, Cut/Undo/Redo/export, three exact
  responsive screenshots, 64/64 focused tests, and all builds passed.
- Found and fixed the video-over-Point overlap defect. P1-A was not started.

## 2026-07-31 — P1-C Inspector V1

- Added one immutable Timeline-selection resolver and one contextual Inspector over the current evaluated `EditProject`; no second project, history, proposal store, playhead, video, schema, or persistence format was introduced.
- Added local section drafts, Apply/Reset, validation notices, and dirty-selection protection. Every successful Apply builds one existing typed operation and uses the existing App/server revision-fenced change-set route, so it remains one Undo.
- Connected clip visibility/sound/transition, caption repair/style, title/callout/media-overlay/music repair, transform, crop, layer, mask, effects, entrance/exit, easing, and Keyframes V1. Missing capabilities remain explicit: accepted nameplate text is read-only, source clips have no visual target, caption placement controls do not exist, and music end is derived.
- Real Edge found and drove three repairs that component tests had not proved: a sticky visual Apply footer intercepted another section's Apply; pending proposal resolution actions inherited the wrong busy flag; and FFmpeg wrote permanent alpha zero before an entrance fade, making the accepted title absent from export.
- The fresh post-repair walkthrough used `test-30s.mp4` and completed clip Apply, Undo, Redo, title repair, transform/crop/fade/keyframes, Undo, Redo, proposal reject, export/download, and tablet/mobile layout checks. Revision advanced exactly from 0 to 8; rejecting the detached proposal did not consume a revision; page, console, and HTTP errors were zero.
- The final export is H.264 1920×1080 at 30 fps with AAC 48 kHz stereo and 30.033-second duration. Five extracted frames prove the repaired title is absent before/after its interval, visible during fade-in, and fully visible inside the interval.
- Final gates: web 380/380, edit-domain 265/265, API 234/234, render-contract 51/51, intent-domain 27/27, and all-workspace build. One API mocked-export assertion failed once under the first parallel full run, then passed alone and on the complete rerun without a code change; this transient observation is preserved in the evidence.
- Evidence: `DOCS/evidence/2026-07-31-p1c-inspector-v1/`. P1-D was not started.
# 2026-08-03 — P1-F.0.2 Nested Studio Layout Engine V2 complete

Replaced the V1 custom splitter presentation with an exact-version nested panel
adapter while preserving the existing editor/domain authority. Added V2
migration, persistence, presets, responsive behavior, keyboard accessibility,
AI overlay continuity, and focused regression coverage. A real 30-second media
walkthrough passed edit, Undo, Redo, export, and download. Final suites pass
1,158/1,158; the production build passes. INFRA-004, INFRA-005, and SEC-001 are
recorded as bounded follow-up work. P1-F.1 was not started.

# 2026-08-03 — P1-F.0.2.1 layout stabilization technically complete

Real-browser measurement found and fixed two milestone blockers: Reset could
leave a physically expanded AI panel behind an `Expand AI` label, and the old
natural-flow breakpoint collapsed nested Preview/Timeline panel ancestors to
zero height at 1024 and mobile widths. Stable initial geometry, final
presentation authority, a bounded 1024 tablet regime, and an explicit mobile
natural-flow escape resolved both without changing editor/domain authority.
One video, AI draft continuity, ten stable 1440×900 expand/collapse cycles, keyboard resize, responsive
reachability, edit, Undo, Redo, and export passed. Final suites pass 1,164/1,164;
all builds pass; the export probes as 1920×1080 H.264/AAC. Invalid tiled PNGs
were not presented as evidence. P1-F.1 was not started.

# 2026-08-03 — P1-F.0.2.2 Media panel and Editor Monitor V1

Completed the container-responsive Media presentation and replaced native video
controls plus the permanent Point row with one custom editor monitor over the
existing video/content layer. Media search/filter/selection survived 420, 304,
239, and 220 px panel widths; monitor, Point, transport, viewer modes, guides,
fullscreen fallback, and shared geometry survived responsive browser checks
with exactly one video. A real nameplate edit, Undo, and Redo passed. Real export
remained rendering beyond 90 seconds and is recorded without renderer drift.
Media V2 was not started.

## 2026-08-04 — Gate D: the timeline shows real pictures and real sound

Replaced coloured rectangles with the actual frames of the actual recording and
the actual shape of the actual sound. The browser decides what is needed because
it is the only thing that knows what is on screen; the local server makes it with
the same FFmpeg that produces the finished video, so a preview frame can never
differ from the exported one.

Each piece is named by which file, which BYTES of it, which moment and how big —
never by where it sits on the timeline. Moving a clip therefore costs nothing,
trimming costs one picture and splitting costs at most one. Bounds are measured,
not hoped for: two frame decodes and one sound decode at once on the server, six
requests in flight in the browser, and on a real project scrolled end to end and
back, never more than two clips mounted, three drawing surfaces, one video
element and zero object URLs.

Running it in a real browser found two faults no test had: the original recording
reported itself missing because one storage reference is spelled two ways, and
every row shrank on a large monitor because row heights were read from the width
of the timeline instead of the width of the window. Both fixed and now held by
test. A third fault was found and recorded rather than fixed: portrait footage
cannot be exported into a landscape project (FAIL-051).

Tests 1,559 → 1,723. Build exit 0. Inspector expansion and AI execution were not
started.

## 2026-08-05 — P1-F.1E begins; the preview stops calling real footage a gap

The new program is **P1-F.1E, Complete Timeline Experience**: eight gates, T0
through T7, taking the timeline from working to something that feels like CapCut
for everyday work and carries Resolve-level depth where it is asked for. The
live state lives in `DOCS/evidence/2026-08-04-timeline-completion/
PROGRAM_STATE.md`, which is the file a new session reads first.

Gate T0 is correctness, and it comes first for a reason: the owner's own
recording showed the monitor saying "No media at this time" while footage sat
plainly under the playhead. Adding a Bezier graph editor to an editor that lies
about whether your footage exists is the wrong order of work.

The cause turned out to be two steps upstream of where it looked. Selecting a
clip appeared to trigger it; selection was innocent, and so were both monitor
state machines. The trigger was: add a title or a piece of B-roll, move or scale
it, then delete it. The adjustment naming it stays behind, the compiler refuses
the WHOLE project, and the preview — which asks that same compiler whether
footage exists — read the refusal as "there are no stretches anywhere". Every
moment of a healthy thirty-second project then answered "no footage here".

`null` was carrying two opposite meanings: "I could not build this" and "there is
nothing here". Recorded as FAIL-052.

Two fixes. Footage existence is now read from the composition — the user's actual
edit — so one broken thing costs only its own interval, and the resolver takes a
project and a number with no third argument, which makes selection structurally
incapable of changing whether footage exists. And a visual adjustment naming
something no longer on screen now draws nothing instead of failing the project,
which is the rule the compiler already applied three lines above for a
switched-off track.

Black also says which black it is now: no clip at all keeps the plain wording
because that black IS the finished video, while a switched-off track, a
switched-off clip and a missing file each say so — and the missing file is
reported as a fault rather than a gap.

## 2026-08-05 — Gate T0 finished: the preview stopped lying, and mixed-shape footage exports

Two things a user could see were broken. Both are fixed and proven in the running
app on the owner's own project.

**The preview called real footage empty.** Deleting an overlay you had moved left
behind an instruction naming something that no longer existed. The part that
builds the video refused the WHOLE project because of it, and the preview read
that refusal as "the timeline is empty everywhere". The same mistake was then
found in a second place — which recording the video element points at was read
from the same failable build — and fixed the same way.

**A phone clip made Export fail completely.** Footage went into the exporter at
whatever size it was recorded at, and the step that joins the pieces refuses
unless they are all already the same size. Recorded as FAIL-051 "portrait footage
cannot export", but it was never about portrait: any two clips of different sizes
failed. One file now owns the rule for fitting a picture of one shape into a
canvas of another, and both the browser preview and the exporter read it, so they
cannot drift apart. Whole picture with black bars by default; fill-and-crop
offered; stretching deliberately not offered.

Also: "Local save needs attention" replaced with states that say what happened,
how much work is already safe, and what to press. "Reopen it and try again"
replaced with carrying the proposal forward wherever it still makes sense. Our
own vocabulary — "P1-A timeline lane", operation names, reason codes, COMMITTED
on every clip — taken off the user's screen.

Tests 1,736 → 1,848. Build exit 0. FAIL-051 and FAIL-052 closed.

## 2026-08-06 — Gate P0 and Gate T1: picking, copying, grouping and noting

**What a person could not do before.** The Timeline could hold exactly one thing
at a time. Enough to click a clip and delete it; not enough for anything a
creator actually does. There was no way to box several things, no copy, no
paste, no duplicate, no way to say "these go together", and nowhere to write
"fix this bit".

**All of that now exists**, and every one of them is one gesture, one change set
and one Undo. Four clips dragged and one Undo puts all four back — not the fourth
back and three still moved. If any one of them cannot make the move, none of them
move, because moving the ones that fit would change the very spacing the user
picked several of them to preserve.

**The ghost shown while dragging comes from the same planner that makes the
edit.** There is no second "roughly what will happen" calculation. Gate T0 existed
because two pieces of code answered the same question separately; this is that
lesson applied before the bug.

**An export is now identified by what it will produce, not by how many times the
project was touched.** It used to be the revision number, which goes up on every
accepted edit — so writing a note to yourself, or grouping three clips, or
switching a track off and straight back on, threw away a finished video and made
the user wait again for a byte-identical file. The key is now the compiled render
plan. Proved in the running app: a real note moved the revision from 25 to 26,
and pressing Export returned the same finished job instantly.

**A real defect was found while writing the tests.** Clicking a piece of B-roll
silently picked up the whole piece of main footage underneath it, because B-roll
is pinned to a clip and so carries that clip's identity. The next Delete would
have taken both. The link between a picture and its own sound is now matched only
where that link can actually exist.

**Transition became reachable.** Its operation, its preview support and its export
support all already existed with no way for a user to press it — which the new
capability inventory records as the most misleading kind of "partial".

Also written: an inventory of every requested Timeline feature judged on seven
separate questions, and a written refusal of veed-engine-cli on licence grounds
with four hard rules so nobody has to work it out again.

Tests 1,848 → 2,050. Build exit 0.

## 2026-08-14 — Component Ingest V1 finishes the approved CH1 set

The owner approved the integrated Frosted Icon Rail comparison, then clarified that this Sanverse coding agent—not another agent—owns the complete engineering conversion and Library insertion for the rest of CH1. The remaining nine already-approved source visuals were therefore implemented in this worktree, not left as intake placeholders.

All ten CH1 packages pass the same foreign/lossless-normalization intake contract and keep immutable approved-source hashes without copying any reference video. Components 02–10 now have canonical typed props, stable semantic Motion Graph scenes, Creator/Designer/Advanced exposures, exact CH1 reference durations, reduced motion, four ratios and C2/C3/C4/C5 editability. Component 01 records direct owner parity approval; Components 02–10 record the separate explicit owner batch-authorized engineering-parity state rather than pretending they were individually watched by the owner.

The visual loop found and fixed real issues before registration: full-screen-vs-intrinsic transform authority, invalid graph shape-child hierarchy, a missing CH1 responsive `data-shape` in the parity harness, Feature Matrix entrance motion bypassing its graph tracks, and invalid blank/noisy Edge captures. Seven exact-tick source↔integrated checkpoints were retained per remaining component and manually inspected.

Registration then moved the public catalog **89 → 99**. The Creative Library now has a first-class `Owner Approved CH1` collection with ten fresh posters and ten `A · PASSED` cards. Real Edge completed canonical 1× playback for all ten new entries. The durable review store is 99/99.

Fresh scoped Creative/Motion/B1/Ingest tests are **473/473**, the root all-workspace build passes, `apps/web` remains unchanged, no source/reference media was copied, no external animation runtime was added, and A22/B2/B3/C6 remain unstarted. GitHub is not used; release history remains local.
