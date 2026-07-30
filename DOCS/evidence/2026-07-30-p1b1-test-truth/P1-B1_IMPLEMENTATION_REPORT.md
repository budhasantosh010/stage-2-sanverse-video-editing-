# P1-B.1 IMPLEMENTATION REPORT — Repository-wide test truth

Date: 2026-07-30  
Branch: `agent/g6-g8-local-alpha`  
Start commit: `fbc18e0bfa471b5fbd4016e681e4b9ebcfedc678`  
End commit: this focused P1-B.1 verification-maintenance commit

## Objective

Restore truthful repository-wide test results after P1-B without changing the
product. This task resolves only `FAIL-024`, `FAIL-025`, and `FAIL-026`.

The protected boundary was:

```text
production source and behavior
  = unchanged

test collection and assertions
  = aligned with the current product contracts
```

P1-C, timeline polish, new interactions, project schemas, API runtime behavior,
rendering, export implementation, proposals, and Undo/Redo were not touched.

## Exact files changed

### Test code

- `packages/edit-domain/src/motion-fidelity.contract.test.ts`
- `apps/api/src/jobs/local-export-job-store.contract.test.ts`
- `apps/api/src/projects/portable-project.contract.test.ts`
- `apps/api/src/server.test.ts`
- `apps/web/src/features/overlays/OverlayRepairPanel.test.tsx`

### Documentation and evidence

- `DOCS/FAILURE_REGISTRY.md`
- `START_HERE.md`
- `DOCS/CURRENT_STATE.md`
- `DOCS/HANDOFF.md`
- `DOCS/BUILD_TRACKER.md`
- `DOCS/PROJECT_LOG.md`
- this evidence folder

No production TypeScript, React, CSS, API route, domain, renderer, or persistence
file changed.

## FAIL-024 — contract files collected as empty Vitest modules

### Old failure

Three files contained real `node:test` assertions but were named `*.test.ts`.
Vitest collected them, could not see the Node test registrations, and exited 1
with “No test suite found” after the other assertions passed.

### Root cause

The files were executable tests using a different test registrar than the
repository-wide Vitest command.

### Exact solution

The assertions and filenames were kept. Only the test registrar import changed
from `node:test` to Vitest in all three files. This is more truthful than
renaming them away from test collection because the contracts are genuine,
valuable executable tests.

```text
existing assertions
  + repository test runner
  = collected and executed normally
```

No fake empty tests were added and no assertion was weakened.

## FAIL-025 — export server tests asserted the removed synchronous contract

### Old failure

Two `server.test.ts` cases expected an immediate successful export object with
HTTP 201 or an immediate renderer failure with HTTP 503. The current durable
endpoint correctly returns HTTP 202 with a queued export job and performs the
renderer work asynchronously.

### Root cause

The tests were not advanced when the production route moved to the durable job
lifecycle.

### Exact solution

The tests now verify the actual stable contract:

```text
POST /api/projects/:projectId/exports
  -> 202 Accepted
  -> safe queued PublicExportJob
  -> GET /api/projects/:projectId/export-jobs/:jobId
  -> succeeded result or failed safe error
  -> export media contract remains available on success
```

The success case proves queued acceptance, attempts/progress, terminal success,
result metadata, controlled output path, and ranged download behavior.

The failure case proves queued acceptance, terminal `failed`, the safe
`RENDER_PROCESS_BLOCKED` code/message, absence of the raw operating-system
message, and absence of a result.

The test imports the production `PublicExportJob` type instead of maintaining a
second copied response contract. Vitest's bounded `waitFor` polls the observable
job endpoint; no arbitrary hard-coded sleep was introduced. Temporary durable
job roots are removed after each test.

No production route or job implementation changed.

## FAIL-026 — jsdom lost the minus sign while typing

### Old failure

The music repair test intended to enter `-24`, but the sequence that cleared a
number input and typed `-` and the digits separately left the controlled input
at `24` in jsdom.

### Root cause

The simulation did not model the browser's signed number input behavior
truthfully. The product callback was not the source of the sign loss.

### Exact solution

The test now sends the complete signed value in one change event, verifies the
controlled input displays `-24`, submits, and proves the callback receives
`gainDb: -24`.

No product component changed.

## Verification summary

| Gate | Result |
|---|---:|
| Full web | 34 files, 332 tests passed |
| Full edit-domain | 23 files, 265 tests passed |
| Full API | 20 files, 233 tests passed |
| Render contract | 5 files, 51 tests passed |
| Intent domain | 3 files, 27 tests passed |
| Focused P1-B Timeline/Studio | 5 files, 79 tests passed |
| All-workspace production build | Passed |

Focused repairs also passed directly:

- Overlay repair: 2/2;
- motion fidelity contract: 2/2;
- API contract/server set: 17/17.

See `test-results.md` for the exact commands and output totals.

## Production bundle comparison

P1-B baseline:

```text
123 modules
index.html 0.72 kB / 0.46 kB gzip
CSS        59.20 kB / 10.54 kB gzip
JS         419.56 kB / 118.43 kB gzip
```

P1-B.1 produced the same module count, output filenames, raw sizes, and gzip
sizes. The task added no runtime dependency and changed no production source.

## Product behavior statement

Product behavior is unchanged. The P1-B real Edge/media/export evidence remains
the runtime evidence for the product. A second browser walkthrough was not
necessary for this test-only maintenance slice because:

1. no production source changed;
2. the complete production bundle is identical;
3. focused Timeline/Studio tests remain 79/79;
4. the full web, API, domain, render, and intent suites now all exit 0.

## Issues resolved

- `FAIL-024` — RESOLVED;
- `FAIL-025` — RESOLVED;
- `FAIL-026` — RESOLVED.

## Remaining issues and open P0/P1 gates

Not changed by this task:

- `FAIL-021` remains `MONITORING`: the 30-second export crossed the 60-second
  walkthrough budget;
- `FEATURE-001` remains `PLANNED`: optional desktop composer resize preference;
- P1-C Inspector V1 has not started;
- owner-only evidence remains open for native drag-and-drop feel, final motion
  and overall Studio UX judgment, repeated owner workflows, representative
  non-editor smoke tests, and agreed E5 performance/reliability budgets;
- a real AI provider still requires the owner's data-leaving-machine decision
  and keys.

None of these blocks the truthfulness of the restored repository-wide suites.

## Architecture consequence review

```text
1st order  broad commands now report the real state and exit 0
2nd order  genuine contract assertions remain executed, not hidden
3rd order  export tests will detect drift across acceptance, polling and result states
4th order  CI and future agents can trust one product contract instead of stale snapshots
```

The implementation is deliberately test-only and reversible.
