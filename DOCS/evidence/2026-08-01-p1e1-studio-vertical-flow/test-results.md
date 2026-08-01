# P1-E.1 Test Results

## Focused gate

Command:

```text
npm test --workspace @sanverse/web -- --run src/styles/visual-contract.test.ts src/screens/studio/StudioScreen.test.tsx src/screens/studio/StudioCanvasIntegration.test.tsx src/editor/timeline/Timeline.test.tsx src/editor/canvas/CanvasInteractionLayer.test.tsx src/editor/canvas/CanvasInteractionModes.test.tsx src/features/annotation/annotation-capture.test.ts src/editor/media/MediaBin.test.tsx src/editor/inspector/Inspector.test.tsx
```

Result: **120/120 passed** across 9 files.

## Final repository gates

- Web: **476/476 passed**, 55/55 files.
- Edit domain: **265/265 passed**, 23/23 files.
- API: **235/235 passed**, 20/20 files.
- Render contract: **51/51 passed**, 5/5 files.
- Intent domain: **27/27 passed**, 3/3 files.
- All-workspace production build: **passed**.

## Production bundle

- Modules: **168**.
- CSS: **73.66 kB raw / 13.16 kB gzip**.
- JavaScript: **505.55 kB raw / 140.57 kB gzip**.

P1-E baseline:

- Modules: 168.
- CSS: 73.55 kB raw / 13.16 kB gzip.
- JavaScript: 505.46 kB raw / 140.55 kB gzip.

P1-E.1 delta:

- Modules: 0.
- CSS: +0.11 kB raw / +0.00 kB gzip.
- JavaScript: +0.09 kB raw / +0.02 kB gzip.
- Dependencies: none.

The existing runtime-resolved nameplate-font warning and Rollup 500 kB chunk warning remain unchanged.
