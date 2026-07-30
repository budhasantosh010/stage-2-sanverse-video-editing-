# P1-B test and build results

## Passing gates

### Timeline and Studio

```text
npm test --workspace @sanverse/web -- --run \
  src/editor/timeline/Timeline.test.tsx \
  src/editor/timeline/timeline-snap.test.ts \
  src/editor/timeline/timeline-ruler-model.test.ts \
  src/editor/timeline/timeline-selection.test.ts \
  src/screens/studio/StudioScreen.test.tsx

5 files passed
79 tests passed
```

Coverage includes semantic lanes, ruler math, selection reconciliation, visible
range/overscan on a 171-item projection, click seek, playhead keyboard movement,
zoom/Fit as presentation state, direct typed gestures, proposal ghosts, Delete
focus safety, right-click and Shift+F10 menus, deterministic snapping, existing
Studio continuity, and direct-control regressions.

### Affected edit domain

```text
npm test --workspace @sanverse/edit-domain -- --run \
  src/timeline-operations.test.ts \
  src/timeline-history.test.ts \
  src/caption-operations.test.ts \
  src/overlay-operations.test.ts

4 files passed
77 tests passed
```

### Unchanged adjacent contracts

```text
@sanverse/render-contract  51/51 passed
@sanverse/intent-domain    27/27 passed
```

### Production build

```text
npm run build

@sanverse/api              passed
@sanverse/web              passed
@sanverse/edit-domain      passed
@sanverse/intent-domain    passed
@sanverse/render-contract  passed
```

Final web output:

```text
123 modules
index.html 0.72 kB / 0.46 gzip
CSS        59.20 kB / 10.54 gzip
JS         419.56 kB / 118.43 gzip
```

The existing runtime-resolved nameplate-font warning remains unchanged.

## Broad-suite limitations observed

### Full web

```text
324 passed, 1 failed
```

`OverlayRepairPanel.test.tsx` expected music gain `-24`; its jsdom/user-event
number-input sequence produced `+24`. Re-running that file alone reproduced the
same failure. P1-B does not modify `OverlayRepairPanel`.

### Full edit-domain

```text
263 assertions passed
Vitest exit 1: motion-fidelity.contract.test.ts has no Vitest suite
```

### Full API

```text
228 passed, 2 failed, 2 files failed collection
```

- `local-export-job-store.contract.test.ts`: no Vitest suite;
- `portable-project.contract.test.ts`: no Vitest suite;
- two `server.test.ts` assertions expect old synchronous export statuses 201 and
  503, while the current API returns asynchronous 202.

The same API result remained after the live dev server was stopped, so it was
not browser-run interference. P1-B modifies no API code.

### All-workspace test wrapper

The first combined command exceeded the Harness synchronous response window and
left an empty generated `apps/api/unused/` directory. The directory was inspected
and removed. Workspace tests were then run separately for explicit results.

## Implementation-time failures and recovery

1. First web build found missing imports/state and one invalid dialogue kind
   comparison. Correct module ownership and linked-clip identity fixed them.
2. Existing Studio tests expected the removed one-row strip. They were updated
   to assert the real semantic Timeline V1 while preserving all direct controls.
3. The first project scan used a callback name matcher unsupported by Python
   Playwright. A regular expression replaced it.
4. The browser found lane clipping, proposal/timeline overlap, trim-tooltip
   clipping, off-screen export readiness, and context/action overflow. Each was
   fixed and recaptured.
5. The first combined PowerShell gate used Bash `&&`; PowerShell rejected it
   before execution. The gates were rerun separately.
6. Stopping the Harness dev parent left Vite/API child processes on ports
   2000/2001. Their exact command lines were inspected before only those two
   processes were stopped.

No failure was hidden or treated as a pass.
