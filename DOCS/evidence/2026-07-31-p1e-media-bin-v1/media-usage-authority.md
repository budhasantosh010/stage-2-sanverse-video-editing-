# Media usage authority

`apps/web/src/features/media/media-usage.ts` derives usage only from the accepted `EditProject`.

Counted references:

- primary composition clips;
- active accepted media-overlay operations;
- active accepted music operations.

Detached proposals, UI selection, search results, filters, and inactive history do not become usage. The index is immutable and is recomputed from the authoritative project instead of being incrementally maintained in a second store.

Usage drives visible `Unused` or `Used N times` text and safe removal refusal. Missing media retains its usage truth, so a broken source does not appear unreferenced.

Proof: `media-usage.test.ts`, `media-view-model.test.ts`, `StudioMediaBinIntegration.test.tsx`, and the real browser report's `usage` object.
