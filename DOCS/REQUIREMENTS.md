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
