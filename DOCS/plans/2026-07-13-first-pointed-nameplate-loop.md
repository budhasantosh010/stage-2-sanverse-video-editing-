# First Pointed Nameplate Loop Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Status:** In progress. Tasks 1 through 4 are complete; Tasks 5 through 8 remain pending. This does not mark the G2 or G3 macro exit gates complete.

**Goal:** Let a non-editor open a real MP4, pause at a moment, point at a position, create a static nameplate through a bounded manual action, preview it, accept or undo it, and export a reproducible MP4.

**Architecture:** Keep one modular monolith with a typed edit-domain package that does not depend on React, AI, storage, HTTP, or FFmpeg. The React Studio translates direct manipulation into typed proposals. A local same-origin API adapter validates projects and invokes a replaceable renderer adapter. In development the user continues to open only `http://localhost:2000`; any internal API port is hidden behind the web proxy and must not replace the owner-reserved port.

**Tech Stack:** TypeScript, React, Vitest, Node API adapter, JSON-schema-compatible typed contracts, FFmpeg adapter, filesystem-backed local project storage behind a replaceable repository port.

---

## AOCS Omega framing

- Classification: Type 2, medium risk, fractal depth 1.
- Root problem: the current Studio displays a video but cannot close even one trustworthy edit loop.
- Highest-leverage vertical: one spatially targeted static nameplate with preview, accept, undo, and real export.
- Red-team rejection: connecting an LLM before this loop exists would let probabilistic text produce no trustworthy or reproducible media result.
- Contrarian check: a Premiere-style timeline is not required for this first loop; point mode plus a simple moment strip carries less editor knowledge.
- Human gate: the owner must complete the loop on a representative talking-head MP4 before AI work begins.

## Explicit boundary

Included:

- Immutable project-owned copy of a selected MP4.
- One point target: normalized `x`, normalized `y`, and source time in milliseconds.
- One typed action: static nameplate with primary text, optional secondary text, start, duration, and point-derived placement.
- Proposal, deterministic preview, accept, undo, and real FFmpeg export.
- Recoverable validation and render failures.

Excluded:

- Free-form AI interpretation, NVIDIA, OpenCode Zen, or any provider key.
- Cut/trim, drawing, tracking, motion, bounce, transitions, effects, or multi-layer timeline editing.
- Accounts, billing, cloud storage, queues, or multi-tenancy.

## Acceptance criterion

On `http://localhost:2000`, the owner can use a real cleaned MP4 to complete:

`Home → Studio → pause → Point mode → click position → Add text → preview → accept → undo/redo → accept → export MP4`

The exported file must preserve source duration and dimensions, contain the accepted nameplate at the selected time/position, and be reproducible from the recorded project actions. Unsupported or ambiguous input must fail visibly without mutating accepted history.

### Task 1: Finish the G1 renderer decision

**Objective:** Choose the minimum renderer architecture with measured evidence before production integration.

**Files:**

- Modify: `spikes/renderer/README.md`
- Create: `spikes/renderer/hybrid_candidate.py`
- Test: `spikes/renderer/tests/test_hybrid_candidate.py`
- Create: `DOCS/runs/2026-07-13-hybrid-static-nameplate.md`
- Create: `DOCS/adr/ADR-001-renderer-architecture.md`

**Steps:**

1. Write a failing hybrid test requiring the same validated fixture to generate a browser preview document and an FFmpeg export command.
2. Run `python -m pytest spikes/renderer/tests/test_hybrid_candidate.py -q`; confirm RED because the adapter is absent.
3. Implement only the static-nameplate hybrid adapter.
4. Run the focused test, then `python -m pytest spikes/renderer/tests -q`.
5. Measure preview/export fidelity, speed, repeatability, Windows behavior, and deployment cost against the existing candidates.
6. Record an ADR; do not select HyperFrames without runtime evidence.
7. Commit: `spike: decide renderer for first edit loop`.

### Task 2: Create the renderer-independent edit domain

**Objective:** Define project state, spatial targets, nameplate actions, and history as pure typed data.

**Files:**

- Modify: `package.json`
- Create: `packages/edit-domain/package.json`
- Create: `packages/edit-domain/src/project.ts`
- Create: `packages/edit-domain/src/actions.ts`
- Create: `packages/edit-domain/src/history.ts`
- Test: `packages/edit-domain/src/*.test.ts`

**Core contract:**

```ts
export type PointTarget = {
  x: number
  y: number
  sourceTimeMs: number
}

export type AddNameplateAction = {
  schemaVersion: 'sanverse.action/v1'
  actionId: string
  kind: 'add-nameplate'
  target: PointTarget
  primaryText: string
  secondaryText: string
  startMs: number
  durationMs: number
}
```

**Steps:**

1. Write failing invariant tests for finite normalized coordinates, non-negative time, non-empty text, positive duration, unique action IDs, and immutable history.
2. Run the focused package tests and confirm RED.
3. Implement the minimum pure functions: validate, propose, accept, undo, redo, and serialize.
4. Run focused tests and the full JavaScript suite.
5. Commit: `feat: add canonical nameplate edit domain`.

### Task 3: Capture an exact point without breaking playback

**Objective:** Add an explicit Point mode so normal video controls remain usable outside targeting.

**Files:**

- Create: `apps/web/src/features/point-target/point-target.ts`
- Test: `apps/web/src/features/point-target/point-target.test.ts`
- Modify: `apps/web/src/screens/studio/StudioScreen.tsx`
- Modify: `apps/web/src/screens/studio/StudioScreen.css`
- Test: `apps/web/src/screens/studio/StudioScreen.test.tsx`

**Steps:**

1. Write failing tests for normalized coordinate calculation, bounds rejection, timestamp capture, Point mode entry, one-click capture, marker display, and returning to normal playback mode.
2. Confirm RED.
3. Implement a temporary pointer layer only while Point mode is active; never leave an invisible overlay blocking video controls.
4. Show the marker and plain-language summary: `Here · 00:12.400`.
5. Run focused and full frontend tests.
6. Commit: `feat: add precise video point targeting`.

### Task 4: Build the bounded manual nameplate proposal

**Objective:** Prove the edit engine without pretending free-form chat is understood.

**Files:**

- Create: `apps/web/src/features/nameplate/NameplateComposer.tsx`
- Create: `apps/web/src/features/nameplate/NameplateComposer.css`
- Test: `apps/web/src/features/nameplate/NameplateComposer.test.tsx`
- Modify: `apps/web/src/screens/studio/StudioScreen.tsx`
- Modify: `apps/web/src/screens/studio/StudioScreen.css`
- Test: `apps/web/src/screens/studio/StudioScreen.test.tsx`
- Modify: `apps/web/package.json`
- Modify: `package-lock.json`

**Steps:**

1. Write failing tests for Add text availability only after a target exists, required primary text, optional secondary text, timing defaults, cancel, and proposal creation.
2. Confirm RED.
3. Implement a plain action sheet: `Add text here`, primary text, optional smaller line, start now, visible for five seconds.
4. Keep free-form chat visibly queued for the later AI adapter; do not parse natural language with fragile regular expressions.
5. Run focused and full tests.
6. Commit: `feat: create bounded nameplate proposals`.

### Task 5: Preview, accept, undo, and redo from canonical history

**Objective:** Close the trustworthy browser preview loop before export.

**Files:**

- Create: `apps/web/src/features/nameplate/NameplateOverlay.tsx`
- Test: `apps/web/src/features/nameplate/NameplateOverlay.test.tsx`
- Modify: `apps/web/src/screens/studio/StudioScreen.tsx`
- Modify: `apps/web/src/app/app-state.ts`
- Test: `apps/web/src/app/App.test.tsx`

**Steps:**

1. Write failing tests that proposals preview without entering accepted history, acceptance records exactly one action, undo removes it, redo restores it, and cancel leaves history unchanged.
2. Confirm RED.
3. Render the overlay from the typed action only; never store preview truth inside CSS or component-local ad hoc objects.
4. Run focused tests and the full suite.
5. Commit: `feat: close nameplate preview and history loop`.

### Task 6: Add immutable local project intake behind an API boundary

**Objective:** Give the renderer a controlled media source without exposing arbitrary filesystem paths.

**Files:**

- Create: `apps/api/package.json`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/projects/project-repository.ts`
- Create: `apps/api/src/projects/filesystem-project-repository.ts`
- Test: `apps/api/src/projects/*.test.ts`
- Modify: `apps/web/vite.config.ts`
- Modify: `.gitignore`

**Steps:**

1. Write failing tests for MP4 validation, size limits, generated project IDs, immutable source copies, ignored local data, path traversal rejection, and atomic manifest writes.
2. Confirm RED.
3. Implement the repository port and local adapter. Keep media, manifests, and exports outside Git.
4. Proxy `/api` through port 2000 in development; any internal port must bind only to `127.0.0.1`.
5. Run API, frontend, and governance tests.
6. Commit: `feat: add safe local project intake`.

### Task 7: Export the accepted action through a replaceable renderer adapter

**Objective:** Produce a real MP4 from accepted history while keeping FFmpeg outside the domain.

**Files:**

- Create: `apps/api/src/render/render-port.ts`
- Create: `apps/api/src/render/ffmpeg-render-adapter.ts`
- Test: `apps/api/src/render/ffmpeg-render-adapter.test.ts`
- Create: `apps/api/src/render/render-service.ts`
- Test: `apps/api/src/render/render-service.test.ts`

**Steps:**

1. Write failing tests for schema translation, escaped text/font paths, bounded placement, cancellation, non-zero exit, missing output, duration/dimension probe, and deterministic fixture hashes where applicable.
2. Confirm RED.
3. Translate only validated accepted actions into FFmpeg arguments; never pass chat text or a shell string directly.
4. Run a real fixture render and probe.
5. Commit: `feat: export accepted nameplate edits`.

### Task 8: Complete the owner-facing end-to-end workflow

**Objective:** Make the vertical feel like one coherent web application.

**Files:**

- Modify: `apps/web/src/screens/studio/StudioScreen.tsx`
- Modify: `apps/web/src/screens/studio/StudioScreen.css`
- Test: `apps/web/src/app/App.test.tsx`
- Create: `DOCS/changes/YYYY-MM-DD-first-pointed-nameplate.md`
- Modify: `DOCS/CURRENT_STATE.md`
- Modify: `DOCS/BUILD_TRACKER.md`
- Modify: `DOCS/PROJECT_LOG.md`

**Steps:**

1. Write the failing integration test for the complete bounded loop.
2. Confirm RED.
3. Connect intake, point mode, proposal, preview, accept, undo/redo, render progress, export result, and recoverable failures.
4. Run all JavaScript tests, renderer tests, production builds, governance checks, and a real MP4 fixture.
5. Run independent security/spec/code-quality review.
6. The owner performs the representative workflow; E4 remains open until that succeeds.
7. Commit and push the coherent vertical slice.

## AI entry gate

NVIDIA or OpenCode Zen keys are needed only after Tasks 1–8 pass and the owner accepts the manual loop. The later AI adapter receives the user message plus typed point/time context and may return only a versioned action proposal. Deterministic code validates, previews, authorizes, records, and renders it. Keys must be stored in an ignored local environment file or OS secret store—never in chat, source code, documentation, screenshots, or Git.
