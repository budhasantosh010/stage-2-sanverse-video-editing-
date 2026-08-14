# COMPONENT INGEST V1 — First Pilot Evidence

Date: 2026-08-14
Pilot: **CH1 Frosted Icon Rail / `sanverse.icon-rail`**
State: **engineering parity ready; owner integrated-parity approval pending; not public**

## Owner authority

The owner explicitly approved all 10 CH1 reusable source components on 2026-08-14 and stated they are visuals they would use in YouTube videos. The original CH1 approval files also record `owner-approved` + `visualLock=true`.

Source approval and integrated parity are separate gates. This evidence does not convert source approval into permission to register a visually changed integration.

## CH1 intake inspection

All 10 approved CH1 packages were inspected read-only through the same `@sanverse/motion-ingest` classifier. Results for all 10:

- source kind: `foreign`;
- foreign decision: `lossless-normalization`;
- owner approval: PASS;
- visual lock: PASS;
- exact-tick determinism: PASS;
- canonical 1,440,000 ticks/sec: PASS;
- direct-seek contract: PASS;
- intake errors: 0.

Only Component 01 was advanced beyond inspection, per the first-pilot gate.

## Immutable pilot intake

Approved-source aggregate SHA-256:

`428e6e328f366417f3e13fb8dcbca388238e1d196f78ec5243fa97a3e374ce39`

Manifest SHA-256:

`23a58bf7fce9b06124225fb649832df246ee4038810bc35a9ea892426f1aea73`

Approval SHA-256:

`dbf009c8a5d9defd6025fe05b7253638f5e0ee9228b0901b9934e7919bc5ae91`

Approved runtime SHA-256:

`cd8c44a60b74401edb01f36b55d139b5663f4151a1fea3cea529e56b2bca5b08`

The snapshot contains the approved reusable component code/manifest/approval, but **zero source/reference video files**. Reference creator footage was not imported into Sanverse.

## Productization proof

`npm run motion:productize -- sanverse.icon-rail` returned:

```text
status                 ready
determinism            passed
direct seek            passed
semantic mapping       passed
C3 Layers              passed
C4 Timeline            passed
C5 Curves              passed
C6                     not-yet-available
AI editability         passed
16:9 / 9:16 / 1:1 / 4:5 passed
semantic nodes         14
exposures              15
editable C5 tracks     10
```

The integrated definition is intentionally staged/exported for review but absent from the generated public ingest registry.

Measured local graph create + exact-tick evaluate + C3 + C4 + C5 projection over 2,000 9:16 iterations averaged **0.5866 ms/iteration** on this machine, classified `light`. This is an engineering measurement, not a browser FPS claim.

## Exact motion preservation

The approved CH1 runtime uses deterministic cubic easing plus an exact Back easing formula for item scale. The Motion Graph scalar-expression vocabulary gained a bounded deterministic `back-out` expression using the existing `easeOutBack` primitive rather than replacing the approved timing with a generic ease.

Automated pilot tests compare resolved Motion Graph state against the approved CH1 timing equations at direct, backward and random exact ticks. Root opacity/position/scale and all item opacity/Y/scale values agree at the tested ticks.

## Real browser visual parity

Internal parity route:

`/ingest/parity/sanverse.icon-rail`

Left side runs the immutable approved CH1 snapshot in a sandboxed browser frame. Right side runs the productized component through the actual Sanverse Motion Graph/host. They share the exact playhead, 1× playback, ratio selection and reduced-motion state.

Retained evidence:

- `motion/visual-baselines/ingest-v1-icon-rail-parity.png`
- `motion/visual-baselines/ingest-v1-icon-rail-temporal-parity.png`

A full 31-frame / 30-fps / 1-second exact-tick review pair was generated locally from the two renderers. The generated MP4s remain ignored local evidence rather than committed exports.

Approved-source canonical-video SHA-256:

`7a79482b5c3b07299cf2f5f7c755553c55ab2273fb4f30416c2c3017e955b762`

Integrated review-video SHA-256:

`dafd3f47903c90b02f05908371e7d3f93a00b85d38d45b48a037e0034a5aa951`

Whole-video SSIM: **0.996780**. SSIM is supporting evidence only, not aesthetic authority.

Seven exact visual checkpoints cover progress 0, .05, .18, .33, .58, .90 and 1. Settled 58% SSIM is **0.999275**. Manual inspection of the source/integrated frames and temporal sheet found no material composition/motion difference; remaining pixel differences are dominated by browser anti-aliasing/translucent DOM rasterization. The exact Motion Graph values still match the source equations.

## Fail-closed registration proof

`npm run motion:register -- sanverse.icon-rail` was deliberately attempted before owner integrated-parity approval and correctly refused:

```text
REGISTRATION_BLOCKED:
VISUAL_PARITY_NOT_PASSED,
OWNER_INTEGRATED_PARITY_APPROVAL_REQUIRED
```

Therefore the public catalog remains **89**, and the Creative Library has no partially registered pilot.

## Regression

Fresh serial Creative/Motion/B1/Ingest tests:

```text
video-understanding     17
creative-direction      27
motion-contract          3
motion-primitives       29
motion-graph            132
motion-native-runtime    4
motion-testing           5
motion-library         192
motion-lab              56
motion-ingest             4
--------------------------
TOTAL                   469 / 469
```

Root all-workspace production build: **PASS**.

Static release checks:

- `apps/web` diff: 0 files;
- copied source/reference video in intake: 0;
- new GSAP/Three/anime/framer/motion dependency: 0;
- `git diff --check`: PASS.

## Acceptance state

Engineering can truthfully say the first pilot is productized and parity-ready. It cannot truthfully say the pilot is public or finally accepted until the owner watches the integrated comparison and approves the integrated result.

Next gate:

```text
owner opens parity page
      ↓
watches/scrubs approved original vs Sanverse integrated
      ↓
APPROVE integrated parity / request correction
      ↓
only on APPROVE: mark parity owner-reviewed → motion:register
      ↓
then make the ingestion pipeline standard and continue remaining CH1 components
```
