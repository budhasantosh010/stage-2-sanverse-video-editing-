# Sanverse Dual-Workspace Full Editor Roadmap

**Status:** Proposed for owner approval. Planning only; this document implements no editor feature.

**Repository:** `C:\Users\Lenovo\Music\Startups\YT Automations\A1 Talking Head Youtube Video\Sanverse YT Channel\Stage 2 Sanverse Editing Workflow`

**Date:** 2026-07-29

## 1. Exact product goal

Build one production-grade video-editing system with two workflows:

1. **Assist workspace:** a person describes or points at what they want; AI proposes visible, reversible edits.
2. **Studio workspace:** an experienced editor directly uses professional timeline, inspector, audio, color, keyframe, effect, and export controls.

Both must use one project schema, media library, timeline/composition model, capability registry, typed operation engine, validator, revision history, undo/redo stack, preview compiler, and export compiler.

The AI is another controller of the same editor. It must not be a separate simplified editor, project format, renderer, or fake mouse macro.

## 2. Truthful current position

Sanverse is a substantial local technical alpha for AI-assisted talking-head editing. It is not yet a general non-linear editor and is not close to complete feature parity with DaVinci Resolve, Premiere Pro, or CapCut.

### Present

- Versioned projects, assets, compositions, revisions, migrations, and typed capabilities.
- Proposal, validation, acceptance, history, undo, and redo foundations.
- Split, trim, remove, ripple-close, reorder, enable/disable, gain, fades, and a bounded dip transition.
- Titles, callouts, captions, media overlays, images/B-roll, music, and direct repair.
- Transform, crop, scale, rotation, opacity, layers, rectangle/ellipse masks.
- Keyframes with linear, cubic-Bezier, spring, and bounce easing.
- Fade, slide, and zoom entrances/exits.
- Blur, brightness, contrast, saturation, and grayscale effects.
- Browser preview, FFmpeg MP4 export, durable jobs, diagnostics, hashes, and portable archives.
- Point, circle, box, arrow, and freehand annotations as non-executable intent.
- Versioned recipes and atomic multi-operation workflows.

### Partial

- Several assets can enter a project, but there is one main footage sequence.
- A simple time strip exists, but not a professional multitrack timeline.
- Captions have a bounded internal/render path, but real transcription is not connected.
- AI proposal plumbing exists, but the fake provider is the only active provider.
- Visual properties execute, but professional manipulation and curve controls are incomplete.
- MP4 export works for the current slice, not professional delivery breadth.

### Critical gaps

- No general append/insert/overwrite multi-clip editing.
- No professional video/audio track model.
- No real AI model or transcription-provider run.
- No professional bins, proxies, cache, relink, metadata, color, HDR, mixer, multicam, transcript editing, retiming, tracking, keying, or advanced compositing.
- No production collaboration, accounts, tenancy, cloud storage, or hosted rendering.

## 3. Product architecture decision

### Use one editor shell with two switchable workspaces

Place a workspace selector in the project toolbar:

- **Assist**
- **Studio**

Do not use “Beginner” and “Professional”; those classify people. Assist and Studio describe the task they want to perform now.

Do not ask for a permanent onboarding choice. A professional may use AI for a rough cut; a first-time editor may manually fine-tune one property.

Initially use layouts inside one project route, not separate products or state stores. Later deep links may preserve layout preference, but they must load the same project and engine.

### Assist workspace

Show:

- media/canvas preview;
- conversation and intent input;
- point/draw/region tools;
- proposal summary and affected ranges;
- before/after preview;
- accept, reject, refine, pause, cancel, undo;
- “Open in Studio.”

Hide professional complexity until requested, without deleting or resetting advanced settings.

### Studio workspace

Show:

- project/media bin;
- source/program monitors where needed;
- general multitrack timeline;
- editing tools;
- inspector;
- effects/components browser;
- audio meters/mixer;
- contextual color scopes;
- keyframe/curve editor;
- compact AI activity/proposal panel.

Every direct manipulation emits the same typed operations Assist uses.

### “Watch the magic” execution

1. AI receives text, drawing, selection, playhead, transcript, and project context.
2. AI returns a bounded proposed change set.
3. Deterministic code validates capabilities, references, timing, permissions, and limits.
4. UI highlights affected clips, tracks, ranges, and properties.
5. A detached preview is compiled.
6. User accepts, modifies, rejects, pauses, or cancels.
7. Acceptance creates one atomic revision and one undo boundary.

An advanced editor can open and modify the proposal in Studio before acceptance.

## 4. Competitor feature-gap inventory

Legend: **Present** means a useful executable foundation exists; **Partial** means narrow support exists; **Missing** means no complete user-facing capability exists.

### 4.1 Project and media management

- **Present:** multiple typed imported asset kinds and content hashes.
- **Partial:** revisions and portable archives.
- **Missing:** bins/folders, smart collections, tags, favorites, metadata search, safe ingest/copy/checksum workflow, duplicate handling UI, offline media, relink/replace, proxies, optimized media, render cache, multiple sequences, nested sequences, waveform/timecode sync, scene detection, timeline markers, user-facing autosave recovery, and version comparison.

### 4.2 Professional timeline and editing

- **Present:** split, trim, remove, ripple-close, reorder, clip enable/disable.
- **Partial:** gaps exist in the domain, but full lift/extract controls do not.
- **Missing:** general multitrack video/audio timeline, append, insert, overwrite, three-point editing, roll/slip/slide, full ripple modes, track targeting/patching, lock/mute/solo/sync-lock, linked/unlinked A/V, snapping, J/L cuts, match frame, replace edit, fit-to-fill, groups, compound clips, adjustment layers, multicam, transcript editing, keyboard mapping, and J/K/L shuttle.

### 4.3 Time, retiming, and motion

- **Present:** bounded keyframes, cubic curves, spring, bounce, and simple entry/exit motion.
- **Missing:** speed/duration, reverse, freeze/frame hold, speed ramps/time remapping, frame sampling, frame blending, optical flow, motion blur, full value/velocity graph editor, keyframe snapping, and keyframe copy/paste.

### 4.4 Transform, compositing, and VFX

- **Present:** position, scale, rotate, crop, opacity, layer order, rectangle/ellipse mask.
- **Missing:** blend modes, track mattes, chroma/luma key, spill cleanup, path masks, rotoscoping, object/point/planar tracking, stabilization, lens correction, corner pin/perspective, parenting/nulls, reusable tracking data, advanced node compositing, 3D layers/camera/lights, particles, and simulations.
- **Defer:** full Fusion/After Effects-style 3D and simulation parity until demanded.

### 4.5 Titles, captions, and motion graphics

- **Present:** nameplates, titles, callouts, captions, and versioned recipe foundations.
- **Missing:** full typography controls, font browsing, kerning/tracking/leading, stroke/shadow/gradient, shape/vector layers, per-word/line/character animation, visual template authoring, parameterized reusable templates, expression/relationship system, motion-graphics interchange, and searchable sticker/elements library.

### 4.6 Color and image finishing

- **Present:** brightness, contrast, saturation, grayscale.
- **Missing:** managed input/working/display/output color spaces, HDR/wide-gamut/10-bit, RAW/log handling, white balance, exposure, highlights/shadows, lift/gamma/gain, curves, HSL qualifiers, secondaries, mask tracking, LUT management, shot match, waveform, RGB parade, vectorscope, histogram, ordered grade stacks/nodes, denoise, sharpening, and grain.

### 4.7 Audio

- **Present:** clip gain, fades, and music mixing.
- **Missing:** cached waveforms, multitrack mixer, peak and loudness meters, pan, track gain, buses, sends, volume/pan/effect automation, EQ, compressor, limiter, gate, de-esser, de-hum, reverb, noise reduction, voice isolation, loudness normalization, automatic ducking, music remix/time-fit, voiceover/ADR recording, audio sync UI, plugins, surround, and spatial audio.

### 4.8 Transcript, captions, and localization

- **Present:** caption data/render path.
- **Partial:** synthetic/sidecar transcript boundary.
- **Missing:** real transcription, speaker detection, word-level timing UI, text-based editing, silence/filler/repetition suggestions, karaoke captions, full caption styling UI, SRT/VTT/TTML import/export, multiple language tracks, translation, RTL/CJK proof, profanity/censor options, and caption safe-area checking.

### 4.9 Effects and transitions

- **Present:** five basic effects, simple entry/exit transitions, one adjacent dip transition.
- **Missing:** ordered effect stack, reorder/toggle/reset, transition library, dissolve/wipe/push/zoom/blur families, effect presets, copy/paste attributes, adjustment effects, stabilization/denoise/sharpen/glow/distortion/lens families, GPU acceleration contract, preview/export parity across backends, and third-party plugin API.

### 4.10 AI-assisted editing

- **Present:** safe proposal/change-set architecture and bounded compound workflows.
- **Partial:** OpenAI-compatible adapter proven only against a stub; crude fake provider remains active.
- **Missing:** real provider evaluation, timed transcript understanding, rough-cut generation, silence/filler removal, scene/beat detection, B-roll search/suggestion, auto reframe, smart crop, object selection/tracking, speech cleanup, color/shot match, shorts/highlights, visible agent progress/diffs/cancel, deterministic quality evaluation, provider routing, cost/latency/privacy controls, and per-capability accuracy gates.

### 4.11 Collaboration and review

- **Present:** local revision history.
- **Partial:** spatial annotations, but not review threads.
- **Missing:** frame/range comments, review links, approvals, roles, shared projects, cloud sync, presence, shared bins, audit views, named versions, visual comparison, and conflict-safe collaboration.

### 4.12 Export and delivery

- **Present:** local MP4 export with durable job records.
- **Partial:** durable queue foundation.
- **Missing:** format/codec presets, custom resolution/FPS/bitrate, ProRes/DNx/WebM where available, audio-only, image sequence, alpha, HDR/color metadata, embedded/sidecar/burned captions, range/clip/sequence export, audio stems, multiple outputs, priority/batch queue, quality-control checks, and direct platform publishing.

### 4.13 Professional UX and extensibility

- **Partial:** contextual alpha UI and capability/recipe registries.
- **Missing:** mature inspector, professional timeline interactions, customizable panels/workspaces, command palette, shortcut editor, source monitor, scopes/meters, multi-monitor mode, trackpad/touch behavior, macros, user-authored components, extension permissions, plugin isolation, and sandboxed extension APIs.

## 5. Apple-like interface system

The target is Apple-like product quality, not an imitation of iOS screens.

### Principles

- **Content first:** footage dominates; controls recede until relevant.
- **Hierarchy:** one obvious primary action in each state.
- **Continuity:** workspace switches and panel changes preserve spatial context.
- **Directness:** dragging, scrubbing, trimming, and transforming feel attached to the pointer.
- **Craft:** exact spacing, alignment, typography, icons, focus, and empty states.
- **Restraint:** black, white, neutral gray, and semantic color only when it communicates state.
- **Accessibility:** keyboard parity, visible focus, contrast, usable targets, captions, and reduced motion.

### Motion language

- Use short spring motion for direct manipulation and small state changes.
- Use ease-out for entrances and ease-in for exits.
- Animate continuity: selection, panels, proposal highlights, timeline changes, and workspace transitions.
- Buttons may compress slightly on press and settle quickly; do not make everything bounce.
- Avoid long overshoot, sustained oscillation, or footage movement during precision work.
- Reduced-motion mode replaces spatial motion with short fades or immediate state changes.
- Progress must be truthful; never use decorative fake progress.

### Materials

- Use translucent/glass-like material only for floating navigation or transient controls.
- Do not put persistent glass over footage, waveforms, scopes, or the timeline.
- Use opaque high-contrast surfaces for precision.
- Keep black-and-white branding, with semantic colors for error, warning, success, selection, and track identity.
- Studio can be neutral dark even if Home/Assist remains light; prolonged editing and grading benefit from low glare.

### Acceptance criteria

- Workspace switching preserves project, playhead, selection, zoom, proposal, and undo history.
- No layout jump when panels open or close.
- Press feedback begins within one animation frame.
- Scrubbing/trimming/transforms stay responsive on representative projects.
- Every animation is interruptible and ends in valid state.
- Every pointer action has a keyboard-accessible path.

## 6. Build order

### P0 — Product contract and workspace prototypes

- [ ] Approve one engine with Assist and Studio workspaces.
- [ ] Approve names and talking-head/YouTube creators as the first complete workflow.
- [ ] Explicitly defer cinema VFX, finishing, DAW, and plugin parity not needed for that workflow.
- [ ] Wireframe Assist states: empty, interpreting, proposal, preview, applying, error, done.
- [ ] Wireframe Studio layout and panel hierarchy.
- [ ] Prototype workspace switching and state-continuity behavior.
- [ ] Define design, motion, accessibility, and reduced-motion tokens.
- [ ] Create a capability parity matrix with domain, UI, preview, export, AI, evidence, and owner-approval columns.
- [ ] Obtain owner approval before feature implementation.

**Exit:** no open decision could create two project models or two engines.

### P1 — General NLE foundation

- [ ] Design Project vNext for sequences, typed tracks, clip instances, linked media, gaps, effects, and automation.
- [ ] Define source-time to sequence-time mapping, including future retiming.
- [ ] Add multiple sequences and general video/audio tracks.
- [ ] Add append, insert, overwrite, linked A/V, track routing/locking/mute/solo/sync-lock.
- [ ] Add selection, snapping, markers, ranges, and playhead contracts.
- [ ] Add ripple, roll, slip, slide, lift, extract, J/L cuts, match frame, and replace.
- [ ] Add source in/out and three-point editing.
- [ ] Add bins, metadata, relink, duplicate detection, and waveform peaks.
- [ ] Compile the same sequence to browser preview and FFmpeg export.
- [ ] Migrate current projects fail-closed.
- [ ] Prove multiple real phone clips, separate audio, stills, music, gaps, and overlapping tracks.

**Exit:** a competent editor can manually assemble/export a multi-clip talking-head video without AI.

### P2 — Dual-workspace editor shell

- [ ] Build shared editor shell and workspace-state contract.
- [ ] Build Assist canvas/conversation/annotation/proposal layout.
- [ ] Build Studio bin/timeline/inspector/effects/meters/keyframes layout.
- [ ] Preserve project semantics and state while switching.
- [ ] Make every Studio edit emit typed operations.
- [ ] Show affected objects/properties for every Assist proposal.
- [ ] Add inspect, modify in Studio, accept, reject, pause, cancel, and undo.
- [ ] Validate accessibility and owner workflow.

**Exit:** the same project moves between Assist and Studio without conversion, loss, or history drift.

### P3 — Talking-head intelligence, audio, and captions

- [ ] Connect one real transcription provider through consent/refusal boundaries.
- [ ] Add speaker-aware transcript and real Stage 1 evidence.
- [ ] Add text-based editing mapped to deterministic cuts.
- [ ] Add silence, filler, repetition, and false-start suggestions with thresholds.
- [ ] Add caption editing/styling/import/export UI and RTL/CJK fixtures.
- [ ] Add waveforms, meters, automation, loudness, dialogue EQ/compression/limiting.
- [ ] Add denoise/voice isolation and music ducking with before/after preview.
- [ ] Connect one real AI provider only after deterministic operations pass.
- [ ] Measure acceptance, repair, export fidelity, latency, and cost on real videos.

**Exit:** a non-editor can create a clean, captioned, audible rough cut in minutes with reviewable AI decisions.

### P4 — Creator visual toolkit

- [ ] Direct transform/crop/mask handles and precision inspector.
- [ ] Keyframe timeline and curve editor.
- [ ] Speed/duration, reverse, freeze, and ramps.
- [ ] Stabilization and lens correction.
- [ ] Tracking reusable by masks, blur, text, and overlays.
- [ ] Background removal and chroma key with manual correction.
- [ ] Blend modes, mattes, and adjustment layers.
- [ ] Ordered effect stack, presets, copy/paste, transition library.
- [ ] Full typography, shapes, and reusable creator templates.
- [ ] Managed basic color, scopes, exposure, wheels, curves, and LUTs.
- [ ] Auto reframe as a proposal over deterministic tracking/crop operations.

**Exit:** common polished creator-video work is complete manually and AI-assistable.

### P5 — Professional workflow depth

- [ ] Proxies, optimized media, cache, and background analysis.
- [ ] Multicam sync/switching.
- [ ] Nested sequences, groups, compound clips, and adjustment structures.
- [ ] Search, metadata, scene detection, transcript search.
- [ ] Shortcut maps and saved Studio layouts.
- [ ] Audio mixer, buses, recording, and restoration depth.
- [ ] HDR/wide-gamut/10-bit preview/export.
- [ ] Export presets, batch outputs, captions, stems, and quality control.
- [ ] Version comparison and review comments.

**Exit:** advanced editors can finish routine creator work without another NLE.

### P6 — Expand AI across stable manual capabilities

- [ ] Require every AI action to map to registered typed capabilities.
- [ ] Add planner decomposition, dependencies, budgets, cancellation, and selective repair.
- [ ] Add visible activity and operation diffs.
- [ ] Ground context in selection, playhead, annotations, transcript, assets, and preferences.
- [ ] Add B-roll, highlights, reframe, cleanup, and shot match only after their primitives are stable.
- [ ] Add per-capability datasets and fail-closed thresholds.
- [ ] Measure false edits, missed intent, acceptance, repair, rollback, latency, and cost.
- [ ] Never claim global near-100% accuracy; approve bounded capability evidence and retain review when uncertain.

### P7 — Advanced finishing, only with demand

- [ ] Node-based advanced color.
- [ ] Advanced roto, planar/camera tracking, 3D, and particles.
- [ ] ADR, Foley, surround, and spatial audio.
- [ ] Sandboxed video/audio plugin platform.
- [ ] Distributed GPU rendering.

### P8 — Production SaaS and collaboration

- [ ] Authentication, organizations, roles, and isolated tenancy.
- [ ] Resumable uploads and content-addressed cloud storage.
- [ ] Hosted rendering, quotas, and cost controls.
- [ ] Review links, comments, approvals, and notifications.
- [ ] Conflict-safe shared projects.
- [ ] Billing after usage units/costs are measured.
- [ ] Security, privacy, deletion, audit, abuse, backup, and recovery gates.

## 7. Consequences and guardrails

### Two separate editors

- First order: duplicated state/UI.
- Second: AI and manual output differ.
- Third: fixes/migrations/render parity must be repeated.
- Fourth: projects change meaning when modes switch.

**Guardrail:** one engine, two workspaces.

### AI before manual primitives

- First order: fast demo.
- Second: prompt-specific, hard-to-repair behavior.
- Third: preview/export and intent diverge.
- Fourth: model changes break editing.

**Guardrail:** deterministic manual capability first; AI mapping second.

### Attempting all competitor features immediately

- First order: feature count rises.
- Second: every feature remains shallow.
- Third: maintenance/render/UX complexity multiplies.
- Fourth: no complete workflow becomes trustworthy.

**Guardrail:** finish the creator/talking-head wedge, then expand by measured demand.

### Treating Apple-like as glass and bouncing

- First order: fashionable screenshots.
- Second: footage/timeline lose contrast.
- Third: precision slows and motion tires users.
- Fourth: advanced editors reject it.

**Guardrail:** use Apple’s hierarchy, continuity, craft, restraint, and accessibility—not indiscriminate surface styling.

## 8. Completion law

A capability is complete only when:

- schema/operation is versioned;
- invalid input fails closed;
- undo/redo and migration are defined;
- manual UI creates and repairs it;
- Assist proposes it through the same capability;
- browser preview and native export agree within stated tolerances;
- representative real media passes;
- performance/failure behavior is observable;
- accessibility is defined;
- documentation/checklists match evidence;
- the owner approves experiential gates.

Near-100% accuracy is a direction, not an honest global claim. Measure accuracy per bounded capability and dataset. Refuse, fail closed, or request review when evidence is insufficient.

## 9. Immediate next decision

Do not add random effects next. Approve or modify:

1. one engine with Assist and Studio;
2. talking-head/YouTube creators as the first complete workflow;
3. P1 general NLE foundation as the next implementation phase;
4. explicitly deferred cinema/VFX/DAW parity;
5. Apple-like principles and restrained motion/material rules.

After approval, write the atomic P1 implementation plan against actual schemas/files. Do not implement P2-P8 in the same batch.

## 10. Official research basis

- DaVinci Resolve: <https://www.blackmagicdesign.com/products/davinciresolve> and <https://www.blackmagicdesign.com/products/davinciresolve/edit>
- Adobe Premiere: <https://www.adobe.com/products/premiere/features.html>, <https://helpx.adobe.com/premiere/desktop/whats-new/release-notes.html>, and <https://helpx.adobe.com/premiere/desktop/organize-media/ingest-proxy-workflow/export-proxies.html>
- CapCut: <https://www.capcut.com/resource/how-to-use-capcut>, <https://www.capcut.com/resource/pc-professional-video-editor>, and <https://www.capcut.com/resource/multicam-editing>
- Apple Human Interface Guidelines: <https://developer.apple.com/design/human-interface-guidelines/design-principles>, <https://developer.apple.com/design/human-interface-guidelines/motion>, <https://developer.apple.com/design/human-interface-guidelines/materials>, and <https://developer.apple.com/design/human-interface-guidelines/accessibility>
