# Sanverse Creative Library — L1 Architecture

Date: 2026-08-11
Status: **L1 implementation + local verification complete**
Scope: development Motion Lab only; production `apps/web` remains untouched.

## Purpose and authority

The Creative Library is a browser/review surface over the existing Plan-A Motion system. It does not create a second component catalog, Motion Graph, Layer tree, keyframe store, renderer or clock.

```text
public Motion component registry
          │
          ▼
typed Library discovery metadata
   ┌──────┼─────────┐
   ▼      ▼         ▼
poster  live player review metadata
   │      │         │
   └──────┴─────────┘
          │
          ▼
real Plan-A module → same Motion Graph → C3/C4/C5
```

`packages/motion-library/src/library-catalog.ts` derives all entries from the canonical public component catalog. L1 adds only discovery/review concerns: aliases, category, intents, contexts, formats, milestone, performance class, lineage, canonical preview definition and review summary. Validation fails closed on unknown/duplicate IDs, invalid taxonomy or invalid preview definitions.

Search is deterministic/local and indexes name, ID, aliases, description, category, intents, contexts, formats, milestone and lineage. Collections are derived from the same catalog, including All Components, Recently Added, YouTube Essentials, WOW/Cinematic, Product Storytelling and Needs Motion Review. The future B2 seam may consume this catalog, but B2 is not implemented here.

## Development routes

```text
/library
/library?collection=...
/library?q=...
/library/component/:componentId
/library/showreel
/library/review
/library/poster/:componentId
/library/audit/:componentId
```

## Static-poster-first grid

The grid does not mount 89 players. Each card starts with a generated 480×270 poster. Pressing Play mounts the real Motion component. Optional hover auto-preview is off by default and delayed. Starting another preview replaces the first; at most one inline player is active. A preview is stopped when its card leaves the viewport and returns to poster state after completion.

## Canonical preview/player

`apps/motion-lab/src/library/preview-model.ts` resolves the real public module and validates real props/style through existing module validators. It uses the existing four compositions, eight shared style packs, reduced-motion path and canonical `1,440,000` ticks/second authority.

The detail player provides Play/Pause, Replay, exact scrub, 0.5×/1×/2× speed, all four ratios, shared styles, dark/light/neutral/busy backgrounds, reduced motion, discovery metadata, Component Lab deep link and C3/C4/C5 Compositor deep link. Display state is reflected in the local URL.

## Deterministic posters

`scripts/generate-library-posters.ts` uses the real Motion Lab poster route and local Edge/Chromium. Assets live under:

```text
motion/library-previews/posters/
motion/library-previews/poster-manifest.v1.json
```

Each entry has a deterministic `previewHash`; `--stale` skips an existing poster only when its file and hash match.

```text
npm run motion-library:posters -- --all --force
npm run motion-library:posters -- --all --stale
npm run motion-library:posters -- --component sanverse.donut-breakdown --force
```

Final L1 freshness rerun: **89 selected, 0 regenerated, 89 skipped fresh**.

## Showreel

`/library/showreel` plays either a named collection or the current Library filter using the same real `LibraryPlayer`. It provides Previous / Replay / Next, optional auto-next, ArrowLeft/ArrowRight navigation and Space replay. `collection=all-components` is the complete 89-component reel.

## Motion review domain

`packages/motion-library/src/library-review.ts` keeps visual review distinct from tests/builds.

Statuses:

`unreviewed | in-review | needs-polish | passed | rejected`

Quality tiers:

`S | A | B | C | Experimental`

Scored dimensions (1–5): entrance, pacing, easing, rhythm, readability, hold, payoff, exit, competing motion, footage compatibility, professional feel and overall.

A `passed` review is invalid unless `fullPlaybackVerified === true` and `playbackSpeed === 1`. Identity is `(componentId, fixtureId)` and duplicates fail validation.

Durable development review data is stored at `motion/library-reviews/reviews.v1.json`. Motion Lab exposes local-only `GET/POST /__sanverse/library-reviews`; the browser store validates with the authoritative Motion Library domain and the Vite endpoint adds bounded structural validation plus temp-file → atomic rename replacement. It is not a production API.

## Real 1× audit

`/library/audit/:componentId` renders one real component at canonical 16:9, canonical style/background, autoplay exactly 1× and no review UI noise.

`scripts/audit-library-motion.ts` drives real Edge over CDP, waits for the player's own `data-library-full-playback="true"` marker and captures temporal frames during the actual run. It supports `--component`, `--from` and `--limit` so long catalog audits can restart Edge in bounded chunks. This was necessary because one long-lived headless browser occasionally accumulated navigation latency after several complete animations; the component run itself was not treated as failed.

## Measured local browser characteristics

Final real-Edge engineering measurements:

| Surface | Ready wall time | DOMContentLoaded | DOM nodes | Live players |
|---|---:|---:|---:|---:|
| `/library` (89 cards) | 1419.9 ms | 896.1 ms | 1465 | 0 |
| search `agent` (3 cards) | 582.2 ms | 452.4 ms | 180 | 0 |
| Donut detail | 437.0 ms | 251.1 ms | 237 | 1 |
| 89-item showreel | 296.1 ms | 212.0 ms | 178 | 1 |
| review queue | 414.3 ms | 277.7 ms | 408 | 0 |

First inline real preview activation measured **208.4 ms**. These are development-machine engineering measurements, not production SLAs or FPS claims.

Synthetic metadata tests also cover filter/sort at 89/150/300/500 entries and search at 100/500/1000 entries.

## Accessibility / hygiene

Real Edge route checks over Library, search, detail, showreel and review found:

- **0 unnamed interactive controls**;
- **0 images missing alt text**;
- no grid player before interaction;
- exactly one live player after inline activation;
- keyboard-visible focus styling;
- real reduced-motion support through the component runtime.

## Stop boundary

L1 does not authorize A22, B2/B3, C6, production Studio/`apps/web` integration, marketplace/publishing infrastructure, external animation runtimes or any second Motion authority. The next Creative Engine implementation cycle still requires explicit authorization.
