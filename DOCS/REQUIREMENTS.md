# Requirements

Status values: `Approved`, `Proposed`, `Deferred`, `Rejected`, `Superseded`.

## Approved requirements

### REQ-001 — Non-editor interaction

- Status: Approved
- The product must let a non-editor request changes through chat, pointing, drawing, and simple direct manipulation.
- The default workflow must not require learning professional NLE concepts.
- Source: owner conversation.

### REQ-002 — Minutes, not hours

- Status: Approved
- The product must optimize for completing real talking-head edits in minutes rather than hours.
- Exact latency budgets will be established from G3/G4 baseline measurements; no unsupported number is claimed at G0.
- Source: owner correction.

### REQ-003 — Safe, non-destructive editing

- Status: Approved
- Original media must remain immutable.
- Accepted edits must be reproducible, versioned, undoable, and auditable.
- Consequential changes require a real preview or explicit approval.

### REQ-004 — AI proposes; deterministic code executes

- Status: Approved
- AI output cannot directly mutate project state or invoke arbitrary renderer operations.
- Intent must become a typed, bounded proposal validated against the project, capabilities, policy, and schema.
- Ambiguity must trigger clarification, preview, or refusal instead of a silent guess.

### REQ-005 — Production-grade architecture from day one

- Status: Approved
- Module boundaries, contracts, migrations, security boundaries, tests, observability hooks, and replaceable adapters must be designed from the beginning.
- This does not require building full login, billing, multi-tenancy, Kubernetes, or enterprise operations before product value is validated.

### REQ-006 — Minimal black-and-white interface

- Status: Approved
- Initial branding uses black, white, and grayscale.
- The interface should be calm and clean like the referenced OpenDesign experience, adapted to video editing rather than copied.
- Fancy decoration and advanced theming are deferred.

### REQ-007 — Staged editing primitives

- Status: Approved
- The engine must eventually support the reusable primitives behind cut, trim, split, ripple, reorder, transform, crop, scale, rotation, opacity, layers, keyframes, easing, springs/bounce, transitions, text, audio, and basic effects.
- These primitives are introduced in goal order through end-to-end user outcomes, not all at once.

### REQ-008 — Durable continuity and drift prevention

- Status: Approved
- A new or compacted session must resume from committed project truth rather than chat memory.
- Requirements, decisions, current state, active plan, failures, and evidence must remain separately inspectable.
- Owner corrections must update the durable record in the same change set.

### REQ-009 — Evidence-based accuracy

- Status: Approved
- Exact deterministic behavior requires reproducible tests.
- Semantic behavior requires representative evaluations and fail-closed handling.
- No “100% accuracy” claim may be made without defining the measured population and showing evidence.

### REQ-010 — Stage 1 boundary

- Status: Approved
- Stage 2 accepts a cleaned MP4 from Stage 1 as the minimum input contract.
- Transcript, word timings, cut map, or EDL are optional accelerators, not a hard dependency for the first vertical slice.
- Stage 1 remains read-only during Stage 2 development unless the owner explicitly changes scope.

### REQ-011 — Owner-visible collaboration

- Status: Approved
- Before materially changing direction, explain what is understood, what is assumed, and what will be built next.
- The owner approves medium-to-large goal transitions.
- Technical explanations must remain understandable to a non-technical founder.

### REQ-012 — Calm landing before the editing Studio

- Status: Approved
- A first-time or returning user must land on a calm Home screen centered on one chat/upload composer, drag-and-drop video entry, and recent projects.
- Editing controls, canvas tools, proposals, history, and the time strip must remain hidden until the user opens or creates a video project.
- Starting may happen by dropping a cleaned video, attaching one inside the composer, opening a recent project, or describing the intended edit and then supplying the video.
- Source: owner correction on 2026-07-12.

### REQ-013 — Web delivery and fixed local port

- Status: Approved
- Stage 2 must be built as a browser-accessible web application.
- The user-facing local development server must bind to port 2000.
- Local startup must use strict port behavior: if port 2000 is occupied, startup fails visibly instead of silently switching to 3000, 5000, 8000, or another port.
- Port 2000 is a local-development constraint. A deployed web application will use its hosting platform's normal public HTTP/HTTPS routing.
- Source: owner correction on 2026-07-12.

### REQ-014 — Proportionate hierarchy and purposeful motion

- Status: Approved
- The Home question must guide the user without dominating the whole viewport.
- Moving between Home and Studio, selecting a video, and pressing primary controls must feel continuous rather than like an abrupt cut.
- Screen navigation must use one restrained smooth curve. Direct controls may use a brief, purposeful spring response so presses and focus changes feel physical rather than abrupt; this spring must not become decorative page motion.
- Motion must reinforce the user's action and be explicitly removed when reduced motion is requested.
- Source: owner real-video walkthrough and material correction on 2026-07-13.

### REQ-015 — Visual-first external component ingestion

- Status: Approved
- External visual agents may create reusable motion components in different implementation environments, but every owner-approved visual must enter Sanverse through one fail-closed component-ingestion contract before it becomes public.
- The approved visual appearance is authority. Engineering may normalize implementation, extract typed properties, semantic nodes, keyframes, expert boundaries and responsive behavior, but may not aesthetically reinterpret or silently approximate the approved result.
- Public registration requires owner approval, deterministic/direct-seek validation, immutable source evidence, visual parity, canonical Motion Graph/edit controls, review evidence and Library metadata.
- All ten CH1 source visuals are owner-approved as of 2026-08-14. Component 01 (`sanverse.icon-rail`) also received direct owner approval of the synchronized integrated parity view.
- The Sanverse coding agent in this worktree owns the complete engineering conversion and Library insertion; this work is not delegated to another coding agent.
- For CH1 Components 02–10, the owner explicitly authorized the coding agent on 2026-08-14 to preserve the approved source visuals, perform the engineering parity/productization review, and insert the verified results into the Library without a separate manual owner viewing round for every component. This batch authorization must be recorded distinctly from direct owner parity review.
- Completion means the components themselves are public, searchable and playable in the Sanverse Creative Library—not merely staged in an intake folder or represented by placeholders.
- Source: owner-approved Component Ingest V1 contract and owner corrections on 2026-08-14.

### REQ-016 — Creative Engine Closed-Loop V1, then MCP V1

- Status: Approved
- The existing Creative Engine must reach a complete UI-independent closed loop before MCP is allowed to expose it: source/capability context → isolated Storyboard KVS → explicit Storyboard approval → exact-tick Animatic → explicit Animatic approval → MotionPlan/Motion Forge → structural and visual QA → bounded repair → explicit Motion approval → one atomic accepted-project merge → one inverse Undo.
- The loop must reuse the existing canonical Motion Scene/Graph, C2 keyframes, C3 Layers, C4 Dope Sheet, C5 Curves, C6 node projection, C8 masks/mattes, exact-tick clock, Library registry and graph inverse operations. It must not create a second graph, renderer, keyframe engine, timeline, Library or Undo authority.
- External assets must be inspected with explicit provenance/rights/editability and fail closed when lossless support is unavailable. Unsupported SVG/Lottie features must refuse rather than silently approximate; alpha video remains an external exact-time asset rather than pretending to be an editable graph node.
- Storyboard/Animatic/Motion owner approvals are explicit and revision-bound. A model/tool caller cannot manufacture approval authority.
- MCP V1 is a thin adapter over the accepted internal tool registry. MCP may list/call the same tools but may not own project, Storyboard, Motion Graph, approval, merge or Undo state, and it may not bypass the internal registry validation/sandbox gates.
- Production `apps/web/**` remains outside this development-only implementation cycle.
- Source: owner implementation instruction on 2026-08-26: take the existing Creative Engine to 100% of Closed-Loop V1, then expose that stable closed loop through MCP V1.

### REQ-017 — Creative Engine V1.1 promotion, parameterization and reuse flywheel

- Status: Approved
- An exact owner-approved Motion revision may be copied into an isolated promotion workspace and productized into reusable Sanverse capability without mutating the approved source. Unapproved, stale-approved, QA-failed, graph-invalid or insufficiently evidenced source must fail closed.
- Promotion must conservatively separate project content from frozen design constants, bind reusable parameters only to stable semantic graph identities, preserve generated origin and immutable lineage, aggregate dependency rights using the most restrictive relevant source, and require successful promotion QA before atomic Library registration.
- V1.1 must prove reusable scene/component productization plus role-based Motion Recipe extraction. Reuse must instantiate as ordinary canonical Motion Graph content, not an opaque runtime, and must remain editable through C3/C4/C5/C6 with deterministic direct-seek behavior and existing one-action/Undo semantics.
- The decisive release proof is cross-project: Project A approved generated scene → promote/register → normal B2 retrieval → Project B instantiate in sandbox → change content/value/accent/style → apply recipe → review → approved apply → Undo restores Project B.
- Promotion/reuse tools are implemented in the existing internal registry first. The existing MCP remains a thin adapter and may expose the new safe internal tools only after the internal cross-project reuse loop passes; neither AI nor MCP may manufacture owner approval or rewrite lineage.
- Production `apps/web/**`, the separately versioned `sites/` repository, B6/B7/B8, C9+, tracking/3D/particles, advanced external conversion and production-editor integration are outside this V1.1 milestone.
- Source: owner-provided SANVERSE CREATIVE ENGINE V1.1 Promotion + Parameterization + Reuse Flywheel implementation plan on 2026-08-26.
