# Stage 2 Roll-Up Plan Checklist

Status: **Proposed for owner approval**

This is the compact ticking surface. Do not put implementation explanations
here; link evidence and use `COMPLETE_MICRO_PLAN.md` for the atomic work.

Legend:

- `[x]` complete with recorded evidence
- `[ ]` not complete
- `E0-E5` use `DOCS/CHANGE_POLICY.md`

## Completed foundation

- [x] G0 requirements, decisions, anti-drift, Git, and remote baseline
- [ ] G1 final owner motion, native drag-and-drop, and Studio UX acceptance
- [x] G2 narrow v1 typed nameplate domain, history, persistence, and renderer boundary
- [x] G3 real manual nameplate loop through verified MP4 download

## G4-A - Scale-ready chassis

- [x] G4A-01 Approve the G4-A specification and scope
- [x] G4A-02 Freeze rational time and half-open range semantics
- [x] G4A-03 Freeze asset identity and metadata contract
- [x] G4A-04 Freeze composition, track, and clip contract
- [x] G4A-05 Freeze geometry and anchor contract
- [x] G4A-06 Freeze project revision and stale-proposal contract
- [x] G4A-07 Freeze atomic change-set and dependency contract
- [x] G4A-08 Freeze strict-core and preserved-extension policy
- [x] G4A-09 Freeze three-level capability contract
- [x] G4A-10 Freeze canonical render specification
- [x] G4A-11 Implement Project v2 domain through TDD
- [x] G4A-12 Implement v1-to-v2 migration, backup, idempotency, and rollback
- [x] G4A-13 Persist and reopen Project v2 safely
- [x] G4A-14 Compile accepted change sets to the canonical render plan
- [x] G4A-15 Adapt browser preview to the canonical render plan
- [x] G4A-16 Adapt FFmpeg export to the canonical render plan
- [x] G4A-17 Prove invalid times/text cannot enter accepted state
- [x] G4A-18 Prove stale proposals and unsupported actions fail closed
- [x] G4A-19 Prove one change set equals one undo
- [x] G4A-20 Prove selective removal preserves or explicitly invalidates dependent work
- [x] G4A-21 Run real migration, reopen, preview, export, and rollback evidence
- [ ] G4A-22 Owner approves G4-A exit

## G4-B - First safe AI edit

- [x] G4B-01 Approve the AI nameplate prompt/intent contract
- [x] G4B-02 Add provider-independent intent candidate types
- [x] G4B-03 Add deterministic fake provider
- [x] G4B-04 Add capability selection and argument validation
- [x] G4B-05 Add ambiguity detection and clarification
- [x] G4B-06 Add stale-revision and unsupported-capability rejection
- [x] G4B-07 Add preview-only proposal creation
- [x] G4B-08 Add direct manual repair
- [x] G4B-09 Add atomic approval and audit provenance
- [x] G4B-10 Build representative prompt/adversarial evaluation corpus
- [x] G4B-11 Add provider outbound-data allowlist and secret boundary
- [ ] G4B-12 Connect one real provider (DEC-011: one OpenAI-compatible adapter behind a LiteLLM proxy)
  - [x] G4B-12A Implement the OpenAI-compatible adapter with no provider-specific branching
  - [x] G4B-12B Keep the fake as the default; prove no test makes a network call
  - [ ] G4B-12C Verify LiteLLM request-body logging is off before any real call — blocked: LiteLLM is not installed
  - [ ] G4B-12D Run the corpus against NVIDIA, opencode, OpenRouter, and LM Studio — blocked: needs the owner's API keys
- [ ] G4B-13 Run provider-switch and failure-recovery evidence
  - [x] G4B-13A Proxy down, never answering, wrong key, prose reply, smuggled capability — proved over real HTTP
  - [ ] G4B-13B The same corpus across two real providers unchanged — blocked with G4B-12D
- [ ] G4B-14 Owner completes the real AI nameplate workflow

## G5-A - Captions and speech metadata

Decisions: ADR-006. Evidence: `DOCS/evidence/2026-07-28-g5a-captions.md`.
"Domain only" means the rule is built, tested, and reaches the export, but no
button offers it yet - the owner cannot get to it from the screen.

- [ ] G5A-01 Approve caption workflow and creative references - owner gate
- [x] G5A-02 Define transcript/word-timing sidecar contract
- [x] G5A-03 Implement Stage 1 sidecar import adapter - the Whisper word-timing
      shape, implemented from its published form; NOT verified against a real
      Stage 1 file, because none exists here yet (ADR-006 records the assumption)
- [x] G5A-04 Implement optional transcription adapter boundary - the port, its
      rules, and a refusing default; no real service is wired
- [x] G5A-05 Define caption segment and style operations
- [x] G5A-06 Implement deterministic segmentation and correction - correction
      exists as `set-caption-cue`; domain only, no control on screen
- [x] G5A-07 Implement caption timing repair
- [x] G5A-08 Compile captions to canonical render nodes
- [x] G5A-09 Implement browser preview
- [x] G5A-10 Implement export rendering
- [x] G5A-11 Implement timeline-change invalidation/reflow
- [ ] G5A-12 Run readability, timing, fidelity, and owner visual gates - the
      transcript used was synthetic; English only; no owner visual verdict
- [ ] G5A-13 Owner exports a publishable captioned video - owner gate

## G5-B - Timeline and editorial primitives

Anchoring decision: ADR-005. Evidence: `DOCS/evidence/2026-07-28-g5b-cutting.md`.
"Domain only" below means the rule is built, tested, and reaches the export, but
no button offers it yet — the owner cannot get to it from the screen.

- [ ] G5B-01 Approve non-editor timeline workflow and terminology — owner gate
- [x] G5B-02 Implement time selection (the playhead selects the section under it)
- [x] G5B-03 Implement split
- [x] G5B-04 Implement trim — progressively disclosed Studio control now sends
      one bounded `trim-clip` operation
- [x] G5B-05 Implement remove-with-gap — Studio now offers the explicit plain
      action “Remove and leave empty space”
- [x] G5B-06 Implement ripple delete
- [x] G5B-07 Implement reorder — Studio offers “Move earlier” and “Move later”
      without exposing indexes
- [x] G5B-08 Implement enable/disable
- [x] G5B-09 Implement basic audio level and fades — Studio offers loudness,
      fade-in, and fade-out values for the section under the playhead
- [x] G5B-10 Implement dependent-edit revalidation
- [x] G5B-11 Implement simple Studio time-strip controls
- [x] G5B-12 Compile timeline state to preview/export
- [x] G5B-13 Run VFR, rational-frame-rate, audio, and boundary fixtures —
      three real generated inputs were conformed and probed; see
      `DOCS/evidence/2026-07-29-g5b13-media-fixtures.md`
- [ ] G5B-14 Owner completes a pacing edit without NLE terminology — owner gate

## G5-C - Useful talking-head workflow

- [ ] G5C-01 Approve the representative full-video job story
- [x] G5C-02 Implement multi-asset intake — media kinds, addAsset, project v4
      migration, upload route, and asset serving; proved on real files
- [x] G5C-02A Implement point/circle/box/arrow/freehand annotation as non-executable intent
- [x] G5C-02B Prove annotation coordinates across portrait, landscape, letterboxing, resizing, and fullscreen
- [x] G5C-02C Prove annotation marks never enter export unless explicitly converted
- [x] G5C-03 Implement image and B-roll overlay clips — proved in a real
      export; two defects found and fixed by that run
- [x] G5C-04 Implement title and callout operations — proved in a real export
- [x] G5C-05 Implement basic audio workflow — music bed proved audible in a
      real export and proved to stop when the song ends
- [x] G5C-06 Combine cuts, captions, titles, callouts, audio, and B-roll —
      proved in a real export, before and after a cut
- [x] G5C-07 Add plain-language proposals and direct repair for each family —
      accepted titles, callouts, B-roll/pictures, and music now share one
      adjustment panel. Each repair is a full `set-*` operation, one history
      entry, and one Undo. The render compiler folds repairs before producing
      the single render plan. Focused domain/render-contract evidence and all
      relevant TypeScript checks pass. Browser click-through remains a separate
      evidence gap, not missing implementation.
- [x] G5C-08 Add progressive disclosure to Studio — one button, four plain
      choices, one short form; never more than four things visible
- [x] G5C-09 Run complete real-video workflow and output inspection —
      DOCS/evidence/2026-07-29-g5c-real-media.md
- [ ] G5C-10 Measure time saved against the manual baseline
- [ ] G5C-11 Owner approves first genuinely useful prototype

## G6 - Composition, motion, and effects

- [ ] G6-01 Approve motion reference fixtures and quality rubric — rubric is
      written; explicit owner approval remains
- [x] G6-02 Implement position/scale/rotation/opacity — closed bounded operation
      contract and render-plan v5 binding
- [x] G6-03 Implement crop, layer order, and masks — normalized crop, bounded
      layer, rectangle/ellipse/none mask, and feather contract
- [x] G6-04 Implement property tracks and keyframes — ordered bounded tracks on
      the exact project clock with deterministic evaluation
- [x] G6-05 Implement easing curves — linear and cubic-Bezier evaluation
- [x] G6-06 Implement spring/bounce — bounded physical spring and bounce curves
- [x] G6-07 Implement transitions — bounded adjacent-clip dip-to-black with
      explicit video and audio ramps in preview and native export
- [x] G6-08 Implement bounded basic effects — blur, brightness, contrast,
      saturation, and grayscale are closed, bounded, and adapter-consumable
- [x] G6-09 Re-run renderer architecture spike on motion fixtures — hybrid
      browser CSS/native FFmpeg retained with measured real-render evidence
- [x] G6-10 Implement winning preview/export adapter path — browser CSS plus
      native FFmpeg media and isolated written-overlay layers
- [x] G6-11 Prove seek, timing, reduced-motion controls, and fidelity —
      canonical boundary samples cover every visual property/easing family;
      browser/export share the evaluator and real adapter fixtures consume it
- [ ] G6-12 Owner approves motion feel and exported result

## G7 - Components and compound AI

- [ ] G7-01 Approve component and recipe contract
- [x] G7-02 Implement component versions and compatibility — exact recipe,
      component, operation-schema, capability, and appearance versions
- [x] G7-03 Implement nameplate, caption, callout, title, and motion recipes
- [x] G7-04 Implement component migration tests — idempotent and fail-closed
      when an old selection did not pin a version
- [x] G7-05 Implement outcome-workflow registry — intro, readable video,
      highlight moment, and polish talking head
- [x] G7-06 Implement multi-action planning — whole-plan validation produces one
      atomic change set or nothing
- [x] G7-07 Implement dependency-aware clarification — stable action IDs,
      topological ordering, missing dependency and cycle errors
- [x] G7-08 Implement compound preview and repair — detached generic change-set
      preview and one-action repair without reinterpreting other actions
- [x] G7-09 Prove one request/one approval/one undo — two actions accepted in one
      change set and removed by one Undo
- [x] G7-10 Prove old projects retain component appearance — migrated v1
      nameplate preserves words, point, top-left anchor, component/style v1, and
      produces an identical render plan after reopen
- [ ] G7-11 Owner completes a compound natural-language edit

## G8 - Trustworthy local alpha

- [ ] G8-01 Approve representative workflow/evidence matrix and budgets
- [x] G8-02 Implement autosave and crash recovery — every accepted state change
      is bounded, flushed, same-directory atomically renamed, and reloaded
- [x] G8-03 Implement resumable local jobs and progress — durable revision
      snapshots, idempotency, bounded progress, cancellation, and restart replay
- [x] G8-04 Implement project portability and integrity verification —
      content-addressed archive, compatibility manifest, SHA-256 integrity,
      fail-closed restore against matching imported media
- [x] G8-05 Implement proxies, caches, and invalidation where measured —
      measured decision: no proxy/cache; first-time CPU encoding is the
      bottleneck and exact-revision caching would not improve it
- [x] G8-06 Implement local diagnostics and observable errors — safe versioned
      `/api/diagnostics`, stable state/code fields, no secrets or private paths
- [x] G8-07 Implement safe media cleanup and retention controls — only
      controlled exports are deletable; originals/state/assets are protected
- [x] G8-08 Complete accessibility and keyboard audit — skip links, focus/live
      semantics, reduced motion, names, and 44-pixel repair controls
- [x] G8-09 Complete malicious/corrupt media and recovery tests — bounded
      intake/storage/render/archive/job failure matrix passes
- [x] G8-10 Profile and remove the largest measured bottleneck — fixed four
      encoder threads measured 2.38x faster than the old one-thread contract
- [ ] G8-11 Run repeated owner full-video workflows
- [ ] G8-12 Run bounded representative non-editor smoke tests
- [ ] G8-13 Reach agreed E5 reliability, time, quality, and recovery budgets

## P1 — Production timeline

- [x] P1-A Build the pure timeline presentation foundation — immutable contract,
      deterministic effective-project projection, semantic lanes, derived gaps,
      detached proposals, diagnostics, viewport math, gesture adapter, focused
      tests, large fixture, evidence, and unchanged production UI
- [x] P1-B Build Production Timeline V1 using the P1-A foundation — five semantic
      lanes, one shared playhead, ruler/seek/zoom/scroll, overscan, stable
      selection, typed edit gestures, trim preview, deterministic snapping,
      proposal ghosts, keyboard safety, context menu, responsive browser proof,
      verified export, and focused evidence
- [x] P1-C Build Inspector V1 — authoritative Timeline selection resolver,
      human-readable labels, contextual states, local drafts, section Apply/Reset,
      dirty-selection guard, existing-operation editorial controls, transform,
      crop, layer, mask, effects, entrance/exit, easing, Keyframes V1, responsive
      browser proof, corrected preview/export parity, and focused evidence
- [x] P1-D Build Canvas direct manipulation — one shared Timeline/Canvas/Inspector selection and visual draft; move, nudge, uniform/centre resize, rotation, crop, snapping, proposal repair, Point precedence, responsive contained-video geometry, one-operation completion, real Edge/export proof
- [x] P1-E Build Media Bin V1 — one accepted-project media view model, shared labels and usage, App-owned source probing, import/search/filters/keyboard/context menus, existing-operation B-roll/music placement, missing/removal truth, responsive real Edge/export evidence; UX-011 resolved
- [x] P1-E.1 Restore Studio vertical page flow — browser document owns vertical scrolling; upper workspace and full Timeline remain in normal flow; panel scrolling, Timeline state, Canvas/Point geometry, one video, and responsive layouts verified in real Edge; UX-013 resolved
- [x] P1-F.0 Build Primary-Footage Motion V1 — stable source-anchored motion identity; full-state position/scale/rotation/crop/keyframes; shared render-plan v6 evaluator; Motion Inspector, Timeline indicator, and direct Canvas controls; Point precedence; real Edge/export/responsive/cleanup proof; P1-F.1 and P1-F.2 not started

## Continuous tracks applied at every visible goal

- [ ] H1 Select only the highest-impact task blocking the active evidence gate
- [ ] H2 Apply the eight-question architecture-quality gate without speculative overbuilding
- [ ] Q1 Create and owner-approve the Sanverse creative-quality contract
- [ ] Q2 Add a reference fixture and visual verdict for each visual capability
- [ ] U1 Record owner task, wrong turns, repairs, completion time, and verdict
- [ ] U2 Run bounded non-editor smoke tests when a slice is stable
- [ ] R1 Grow the licensed real-media matrix only as capabilities require
- [ ] F1 Define preview/export fidelity tolerance for every primitive
- [ ] F2 Compare canonical preview states with extracted export frames
- [ ] S1 Preserve immutable media, opaque IDs, bounded input, and safe subprocess rules
- [ ] S2 Preserve provider outbound allowlists, secret safety, and redacted logs
- [ ] A1 Verify keyboard, focus, screen-reader names, contrast, and reduced motion
- [ ] A2 Verify plain language and progressive disclosure
- [ ] C1 Version every serialized schema and prove migration/rollback
- [ ] P1 Measure before optimizing and attack only the largest observed bottleneck
- [ ] O1 Give every failure a stable code, safe user truth, recovery, and cleanup proof
- [ ] E1 Record the exact E0-E5 evidence level and remaining limitations
- [ ] D1 Update checklist, current state, project log, failure registry, and change record at each goal exit

## Evidence-driven branches

### G9 - API and MCP

- [ ] G9-ENTRY Confirm stable G8 contracts and a real external-client need
- [ ] G9-01 Version public project, capability, proposal, job, and result schemas
- [ ] G9-02 Add authentication and authorization boundary
- [ ] G9-03 Add idempotent job semantics
- [ ] G9-04 Add capability discovery
- [ ] G9-05 Add audit and rate/abuse boundaries
- [ ] G9-06 Prove external clients cannot bypass validation or approval policy

### G10 - Production SaaS operations

- [ ] G10-ENTRY Confirm G8 evidence and owner approval for multi-user launch
- [ ] G10-01 Threat and trust model
- [ ] G10-02 Identity and session contracts
- [ ] G10-03 Tenancy and deny-by-default authorization
- [ ] G10-04 Transactional metadata persistence and migrations
- [ ] G10-05 Integrity-checked cloud object storage
- [ ] G10-06 Durable idempotent render jobs and workers
- [ ] G10-07 Secrets, encryption, rotation, and leak prevention
- [ ] G10-08 Redacted end-to-end production observability
- [ ] G10-09 Backup, restore, and disaster-recovery drills
- [ ] G10-10 Quotas, malicious-media handling, and abuse controls
- [ ] G10-11 Deployment provenance, staged rollout, and rollback
- [ ] G10-12 Data export, deletion, retention, and processor lifecycle
- [ ] G10-13 Incident-response tabletop and technical drills
- [ ] G10-14 Production-readiness review and explicit launch approval

### G11 - Vision and tracking

- [ ] G11-ENTRY Confirm repeated moving-object user need
- [ ] G11-01 Create representative licensed evaluation set
- [ ] G11-02 Implement detection adapter
- [ ] G11-03 Implement tracking and coordinate transforms
- [ ] G11-04 Implement segmentation and occlusion handling
- [ ] G11-05 Implement confidence and tracking-loss behavior
- [ ] G11-06 Implement direct user correction
- [ ] G11-07 Prove dataset-backed quality and safe failure

### G12 - Evaluation and specialized models

- [ ] G12-ENTRY Confirm consent and a repeatable general-model weakness
- [ ] G12-01 Define privacy-preserving event and provenance contract
- [ ] G12-02 Implement consent, export, and deletion
- [ ] G12-03 Build representative evaluation datasets
- [ ] G12-04 Implement model routing and shadow evaluation
- [ ] G12-05 Prove measurable benefit before specialized training
- [ ] G12-06 Implement rollout, monitoring, and rollback

## Macro completion

### P1-F.0.2 — Nested Studio Layout Engine V2

- [x] Replace custom splitters with exact-version reusable panel primitives
- [x] Preserve the single editor/domain authority
- [x] Add typed V2 state, migration, persistence, presets, responsive rules
- [x] Preserve one video/playhead/draft/proposal/history through layout changes
- [x] Verify real edit, Undo, Redo, export, and download
- [x] Pass 1,158 tests and production build
- [x] Record evidence and nonblocking failures
- [x] P1-F.0.2.1 stabilize nested height, scroll, rail, and responsive panel behavior
- [x] P1-F.0.2.1 real-user E2E: draft continuity, 10 collapse cycles, keyboard resize, edit, Undo, Redo, export
- [x] P1-F.0.2.1 pass 1,164 tests and production build
- [ ] Owner visual acceptance of P1-F.0.2.1
- [ ] Begin P1-F.1 only after a new approved contract

### P1-F.0.2.2 — Media panel and Editor Monitor V1

- [x] Complete responsive Media presentation without Media V2 state
- [x] Make only Media results scroll
- [x] Add one custom monitor around the existing video
- [x] Move Point into the compact monitor toolbar
- [x] Add custom transport, Fit/Fill/100%, guides, and fullscreen fallback
- [x] Preserve one editor/project/revision/video/playhead/proposal/history/export path
- [x] Run focused and real-browser acceptance checks
- [x] Record real export timeout and screenshot-tool limitation
- [ ] Owner visual acceptance
- [ ] Media V2 capabilities — not started

- [ ] Representative users finish acceptable videos in measured minutes
- [ ] Default workflows require no professional editor knowledge
- [ ] Ambiguity clarifies or fails closed
- [ ] Accepted work survives reload, crash, provider failure, and render failure
- [ ] Preview/export fidelity meets agreed budgets
- [ ] Creative output meets the owner-approved reference contract
- [ ] Source media remains immutable
- [ ] Projects remain migratable and portable
- [ ] Repeated workflows reach E5
