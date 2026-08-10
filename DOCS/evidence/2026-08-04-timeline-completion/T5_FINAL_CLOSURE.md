# Gate T5 — Advanced Track Controls and Expandable Tracks — Final Closure

Date: 2026-08-10
Branch: `timeline-t5-advanced-tracks`
Base: verified T4 program tip `99dcb6a71085b314414f2a4e0d526b9c5348855d`

Gate T5 is **complete**. Gates T6 and T7 were not started.

## Product delivered

T5 replaces the old five display labels as hidden identity with one typed stable track model while preserving all prior editing authorities.

Delivered end to end:

- stable video/audio/caption track identities with deterministic legacy migration;
- dynamic Timeline sections with display labels derived from current order;
- add, rename, reorder and delete track operations with closed limits and explicit required tracks;
- stable item-to-track assignment for visual, audio and caption families;
- Place On Top using compatible collision-free video tracks or one atomic create+assign operation;
- track output as accepted render-affecting project state;
- Lock as workspace-only protection with no revision/Undo/export mutation;
- Sync Lock as accepted non-rendering project policy, including safe compensation/refusal rules for source-anchored content and composition-anchored music;
- Targeting as workspace-only command destination state;
- Track Select Forward/Backward over the selected row;
- per-audio-track mute, solo, gain and pan in the shared Preview/export render plan;
- Combined / Separate L/R waveform presentation per stable audio track, with real channel-aware FFmpeg analysis and no fake stereo;
- stable video-track order as render stacking authority and stable caption-track order/output authority;
- T4 animation/keyframe identity preserved across track move/reorder;
- bounded validation and required stress proof at 20 video + 24 audio + 8 caption tracks.

The project remains one accepted EditProject/history, one Timeline selection/playhead, one Preview authority, one native video and one export compiler. T5 did not introduce a second editing or render authority.

## Important correctness fixes closed during final verification

1. **One-clip Sync-Lock music ripple.** A duration-changing primary edit with no downstream clip had no moved downstream start from which to infer the ripple. The T5 planner now falls back to the real primary-duration delta, so composition-anchored music on a Sync-Locked track moves correctly even in a one-clip project.
2. **Source-anchored Sync-Lock OFF.** Visuals and captions on off-Sync-Lock tracks are compensated only when their old composition placement can be reproduced exactly; otherwise the whole ripple is refused atomically rather than guessing.
3. **Header/body presentation drift.** Both now consume the same reconciled stable track presentation.
4. **Internal ID leak.** User-facing lock messages use visible row labels while domain callbacks retain stable `track_...` IDs.
5. **Waveform truth.** Separate L/R is a user preference, not an automatic stereo rewrite. Only confirmed ordinary stereo draws distinct L/R; unsupported layouts fall back to Combined.

## Automated verification

Final repository gate: **2,501 / 2,501**.

- API 405 / 405
- Web 1,365 / 1,365
- edit-domain 562 / 562
- intent-domain 27 / 27
- render-contract 142 / 142

All-workspace production build: **PASS**.

See `T5_TEST_RESULTS.md` for the full test-run notes and stress coverage.

## Real Microsoft Edge proof

Microsoft Edge 151 drove a real 30-second H.264/AAC source through Home, Assist/Studio, T5 controls, reload/reopen and Export.

The accepted project history reached revision **13** through real add/rename/reorder/Sync-Lock/audio/output/delete operations. Presentation-only Lock/Target/collapse/height/waveform interactions did not add project revisions. After reload → Home → Recent project → Studio, revision 13, one native video, stable track identity/order/name, Targeting, Sync Lock, A1 waveform mode, A1 gain and A1 pan all survived.

Responsive 1440×900, 1024×768 and 390×844 checks had no horizontal page overflow. Final browser observation recorded zero runtime exceptions, zero console errors and zero HTTP responses >=400.

See `T5_BROWSER_WORKFLOW.md` and `t5-browser-screenshots/t5-browser-report.json`.

## Real export

Revision 13 exported successfully through the visible Studio Export action:

- H.264 High, 1280×720, yuv420p, SAR 1:1;
- 30 fps, 900 frames;
- AAC-LC stereo at 48 kHz;
- 30.000000 seconds;
- 16,338,429 bytes;
- SHA-256 `d7ef76f49d80021e2a8798519fb1f723e1cebbd15b2e892c927abc31edf6ea10`.

The downloaded file hash matches the server-side export artifact exactly. Three decoded frames were visually inspected. See `T5_EXPORT_EVIDENCE.md` and `t5-export-metadata.json`.

## Scope boundary

T5 changed only the Editor track/routing/mix/presentation layer needed by this gate. Motion Graphics Library and Plan-B protected workstreams were not integrated. Gates T6 and T7 remain untouched.

**STOP:** Do not start Gate T6 without explicit owner authorization.
