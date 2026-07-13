# Current State

Last updated: 2026-07-13

## Active goal

**G1 — Runnable web UX validation and renderer feasibility**

## State summary

- The Stage 2 workspace began without product files or valid Git metadata.
- The Stage 1 project and the prior anti-drift template were inspected read-only.
- Owner requirements and corrections have been converted into durable requirements and decisions.
- The product architecture direction is approved at the principle level: modular monolith, headless canonical edit engine, deterministic execution, replaceable AI/render/storage adapters.
- The interface direction is approved at the principle level: calm black-and-white Home first, then a focused Studio after a video/project is opened.
- A runnable browser-only Home-to-Studio frontend shell now exists at strict `http://localhost:2000`. Live Home and port behavior were verified, and the controlled automated workflow has E3 evidence.
- The shell uses a local browser object URL for the selected MP4; it does not upload or alter the source file, and cleanup occurs on Back or app unmount.
- The owner completed the first real-video Home-to-Studio walkthrough. The flow reached Studio and video playback worked, but the owner found the Home heading too large, state changes abrupt, and Studio non-actionable because pointing, chat execution, and editing do not exist yet.
- The owner reported that the first refinement still felt abrupt. Live browser inspection verified that `document.startViewTransition` is unavailable on the current surface, so the prior direct-update fallback had no visible transition. A tested correction now gates a visible CSS entry transition to unsupported browsers, adds brief spring feedback to direct controls, and explicitly removes these transforms for reduced motion. A fresh owner re-test is pending.
- The G1 renderer spike now selects a minimum hybrid architecture for the first static-nameplate loop: browser-native preview plus FFmpeg-native export from the same renderer-neutral request. Parsed generated outputs have equivalent text and timing, with placement differing only by bounded pixel rounding for the exact synthetic fixture. Preview-to-export pixel fidelity remains unmeasured.
- A renderer-independent `@sanverse/edit-domain` workspace now defines the exact versioned point/nameplate contract plus pure validation, proposal, acceptance, undo, redo, and deterministic serialization. Studio uses its proposal validator for bounded manual proposal creation; accepted history and the renderer remain unconnected.
- Studio now has an explicit, temporary Point mode. It pauses playback on entry, captures finite normalized coordinates and a non-negative millisecond timestamp against the rendered video content rather than padding or letterboxing, rejects invalid clicks, then removes the pointer layer and shows a marker plus `Here · timestamp`. The marker reprojects after video resize from the normalized target. Pointer input and a focused arrow-key/Enter flow are supported; Cancel and Escape return to normal controls without capturing. Eleven pure point-target tests plus 16 Studio tests pass, and the full workspace has 109 passing tests. This is E2 automated evidence; owner/live-browser usability is not yet verified.
- Studio now connects a captured point to the canonical proposal validator. `Add text here` is unavailable until a target exists; the composer requires main text, permits an optional smaller line, maps the captured position and timestamp exactly, and defaults to five seconds. A validated immutable proposal appears in the Conversation panel without entering accepted history. Capturing a new point invalidates the old unaccepted proposal and resets any open composer.
- Ten composer tests plus 18 Studio tests pass for this slice. The full workspace passes 87 web tests plus 34 edit-domain tests (121 total); both production builds, governance checks, diff checks, spec review, and code-quality re-review pass.
- No backend, project upload, persistence, AI integration, database, nameplate preview/acceptance, renderer integration, or export has been implemented.
- The local `main` branch is connected to and pushed at `budhasantosh010/stage-2-sanverse-video-editing-`.
- The owner explicitly authorized G1 to begin.

## Currently being completed

- Track A Home-to-Studio workflow and wireframes are owner-approved
- Track A2 runnable Home-to-Studio web shell received a second owner motion rejection; the diagnosed unsupported-browser fallback correction is implemented, independently reviewed once, corrected, and awaits final verification plus owner re-test
- Renderer-neutral contract, FFmpeg-native export, and the bounded hybrid static candidate have narrow static-fixture evidence; ADR-001 selects the hybrid boundary only for the first loop
- The broader G1 renderer comparison remains in progress until pixel fidelity, representative real-video/audio behavior, and the approved motion envelope have evidence
- HyperFrames runtime remains uninstalled and unverified; it is deferred until a demonstrated motion need justifies its runtime and deployment cost
- The owner explicitly instructed the team to continue building the real edit workflow while motion polish continues. The first pointed-nameplate plan may therefore begin after its renderer and motion reviews pass; G1-01B and owner motion acceptance remain open rather than being silently marked complete
- Tasks 2 through 4 of the pointed-nameplate plan are implemented in isolation: the canonical contract fails closed and remains immutable, Studio can capture one ephemeral point without permanently blocking native video controls, and that target can become one bounded unaccepted proposal. Canonical history integration, preview, export, and Tasks 5 through 8 remain unimplemented

## Next gated goal

**G2 — Canonical project foundation**

G2 does not begin until G1's owner workflow review and measured renderer decision are complete.

## Known unknowns

- Whether the refined Home-to-Studio motion and hierarchy now feel calm enough. The first owner walkthrough proved the previous version was too abrupt and visually oversized.
- Whether the explicit Point/Cancel/capture/Add-text interaction is clear and fast on representative owner footage; automated tests cannot establish usability or perceived feel.
- Whether browser preview and FFmpeg export meet the required visual fidelity on a representative owner video; no pixel comparison or HyperFrames runtime evidence exists yet.
- The exact Stage 1 artifact contract beyond cleaned MP4.
- Real completion-time and edit-acceptance baselines.
- Whether free OpenCode Zen/NVIDIA endpoints support the schemas, quotas, latency, and commercial terms needed for later stages.

## Honest evidence level

G0 governance is locally verified and remotely backed up. The runnable frontend's controlled automated Home-to-Studio workflow has **E3** evidence, and live Home/strict-port behavior is verified. Owner hands-on workflow evidence remains below E4. The isolated hybrid synthetic fixture has E3 integration evidence for structural translation, repeatable document generation, and FFmpeg output on this machine, but no preview/export pixel comparison. The canonical edit-domain contract, Point mode, and bounded unaccepted proposal have **E2** automated evidence. Product capability remains **E0: not implemented** for a completed edit, backend, AI, persistence, render, and export.
