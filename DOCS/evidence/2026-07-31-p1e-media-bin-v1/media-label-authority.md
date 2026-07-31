# Media display-label authority

## Problem

Before P1-E, Media and editor surfaces could derive different ordinal labels for the same imported asset. That was `UX-011`.

## Authority

`apps/web/src/features/media/media-display-labels.ts` owns one pure `deriveAssetDisplayLabels` function. It strips raw path segments, uses the safe current-session upload filename when available, disambiguates duplicates deterministically, and falls back by media family (`Video 1`, `Image 1`, `Audio 1`).

Studio computes the map once and supplies it to:

- Media Bin view model;
- Timeline view model;
- Inspector selection resolver;
- Canvas selection labels.

No component patches or independent numbering remain.

## Proof

- `media-display-labels.test.ts` proves path stripping, family fallbacks, duplicate disambiguation, and deterministic ordering.
- `StudioMediaBinIntegration.test.tsx` proves one imported image uses one name across Media, Timeline, preview/Canvas selection, and Inspector.
- `browser-report.json` records `hero-frame.png` across Media, Timeline, Inspector, and Canvas.
- `screenshots/image-added-to-timeline-1440x900.png` visibly shows `hero-frame.png` in Media, Canvas/preview context, Inspector, and V2 Timeline.

`UX-011` is resolved in the P1-E completion commit.
