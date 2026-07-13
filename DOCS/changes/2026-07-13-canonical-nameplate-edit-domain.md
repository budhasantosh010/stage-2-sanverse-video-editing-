# Change Record: Canonical nameplate edit domain

- Date: 2026-07-13
- Goal: G2 — Canonical project foundation
- Requirements: REQ-003, REQ-004, REQ-005
- Decisions: DEC-002, DEC-003, DEC-005
- Acceptance criterion: The exact versioned point/nameplate action can be validated, proposed, accepted once, undone, redone, and serialized by pure typed code; every invalid or duplicate operation fails without mutating history.
- Status: Implemented with E2 automated evidence

## Why

The first trustworthy edit loop needs one canonical source of truth before the Studio, renderer, storage, or a future AI adapter can use it. UI-local objects or prompt-shaped data would make preview, history, and export drift apart.

## Scope

Adds only the renderer-independent edit-domain workspace. The secondary line remains the plan's exact required `secondaryText: string` field; an empty string represents no secondary line. Point UI, free-form interpretation, storage, HTTP, FFmpeg integration, preview, and export remain outside this change.

## Architecture impact

`@sanverse/edit-domain` owns versioned edit data and pure state transitions. It has no React, AI provider, storage, HTTP, or renderer dependency. Typed result unions make validation, duplicate IDs, and empty undo/redo explicit recoverable failures. A never-cleared issued-ID ledger prevents identity reuse even after redo is cleared. Canonical project, actions, and history are copied and frozen so caller-owned inputs and previous snapshots cannot be mutated through the domain API. Project creation and serialization deeply validate structural input before accepting it.

## Files/modules changed

- Root npm workspace/test/build integration and lockfile.
- `packages/edit-domain/src/actions.ts`: exact action schema, validation, and proposal creation.
- `packages/edit-domain/src/history.ts`: acceptance, uniqueness, undo, redo, and runtime immutability.
- `packages/edit-domain/src/project.ts`: canonical project envelope and serialization.
- Focused tests for contracts, boundaries, failures, history, and reproducibility.
- Current state, build tracker, and project log evidence.

## Tests and evidence

- RED 1: all three focused suites failed because the production domain modules did not exist.
- GREEN 1: 29 focused tests passed after the minimum implementation.
- RED 2: the runtime-immutability test failed because history was not frozen.
- GREEN 2: all 30 focused tests passed after freezing detached canonical values.
- RED 3: seven focused failures reproduced issued-ID reuse, forged history acceptance, unchecked serialization, and the unfrozen project envelope.
- GREEN 3: all 34 focused tests passed after the identity ledger and deep project/history validation were added.
- Full JavaScript suite: 56 frontend tests plus 34 edit-domain tests passed.
- Production build: frontend Vite/TypeScript build and edit-domain TypeScript build passed.
- Evidence level: E2. No integrated user workflow or rendered-media claim is made.

## Limitations and risks

- Serialization is deterministic for canonical in-memory objects on the current runtime; cross-version migration parsing is not implemented.
- The project envelope does not yet contain immutable source-media identity because safe project intake is a later task.
- This package cannot edit or render a video by itself and is not yet wired into Studio.

## Migration and rollback

No persisted project data or media is migrated. Revert the coherent commit to remove the workspace and restore the prior root workspace scripts.

## Follow-up

Task 3 adds explicit Point mode and produces the normalized target/time input consumed by this contract. Later tasks connect bounded proposal UI, canonical preview/history, safe intake, and renderer export.
