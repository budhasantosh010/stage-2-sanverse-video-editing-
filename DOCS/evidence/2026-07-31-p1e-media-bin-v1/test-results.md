# P1-E final test and build results

All commands ran sequentially on the final source tree.

| Gate | Result |
|---|---:|
| Web | 55 files, 473/473 passed |
| Edit domain | 23 files, 265/265 passed |
| API | 20 files, 235/235 passed |
| Render contract | 5 files, 51/51 passed |
| Intent domain | 3 files, 27/27 passed |
| All-workspace production build | Passed |

## Verification failure found during closure

The full web suite initially hung in `StudioCanvasIntegration.test.tsx`. P1-E had defaulted optional `assetOriginalNames` to a new `{}` on every Studio render. That changed the media-source input identity, retriggered the source-probe effect, and scheduled another state update indefinitely when tests omitted the optional map.

Repair: one frozen module-level empty name map plus a true no-op when no source probe exists. The formerly hanging file then passed 4/4, the affected Media/Canvas integration gate passed 9/9, and the normal single-process full web command completed 473/473.

The first final build also found a test-only TypeScript narrowing issue around a deferred source-probe resolver. The test now uses an explicit promise resolver helper; production behavior was unchanged. All final gates were rerun after this edit.

## Bundle

| Asset | P1-D baseline | P1-E final | Delta |
|---|---:|---:|---:|
| Modules | 155 | 168 | +13 |
| CSS raw | 69.04 kB | 73.55 kB | +4.51 kB |
| CSS gzip | 12.39 kB | 13.16 kB | +0.77 kB |
| JavaScript raw | 489.05 kB | 505.46 kB | +16.41 kB |
| JavaScript gzip | 135.73 kB | 140.55 kB | +4.82 kB |

No runtime dependency was added. The existing runtime font-resolution warning and Vite chunk-size warning remain unchanged.
