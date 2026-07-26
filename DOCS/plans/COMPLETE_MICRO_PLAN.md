# Complete Stage 2 Micro Implementation Plan

> **For the implementer:** Whether Codex, Claude, or a human engineer, execute
> one approved task at a time and preserve every gate, test, and rollback rule.

**Status:** Proposed for owner approval. This document plans all known goals;
it does not authorize implementation.

**Goal:** Translate `DOCS/MASTER_PLAN.md` into ordered, test-first task packets
that Codex, Claude, or another implementer can execute without reconstructing
the product from chat.

**Architecture:** One modular monolith, a pure edit domain, a renderer-neutral
plan, provider/storage/render adapters, progressively disclosed React UI, and
evidence-gated branches. Every capability is a vertical slice.

**Tech Stack:** TypeScript, React, Node, Vitest, FFmpeg/ffprobe, JSON project
files, Windows PowerShell, later replaceable provider/cloud adapters.

---

## 0. Completed-plan lineage

Completed work is not rewritten as if it were still future work. Its original
plans and current evidence remain:

| Goal | Historical plan/evidence authority | Current boundary |
|---|---|---|
| G0 Foundation | `2026-07-12-stage2-master-plan.md`, requirements, decisions, governance, Git evidence | Complete |
| G1 Interface/renderer | `2026-07-12-g1-interface-renderer-spike.md`, `2026-07-12-g1-runnable-web-shell.md`, renderer ADR/runs | Technical work exists; owner motion/native drag-and-drop/Studio acceptance remains open |
| G2 Project foundation | `2026-07-13-first-pointed-nameplate-loop.md`, build tracker, change records | Complete for the narrow v1 nameplate foundation |
| G3 Closed manual slice | `2026-07-13-first-pointed-nameplate-loop.md`, current state, real-browser/export evidence | Complete |

Do not re-execute completed plans unless a regression or migration task
explicitly requires it. Do not close the remaining G1 owner gate by inference.

## 1. How to execute this document

1. Read `START_HERE.md`, `DOCS/CURRENT_STATE.md`, `DOCS/MASTER_PLAN.md`, and
   `DOCS/plans/PLAN_CHECKLIST.md`.
2. Confirm the owner approved entry into exactly one goal.
3. Read only that goal section plus the cross-cutting plan.
4. Select the highest-impact unchecked task that blocks the active goal's next
   user-visible or invariant evidence. Record non-blocking discoveries instead
   of chasing them.
5. Turn that task packet into 2-5 minute actions:
   - write one failing test;
   - run it and record the expected failure;
   - write the minimum implementation;
   - run the focused test;
   - refactor without changing behavior;
   - apply the architecture-quality gate in `DOCS/MASTER_PLAN.md`;
   - run the broader relevant boundary;
   - update evidence;
   - commit one coherent change.
6. Never start a later goal because a future file is mentioned here.
7. If code or real media disproves the plan, stop, record the evidence, and
   revise the plan before continuing.

## 2. Universal per-task acceptance cycle

Every production task follows:

```text
requirement
  -> decision
  -> observable acceptance criterion
  -> failing test
  -> minimal implementation
  -> focused pass
  -> relevant integration pass
  -> real-media/browser evidence when user-visible
  -> limitation/failure record
  -> coherent commit
```

Minimum commands, adjusted to the active package:

```powershell
npm run test -w @sanverse/edit-domain -- <focused-test>
npm run test -w @sanverse/render-contract -- <focused-test>
npm run test -w @sanverse/api -- <focused-test>
npm run test -w @sanverse/web -- <focused-test>
npm test
npm run build
git diff --check
```

Never convert FAIL-011 sandbox blocking into a pass. Run child-process-dependent
commands in normal PowerShell and record the real result.

## 3. G4-A - Scale-ready chassis

The complete file-level and test-level plan is:

`DOCS/plans/G4A_ATOMIC_IMPLEMENTATION_PLAN.md`

Do not duplicate or paraphrase it here. G4-A closes before real AI integration.

## 4. G4-B - First safe AI-operated nameplate

### Goal contract

User points or pauses, writes a natural request, receives either clarification
or one concrete nameplate proposal, repairs it if needed, approves it, and
exports it. Provider output cannot bypass deterministic validation.

### Planned files

#### Pure intent contract

- Create: `packages/intent-domain/package.json`
- Create: `packages/intent-domain/tsconfig.json`
- Create: `packages/intent-domain/src/intent-request.ts`
- Create: `packages/intent-domain/src/intent-candidate.ts`
- Create: `packages/intent-domain/src/clarification.ts`
- Create: `packages/intent-domain/src/evaluation.ts`
- Test: matching `*.test.ts`

#### API intent boundary

- Create: `apps/api/src/intent/intent-port.ts`
- Create: `apps/api/src/intent/fake-intent-adapter.ts`
- Create: `apps/api/src/intent/intent-service.ts`
- Create: `apps/api/src/intent/outbound-data-policy.ts`
- Test: matching `*.test.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/server.test.ts`

#### Browser conversation and repair

- Create: `apps/web/src/features/conversation/conversation-client.ts`
- Create: `apps/web/src/features/conversation/ChatComposer.tsx`
- Create: `apps/web/src/features/conversation/ChatComposer.css`
- Create: `apps/web/src/features/proposal-repair/NameplateRepair.tsx`
- Create: matching tests
- Modify: `apps/web/src/app/app-state.ts`
- Modify: `apps/web/src/screens/studio/StudioScreen.tsx`
- Modify matching tests/styles

#### Evaluation fixtures

- Create: `fixtures/intent/nameplate-valid.json`
- Create: `fixtures/intent/nameplate-ambiguous.json`
- Create: `fixtures/intent/nameplate-adversarial.json`
- Create: `DOCS/evaluations/nameplate-intent-v1.md`

### Task G4B-01: Specify user input and context

Define one bounded `IntentRequest` containing:

- opaque request ID;
- project ID and base revision;
- user message;
- optional selected clip/time/point;
- available capability IDs and versions;
- locale;
- no filesystem paths;
- no raw project JSON;
- no media bytes by default.

Tests reject oversized text, missing revision, unknown context fields, invalid
coordinates, and unapproved capability IDs.

### Task G4B-02: Specify untrusted candidate output

Candidate states are exactly:

- `proposal-candidate`;
- `clarification-required`;
- `unsupported`;
- `provider-failure`.

A proposal candidate contains a capability ID/version and raw arguments. It is
not an accepted operation or render plan.

### Task G4B-03: Build the fake provider

The fake adapter returns deterministic fixtures for:

- fully specified request;
- missing main text;
- missing target;
- unclear timing;
- unsupported request;
- malicious attempt to inject renderer commands;
- stale base revision.

The fake proves orchestration without requiring any key or network.

### Task G4B-04: Build the deterministic intent service

Order is fixed:

1. validate request;
2. load exact project revision;
3. intersect requested capability with registry;
4. call provider adapter;
5. treat output as untrusted;
6. validate candidate schema;
7. resolve clarification or unsupported state;
8. construct canonical operation;
9. validate operation against project bounds;
10. construct pending change set;
11. return previewable proposal only.

Any failure before step 10 returns no pending operation.

### Task G4B-05: Add clarification

Clarification asks only for missing facts that change the operation:

- what text;
- where;
- when;
- how long;
- which selected object or clip.

It does not ask broad conversational questions when a safe deterministic
default is owner-approved and visible in preview.

### Task G4B-06: Add direct repair

The user can change:

- primary/secondary text;
- point/anchor;
- visible interval;
- component style version where more than one exists.

Repair revalidates the proposal and retains provenance. It does not call the
provider again unless the user explicitly requests reinterpretation.

### Task G4B-07: Add conversation UI

Replace the disabled placeholder only after fake-provider integration passes.
Required states:

- ready;
- sending;
- clarification;
- invalid response;
- unsupported;
- proposal ready;
- proposal repaired;
- provider unavailable;
- stale proposal;
- accepted;
- discarded.

One primary action per state. Technical provider names remain hidden unless
diagnostics require them.

### Task G4B-08: Add prompt/evaluation corpus

Include at minimum:

- concise natural language;
- misspellings;
- pronouns tied to point context;
- conflicting time instructions;
- request outside source duration;
- very long text;
- empty text;
- unsupported edit;
- prompt injection;
- request for shell/file access;
- duplicate/replayed response;
- response for stale revision.

Record expected product behavior, not expected model prose.

### Task G4B-09: Add outbound data allowlist

Before any real provider:

- enumerate every outbound field;
- exclude media bytes and private paths by default;
- redact local filenames unless required and approved;
- bound text/context;
- store key only in ignored environment/OS secret storage;
- add request timeout and cancellation;
- log safe metadata, never secrets or raw private content by default.

### Task G4B-10: Connect one real provider

Provider choice is an adapter decision, not a domain decision. Probe:

- structured-output support;
- schema adherence;
- latency;
- error shape;
- timeout;
- cancellation;
- quota/rate behavior;
- terms relevant to development use.

Do not add automatic blind retries. A bounded retry is allowed only for
transport/transient failures and must never duplicate proposal acceptance.

### G4-B verification

- Focused intent-domain tests.
- Fake-provider API integration.
- Browser state tests.
- Prompt corpus evaluation report.
- Provider-switch contract.
- Stale-revision race test.
- Real browser: request, clarify, preview, repair, approve, reopen, export.
- Real output probe and frame inspection.

### G4-B exit

The owner completes the workflow and confirms that uncertainty is visible,
repair is easier than starting over, and the output matches the approved
creative-quality contract.

## 5. G5-A - Deterministic captions and speech metadata

### Goal contract

Captions are an early-value branch. Caption creation from trusted transcript
data is deterministic and does not require AI.

### Planned files

- Create: `packages/edit-domain/src/transcript.ts`
- Create: `packages/edit-domain/src/operations/captions.ts`
- Create: matching tests
- Create: `apps/api/src/transcript/transcript-port.ts`
- Create: `apps/api/src/transcript/stage1-sidecar-adapter.ts`
- Create: `apps/api/src/transcript/transcription-adapter.ts`
- Create: `apps/api/src/transcript/transcript-service.ts`
- Create: matching tests
- Create: `packages/render-contract/src/caption-style.ts`
- Create: `packages/render-contract/src/caption-nodes.ts`
- Create: matching tests
- Create: `apps/web/src/features/captions/CaptionEditor.tsx`
- Create: `apps/web/src/features/captions/CaptionTrack.tsx`
- Create: `apps/web/src/features/captions/*.css`
- Create: matching tests
- Modify renderer adapters and Studio integration

### Task G5A-01: Define sidecar intake

Minimum accepted sidecar:

- schema/version;
- source asset hash;
- language;
- ordered words;
- word text;
- source-time start/end;
- confidence when supplied;
- provenance;
- optional speaker.

Reject hash mismatch, overlapping invalid ranges, reversed time, impossible
duration, unknown executable fields, excessive size, and untrusted HTML.

### Task G5A-02: Build Stage 1 adapter

Read only an explicitly supplied sidecar. Do not read Stage 1's internal
database or mutate its files. Translate into the Stage 2 transcript contract.

### Task G5A-03: Add optional transcription adapter

Define a replaceable port. Local/cloud provider is chosen later. Store
provenance and source hash so stale transcripts cannot attach to another video.

### Task G5A-04: Segment captions deterministically

Segment using bounded rules:

- maximum characters/words;
- punctuation;
- silence gaps;
- minimum/maximum display duration;
- reading-speed budget;
- no segment outside source duration.

Rules are style-profile versions, not hidden constants.

### Task G5A-05: Add caption operations

Operations include:

- insert generated caption track;
- edit caption text;
- split/merge segment;
- move segment boundary;
- set approved style;
- enable/disable segment.

Every operation targets stable IDs and a project revision.

### Task G5A-06: Add caption rendering

Canonical style defines font asset, case policy, size, line wrapping, safe
area, active-word treatment, background, and vertical placement.

Preview/export fixtures include portrait/landscape, long word, punctuation,
emoji/non-Latin where supported, edge cases, and mobile-size readability.

### Task G5A-07: Add caption UI

Default UI shows readable transcript/caption rows and the current segment.
Advanced timing appears only during correction. No professional subtitle
terminology is required for the default flow.

### Task G5A-08: Add timeline invalidation contract

When later cuts alter time:

- source-linked words remain tied to source time;
- composition caption segments are recomputed or marked stale;
- manual corrections preserve provenance;
- no caption silently shifts to different speech.

### G5-A exit

The owner exports a representative captioned video that meets timing,
readability, creative-quality, fidelity, and recovery gates.

## 6. G5-B - Timeline and editorial primitives

### Planned files

- Create: `packages/edit-domain/src/operations/timeline.ts`
- Create: `packages/edit-domain/src/timeline-evaluator.ts`
- Create: matching tests
- Extend: `packages/edit-domain/src/composition.ts`
- Create: `packages/render-contract/src/timeline-plan.ts`
- Create: matching tests
- Create: `apps/web/src/features/timeline/SimpleTimeStrip.tsx`
- Create: `apps/web/src/features/timeline/TimeSelection.tsx`
- Create matching CSS/tests
- Modify API render compiler/adapters

### Task G5B-01: Define timeline invariants

- Stable IDs never encode array positions.
- Source ranges remain inside assets.
- Composition starts are non-negative.
- Track overlap policy is explicit per track kind.
- Output duration is derived.
- Audio/video linkage is explicit.
- All calculations use rational time.
- VFR sources retain source PTS mapping or use a documented conform step.

### Task G5B-02: Implement time selection

Selection is a half-open composition range. UI drag, transcript selection, and
chat all produce the same typed selection.

### Task G5B-03: Implement split

Split one clip into two clips at a valid interior point. Preserve source
coverage exactly; reject boundary/no-op splits; update dependent anchors.

### Task G5B-04: Implement trim

Adjust source in/out while preserving composition placement according to the
chosen edge. Reject negative or zero duration.

### Task G5B-05: Implement remove and ripple delete

Two explicit operations:

- remove-with-gap leaves composition time unchanged;
- ripple-delete shifts eligible later clips by the removed duration.

Never infer which behavior the user meant when the request is ambiguous.

### Task G5B-06: Implement reorder

Define collision and gap behavior before moving clips. Recompute dependent
composition anchors and surface blocked dependencies.

### Task G5B-07: Implement clip enable/disable

Non-destructive temporary exclusion is distinct from deletion.

### Task G5B-08: Implement basic audio

Start with clip gain and bounded fade-in/fade-out. Cuts require an explicit
audio conform strategy; do not rely on `-c:a copy` for arbitrary frame-accurate
editorial output.

### Task G5B-09: Implement the simple time strip

Default controls:

- playhead;
- selected moment/range;
- clip blocks;
- accepted edit markers;
- captions where present;
- undoable actions.

Advanced multitrack controls remain hidden until the user needs them.

### Task G5B-10: Compile and render

Browser and export consume the same evaluated composition. Fixtures cover:

- 23.976/29.97/30 fps;
- VFR;
- portrait and landscape;
- source shorter/longer than composition;
- audio/no audio;
- cut at exact boundary;
- one-frame selections;
- repeated split/undo/redo;
- captions after ripple.

### G5-B exit

Owner completes a real pacing edit without needing NLE terminology; the source
hash is unchanged and output timing/audio are inspected.

## 7. G5-C - Useful talking-head workflow

### Planned files

- Create: `packages/edit-domain/src/operations/assets.ts`
- Create: `packages/edit-domain/src/operations/overlays.ts`
- Create: `packages/edit-domain/src/operations/audio.ts`
- Create: `packages/intent-domain/src/spatial-annotation.ts`
- Create matching tests
- Extend render contract with image/video overlay nodes
- Create: `apps/web/src/features/assets/AssetPicker.tsx`
- Create: `apps/web/src/features/annotation/AnnotationSurface.tsx`
- Create: `apps/web/src/features/annotation/annotation-transform.ts`
- Create: `apps/web/src/features/callouts/CalloutRepair.tsx`
- Create: `apps/web/src/features/audio/BasicAudioControls.tsx`
- Create matching tests/styles
- Extend API intake/render services

### Task G5C-01: Define representative workflow

Owner supplies one real cleaned video and states the desired finished outcome.
Record the manual baseline time and required operations before implementation.

### Task G5C-02: Add multi-asset intake

Accept bounded image/video/audio assets into the controlled project repository.
Validate type, bytes, hash, metadata, duplicates, lifecycle, and path safety.

### Task G5C-02A: Add rough spatial annotation as intent

This is how a non-editor can point, circle, box, arrow, or roughly sketch
"here" without learning coordinates.

Define a versioned `SpatialAnnotation` that contains:

- opaque annotation ID;
- project revision and selected clip/object context;
- media/composition time anchor;
- tool kind: point, freehand stroke, rectangle, ellipse, or arrow;
- ordered normalized points;
- optional color used only to distinguish simultaneous annotations;
- capture viewport and video-content rectangle needed to prove the transform;
- creation order and optional short user label;
- bounded point count, payload bytes, and lifetime.

Rules:

- annotation geometry is intent evidence, not an executable edit;
- black bars, responsive scaling, portrait media, zoom, and fullscreen must not
  change normalized targeting;
- pointer positions outside the rendered video content are rejected;
- simplifying a freehand stroke must preserve endpoints and declared tolerance;
- the user can undo the last stroke, erase, clear, select, and relabel;
- a keyboard-accessible alternative can target a selected object or nine-way
  region without drawing;
- annotations are sent to a provider only through the outbound allowlist;
- a provider may reference annotation IDs but cannot invent trusted geometry;
- annotations are not included in export unless the user explicitly converts
  one into a supported visible component;
- stale-revision annotations require revalidation or recapture.

Tests cover landscape, portrait, letterbox/pillarbox, responsive resize,
device-pixel ratio, paused/playing time capture, outside-video rejection,
stroke simplification, payload limits, undo/clear, stale revision, and
provider-reference validation.

Browser evidence covers: pause, circle a person/object, write a request, see
the annotation attached to the request, receive a proposal at the intended
target, clear the mark, and confirm the mark is absent from export.

### Task G5C-03: Add overlay clips

Insert image/video B-roll with explicit composition interval, layer, fit mode,
crop, and audio policy.

### Task G5C-04: Add titles and callouts

Use versioned components built from text/shape primitives. Apply creative
quality references and direct repair.

### Task G5C-05: Combine the workflow

One project must safely contain cuts, captions, nameplates, callouts, B-roll,
and basic audio. Each edit family remains independently removable.

### Task G5C-06: Progressive Studio integration

The canvas and conversation remain primary. The time strip grows only enough
to repair the current operation. No panel appears merely because a primitive
exists.

### Task G5C-07: Full real-video evidence

Measure:

- time to start;
- time to first accepted edit;
- total time to export;
- number of clarifications;
- number and time of repairs;
- preview/export mismatches;
- failures and recoveries;
- owner quality verdict.

### G5-C exit

The owner confirms the first genuinely useful prototype materially reduces
manual editing time and produces acceptable output.

## 8. G6 - Composition, motion, and effects

### Planned files

- Create: `packages/edit-domain/src/animation.ts`
- Create: `packages/edit-domain/src/easing.ts`
- Create: `packages/edit-domain/src/operations/transform.ts`
- Create: `packages/edit-domain/src/operations/motion.ts`
- Create: `packages/edit-domain/src/operations/effects.ts`
- Create matching tests
- Extend render-contract animation nodes
- Create: `apps/web/src/features/motion/MotionRepair.tsx`
- Create: `apps/web/src/features/motion/KeyframeStrip.tsx`
- Create matching tests/styles
- Extend or replace render adapters behind existing port

### Task G6-01: Define transform properties

Position, scale, rotation, opacity, crop, layer order, and masks use explicit
coordinate spaces, bounds, defaults, and compositing order.

### Task G6-02: Define keyframes

Keyframes target one property and one stable object ID. Duplicate times,
unsupported interpolation, out-of-range values, and invalid object lifecycles
fail closed.

### Task G6-03: Define easing

Start with linear, step, cubic-bezier, and owner-approved presets. Serialize
parameters, not CSS class names.

### Task G6-04: Define springs

Specify mass, stiffness, damping, initial velocity, settling threshold, and
duration/termination policy. The browser and final renderer must evaluate the
same sampled or analytic curve.

### Task G6-05: Define transitions

Transitions are bounded relationships between adjacent/overlapping clips.
Audio transition behavior is explicit.

### Task G6-06: Define the bounded initial effects allowlist

Start only with effects that serve an approved real workflow, selected from:

- grayscale;
- brightness/exposure adjustment with declared transfer semantics;
- contrast;
- saturation;
- bounded blur;
- drop shadow;
- background dim behind text/callouts.

Every effect declares target type, parameter units/range/defaults, evaluation
order, alpha/color-space behavior, GPU/CPU support, preview fallback, and
unsupported behavior. Effects are pure serialized parameters, not arbitrary
shader, CSS, FFmpeg, or shell fragments.

HDR-aware grading, LUT pipelines, chroma key, particles, generative fill,
beauty filters, noise reduction, stabilization, and rotoscoping remain
deferred until a user workflow and renderer evidence justify them.

### Task G6-07: Re-evaluate renderer architecture

Use approved fixtures:

- static text;
- multiline captions;
- transform;
- easing;
- spring/bounce;
- transition;
- layered video/audio.

Measure fidelity, seek behavior, determinism, performance, portability,
deployment/security cost, and implementation duplication. ADR-001 is reopened
only with evidence.

### Task G6-08: Build repair UI

User chooses plain outcomes such as subtle, smooth, bouncy, or none. Advanced
curves/keyframes are progressively disclosed.

### G6 exit

Owner approves motion feel in both preview and exported media. Tests prove
seekable deterministic curves and safe failure.

## 9. G7 - Versioned components and compound AI

### Planned files

- Create: `packages/component-domain/package.json`
- Create: `packages/component-domain/tsconfig.json`
- Create: `packages/component-domain/src/component.ts`
- Create: `packages/component-domain/src/recipe.ts`
- Create: `packages/component-domain/src/compatibility.ts`
- Create: `packages/component-domain/src/migrations.ts`
- Create matching tests
- Extend intent-domain with workflow planning
- Create: `apps/api/src/planning/compound-plan-service.ts`
- Create matching tests
- Create: `apps/web/src/features/compound-proposal/CompoundProposal.tsx`
- Create: `apps/web/src/features/compound-proposal/CompoundRepair.tsx`
- Create matching tests/styles

### Task G7-01: Define component contract

Component contains:

- stable component ID;
- version;
- input schema;
- primitive recipe;
- style dependencies;
- capability dependencies;
- migration/compatibility declaration;
- preview fixture;
- creative-quality reference.

### Task G7-02: Build initial components

Nameplate, captions, callout, title, and bouncy-title recipes use existing
primitives. They do not add hidden renderer behavior.

### Task G7-03: Add compatibility and migration

Saved projects retain the component version they accepted. New defaults do not
silently restyle old projects.

### Task G7-04: Define outcome workflow planning

Planner selects workflow/component capabilities, then deterministic expansion
produces primitives. Raw model output never supplies arbitrary primitive lists
without validation.

### Task G7-05: Add compound change sets

All operations validate against one base revision. Either the entire proposal
becomes pending or it fails/clarifies. Acceptance is atomic.

### Task G7-06: Add dependency-aware clarification and repair

User can repair one part without forcing reinterpretation of correct parts.
The proposal shows what, where, when, why, and dependencies.

### G7 exit

One natural request produces a multi-edit proposal; the owner repairs one part,
accepts once, undoes once, reopens, and exports the expected result.

## 10. G8 - Trustworthy local alpha

### Planned files

- Create: `apps/api/src/jobs/job-port.ts`
- Create: `apps/api/src/jobs/local-job-repository.ts`
- Create: `apps/api/src/jobs/local-job-runner.ts`
- Create matching tests
- Create: `apps/api/src/projects/project-archive-service.ts`
- Create matching tests
- Create: `apps/api/src/diagnostics/diagnostics-service.ts`
- Create matching tests
- Create: `apps/web/src/features/jobs/JobProgress.tsx`
- Create: `apps/web/src/features/recovery/RecoveryPanel.tsx`
- Create matching tests/styles
- Create: `DOCS/ALPHA_EVIDENCE_MATRIX.md`

### Task G8-01: Freeze alpha workflows and budgets

Define representative videos, operations, device/browser, expected output,
time budget, recovery budget, and quality rubric. No invented percentage.

### Task G8-02: Autosave and crash recovery

Persist accepted state atomically after every committed change set. Recover
pending local jobs and last valid project state. Never auto-accept proposals.

### Task G8-03: Resumable local jobs

Jobs have stable ID, project revision, idempotency key, status, bounded
progress, cancellation, result, error, and cleanup. Restart either resumes
supported work or fails visibly without corrupting the project.

### Task G8-04: Project portability

Export/import a project archive containing project JSON, manifest, controlled
assets or portable references, hashes, component versions, and compatibility
report. Reject traversal, symlinks, corrupt hashes, and unsupported actions.

### Task G8-05: Performance and proxy strategy

Measure first. Add proxies/caches only for the largest proven bottleneck.
Every cache key includes source identity, project revision, render-plan version,
and relevant renderer/style version.

### Task G8-06: Media lifecycle

Define active projects, abandoned stages, exports, caches, backups, and user-
requested deletion. Never delete original external source media.

### Task G8-07: Diagnostics

Expose safe local diagnostics: app version, project version, renderer
availability, job state, safe error code, and recovery instructions. Do not
expose secrets or private paths by default.

### Task G8-08: Accessibility

Keyboard-only workflow, focus management, screen-reader names, contrast,
reduced motion, captions, error announcements, and touch target checks.

### Task G8-09: Repeated real use

Run owner and bounded representative non-editor workflows. Watch behavior,
record attempted actions and stops, and do not coach during smoke tests.

### G8 exit

Agreed workflows reach E5. Local alpha is not declared from test counts alone.

## 11. G9 - API and MCP branch

### Entry gate

Do not create public surfaces until G8 schemas are stable and an external
client has a concrete job.

### Planned modules

- `packages/public-contract`
- `apps/api/src/public`
- `apps/api/src/auth`
- `apps/api/src/idempotency`
- `apps/mcp`

Exact framework/package choices are made at G9 entry using current supported
standards; freezing them now would be fake precision.

### Task packets

1. Inventory internal capabilities safe for external exposure.
2. Version project/proposal/job/result schemas.
3. Define authentication and authorization.
4. Define idempotency keys and replay behavior.
5. Define async job status/cancel/result.
6. Define capability discovery.
7. Ensure approval policy cannot be bypassed.
8. Add audit and abuse boundaries.
9. Build one client fixture and one MCP workflow.
10. Run contract, security, compatibility, and failure tests.

## 12. G10 - Production SaaS branch

### Entry gate

Requires owner approval, G8 evidence, a multi-user launch plan, deployment
target, data regions, retention needs, and current legal/security review.

### Workstreams

#### Task G10-01: Freeze the SaaS threat and trust model

- Draw user, browser, API, database, object storage, queue, worker, provider,
  administrator, and observability boundaries.
- List assets, attackers, abuse cases, legal/data-region constraints, and
  explicit non-goals.
- Define source-media immutability and accepted-change durability in cloud
  failure scenarios.
- Exit: reviewed threat model and prioritized mitigations exist.

#### Task G10-02: Add identity and session contracts

- Define user identity, verified contact, session creation/rotation/revocation,
  recovery, device/session visibility, and MFA decision.
- Use a replaceable identity adapter; domain ownership must not depend on vendor
  token shapes.
- Test expired, revoked, replayed, forged, and cross-user sessions.
- Exit: unauthenticated access fails closed and recovery does not bypass
  ownership.

#### Task G10-03: Add tenancy and authorization

- Add tenant, membership, role, project owner, asset owner, job owner, and audit
  actor IDs.
- Centralize authorization checks for read, propose, approve, render, download,
  delete, invite, and administer.
- Deny by default; never trust IDs supplied by a browser or AI provider.
- Test horizontal and vertical privilege escalation for every resource type.
- Exit: cross-tenant isolation evidence passes at API, storage, queue, and log
  boundaries.

#### Task G10-04: Add transactional metadata persistence

- Select the database only after deployment and operating constraints are
  known.
- Define transactional project revision, change set, asset manifest, render
  job, export, audit event, and idempotency records.
- Add forward migration, compatibility window, backup, rollback, and
  destructive-change prohibition.
- Test retry, conflict, partial failure, migration, and restore.
- Exit: accepted edits and job state cannot be half-committed.

#### Task G10-05: Add cloud object storage

- Use opaque object identities, scoped signed access, server-side validation,
  encryption, quarantine, and lifecycle rules.
- Keep immutable sources separate from proxies, temporary renders, and
  published exports.
- Verify checksum during intake, transfer, worker fetch, output publication, and
  restore.
- Test traversal-equivalent key attacks, unauthorized signed URLs, multipart
  interruption, duplicate upload, and cleanup.
- Exit: media access is authorized, integrity-checked, auditable, and
  recoverable.

#### Task G10-06: Add durable render jobs and workers

- Define job state machine, lease, heartbeat, retry budget, cancellation,
  timeout, progress, idempotency key, and poison-job handling.
- Workers receive only the authorized render plan and scoped media handles.
- Publication is atomic and never overwrites an immutable prior export.
- Test worker death, duplicate delivery, lost acknowledgement, cancellation,
  provider failure, storage failure, and stale project revision.
- Exit: retries cannot duplicate charges, mutate history, or publish conflicting
  outputs.

#### Task G10-07: Add secret and encryption management

- Move production secrets to managed storage with least privilege, rotation,
  revocation, and access audit.
- Define encryption in transit, at rest, key ownership, key rotation, and
  emergency revocation.
- Prevent secret, token, media path, raw prompt, and sensitive transcript leakage
  in logs or client responses.
- Exit: automated secret scanning and rotation drill pass.

#### Task G10-08: Add production observability

- Define correlation IDs across request, project revision, change set, render
  plan, job, worker, provider call, and export.
- Define service-level indicators for availability, proposal latency, job
  latency, render success, recovery, and data integrity.
- Add structured redacted logs, metrics, traces, dashboards, alerts, runbooks,
  and ownership.
- Test alert delivery and verify diagnostics do not expose user media or secrets.
- Exit: a failed user workflow can be traced safely end to end.

#### Task G10-09: Define backups and disaster recovery

- Set owner-approved recovery point and recovery time objectives separately for
  metadata, source media, project history, and exports.
- Automate encrypted backups, retention, integrity checks, and restore
  environments.
- Run restore drills that reopen and render sampled projects.
- Exit: restore is proven, not merely configured.

#### Task G10-10: Add quotas and abuse controls

- Bound upload size/type/rate, project count, storage, provider calls, render
  duration/concurrency, export retention, and API use.
- Define safe rejection, wait, cancellation, and support paths.
- Detect decompression bombs, malicious media, prompt abuse, job floods, and
  cost amplification without silently blocking legitimate work.
- Exit: abuse simulations stay within agreed cost and availability budgets.

#### Task G10-11: Add deployment and release safety

- Define environments, infrastructure ownership, immutable builds, provenance,
  dependency scanning, schema compatibility, staged rollout, health checks,
  rollback, and feature kill switches.
- Separate application rollback from schema/data rollback.
- Test partial deployment, incompatible worker, degraded provider, and regional
  failure.
- Exit: a failed release can be contained without losing accepted work.

#### Task G10-12: Add data lifecycle and user rights

- Define collection purpose, consent, retention, export, deletion, legal hold,
  processor inventory, and audit.
- Ensure deletion covers metadata, objects, caches, jobs, logs where allowed,
  and provider copies according to contract.
- Test account export and deletion end to end with recorded exceptions.
- Exit: user-facing promises match actual storage and provider behavior.

#### Task G10-13: Establish incident response

- Define severity, on-call ownership, containment, evidence preservation,
  communication, recovery, post-incident review, and corrective-action tracking.
- Drill media exposure, credential leak, cross-tenant access, lost job queue,
  corrupted metadata, and unavailable renderer.
- Exit: tabletop and one technical recovery drill pass.

#### Task G10-14: Complete production-readiness review

- Re-run security, isolation, migration, load, failure, backup, restore,
  accessibility, privacy, and cost-boundary evidence.
- Record accepted risks, owner, expiry, monitoring, and mitigation.
- Require explicit owner launch approval.
- Exit: agreed launch workflows meet production evidence budgets.

Billing and pricing are intentionally excluded from this active planning
priority. If later authorized, billing must consume metered, idempotent usage
events and must never become the source of project or job truth.

Exact vendors and files remain intentionally undecided until entry because
those facts are time-sensitive and deployment-dependent.

## 13. G11 - Vision and tracking branch

### Entry gate

Requires repeated real requests where static/source-normalized targeting is
insufficient.

### Task packets

1. Define licensed representative dataset and target workflows.
2. Define object/track/segment IDs and coordinate transformations.
3. Add provider-neutral detection/tracking/segmentation ports.
4. Build deterministic fixture adapter before a model.
5. Add confidence and tracking-loss state.
6. Add occlusion and reappearance semantics.
7. Add direct user correction/reacquisition.
8. Compile track-linked edits to frame-time geometry.
9. Compare preview/export.
10. Evaluate false target, drift, loss, and recovery.
11. Connect one measured model only after the boundary passes.

## 14. G12 - Evaluation and specialized-model branch

### Entry gate

Requires informed consent, representative evaluation data, deletion policy,
and a repeatable weakness in general providers.

### Task packets

1. Define event taxonomy with minimum necessary data.
2. Separate product telemetry from model-training consent.
3. Record provenance for prompts, candidates, repairs, approvals, and outcomes.
4. Implement user export/deletion.
5. Build immutable evaluation snapshots.
6. Define offline metrics and human quality rubric.
7. Implement provider/model routing.
8. Run shadow evaluation without affecting accepted edits.
9. Prove material improvement before training.
10. Add staged rollout, monitoring, rollback, and regression gates.
11. Never retain raw media or transcripts for training by default.

## 15. Documentation closeout for every goal

Before marking a goal complete:

- update `DOCS/CURRENT_STATE.md`;
- update `DOCS/BUILD_TRACKER.md`;
- update `DOCS/PROJECT_LOG.md`;
- add a change record;
- update `DOCS/FAILURE_REGISTRY.md` for every discovered failure;
- update `DOCS/AOCS_BLACKBOARD.md` when an assumption becomes fact or is rejected;
- update `DOCS/plans/PLAN_CHECKLIST.md`;
- preserve obsolete plans as historical and mark supersession;
- record branch/commit/remote state;
- obtain owner approval for the next medium-to-large goal.
