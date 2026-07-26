# G4-A Scale-Ready Chassis Implementation Plan

> **For the implementer:** Execute one task at a time, keep the checklist and
> evidence current, and do not infer approval for later tasks or goals.

**Status:** Proposed for owner approval. No implementation has started.

**Goal:** Migrate the verified nameplate product from the narrow
`sanverse.project/v1` history envelope to a minimal scale-ready Project v2
without changing the visible workflow or losing saved projects.

**Architecture:** Keep the modular monolith. Expand the pure edit domain with
explicit time, asset, composition, geometry, revision, change-set, capability,
extension, and migration contracts. Add one pure renderer-neutral render
contract. Adapt persistence, browser preview, and FFmpeg export only after the
domain contracts pass in isolation.

**Tech Stack:** TypeScript 5.8, React 19, Node 24, Vitest, filesystem-backed
local repository, FFmpeg/ffprobe, JSON project files, Windows PowerShell.

**Owner-facing outcome:** The existing upload, point, nameplate, preview,
accept, undo/redo, reopen, and export loop behaves the same, while impossible
times cannot be accepted, one request is one undo, old projects migrate safely,
and later captions/cuts can address stable assets and clips.

---

## 1. Non-negotiable scope

### Included

- Project v2 specification and implementation.
- Exact time-space rules.
- One source video asset.
- One composition.
- Minimal video/audio/overlay tracks and stable clip IDs.
- Explicit point anchor and bounds semantics.
- Project revision.
- Atomic change sets.
- Selective change-set deactivation plus dependency revalidation.
- Strict executable schemas.
- Preserved namespaced metadata extensions.
- Primitive/component/workflow capability levels.
- Canonical nameplate render specification.
- Idempotent v1-to-v2 migration, backup, rollback, and reopen.
- Browser and FFmpeg adaptation.
- Real-media migration/export evidence.

### Excluded

- Real AI provider.
- Chat interpretation.
- Captions.
- Cut, trim, split, ripple, or reorder.
- Motion, keyframes, effects, or B-roll.
- Accounts, cloud storage, queues, billing, or multi-tenancy.
- General plugin framework.

## 2. Proposed contracts to approve before coding

These are proposed concrete defaults. If the owner or implementation review
changes one, update this plan and the corresponding decision before code.

### 2.1 JSON-safe rational time

```ts
export type MediaTime = Readonly<{
  ticks: number
  timescale: number
}>

export type TimeRange = Readonly<{
  start: MediaTime
  duration: MediaTime
}>
```

Rules:

- `ticks` is a safe integer.
- `timescale` is a positive safe integer.
- Different timescales compare through checked rational arithmetic.
- Ranges are half-open: `[start, start + duration)`.
- Duration is positive unless a specific contract explicitly permits zero.
- UI seconds and milliseconds are derived views, never canonical truth.
- Serialized times never contain floating-point seconds.

### 2.2 Explicit time spaces

```ts
export type TimeAnchor =
  | Readonly<{ space: 'source'; assetId: string; time: MediaTime }>
  | Readonly<{ space: 'clip'; clipId: string; time: MediaTime }>
  | Readonly<{ space: 'composition'; compositionId: string; time: MediaTime }>
```

No field may be named merely `time`, `start`, or `duration` when its time space
cannot be inferred from its enclosing type.

### 2.3 Immutable asset identity

```ts
export type VideoAsset = Readonly<{
  schemaVersion: 'sanverse.asset/video/v1'
  assetId: string
  storageRef: string
  sha256: string
  byteLength: number
  duration: MediaTime
  width: number
  height: number
  frameRate: Readonly<{ numerator: number; denominator: number }> | null
  hasAudio: boolean
}>
```

The domain stores no absolute filesystem path. `storageRef` is an opaque
application-controlled reference resolved only by a storage adapter.

### 2.4 Minimal composition

```ts
export type Clip = Readonly<{
  clipId: string
  assetId: string
  sourceRange: TimeRange
  compositionStart: MediaTime
  enabled: boolean
}>

export type Track = Readonly<{
  trackId: string
  kind: 'video' | 'audio' | 'overlay'
  order: number
  clips: readonly Clip[]
}>

export type Composition = Readonly<{
  compositionId: string
  width: number
  height: number
  tracks: readonly Track[]
}>
```

G4-A creates only the minimum single-source composition needed to address the
existing media. Timeline mutation arrives in G5-B.

### 2.5 Geometry and anchor

```ts
export type NormalizedPoint = Readonly<{ x: number; y: number }>
export type Anchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export type SpatialTarget = Readonly<{
  coordinateSpace: 'source-normalized'
  point: NormalizedPoint
  anchor: Anchor
}>
```

G4-A must not silently preserve the current top-left assumption. The owner
must approve the default anchor and near-edge placement behavior before the
schema is accepted.

### 2.6 Atomic change set and revision

```ts
export type ChangeSet = Readonly<{
  schemaVersion: 'sanverse.change-set/v1'
  changeSetId: string
  baseRevision: number
  operations: readonly EditOperation[]
  provenance: Readonly<{
    source: 'direct' | 'ai' | 'migration'
    requestId: string | null
  }>
}>
```

Rules:

- Project revision is a non-negative safe integer.
- Accept succeeds only when `baseRevision === project.revision`.
- One accepted change set increments revision exactly once.
- One Undo reverses one accepted change set, not one primitive.
- A deactivated earlier change set triggers deterministic revalidation of all
  later active change sets.
- Dependent later work is either still valid or explicitly marked blocked.
- No later edit is silently altered to make it pass.

### 2.7 Strict core and preserved extensions

```ts
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | Readonly<{ [key: string]: JsonValue }>

export type Extensions = Readonly<Record<string, JsonValue>>
```

Rules:

- Keys must be namespaced, for example `sanverse.ui/note`.
- Extensions are size- and depth-bounded.
- Unknown extensions are preserved byte-semantically where practical and
  value-semantically at minimum.
- Unknown executable operation kinds reject the project or proposal loudly.
- Extensions cannot alter render, timing, authorization, or project revision.

### 2.8 Capability levels

```ts
export type CapabilityLevel = 'primitive' | 'component' | 'workflow'

export type CapabilityDescriptor = Readonly<{
  capabilityId: string
  version: number
  level: CapabilityLevel
  accepts: string
  produces: readonly string[]
  requires: readonly string[]
}>
```

G4-A registers only the existing nameplate primitive and nameplate component.
Workflow-level AI behavior begins in G4-B.

### 2.9 Canonical render specification

```ts
export type TextOverlayNode = Readonly<{
  nodeId: string
  kind: 'text-overlay'
  interval: TimeRange
  target: SpatialTarget
  primaryText: string
  secondaryText: string
  styleId: 'sanverse.nameplate.default/v1'
}>

export type RenderPlan = Readonly<{
  schemaVersion: 'sanverse.render-plan/v1'
  projectId: string
  projectRevision: number
  compositionId: string
  nodes: readonly TextOverlayNode[]
}>
```

The style ID resolves to one versioned specification covering:

- font family and exact font asset;
- font weight and size calculation;
- line wrapping;
- padding;
- line height;
- foreground/background;
- safe margins;
- anchor;
- clipping/fit behavior;
- primary/secondary layout;
- preview/export rounding.

CSS and FFmpeg do not define independent product semantics.

## 3. Planned file map

### Pure edit domain

- Create: `packages/edit-domain/src/json.ts`
- Create: `packages/edit-domain/src/time.ts`
- Create: `packages/edit-domain/src/assets.ts`
- Create: `packages/edit-domain/src/geometry.ts`
- Create: `packages/edit-domain/src/composition.ts`
- Create: `packages/edit-domain/src/operations.ts`
- Create: `packages/edit-domain/src/change-set.ts`
- Create: `packages/edit-domain/src/capabilities.ts`
- Create: `packages/edit-domain/src/migrations/project-v1-to-v2.ts`
- Modify: `packages/edit-domain/src/project.ts`
- Modify: `packages/edit-domain/src/actions.ts`
- Modify: `packages/edit-domain/src/history.ts`
- Modify: `packages/edit-domain/package.json`
- Test: matching `*.test.ts` files beside every module

### Renderer-neutral contract

- Create: `packages/render-contract/package.json`
- Create: `packages/render-contract/tsconfig.json`
- Create: `packages/render-contract/src/render-plan.ts`
- Create: `packages/render-contract/src/nameplate-style.ts`
- Create: `packages/render-contract/src/compile-project.ts`
- Test: `packages/render-contract/src/*.test.ts`

### Persistence and API adaptation

- Modify: `apps/api/src/projects/project-repository.ts`
- Modify: `apps/api/src/projects/filesystem-project-repository.ts`
- Create: `apps/api/src/projects/project-state-service.ts`
- Create: `apps/api/src/projects/project-state-service.test.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/server.test.ts`
- Modify: `apps/api/src/render/render-port.ts`
- Modify: `apps/api/src/render/render-service.ts`
- Modify: `apps/api/src/render/ffmpeg-render-adapter.ts`
- Modify matching tests

### Browser adaptation

- Modify: `apps/web/src/app/app-state.ts`
- Modify: `apps/web/src/app/app-state.test.ts`
- Create: `apps/web/src/features/render-plan/render-plan-preview.ts`
- Create: `apps/web/src/features/render-plan/render-plan-preview.test.ts`
- Modify: `apps/web/src/features/nameplate/NameplateOverlay.tsx`
- Modify: `apps/web/src/features/nameplate/NameplateOverlay.test.tsx`
- Modify: `apps/web/src/screens/studio/StudioScreen.tsx`
- Modify: `apps/web/src/screens/studio/StudioScreen.test.tsx`
- Modify: `apps/web/src/app/App.test.tsx`

### Evidence and documentation

- Create: `DOCS/adr/ADR-002-project-v2-and-time-model.md`
- Create: `DOCS/adr/ADR-003-canonical-render-contract.md`
- Create: `DOCS/CREATIVE_QUALITY_CONTRACT.md`
- Create: `DOCS/changes/YYYY-MM-DD-g4a-project-v2.md`
- Modify: `DOCS/CURRENT_STATE.md`
- Modify: `DOCS/BUILD_TRACKER.md`
- Modify: `DOCS/PROJECT_LOG.md`
- Modify: `DOCS/FAILURE_REGISTRY.md` only if a failure is found

## 4. Universal verification commands

Focused commands are run after each RED/GREEN cycle:

```powershell
npm run test -w @sanverse/edit-domain -- <specific-test-file>
npm run build -w @sanverse/edit-domain
```

After `@sanverse/render-contract` exists:

```powershell
npm run test -w @sanverse/render-contract -- <specific-test-file>
npm run build -w @sanverse/render-contract
```

Integration boundary:

```powershell
npm run test -w @sanverse/api
npm run test -w @sanverse/web
npm test
npm run build
git diff --check
```

Expected result: every command exits `0`. In the managed Codex sandbox,
FAIL-011 may block Vitest/Vite child processes. That is recorded as an
environment limitation, not converted into a pass. Run blocked commands in
normal PowerShell and record the actual result.

## 5. Atomic implementation tasks

### Task G4A-01: Approve contracts and owner decisions

**Objective:** Remove every product-level ambiguity before schema code.

**Files:**

- Modify: this plan
- Create: `DOCS/adr/ADR-002-project-v2-and-time-model.md`
- Create: `DOCS/adr/ADR-003-canonical-render-contract.md`

**Steps:**

1. Review the proposed time representation in plain language.
2. Review the default spatial anchor and near-edge behavior.
3. Review style reference inputs and identify missing reference videos.
4. Review selective removal behavior when later edits depend on an earlier edit.
5. Review the Stage 2 export boundary.
6. Mark each item approved, changed, or unresolved.
7. Stop if an unresolved answer changes serialized data.
8. Commit the approved specification separately from implementation.

### Task G4A-02: Add bounded JSON extensions

**Objective:** Preserve safe metadata evolution without tolerating unknown edits.

**Files:**

- Create: `packages/edit-domain/src/json.ts`
- Test: `packages/edit-domain/src/json.test.ts`

**RED cases:**

- non-JSON values;
- unsafe numbers;
- excessive depth;
- excessive keys or bytes;
- non-namespaced extension keys;
- prototype-pollution keys;
- mutation after validation.

**GREEN behavior:** Validate, deep-copy, freeze, and serialize bounded JSON
extensions while preserving unknown namespaced values.

**Commit:** `feat(domain): add preserved bounded project extensions`

### Task G4A-03: Add rational time and range arithmetic

**Objective:** Establish exact time comparison and conversion before clips.

**Files:**

- Create: `packages/edit-domain/src/time.ts`
- Test: `packages/edit-domain/src/time.test.ts`

**RED cases:**

- non-integer ticks/timescale;
- zero/negative timescale;
- unsafe multiplication overflow;
- negative duration;
- range-end overflow;
- boundary equality under different timescales;
- half-open containment;
- conversion rounding policy.

**GREEN behavior:** Pure validated compare/add/subtract/convert/contains helpers
with explicit overflow errors.

**Commit:** `feat(domain): add exact media time contract`

### Task G4A-04: Add asset identity

**Objective:** Represent source media without leaking filesystem paths.

**Files:**

- Create: `packages/edit-domain/src/assets.ts`
- Test: `packages/edit-domain/src/assets.test.ts`
- Modify: `apps/api/src/projects/project-repository.ts`
- Test: `apps/api/src/projects/project-service.test.ts`

**RED cases:** bad IDs, malformed hashes, duration mismatch, invalid dimensions,
unsafe byte lengths, invalid frame-rate rational, untrusted storage references.

**GREEN behavior:** Construct one immutable `VideoAsset` from repository
manifest plus trusted probe output.

**Commit:** `feat(domain): add immutable video asset descriptor`

### Task G4A-05: Add geometry and anchor semantics

**Objective:** Replace the implicit top-left point meaning.

**Files:**

- Create: `packages/edit-domain/src/geometry.ts`
- Test: `packages/edit-domain/src/geometry.test.ts`
- Modify: `apps/web/src/features/point-target/point-target.ts`
- Test: `apps/web/src/features/point-target/point-target.test.ts`

**RED cases:** invalid coordinates, unknown coordinate spaces/anchors,
near-edge placement, letterboxing projection, portrait/landscape conversion.

**GREEN behavior:** Explicit source-normalized target plus owner-approved anchor.

**Commit:** `feat(domain): make spatial anchors explicit`

### Task G4A-06: Add composition, tracks, and clips

**Objective:** Give every future edit a stable target.

**Files:**

- Create: `packages/edit-domain/src/composition.ts`
- Test: `packages/edit-domain/src/composition.test.ts`

**RED cases:** duplicate IDs, missing assets, source ranges outside duration,
overlapping forbidden track state, invalid order, invalid composition bounds.

**GREEN behavior:** One valid composition containing the imported source clip
and the minimum track set.

**Commit:** `feat(domain): add minimal composition and clip model`

### Task G4A-07: Replace nameplate v1 timing ambiguity

**Objective:** Make the spatial sample and visible interval explicit.

**Files:**

- Create: `packages/edit-domain/src/operations.ts`
- Test: `packages/edit-domain/src/operations.test.ts`
- Modify: `packages/edit-domain/src/actions.ts`
- Modify: `packages/edit-domain/src/actions.test.ts`

**RED cases:** missing clip, source sample outside clip, display interval outside
composition, overlong text, invalid anchor, unknown fields, unknown operations.

**GREEN behavior:** Strict versioned nameplate operation addressed to stable
clip/composition IDs with bounded text and explicit interval.

**Commit:** `feat(domain): add scale-ready nameplate operation`

### Task G4A-08: Add capabilities

**Objective:** Register only operations the product can validate and render.

**Files:**

- Create: `packages/edit-domain/src/capabilities.ts`
- Test: `packages/edit-domain/src/capabilities.test.ts`

**RED cases:** duplicate IDs, missing dependency, invalid version, recursive
recipe, workflow exposed as primitive, renderer lacking required support.

**GREEN behavior:** Register one primitive and one nameplate component.

**Commit:** `feat(domain): add layered capability registry`

### Task G4A-09: Add atomic change sets and revision

**Objective:** Make one request one approval and one undo.

**Files:**

- Create: `packages/edit-domain/src/change-set.ts`
- Test: `packages/edit-domain/src/change-set.test.ts`
- Modify: `packages/edit-domain/src/history.ts`
- Modify: `packages/edit-domain/src/history.test.ts`

**RED cases:** stale base revision, duplicate IDs, empty operation set, one
invalid operation, partial application, replay, undo/redo revision errors.

**GREEN behavior:** Validate all operations before applying any; apply or reject
the entire change set; increment revision exactly once.

**Commit:** `feat(domain): make accepted edits atomic change sets`

### Task G4A-10: Add selective deactivation and dependency revalidation

**Objective:** Remove an older bad edit without destroying unrelated later work.

**Files:**

- Modify: `packages/edit-domain/src/change-set.ts`
- Modify: `packages/edit-domain/src/change-set.test.ts`
- Modify: `packages/edit-domain/src/history.ts`
- Modify: `packages/edit-domain/src/history.test.ts`

**RED cases:** remove middle independent edit, remove edit with direct dependent,
transitive dependency, redo after selective removal, invalid dependency cycle.

**GREEN behavior:** Independent later work remains active; dependent work is
explicitly blocked with reasons; nothing is silently rewritten.

**Commit:** `feat(domain): support dependency-aware edit removal`

### Task G4A-11: Implement Project v2

**Objective:** Assemble the approved contracts into one canonical project.

**Files:**

- Modify: `packages/edit-domain/src/project.ts`
- Modify: `packages/edit-domain/src/project.test.ts`
- Modify: `packages/edit-domain/package.json`

**RED cases:** exact core fields, unknown executable fields, preserved
extensions, invalid revision, broken asset/clip reference, invalid history,
mutation, deterministic serialization.

**GREEN behavior:** Validate, deep-copy, freeze, and serialize
`sanverse.project/v2`.

**Commit:** `feat(domain): add canonical project v2`

### Task G4A-12: Implement v1-to-v2 migration

**Objective:** Preserve every existing project and provide rollback.

**Files:**

- Create: `packages/edit-domain/src/migrations/project-v1-to-v2.ts`
- Test: `packages/edit-domain/src/migrations/project-v1-to-v2.test.ts`
- Create: `apps/api/src/projects/project-state-service.ts`
- Test: `apps/api/src/projects/project-state-service.test.ts`

**RED cases:** empty history, accepted actions, redo stack, issued IDs,
corrupt v1, repeated migration, interrupted write, existing backup, rollback.

**GREEN sequence:**

1. Read without mutating.
2. Validate v1.
3. Resolve trusted manifest/probe inputs.
4. Build v2 in memory.
5. Validate v2.
6. Write versioned backup beside state.
7. Atomically write v2.
8. Re-read and validate.
9. Preserve rollback command/path.

**Commit:** `feat(api): migrate project v1 to v2 safely`

### Task G4A-13: Add canonical render contract package

**Objective:** Define visual semantics once.

**Files:**

- Create all `packages/render-contract` files listed above
- Modify: root `package.json` only if workspace scripts require it
- Test: `packages/render-contract/src/*.test.ts`

**RED cases:** invalid interval, missing style, unsafe text, unsupported node,
non-deterministic node order, stale revision, mutation.

**GREEN behavior:** Compile validated active change sets into a frozen,
deterministically ordered `RenderPlan`.

**Commit:** `feat(render): add canonical render plan`

### Task G4A-14: Adapt browser preview

**Objective:** Render the nameplate only from the canonical plan.

**Files:** Browser files listed in Section 3.

**RED cases:** pending vs accepted plan, time boundary, anchor, wrapping,
secondary line, near-edge fit, stale plan, reduced layout size.

**GREEN behavior:** React receives render nodes rather than raw history actions.

**Commit:** `refactor(web): preview canonical render plan`

### Task G4A-15: Adapt FFmpeg export

**Objective:** Translate the same plan to controlled FFmpeg arguments.

**Files:** Render API files listed in Section 3.

**RED cases:** same style metrics as browser, wrapping fixture, anchors,
duration bounds before spawn, unsupported node before spawn, cancellation.

**GREEN behavior:** Renderer receives a `RenderPlan`, never raw chat or
unbounded history.

**Commit:** `refactor(api): render canonical plans with ffmpeg`

### Task G4A-16: Integrate persistence and routes

**Objective:** Make every API route read/write Project v2 and reject stale state.

**Files:**

- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/server.test.ts`
- Modify project repository/service tests

**RED cases:** v1 reopen/migration, v2 reopen, stale PUT, corrupt backup, invalid
operation, over-limit extensions, atomic save failure.

**Commit:** `feat(api): persist revisioned project v2`

### Task G4A-17: Integrate browser state

**Objective:** Make proposals revision-aware and change-set based.

**Files:**

- Modify app-state and Studio files listed in Section 3

**RED cases:** stale proposal after another accept, one request/one undo,
selective removal, save failure, reopened revision, pending proposal export.

**Commit:** `feat(web): use revisioned atomic edit proposals`

### Task G4A-18: Run migration and real-media evidence

**Objective:** Prove the product, not just the modules.

**Evidence sequence:**

1. Copy a real existing v1 project directory to an isolated test root.
2. Record hashes of source, manifest, and state.
3. Start normal PowerShell servers.
4. Open the v1 project.
5. Verify backup and migrated v2 on disk.
6. Preview existing edit.
7. Accept another edit.
8. Undo/redo one whole change set.
9. Selectively remove an older independent edit.
10. Reload and reopen.
11. Export and download.
12. Probe output dimensions, duration, audio, and frames.
13. Confirm source hash unchanged.
14. Exercise rollback on a separate copy.
15. Record E3/E4 evidence and limitations.

### Task G4A-19: Close documentation and owner gate

**Objective:** Reconcile all durable truth before G4-B.

**Files:** Evidence/documentation files listed in Section 3.

**Steps:**

1. Record exact commands and results.
2. Record failures with What/Where/When/Who/Why/How.
3. Update current state once.
4. Update tracker once.
5. Link ADRs and change record.
6. Run documentation link/contradiction checks.
7. Commit and push a coherent rollback point only after owner authorization.
8. Ask the owner to approve or reject G4-A exit.

## 6. Rollback contract

- Never overwrite the only v1 copy.
- Migration backup is created before atomic v2 publication.
- Source media and immutable manifest are never changed.
- Each implementation task is a coherent commit.
- The G4-A branch/tag is not called a rollback point until targeted tests,
  builds, real migration, real export, and owner review are recorded.
- No `git reset --hard` or destructive project-data cleanup is part of rollback.

## 7. G4-A exit checklist

- [ ] Owner approved all serialized contract decisions.
- [ ] Project v2 validates strict executable data.
- [ ] Unknown extensions round-trip.
- [ ] Unsupported actions fail loudly.
- [ ] v1 migration is idempotent.
- [ ] Migration backup and rollback work.
- [ ] Impossible times/text fail before acceptance.
- [ ] Stable assets/clips/time spaces exist.
- [ ] One change set equals one undo.
- [ ] Selective removal does not destroy unrelated later work.
- [ ] Stale revisions fail closed.
- [ ] Browser and FFmpeg consume one canonical plan.
- [ ] Existing nameplate visual behavior is intentionally preserved or changed
      with owner approval.
- [ ] Preview/export fidelity evidence exists.
- [ ] Real project reopen and export evidence exists.
- [ ] Source hash remains unchanged.
- [ ] Current docs contain one non-contradictory truth.
- [ ] Owner approves entry into G4-B.
