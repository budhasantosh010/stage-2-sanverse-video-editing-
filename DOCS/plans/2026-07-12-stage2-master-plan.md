# Stage 2 Master Plan

Status: Historical approved direction. It remains evidence of earlier decisions, not the current detailed sequencing authority.

The proposed refined roadmap is `../MASTER_PLAN.md`. It separates the scale-ready G4-A chassis from G4-B AI, adds the caption and useful-workflow slices, and makes G9-G12 conditional. Do not infer the old linear order as a new approval.

## Planning rule

Move from the smallest complete user outcome toward broader capability. Architecture boundaries exist from day one, while expensive operational infrastructure waits for evidence.

## G0 — Foundation and continuity

**Why:** Prevent loss of intent, unsafe architectural drift, and opaque handoffs before code compounds mistakes.

**Build:** Requirements, decisions, goal map, architecture principles, current state, lightweight continuity hooks, verification, Git and private remote baseline.

**Exit:** Checks pass, commit is pushed, limitations are recorded, owner approves G1.

## G1 — Interface design and renderer feasibility spike

**Why:** The user workflow and render approach constrain the project model. A wrong renderer choice could force a major rewrite.

**Build:** Low-fidelity black-and-white Home/Studio flow, a thin runnable web shell for owner interaction testing, representative edit fixtures, and a comparison harness for FFmpeg-native, HTML/Chromium, and hybrid rendering.

**Exit:** Owner can start the web shell on strict localhost port 2000, complete and approve the Home-to-Studio walkthrough, and review a renderer decision backed by reproducible measurements.

## G2 — Canonical project foundation

**Why:** Undo, history, preview, AI actions, exports, API access, and multiple renderers need one trustworthy model.

**Build:** Typed project schema, media references, timebase rules, edit/action envelope, validation, versioning, persistence port, renderer port, event/history model, migrations, observability seams.

**Exit:** Contract, migration, invariant, and persistence tests pass without UI or provider coupling.

## G3 — First closed manual vertical slice

**User outcome:** Upload a cleaned MP4, pause at a moment, draw/select a rectangle, add a static nameplate, preview, accept, reload, undo, and export.

**Why:** Proves the complete loop before probabilistic interpretation.

**Exit:** A real fixture exports correctly, history survives reload, undo restores state, and the owner completes the workflow.

## G4 — First AI-operated edit

**User outcome:** Describe the nameplate change naturally; the product proposes the same typed action, explains ambiguity, previews it, and acts only after approval.

**Build:** Provider-independent intent port, structured output validation, bounded repair, clarification, capability checking, audit trail.

**Exit:** Representative prompt set passes; ambiguous or invalid prompts fail closed; provider switching does not change the core contract.

## G5 — Editorial timeline primitives

**Build in workflow order:** cut, trim, split, ripple delete, reorder, time selection, audio level/fade basics, captions where validated.

**Why:** These deliver the highest-value talking-head editing outcomes.

**Exit:** Exact timebase and timeline invariants plus representative user workflows.

## G6 — Composition, effects, and motion primitives

**Build in workflow order:** position, scale, crop, rotation, opacity, layer order, keyframes, easing, spring/bounce, transitions, text styles, and basic visual effects.

**Why:** These are the reusable mechanisms behind “make this move,” “bounce here,” and polished compositions.

**Exit:** Deterministic action contracts, preview/export fidelity evidence, and usable non-editor controls.

## G7 — Versioned component platform

**Build:** Reusable nameplates, callouts, subtitles, diagrams, motion presets, templates, compatibility rules, migrations, and component testing.

**Exit:** Components can evolve without breaking saved projects and can be inserted through the same action model.

## G8 — Trustworthy local alpha

**Build:** Recovery, autosave, project portability, performance profiling, local observability, safe media management, and repeated real-video use.

**Exit:** Owner completes representative videos in measured time with acceptable edit acceptance and recovery rates.

## G9 — API and MCP surfaces

**Build:** Versioned external contracts over the same domain services, idempotency, authentication boundary, capability discovery, job semantics.

**Exit:** External clients cannot bypass validation, authorization, history, or audit controls.

## G10 — Full production SaaS operations

**Build when justified:** identity, tenancy, authorization, billing, quotas, queues, object storage, cloud render workers, encryption, backups, abuse controls, monitoring, incident response, data lifecycle, compliance preparation.

**Important:** G10 is operationalization, not the first time architecture quality appears. All earlier goals must already respect production-grade boundaries.

## G11 — Advanced vision and tracking

**Build:** Object detection, tracking, segmentation, occlusion handling, coordinate transforms, and confidence-aware spatial edits.

**Exit:** Dataset-backed results and safe handling of tracking loss or ambiguity.

## G12 — Data flywheel and specialized models

**Build only with consent and evidence:** anonymized outcome metrics, evaluation sets, model routing, fine-tuning or specialized models where they measurably outperform adapters.

**Exit:** Privacy, provenance, evaluation, rollback, and measurable product improvement.

## Global quality gates

Every goal must preserve:

- immutable source media;
- deterministic validated actions;
- reversible history;
- provider and renderer boundaries;
- accessible low-complexity UX;
- explicit evidence and known limitations;
- owner approval before the next medium-to-large goal.
