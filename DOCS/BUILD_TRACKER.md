# Build Tracker

Last updated: 2026-08-03

| ID | Goal | Deliverable | Status | Evidence |
|---|---|---|---|---|
| G0-01 | G0 | Product requirements and macro goal | Complete | `REQUIREMENTS.md`, `MACRO_GOAL.md` |
| G0-02 | G0 | Architecture and interface decisions | Complete | `DECISIONS.md`, `INTERFACE_PRINCIPLES.md` |
| G0-03 | G0 | Goal map and anti-drift protocol | Complete | `GOALS.md`, `ANTI_DRIFT_PROTOCOL.md` |
| G0-04 | G0 | Lightweight local continuity hooks | Complete | Setup/governance checks and isolated hook-output tests pass |
| G0-05 | G0 | Coherent Git baseline | Complete | `eb08ce2`, merged remote history at `751911f` |
| G0-06 | G0 | Private GitHub repository | Complete | SSH push to `budhasantosh010/stage-2-sanverse-video-editing-` |
| G0-07 | G0 | Owner approval to enter G1 | Complete | Explicit owner instruction on 2026-07-12 |
| G1-01 | G1 | Two-screen user journey and low-fidelity Home/Studio design | Complete | Owner approved both screens |
| G1-01B | G1 | Runnable Home-to-Studio web shell on strict port 2000 | In progress | Owner rejected subtle motion twice; unsupported native transition API was verified and a gated fallback plus direct-control spring correction now awaits owner re-test |
| G1-02 | G1 | Renderer comparison harness and fixtures | In progress | 11 focused hybrid tests and 45 renderer tests; static fixture has structural hybrid evidence; pixel fidelity, real-video/audio, motion, and HyperFrames runtime remain open |
| G1-03 | G1 | Architecture decision record for renderer | Complete | ADR-001 narrowly selects browser preview plus FFmpeg export for the first static-nameplate loop |
| G2-01 | G2 | Canonical point/nameplate action and immutable history package | Complete | 34 edit-domain tests pass; Studio uses canonical proposal, acceptance, undo, redo, persistence, and the renderer boundary delivered by later rows |
| G2-02 | G2 | Explicit rendered-video Point mode | Complete | 11 pure point-target tests plus 16 Studio tests (27 focused), 109 full workspace tests, both builds, governance, and diff checks pass; live owner workflow remains unverified |
| G2-03 | G2 | Bounded manual nameplate proposal | Complete | 10 composer tests plus 18 Studio tests pass; this independent slice creates a validated pending proposal without accepting it |
| G2-04 | G2 | Typed nameplate preview and canonical history loop | Complete | Preview, exactly-once acceptance, undo/redo, persisted history, and recent-project reopening are connected; owner placement semantics remain a G1 UX decision |
| G2-05 | G2 | Immutable local project intake and controlled media API | Complete | 30 API + 118 web + 34 edit-domain tests passed at the slice gate; configured runtime smoke and a real-video-derived HTTP/hash/range check passed; later rows connect history and export |
| G3-01 | G3 | Replaceable deterministic FFmpeg renderer adapter | Complete | Two real-video-derived renders have identical hashes and preserve 640 by 360, two-second duration, and audio; API/domain builds, web type-check, direct cancellation/path/publication checks, governance, static scan, diff check, and independent final re-review pass |
| G3-02 | G3 | Owner-facing accepted-history export and download | Complete | Real-browser walkthrough 2026-07-25 exported a 30s 1080p clip and downloaded it; probe and frames confirm 1920×1080, 30.03s, AAC audio, nameplate present at the clicked point during its window and absent after. Preview and export styles match. Render took roughly 60–85s, recorded as a known cost; owner has deprioritized speed |
| G2-06 | G2 | Persisted project history and recent projects | Complete | Accept, undo, and redo write serialized history to `.sanverse-data/projects/<id>/edit-project.json`, verified on disk after each action; Home lists recent projects and reopening restores saved history in a live browser |
| G3-03 | G3 | Real-user end-to-end verification of the manual loop | Complete | Full browser walkthrough with console, network, server-log, disk, and exported-media inspection. Found and fixed FAIL-006 (64-bit inode rejection blocking all new uploads) and FAIL-008 (misleading copy); repaired 5 stale App tests. 220/220 tests and all three builds pass at `fcc41eb` |
| G2-07 | G2 | Explicit media-handle ownership and authority-document cleanup | Complete | Direct RED/GREEN HTTP and real-filesystem checks pass; API/domain/web TypeScript builds pass; independent re-review passes. Full Vitest/Vite execution is blocked only by FAIL-011 and retains the prior 220/220 baseline |
| PLAN-01 | Planning | Complete macro roadmap, micro plans, atomic G4-A plan, cross-cutting validation, and one tickable checklist | Complete | Planning documents exist and were reconciled with authority docs; the owner authorized implementation on 2026-07-27 and G4-A was built against them |
| G4A-01 | G4-A | Scale-ready `sanverse.project/v2` domain: fixed 1,440,000-tick clock, half-open ranges, opaque storage refs, clip composition, capability registry, atomic change sets with revision fencing, selective deactivation, bounded preserved extensions | Complete | 103 edit-domain tests; ADR-002; migration verified on the owner's real 2026-07-25 v1 files |
| G4A-02 | G4-A | One canonical render contract compiled by both preview and export, with the exporter's font served to the browser | Complete | 22 render-contract tests including a parity test that numerically evaluates the exact FFmpeg placement expression; ADR-003 |
| G4A-03 | G4-A | Server-authoritative editing routes and export from the stored project | Complete | API change-set/undo/redo/active/export routes; the browser supplies no edit list to export |
| G4A-04 | G4-A | Real-media, real-browser evidence | Complete | `DOCS/evidence/2026-07-27-g4a-real-media.md`; measured placement parity; two defects found by the browser run that no test had caught |
| G4B-01 | G4-B | Bounded `IntentRequest` with a closed shape that keeps paths, project JSON, and media bytes out by construction | Complete | 27 intent-domain tests |
| G4B-02 | G4-B | Untrusted `IntentCandidate` with exactly four states and a closed argument shape | Complete | Extra keys, smuggled operations, control characters, and out-of-range values all refused |
| G4B-03 | G4-B | Deterministic fake provider that also misbehaves on purpose | Complete | Injection, prose replies, and out-of-range values are produced deliberately so the refusals are exercised every run |
| G4B-04 | G4-B | Deterministic 13-step intent service; any failure before the change set returns no pending operation | Complete | 28 API intent tests; stale revisions refused before the provider is called |
| G4B-05 | G4-B | Clarification bounded to six facts that change the edit | Complete | Wording lives in the domain, so the provider never phrases a question to the user |
| G4B-06 | G4-B | Direct repair of a pending proposal without a second request | Complete | Text, length, start, and position are all repairable; provenance and identity survive |
| G4B-07 | G4-B | Conversation UI replacing the disabled placeholder | Complete | 158 web tests; ready, sending, clarification, unsupported, error, proposal, and closed-while-pending states |
| G4B-08 | G4-B | Prompt/evaluation corpus asserting product behaviour, not model prose | Complete | 18 cases, run on every `npm test`; `DOCS/evaluations/nameplate-intent-v1.md` |
| G4B-09 | G4-B | Outbound data allowlist enforced immediately before the wire | Complete | Every outbound field enumerated; media, paths, filenames, identifiers, history and hashes excluded by construction; logs carry sizes only |
| G4B-10 | G4-B | Connect one real provider | Pending | Needs the owner's decision about data leaving the machine, then a probe of schema adherence, latency, error shape, timeout, cancellation, and quota behaviour |
| P0B-01 | Dual workspace | Minimal shared UI kernel: Button, IconButton, SegmentedControl, Panel, and Tabs | Complete | 2 focused EditorShell tests; shared tokens; required web production build passes |
| P0C-01 | Dual workspace | Persistent EditorShell with Assist/Studio switching and state continuity | Complete — owner walkthrough open | 10 focused App tests; pending AI proposal, project revision, video element/playback time, history and acceptance survive switching; real browser retained one project, 9 history entries and one video element |
| P0E-01 | Studio structure | Five-region professional Studio frame over the existing editor authority | Complete — owner approved | 64/64 focused regressions; all-workspace build; one-video continuity, AI collapse, direct edit/Undo/Redo/export, proposal repair, three exact-size screenshots; owner approved from `d48aabf…` |
| P1A-01 | Timeline foundation | Immutable deterministic timeline presentation model, viewport math, and typed gesture adapter | Complete | 71/71 focused web timeline tests; 77/77 affected edit-domain tests; representative 50/100/20/1 fixture; unchanged production bundle; all-workspace build |
| P1B-01 | Production Timeline V1 | Five semantic lanes, shared playhead, ruler, seek/drag, zoom/Fit/scroll, overscan, selection, supported typed edit gestures, trim preview, snapping, proposal ghosts, keyboard safety, and context menu | Complete — owner approved | 79/79 focused timeline/Studio tests; 77/77 affected domain tests; real Edge split/Undo/Redo/snap/trim/proposal/export loop; clean 1440/1024/390 geometry; probed 1080p MP4; all-workspace build |
| P1B1-01 | Repository-wide test truth | Align executable contracts, export lifecycle assertions, and signed-number simulation with current product behavior | Complete — owner approved | Web 332/332; edit-domain 265/265; API 233/233; render 51/51; intent 27/27; Timeline/Studio 79/79; identical P1-B bundle; no production source change |
| P1C-01 | Inspector V1 | Contextual authoritative selection, local drafts, section Apply/Reset, dirty-selection guard, existing-operation editorial controls, visual properties, effects, transitions, and Keyframes V1 | Complete — owner visual approval open | Real Edge clip/title/visual/proposal/export workflow with revision chain 0→8 and zero page/console/HTTP errors; corrected 1080p export inspected; web 380/380, edit-domain 265/265, API 234/234, render 51/51, intent 27/27; all-workspace build |
| P1D-01 | Canvas Direct Manipulation V1 | Shared Timeline/Canvas/Inspector selection and visual draft; move, nudge, resize, rotate, crop, snapping, proposal repair, Point precedence, responsive contained-video geometry, one-operation completion | Complete — owner approved | Real Edge title/callout/image/proposal/export workflow, one video, native controls, zero page/console/HTTP errors, 1440/1280/1024/390 screenshots, inspected 1080p export; web 442/442, edit-domain 265/265, API 235/235, render 51/51, intent 27/27; build passes |
| P1E-01 | Media Bin V1 | Immutable accepted-project media view model; shared labels and usage; App-owned source probing; import/search/filters/selection; existing-operation B-roll/music placement; missing/removal truth; responsive and accessible controls | Complete | Real Edge with talking-head MP4, image, secondary MP4, and WAV; missing-source failure/restoration; one video, five lanes, zero unexpected browser/HTTP errors, no overflow/blob leak; 10 screenshots; probed H.264/AAC export and frame/audio evidence; web 473/473, edit-domain 265/265, API 235/235, render 51/51, intent 27/27; build passes |
| P1E1-01 | Studio Vertical Flow | One browser-document vertical-scroll authority; natural Studio height; reachable full Timeline; bounded panel scrolling; passive existing-geometry refresh after document scroll | Complete | Real Edge at 1440/1280/1024/390; 1484px document at 1440×900; preserved playhead/selection/zoom/horizontal scroll/revision; Canvas and Point alignment; playback continuity; one video, five lanes, zero page/console/HTTP errors; 8 screenshots; web 476/476, edit-domain 265/265, API 235/235, render 51/51, intent 27/27; build passes |
| P1F0-01 | Primary-Footage Motion V1 | Stable source-anchored motion identity; full-state position/scale/rotation/crop/keyframes; shared evaluator; Motion Inspector, Timeline indicator, Canvas controls; one-video preview and FFmpeg export | Complete | Real Edge static/Canvas/Undo/Redo/Point/animated/split/export/responsive/cleanup loop; zero page/console/HTTP errors; inspected 1920×1080 H.264/AAC export; 53.3s render; API 239/239, web 484/484, edit-domain 299/299, render 65/65, intent 27/27; all-workspace build passes |
| P1F01-01 | Studio Workspaces and Docking V1 | Studio-only Edit/Effects/Color/Audio views over one editor authority; accessible Tool/AI dock; validated local layout schema, presets, collapsible bounded splitters, truthful capability surfaces, and compact responsive behavior | Complete | Real Edge preserved one video, AI draft, playhead, selection, and revision 15→15 through all workspaces/presets/splitters; no tablet/mobile overflow; zero page/console/HTTP errors; inspected 1920×1080 H.264/AAC export; API 239/239, web 515/515, edit-domain 299/299, render 65/65, intent 27/27 — 1,145 total; all-workspace build passes |
| P1F02-01 | Nested Studio Layout Engine V2 | Exact-version nested panel adapter with typed migration, persistence, presets, responsive overlay, and one editor authority | Complete | 1,158/1,158; real edit/Undo/Redo/export; build passes; screenshot-compositor exception recorded |
| P1F021-01 | Nested Layout Stabilization | One desktop height authority; full-height AI rail; protected Preview/Timeline; panel queries; laptop AI fallback; tablet/mobile drawers | Complete — owner visual approval open | Real browser: one video, preserved draft, 10 stable 1440×900 expand/collapse cycles, laptop overlay fallback, keyboard resize, 1440/1280/1238/1024/390 geometry, edit/Undo/Redo/export; 1,164/1,164; build passes |

## Status rules

| P1F022-01 | Media panel and Editor Monitor V1 | Container-responsive Media shell/cards and one custom monitor with Point, transport, viewer modes, guides, shared geometry, and fullscreen fallback | Complete — owner visual approval open | 1,174/1,174 full suite plus 31/31 post-review affected gate; current inventory 1,176; real browser across Media 420/304/239/220 px and 1440/1280/1238/1024/390 regimes; one video; edit/Undo/Redo; export runtime timeout recorded; builds pass |

- `Pending`: not started.
- `In progress`: active work exists but the acceptance gate is open.
- `Complete`: acceptance evidence exists and limitations are recorded.
- `Blocked`: progress requires owner authority or external state.
- `Proposed`: planning exists but is not approved or active implementation.
# P1-F.0.2 — Nested Studio Layout Engine V2 (2026-08-03)

- [x] Exact `react-resizable-panels@4.12.2` dependency
- [x] Nested AI/main, upper/timeline, media/preview/tool groups
- [x] Typed V2 state, V1 migration, validation, persistence, presets, reset
- [x] Responsive AI overlay, keyboard separators, reduced motion
- [x] One editor/video/playhead/proposal/history/preview/export authority preserved
- [x] Real edit → Undo → Redo → export/download walkthrough
- [x] 1,158 tests and all-workspace production build pass
- [x] Evidence and failure registry updated
- [ ] P1-F.1 (not started by contract)

# P1-F.0.2.2 — Media panel and Editor Monitor V1 (2026-08-03)

- [x] Media responsive presentation and single results-scroll authority
- [x] Editor Monitor V1 and compact Point tool
- [x] One video/playhead/project/revision/history/proposal/export authority
- [x] Real browser responsive, transport, viewer mode, Point, fullscreen checks
- [ ] Owner visual acceptance
- [ ] Media V2 (not started)
| P1F1A-B | P1-F.1A | Media Library V2 essentials: compact responsive panel, import by kind, OS file drop, sort, filter, durable one-level server folders, closed drag payload (switched off) | Complete | `DOCS/evidence/2026-08-03-p1f1a-creator-editor-core/media-library-contract.md`, `media-folders.md`, `media-drag-contract.md`, `media-responsive-matrix.md`, `media-browser-walkthrough.md`, `test-results-gate-b.md` |
