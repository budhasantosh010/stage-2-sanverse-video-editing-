# Current State

Last updated: 2026-07-14

## Active goal

**G1 — Runnable web UX validation and renderer feasibility**

## State summary

- The Stage 2 workspace began without product files or valid Git metadata.
- The Stage 1 project and the prior anti-drift template were inspected read-only.
- Owner requirements and corrections have been converted into durable requirements and decisions.
- The product architecture direction is approved at the principle level: modular monolith, headless canonical edit engine, deterministic execution, replaceable AI/render/storage adapters.
- The interface direction is approved at the principle level: calm black-and-white Home first, then a focused Studio after a video/project is opened.
- A runnable browser-only Home-to-Studio frontend shell now exists at strict `http://localhost:2000`. Live Home and port behavior were verified, and the controlled automated workflow has E3 evidence.
- The shell now imports the selected MP4 into an immutable project-owned local copy through the loopback API and previews the controlled same-origin media URL. The original source is not altered.
- The owner completed the first real-video Home-to-Studio walkthrough. The flow reached Studio and video playback worked, but the owner found the Home heading too large, state changes abrupt, and Studio non-actionable because pointing, chat execution, and editing do not exist yet.
- The owner reported that the first refinement still felt abrupt. Live browser inspection verified that `document.startViewTransition` is unavailable on the current surface, so the prior direct-update fallback had no visible transition. A tested correction now gates a visible CSS entry transition to unsupported browsers, adds brief spring feedback to direct controls, and explicitly removes these transforms for reduced motion. A fresh owner re-test is pending.
- The G1 renderer spike now selects a minimum hybrid architecture for the first static-nameplate loop: browser-native preview plus FFmpeg-native export from the same renderer-neutral request. Parsed generated outputs have equivalent text and timing, with placement differing only by bounded pixel rounding for the exact synthetic fixture. Preview-to-export pixel fidelity remains unmeasured.
- A renderer-independent `@sanverse/edit-domain` workspace now defines the exact versioned point/nameplate contract plus pure validation, proposal, acceptance, undo, redo, and deterministic serialization. App-owned Studio state now uses that canonical history in memory; the renderer and persistence remain unconnected.
- Studio now has an explicit, temporary Point mode. It pauses playback on entry, captures finite normalized coordinates and a non-negative millisecond timestamp against the rendered video content rather than padding or letterboxing, rejects invalid clicks, then removes the pointer layer and shows a marker plus `Here · timestamp`. The marker reprojects after video resize from the normalized target. Pointer input and a focused arrow-key/Enter flow are supported; Cancel and Escape return to normal controls without capturing. Eleven pure point-target tests plus 16 Studio tests pass, and the full workspace has 109 passing tests. This is E2 automated evidence; owner/live-browser usability is not yet verified.
- Studio now connects a captured point to the canonical proposal validator. `Add text here` is unavailable until a target exists; the composer requires main text, permits an optional smaller line, maps the captured position and timestamp exactly, and defaults to five seconds. A validated immutable proposal appears in the Conversation panel without entering accepted history. Capturing a new point invalidates the old unaccepted proposal and resets any open composer.
- Ten composer tests plus 18 Studio tests pass for this slice. The full workspace passes 87 web tests plus 34 edit-domain tests (121 total); both production builds, governance checks, diff checks, spec review, and code-quality re-review pass.
- Studio now derives both pending and accepted nameplate overlays from typed actions over the contain-fitted video content. A pending proposal previews without entering history; Accept records it once through the canonical domain, Discard leaves history unchanged, and canonical Undo/Redo remove and restore accepted overlays. Retargeting discards only a pending proposal, redo-only actions never render, and Back/new-project transitions reset the in-memory edit state.
- The overlay uses a half-open timing interval `[startMs, startMs + durationMs)` and does not intercept video controls. The current point represents the overlay box's top-left position only as a provisional renderer-compatibility assumption; this is not owner-approved placement semantics and can clip near the right or bottom edge.
- Preview timing uses presented-video-frame callbacks when the browser supports them and a mutually exclusive media-event fallback otherwise. Proposal duration copy is derived from the typed action, and successful resolution is announced with a stable visible focus target.
- Final Task 5 evidence passes 113 web tests plus 34 edit-domain tests (147 total), both production builds, both governance checks, `git diff --check`, independent spec review, and independent code-quality re-review.
- A loopback-only local API now accepts one raw MP4 stream behind the web app's same-origin `/api` proxy. The user still opens only strict port 2000; the internal API binds only to `127.0.0.1:2001`, and root `npm run dev` starts and stops both processes as one local application.
- Intake validates a configured safe byte limit, declared and actual byte counts, a bounded ISO-BMFF `ftyp` signature, allowed MP4 brands, filename shape, and conflicting MIME. It generates an opaque project ID, hashes while streaming, writes the complete source and manifest in same-filesystem staging, and publishes only by atomic directory rename. No client filename or ID becomes a filesystem path.
- Project media and its SHA-256/size manifest persist under ignored `.sanverse-data/`. The web waits for HTTP 201, then previews the controlled same-origin project media URL; importing, single-flight selection, cancellation, and recoverable failure are explicit.
- Range media serving now opens one stream per request, clamps valid ends, returns exact-size 416 responses, and cancels iterators on disconnect/error. Filesystem writes handle partial progress, and Windows development shutdown targets the known spawned process tree.
- Final Task 6 evidence passes 30 API tests, 118 web tests, and 34 edit-domain tests (182 total), all three production builds, `git diff --check`, independent spec review, and independent quality/security re-review.
- A post-review configured-runtime check found and fixed Node strip-only rejection of two TypeScript parameter properties. The actual API entry graph now loads under the configured command, and a dedicated compatibility regression scans the API TypeScript sources with the same strip-only parser.
- A 142,738-byte MP4 derived from one second of the supplied 189,751,984-byte MOV passed actual HTTP intake, persistence, full retrieval, and byte-range retrieval with matching SHA-256. This is bounded real-video-derived E3 evidence; it does not establish full-file import speed, owner usability, or MOV support.
- Task 7 now provides a replaceable renderer port, accepted-history render service, and FFmpeg adapter. Runtime action validation, bounded action/text resources, fixed private text/font files, no-shell argument arrays, exact semantic timing, frame-bounded placement, audio copy, duration/dimension/audio probes, cancellation, private partial cleanup, and create-if-absent atomic publication are enforced.
- A two-second 640 by 360 MP4 derived from the supplied owner video plus an audio track rendered twice with identical SHA-256 `7c99b6e08c822fb828e38a22f2aec96d69bea0229dbb58b6d70868000b4c1356`. Both outputs preserved exact duration, dimensions, and audio. Direct checks also passed for accepted-history delegation, Node runtime loading, canonical junction paths, private partial output, hard-link rejection, close-before-cancel settlement, cancellation before publication, and atomic publication.
- API and edit-domain builds plus web type-check, governance, static scan, and diff checks pass. Vite/Vitest execution in the current managed session remains blocked before collection by sandbox `spawn EPERM`; earlier Task 6 full-suite evidence remains 182 passing tests, while Task 7's focused tests are type-checked and backed by the direct/real checks above rather than a falsely claimed Vitest run.
- Independent Task 7 security/logic review initially blocked cancellation and reparse/partial-file races. Two focused correction cycles closed every blocker; final re-review passed.
- Task 8 now carries the opaque project ID into Studio, enables Export only for accepted history with no pending proposal, shows rendering/error/ready states, and exposes a same-origin **Download MP4** result. Editing or leaving Studio cancels or invalidates an in-flight/stale result.
- The loopback API now accepts bounded JSON history at a strict project export route, revalidates it through the render service, allocates source/output/work paths only through the filesystem repository, invokes the replaceable renderer, verifies the returned controlled path, and serves completed MP4 bytes with range and attachment headers. Client filenames, project IDs, export IDs, and response URLs cannot choose filesystem paths.
- Direct Task 8 HTTP composition passed real MP4 intake, empty-history rejection, validated accepted-history delegation, controlled export allocation/publication, full and range download, traversal rejection, and SHA-256 equality. The downloaded fixture probes as 640 by 360, exactly two seconds, with audio. The managed sandbox blocked a fresh production FFmpeg subprocess with `spawn EPERM`; Task 7's separate real FFmpeg evidence remains the renderer proof rather than being misreported as a new combined run.
- API and web TypeScript checks pass. The focused Vitest files were written test-first and type-check, but Vite/Vitest remains blocked before collection by the same managed-sandbox process policy.
- A focused no-child-process repository/API check passes handle-bound path replacement, empty/multiply-linked rejection, export creation, and full/range serving. Independent review first blocked a pathname re-open race and two test-contract defects; corrected handle-bound streaming and contracts received final PASS.
- No persisted edit history, AI integration, database, accounts, billing, or cloud workflow has been implemented. The owner has not yet accepted the downloaded output or preview/export placement fidelity.
- The local `main` branch is connected to and pushed at `budhasantosh010/stage-2-sanverse-video-editing-`.
- The owner explicitly authorized G1 to begin.

## Currently being completed

- Track A Home-to-Studio workflow and wireframes are owner-approved
- Track A2 runnable Home-to-Studio web shell received a second owner motion rejection; the diagnosed unsupported-browser fallback correction is implemented, independently reviewed once, corrected, and awaits final verification plus owner re-test
- Renderer-neutral contract, FFmpeg-native export, and the bounded hybrid static candidate have narrow static-fixture evidence; ADR-001 selects the hybrid boundary only for the first loop
- The broader G1 renderer comparison remains in progress until pixel fidelity, representative real-video/audio behavior, and the approved motion envelope have evidence
- HyperFrames runtime remains uninstalled and unverified; it is deferred until a demonstrated motion need justifies its runtime and deployment cost
- The owner explicitly instructed the team to continue building the real edit workflow while motion polish continues. The first pointed-nameplate plan may therefore begin after its renderer and motion reviews pass; G1-01B and owner motion acceptance remain open rather than being silently marked complete
- Tasks 2 through 8 of the pointed-nameplate plan are implemented. The owner E4 upload-to-download walkthrough, accepted edit persistence, motion acceptance, and pixel-fidelity decision remain open.

## Next gated goal

**G2 — Canonical project foundation**

G2 does not begin until G1's owner workflow review and measured renderer decision are complete.

This line governs macro-goal status, not permission to implement the approved first vertical slice. The owner repeatedly instructed the team to keep building the real workflow while G1 motion/owner acceptance remains open. Tasks 2–8 may therefore implement early G2/G3 capabilities in bounded, reversible slices, but neither G1 closure nor G2/G3 completion may be claimed until their stated evidence gates pass.

## Known unknowns

- Whether the refined Home-to-Studio motion and hierarchy now feel calm enough. The first owner walkthrough proved the previous version was too abrupt and visually oversized.
- Whether the explicit Point/Cancel/capture/Add-text interaction is clear and fast on representative owner footage; automated tests cannot establish usability or perceived feel.
- Whether a click should mean the nameplate box's top-left corner, center, or another explicit anchor, and how near-edge placement should remain visible without silently changing previously recorded actions.
- Whether browser preview and FFmpeg export meet the required visual fidelity on a representative owner video; no pixel comparison or HyperFrames runtime evidence exists yet.
- The exact Stage 1 artifact contract beyond cleaned MP4.
- Real completion-time and edit-acceptance baselines.
- Whether free OpenCode Zen/NVIDIA endpoints support the schemas, quotas, latency, and commercial terms needed for later stages.
- Real full-file MP4 intake behavior and owner-perceived import time; only a short MP4 derivative of the supplied MOV has completed the local integration gate.

## Honest evidence level

G0 governance is locally verified and remotely backed up. The runnable application's controlled workflow and local intake boundary have automated integration evidence, while owner hands-on workflow evidence remains below E4. The isolated hybrid fixture and production FFmpeg adapter have bounded **E3** real-render evidence but no browser/export pixel comparison. The canonical edit-domain, Point mode, proposal, preview, in-memory history, and local intake have **E2** automated evidence. Product capability remains **E0: not implemented** for persisted edit history and AI. The user-triggered export loop has **E2 automated/type evidence** plus **E3 direct HTTP composition evidence**, while the production renderer separately has bounded **E3 real-media evidence**. The complete owner workflow remains below E4 until the owner downloads and approves a representative result.
