# Decisions

Only durable, approved decisions belong here. Proposals stay in plans or the blackboard until approved.

## DEC-001 — Separate Stage 2 repository

- Status: Approved
- Date: 2026-07-12
- Decision: Stage 2 is an independent repository named `stage-2-sanverse-video-editing-` under the owner's GitHub account. The trailing hyphen is part of the owner-created repository slug.
- Why: It is a substantially larger product with its own lifecycle, architecture, tests, and release path. Stage 1 remains a read-only upstream input system.
- Revisit trigger: A later integration analysis proves a monorepo materially lowers cost without coupling releases.

## DEC-002 — Modular monolith with production-grade boundaries

- Status: Approved
- Date: 2026-07-12
- Decision: Begin with a modular monolith and explicit domain ports/adapters. Design contracts, migrations, observability seams, and security boundaries now; defer full distributed SaaS operations.
- Why: Weak boundaries make every later change dangerous, while premature microservices and cloud operations slow product learning.
- Revisit trigger: Measured scaling, deployment, ownership, or fault-isolation needs exceed the modular monolith.

## DEC-003 — AI control plane over a deterministic edit engine

- Status: Approved
- Date: 2026-07-12
- Decision: Models translate natural intent into structured proposals. Deterministic services validate, simulate, execute, record, undo, and render those proposals.
- Why: This creates an auditable trust boundary and prevents probabilistic model output from arbitrarily changing media projects.
- Revisit trigger: None for the trust boundary; provider and model implementations remain replaceable.

## DEC-004 — Two-stage black-and-white interface

- Status: Approved
- Date: 2026-07-12
- Decision: The initial product experience has two progressively disclosed surfaces. Screen 1 is a calm Home screen with a centered chat/upload composer, drag-and-drop entry, and recent projects. Screen 2 is the focused Studio with project/export controls, a central video canvas, a right-side conversational proposal/history panel, and a simple lower time strip. The Studio appears only after a video/project is opened.
- Why: Showing editing controls on first arrival would overwhelm the target non-editor. The user wants OpenDesign's calm conversational start, followed by editing capability only when it becomes relevant.
- Revisit trigger: Real usability evidence shows another layout materially reduces completion time.

## DEC-005 — Vertical slices before broad primitive coverage

- Status: Approved
- Date: 2026-07-12
- Decision: Build complete edit loops one by one. The first is a deterministic static nameplate placement; AI enters only after the manual loop is trusted.
- Why: A narrow closed loop reveals whether the data model, preview, approval, history, and renderer actually work together.
- Revisit trigger: Renderer spike or usability testing invalidates the proposed first slice.

## DEC-006 — Renderer chosen by a measured spike

- Status: Approved
- Date: 2026-07-12
- Decision: Do not lock the rendering architecture from assumption. G1 compares FFmpeg-native, HTML/Chromium, and hybrid approaches against representative edits and records the evidence.
- Why: Text/motion flexibility, preview fidelity, performance, portability, and determinism trade off differently.
- Revisit trigger: New primitive classes exceed the winning renderer's demonstrated envelope.

## DEC-007 — Provider independence

- Status: Approved
- Date: 2026-07-12
- Decision: OpenCode Zen and NVIDIA free endpoints may be development adapters, but core contracts cannot depend on a specific model or free-plan behavior.
- Why: Availability, terms, quotas, and model quality can change. Product correctness must not be coupled to a temporary provider.
- Revisit trigger: None for the abstraction boundary.

## DEC-008 — Lightweight anti-drift hooks only

- Status: Approved
- Date: 2026-07-12
- Decision: Install deterministic context injection, prompt logging, and pre-edit decision reminders. Defer semantic indexing, automatic diagram rendering, heuristic goal scoring, and destructive rollback helpers.
- Why: The old template contains useful mechanisms, but unproven automation adds dependencies, latency, and failure paths. Every governance layer must earn its complexity.
- Revisit trigger: Committed documents and lightweight hooks prove insufficient in actual sessions.

## DEC-009 — Runnable web shell before remaining renderer work

- Status: Approved
- Date: 2026-07-12
- Decision: Pause HyperFrames runtime and hybrid renderer work long enough to build a thin, runnable Home-to-Studio web shell on localhost port 2000. The shell uses real local video selection and browser preview, but it must not pretend that upload, editing, AI, persistence, or export exists.
- Why: The owner needs to evaluate how the product looks, works, and feels before more renderer investment. A static wireframe cannot validate interaction clarity.
- Architecture boundary: Use production-quality frontend boundaries and tests, but do not introduce a backend, database, renderer, or provider until the first UX loop requires them.
- Revisit trigger: The owner completes the runnable Home-to-Studio walkthrough and records corrections; renderer comparison then resumes before G2 closes.
