# Project Log

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
