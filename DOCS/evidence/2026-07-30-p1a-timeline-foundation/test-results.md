# P1-A test results

Date: 2026-07-30

## Focused web timeline gate

Command:

```text
npm test --workspace @sanverse/web -- --run src/features/timeline/timeline-view-model.test.ts src/features/timeline/timeline-viewport-state.test.ts src/features/timeline/timeline-gesture-adapter.test.ts src/features/timeline/timeline-edits.test.ts
```

Result: **4 files, 71 tests, all passed**.

Coverage includes deterministic projection, accepted/effective clips, derived gaps, dialogue mirrors, captions, overlays, music, pending and stale proposals, blocked diagnostics, stable identity through repairs, immutability, representative large input, viewport bounds, zoom-anchor preservation, and gesture adaptation/refusal.

## Affected edit-domain gate

Command:

```text
npm test --workspace @sanverse/edit-domain -- --run src/timeline-operations.test.ts src/timeline-history.test.ts src/caption-operations.test.ts src/overlay-operations.test.ts
```

Result: **4 files, 77 tests, all passed**.

## All-workspace production build

Command:

```text
npm run build
```

Result: **passed sequentially for API, web, edit-domain, intent-domain, and render-contract**.

Production web output remained identical to P0-E because P1-A is not imported by production UI:

- 104 modules
- CSS 48.47 kB / 8.78 kB gzip
- JS 374.08 kB / 106.78 kB gzip

The existing runtime-resolved `/api/render-assets/nameplate-font` Vite warning remained unchanged.

## Implementation-time failures

These were local development mistakes, not shipped product defects:

1. **Malformed patch invocation**
   - What: the first patch lacked unified-diff file headers.
   - Where: initial documentation edit.
   - How/why: incorrect tool payload format.
   - Tried: stopped using that malformed patch and used guarded exact edits.
   - Status: resolved; no file corruption occurred.
   - One-line solution: use valid `+++ b/...` headers or guarded exact edits.

2. **Unavailable automatic diagnostics runner**
   - What: the harness found no standalone diagnostics command.
   - Where: post-implementation type gate.
   - How/why: repository exposes TypeScript through workspace build scripts rather than the generic diagnostics detector.
   - Tried: ran `npm run build --workspace @sanverse/web -- --pretty false` directly.
   - Status: resolved as an environment/tool-discovery limitation.
   - One-line solution: run the repository's explicit TypeScript build command.

3. **Two TypeScript construction errors**
   - What: one union result was read before narrowing; three fixture coordinate-space literals widened to `string`.
   - Where: `timeline-gesture-adapter.ts` and `timeline-test-fixtures.ts`.
   - How/why: first-pass type construction mistakes.
   - Tried: added explicit success narrowing and literal typing, then reran the web TypeScript build.
   - Status: resolved before tests; no production behavior was affected.
   - One-line solution: preserve discriminated-union narrowing and literal domain types at fixture boundaries.

No new open product failure was discovered. `FAIL-021` remains monitoring and `FEATURE-001` remains planned; neither was changed.