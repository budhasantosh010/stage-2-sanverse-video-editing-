# P1-B.1 test and build results

Date: 2026-07-30  
Start commit: `fbc18e0bfa471b5fbd4016e681e4b9ebcfedc678`

## Start verification

```text
git branch --show-current
git rev-parse HEAD
git status --short
git log -1 --oneline
```

Verified before edits:

```text
branch: agent/g6-g8-local-alpha
HEAD:   fbc18e0bfa471b5fbd4016e681e4b9ebcfedc678
status: clean
commit: fbc18e0 feat(web): complete P1-B production timeline v1
```

## Focused repair gates

### Signed music gain

```text
npm test --workspace @sanverse/web -- --run \
  src/features/overlays/OverlayRepairPanel.test.tsx
```

Result: **1 file, 2 tests passed**.

The test verifies the input displays `-24` and the repair callback receives
`gainDb: -24`.

### Motion contract collection

```text
npm test --workspace @sanverse/edit-domain -- --run \
  src/motion-fidelity.contract.test.ts
```

Result: **1 file, 2 tests passed**.

### API contract and lifecycle set

```text
npm test --workspace @sanverse/api -- --run \
  src/jobs/local-export-job-store.contract.test.ts \
  src/projects/portable-project.contract.test.ts \
  src/server.test.ts
```

Result: **3 files, 17 tests passed**.

This includes:

- durable job persistence/deduplication/recovery;
- portable archive integrity/restoration;
- `202 Accepted` queued export job;
- deterministic polling to `succeeded`;
- result and ranged media contract;
- deterministic polling to `failed`;
- safe `RENDER_PROCESS_BLOCKED` error without raw OS detail.

## Required broad gates

All gates were run sequentially on Windows.

### 1. Full web

The first synchronous invocation exceeded the Harness response window, which is
not a test result. The same full suite was then run as one background process
with the dot reporter so its exit code and totals could be captured:

```text
npm test --workspace @sanverse/web -- --reporter=dot
```

Result:

```text
34 test files passed
332 tests passed
exit 0
```

No signed-number failure remains.

### 2. Full edit-domain

```text
npm test --workspace @sanverse/edit-domain
```

Result:

```text
23 test files passed
265 tests passed
exit 0
```

`motion-fidelity.contract.test.ts` is collected and executes two assertions.
No empty-suite failure remains.

### 3. Full API

```text
npm test --workspace @sanverse/api
```

Result:

```text
20 test files passed
233 tests passed
exit 0
```

Both contract files are collected and execute three tests total. The two export
server cases pass against the asynchronous lifecycle. The suite's deliberate
stderr from the response-metadata-failure test remains expected and asserted;
it is not a suite failure.

### 4. Render contract

```text
npm test --workspace @sanverse/render-contract
```

Result:

```text
5 test files passed
51 tests passed
exit 0
```

### 5. Intent domain

```text
npm test --workspace @sanverse/intent-domain
```

Result:

```text
3 test files passed
27 tests passed
exit 0
```

### 6. Focused P1-B Timeline/Studio regression

```text
npm test --workspace @sanverse/web -- --run \
  src/editor/timeline/Timeline.test.tsx \
  src/editor/timeline/timeline-snap.test.ts \
  src/editor/timeline/timeline-ruler-model.test.ts \
  src/editor/timeline/timeline-selection.test.ts \
  src/screens/studio/StudioScreen.test.tsx
```

Result:

```text
5 test files passed
79 tests passed
exit 0
```

### 7. All-workspace production build

```text
npm run build
```

Result: **passed sequentially for API, web, edit-domain, intent-domain and
render-contract**.

Web output:

```text
123 modules
index.html                 0.72 kB / 0.46 kB gzip
assets/index-DslF4k8U.css 59.20 kB / 10.54 kB gzip
assets/index-C2Cc__uT.js 419.56 kB / 118.43 kB gzip
```

This exactly matches the recorded P1-B output. The existing runtime-resolved
`/api/render-assets/nameplate-font` Vite warning is unchanged.

## Implementation-time failures

These were local test-maintenance mistakes and were resolved before the broad
gates. They are not new product issues.

### Missing `fireEvent` import after a two-edit batch

- **What:** The test body used `fireEvent`, but the import change was lost when
  two writes targeted the same file in one atomic edit batch.
- **Where:** `OverlayRepairPanel.test.tsx`.
- **How reproduced:** Focused test reported `ReferenceError: fireEvent is not defined`.
- **Attempted fix:** Restored the explicit import and reran the exact focused test.
- **Result:** 2/2 passed.
- **One-line solution:** Do not batch multiple independent writes to the same
  file when the edit tool resolves them from one original snapshot.

### Homemade polling loop completed before durable Windows file writes

- **What:** A manual 100-iteration HTTP loop exhausted in about 200 ms while the
  job store was still `queued` or `running`.
- **Where:** First P1-B.1 draft of the two export lifecycle tests.
- **Why:** Iteration count is not a time or completion guarantee when the system
  performs real atomic writes and file flushes.
- **Attempted fix:** Replaced the loop with Vitest's bounded async `waitFor`
  polling helper against the observable job endpoint.
- **Result:** API focused set 17/17 and full API 233/233 passed.
- **One-line solution:** Poll the observable terminal condition with the test
  framework's bounded helper rather than guessing an iteration budget.

### Whole-test timeout equalled the polling-helper timeout

- **What:** A later full API rerun ended both export lifecycle tests at Vitest's
  default five-second whole-test limit while their polling helper also owned a
  five-second limit.
- **Where:** The two asynchronous export lifecycle cases in `server.test.ts`.
- **Why:** The test runner and the assertion helper raced for the same deadline
  under full-suite process and filesystem contention.
- **Attempted fix:** First raised the containing tests above the helper budget.
  A subsequent full run showed the successful durable job could remain
  `running` slightly beyond five seconds under contention, so condition-based
  polling was bounded at ten seconds and each containing test at fifteen.
  No sleep, retry loop, or production behavior changed.
- **Result:** Focused API 17/17 and final full API 233/233 passed.
- **One-line solution:** Make the whole-test budget strictly larger than the
  bounded asynchronous assertion budget.

### Synchronous full-web result transport timeout

- **What:** The Harness response window closed before the full web command
  returned its summary.
- **Where:** Verification transport only.
- **Attempted fix:** Ran the unchanged full suite as one background process with
  a compact reporter and polled it to completion.
- **Result:** 332/332, exit 0.
- **One-line solution:** Use a background process for long broad suites when the
  synchronous tool window is shorter than the test run.

No new open issue was discovered.
