# P1-D test results

All final gates ran sequentially on Windows.

## Required commands

```text
npm test --workspace @sanverse/web -- --run
npm test --workspace @sanverse/edit-domain -- --run
npm test --workspace @sanverse/api -- --run
npm test --workspace @sanverse/render-contract -- --run
npm test --workspace @sanverse/intent-domain -- --run
npm run build
```

## Final results

| Gate | Result |
|---|---:|
| Web | 48 files, 442/442 passed |
| Edit domain | 23 files, 265/265 passed |
| API | 20 files, 235/235 passed |
| Render contract | 5 files, 51/51 passed |
| Intent domain | 3 files, 27/27 passed |
| All-workspace build | passed |

Focused P1-D geometry, Point, CSS, preview, Canvas, Studio, and Inspector gate: 13 files and 142/142 passed. App authority boundary: 12/12 passed. FFmpeg overlay filter graph: 33/33 passed.

## Failures encountered and resolved

- The first full web run found annotation capture accepting unknown intrinsic media dimensions after a layout fallback was placed too low in the shared geometry layer. The fallback moved to Studio layout only; strict Point/annotation capture remains fail-closed. Full web then passed 442/442.
- Full API lifecycle tests reproduced Windows filesystem contention. HTTP lifecycle tests now inject a deterministic in-memory store, while the dedicated filesystem contract continues to test real job durability. Production storage is unchanged. Full API passed 235/235.
- The first build found `effects: []` inferred as `never[]` inside a test fixture. The fixture now uses the existing `VisualPropertiesNode` type. Production code was unchanged; the complete build passed.

## Production bundle

| Asset | P1-C | P1-D | Delta |
|---|---:|---:|---:|
| CSS raw | 63.89 kB | 69.04 kB | +5.15 kB |
| CSS gzip | 11.40 kB | 12.39 kB | +0.99 kB |
| JS raw | 463.68 kB | 489.05 kB | +25.37 kB |
| JS gzip | 128.38 kB | 135.73 kB | +7.35 kB |
| Modules | 140 | 155 | +15 |

No runtime dependency was added. The existing `/api/render-assets/nameplate-font` runtime-resolution warning remains unchanged.
