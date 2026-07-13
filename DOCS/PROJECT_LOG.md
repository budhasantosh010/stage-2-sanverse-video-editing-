# Project Log

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
