# SANVERSE CREATIVE ENGINE ABC-2 — Source Understanding → Curve-Control Evidence

Date: 2026-08-11
Status: complete; preserved by integrated checkpoint tag `sanverse-creative-engine-abc2`

## Cycle boundary

ABC-2 completes exactly these lanes over the preserved ABC-1 architecture:

1. **B1 Source Understanding Foundation** — preserved by `video-understanding-b1`;
2. **C5 Professional Curve Editor / Value Graph** — preserved by `motion-compositor-c5`;
3. **A21 Creator Utility + Advanced Visual Pack** — preserved by `motion-library-v1.5`;
4. **cross-plan source→creative→component→graph→curve proof** — this document.

No A22, B2/B3 or C6 work is included. Production `apps/web` remains outside this cycle.

## Authority chain proved

```text
original generic source fixture
        |
        v
B1 Video Understanding
  semantic observation + provenance + exact evidence ticks
        |
        v
B0 Creative Direction
  semantic directive + stable sourceObservationIds
        |
        v
Creative Edit Proposal
  selected Plan-A component + same observation refs
        |
        v
Plan A component
  one Motion Scene / real C2 Animatable authority
        |
        +------> C3 Layers
        |
        +------> C4 Timeline
        |
        `------> C5 Value Graph / Bezier operations
```

The integration does not create a second source model, proposal store, Motion Graph, keyframe store, Layer document or clock.

## Development integration seams

### `creative-engine-source-bridge.ts`

The Motion Lab development seam now provides:

- `resolveCreativeSourceTrace(...)` — resolves one stable B1 observation ID into exact evidence ticks, confidence, provenance/analyzer and transcript references without mutating B1;
- `createSourceStatisticCreativeDirection(...)` — deterministic B1→B0 semantic adapter for source statistics; it creates creative direction only and has no Motion-library dependency;
- `linkCreativeDirectiveToSourceObservations(...)` — attaches verified B1 observation IDs to an existing B0 directive while preserving the stable directive ID/creative choice.

For a percentage inside 0–100, the statistic adapter may derive the mathematical complement for a part-to-whole visual. The real 68% fixture therefore produces only source-supported/derived content:

```text
Observed  = 68
Remaining = 100 - 68 = 32
```

No historical point, customer fact or trend value is invented.

### `creative-engine-bridge.ts`

The existing B0 proposal→Plan-A Motion bridge now additionally:

- maps semantic `content.fields.value` into family component `value` props;
- carries that value into direct Motion Lab preview URLs;
- exposes exact proportional B0 edit-region ↔ Plan-A local-motion mapping helpers:
  - `sourceTickToPlacementLocalTicks(...)`
  - `placementLocalTicksToSourceTick(...)`

These helpers project between the two existing authorities. They are not a new clock.

## Required proof 1 — real B1 68% statistic → A21 → C5

Source fixture:

- source ID: `source:generic-product-launch`;
- transcript `transcript:1`: `Our agent now completes 68% of requests automatically.`;
- evidence range: **4.000s → 8.000s**;
- semantic kind: `percentage`;
- value/unit: **68%**;
- analyzer provenance: `sanverse.semantic-rules.v1`;
- stable observation ID is discovered from the B1 document and preserved through B0/proposal rather than recreated by Motion.

B1→B0 adapter creates one `source-statistic` graphic directive over the same exact evidence region and stores the observation ID in `sourceObservationIds`.

The test-local deterministic B0 resolver selects **`sanverse.donut-breakdown`** from the real 89-component Plan-A catalog. This choice is intentional: the older `Single Metric` is graph-native but predates explicit C2 keys, so it cannot truthfully prove C5 editing. Donut Breakdown is an A21 exact-keyframe component and naturally expresses a percentage as observed/remainder.

The proposal preserves:

- the exact B1 observation ref;
- `68%` as semantic value;
- `Observed · 68`;
- `Remaining · 32`.

The real component then proves:

- Motion Scene validates;
- root exists in C3 Layers;
- C4 contains real explicit keyframes;
- C5 contains editable numeric curves;
- rendered semantic text contains `68%`.

### Exact time mapping

Because the statistic placement itself is four seconds and A21 Donut accepts a four-second local authoring window:

```text
B1/B0 placement: 4.000s -> 8.000s
midpoint edit tick:       6.000s
Plan-A local midpoint:    2.000s
reverse projection:       6.000s
```

The test performs the mapping in exact project ticks and proves the midpoint round-trip.

### C5 edit identity proof

The integration chooses a real editable numeric C5 curve from the Donut scene and applies the real `soft` curve preset through typed Motion Graph operations.

After the edit:

- B1 `sourceObservationIds` unchanged;
- B0 directive/proposal identity unchanged;
- component ID unchanged;
- graph node ID set unchanged;
- selected C5 track ID unchanged;
- all keyframe IDs unchanged;
- the edited left key becomes real Bezier interpolation;
- the owning C3 Layer still exists.

This is an edit of the actual C2 authority, not a visual-only curve overlay.

## Required proof 2 — real B1 security evidence → Scoped Access → C5

B1 finds the security semantic moment from:

`Your private workspace stays separate from your team workspace for better security.`

Evidence range: **49.000s → 57.000s**.

`linkCreativeDirectiveToSourceObservations(...)` attaches that stable B1 security observation to the existing B0 `graphic:scoped-access` directive without changing its creative semantic intent.

The existing deterministic B0 planner still selects:

**`sanverse.scoped-access-comparison`**.

This also demonstrates three deliberately separate time concepts:

```text
B1 evidence time       = 49s -> 57s
B0 creative placement = 72s -> 80s
Plan-A local motion    = component-local authored duration
```

A creative decision may cite earlier evidence and intentionally appear later in the edit. The system preserves those facts rather than forcing all three times to be equal.

The integration selects a real editable C5 numeric curve on the left scoped-access item and applies the real `smooth` preset. After the edit:

- security observation ID still resolves to the same B1 provenance;
- component ID remains `sanverse.scoped-access-comparison`;
- every graph node ID survives;
- every selected-track keyframe ID survives;
- C4 still contains the same track ID;
- C3 still contains the owning node;
- the edited C5 key is real Bezier interpolation.

## Browser proof

### Source evidence

`motion/visual-baselines/b1-source-understanding.png`

Real Edge shows the five B1 lanes and selected **68%** observation with observation ID, 4s→8s time, confidence and provenance.

### Statistic result + real C5

`motion/visual-baselines/abc2-source-statistic-c5.png`

Real Edge shows:

- A21 Donut Breakdown;
- exact source-derived title;
- `68%` center value;
- `Observed · 68` + `Remaining · 32`;
- C3 selected `family.donut-breakdown.value`;
- Curves active;
- real numeric opacity/position/scale tracks;
- selected key/playhead + Curve Inspector.

### Scoped-security result + real C5

`motion/visual-baselines/abc2-scoped-security-c5.png`

Real Edge shows:

- Scoped Access Comparison;
- the B1 security statement as supporting copy;
- Private/Team workspace separation;
- C3 selected `family.scoped-access-comparison.item:1`;
- Curves active;
- real numeric C5 tracks, selected key and shared playhead.

These browser images are paired with the typed integration test for provenance/reference identity; the UI does not fabricate an on-screen trace link that the development controls do not actually own.

## Final automated proof

`apps/motion-lab/src/creative-engine-abc2-integration.test.ts` contains four integrated tests:

1. B1 68% → B0 source statistic → proposal → A21 Donut → Motion Scene → C3/C4/C5;
2. exact reversible placement/local tick mapping;
3. statistic C5 preset edit with all source/Motion identities preserved;
4. B1 security → B0 Scoped Access → Plan A → C3/C4/C5 with C5 edit identity proof.

Focused ABC-2 integration result: **4/4 PASS**.

## Fresh final release gate

```text
video-understanding    17/17
creative-direction     27/27
motion-contract         3/3
motion-primitives      29/29
motion-graph          131/131
motion-native-runtime   4/4
motion-testing          5/5
motion-library        173/173
motion-lab             50/50
----------------------------
TOTAL                 439/439 PASS
```

All nine workspace builds: **9/9 PASS**.

Fresh release-run measurements still execute B1 1/10/30/60-minute source stress, C5 10→10,000-key stress, C5 development render stress and A21 full 192-combination/576-iteration performance coverage. These remain engineering measurements rather than invented FPS guarantees.

Known non-failing build advisory: Motion Lab's main Vite bundle is about **695.31 kB minified**, above Vite's 500 kB advisory threshold. No architecture change is made solely to hide that warning.

## Integration failure caught

`CREATIVE-FAIL-009`: the first statistic proof chose `sanverse.single-metric`. That component is valid/graph-native but predates A18 keyframe-native family motion, so C4/C5 correctly reported zero explicit keys/curves. The proof was not weakened. A percentage statistic now resolves in this integration to A21 Donut Breakdown, using only 68 and its deterministic 32 complement, and the full source→C5 chain passes.

## Isolation / stop boundary

- `apps/web`: unchanged;
- production editor: unchanged;
- no new provider/network requirement;
- no external animation runtime;
- no copied reference asset;
- public catalog remains **89**;
- no A22 implementation;
- no B2/B3 implementation;
- no C6 implementation.

ABC-2 ends here. The next cycle requires explicit authorization.
