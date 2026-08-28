# Creative Engine V1.6 — Production Editor Evidence

Date: 2026-08-28

This evidence belongs to the V1.6 production-editor integration release only. The browser source and exported MP4 used by the audit were temporary local files and are intentionally not committed.

## Architecture truth

- Production editor, project, revision, accepted history, Undo/Redo, preview and export remain the existing `apps/web` + edit-domain/server authorities.
- Creative Engine keeps the existing canonical `MotionSceneV1`, semantic IDs and 1,440,000-tick clock.
- Storyboard/KVS, Animatic, Motion Forge and Motion Review reuse the existing closed-loop workflow.
- C3 Layers, C4 dope sheet, C5 curves and C6 node graph are projections of the same candidate scene and share one semantic selection.
- UI and MCP use the same internal Creative tool/workflow authority. Production-fenced MCP mutations require the live production revision and cannot call isolated sandbox apply/Undo tools.
- The Library exposes all 99 canonical entries. V1.6 has one lossless native production adapter, Kinetic Headline. The remaining 98 are explicitly `creative-preview-only` because arbitrary Motion Graph scenes cannot be losslessly serialized into the current production edit schema.

## Automated production integration proof

- `@sanverse/creative-production-adapter`: 12/12 PASS.
- Production `apps/web`: 1,238/1,238 PASS.
- App/server integration proves one Creative change set contains `add-title` + `set-visual-properties`, one Undo removes both, one Redo restores both and the accepted result survives reopen.
- Production preview/export parity passes at exact checkpoints through the existing render-plan compiler.
- Production ratios 16:9, 9:16, 1:1 and 4:5 pass with C3–C6 semantic continuity and correct render dimensions.
- Recovery fails closed for no active source, unsupported source timing, stale production revision, stale MCP revision and failed production apply.

## Real Microsoft Edge workflow

Browser: Microsoft Edge headless via native CDP.

Temporary source fixture:

- real MP4 generated locally for the audit;
- 640×360;
- 6.000 seconds;
- never committed.

Observed workflow:

1. Open the real production app and source.
2. Enter Studio → Creative.
3. Create the Kinetic Headline Creative draft.
4. Complete Storyboard/Animatic/Motion review flow.
5. Apply a manual C5 `snappy` curve preset.
6. Verify previous approvals are discarded.
7. Reapprove Storyboard, Animatic and Motion.
8. Apply one production change set.
9. Verify revision 1.
10. Undo the complete Creative result and verify revision 2.
11. Redo the complete Creative result and verify revision 3.
12. Reload/reopen and verify the accepted result persists.
13. Verify responsive production layouts at 1440×900, 1024×768 and 390×844: no horizontal overflow, exactly one video and reachable Creative controls.
14. Export through the real production export path.
15. Verify globally visible Export ready/download state even if the AI panel is collapsed.

Browser/network result:

- console errors: 0;
- network failures: 0;
- bad HTTP responses: 0.

Export result:

- H.264 High video;
- AAC LC stereo audio;
- 640×360;
- 30 fps;
- 6.000 seconds;
- 858,823 bytes;
- SHA-256 `653afd857d0fc4d3441c9486dfac564af9d18e4503c80f45c6f1b96287ce12ef`;
- temporary local export, not committed.

Machine-readable report: `browser-report.json`.

## Retained screenshots

- `screenshots/01-creative-c5-edited.png` — canonical C5 edit before reapproval/apply.
- `screenshots/02-creative-applied.png` — accepted production Creative result.
- `screenshots/03-desktop-1440x900.png` — desktop production layout.
- `screenshots/03-tablet-1024x768.png` — tablet production layout.
- `screenshots/03-mobile-390x844.png` — compact mobile Creative reachability.
- `screenshots/04-export-ready.png` — global production Export ready + Download state.

## Release matrix and hygiene

Authoritative uninterrupted Windows single-fork repository run: **2,950/2,950 PASS across 25 workspaces**.

Key totals:

| Workspace | Result |
| --- | ---: |
| `@sanverse/api` | 403/403 |
| `@sanverse/motion-lab` | 66/66 |
| `@sanverse/web` | 1,238/1,238 |
| `@sanverse/creative-production-adapter` | 12/12 |
| `@sanverse/edit-domain` | 488/488 |
| `@sanverse/motion-graph` | 139/139 |
| `@sanverse/motion-library` | 202/202 |
| `@sanverse/motion-mcp` | 18/18 |
| `@sanverse/render-contract` | 119/119 |

Root all-workspace production build: PASS / exit 0.

Final hygiene:

- `git diff --check`: PASS;
- `sites/**` diff: 0;
- raw source-media or generated-export additions: 0;
- secret-like additions: 0;
- no real parallel project/clock/Motion/history authority additions; the lexical scan's only hit is a canonical 1,440,000-timescale test fixture.

Release tag: `sanverse-production-editor-creative-engine-v1.6`.
