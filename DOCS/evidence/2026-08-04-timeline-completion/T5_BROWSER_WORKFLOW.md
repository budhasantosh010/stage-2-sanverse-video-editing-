# Gate T5 — Real Microsoft Edge Workflow

Date: 2026-08-10
Browser: Microsoft Edge `151.0.4129.72`
Project: disposable real-media project `project_38e764c3925fd17fa5164db62a68d08e`
Source: `sanverse-t5-primary-30s.mp4`
Source SHA-256: `1a9cb5f91ca6f80b8fdb3bb9619ebd11b460f96826a56b19691c7b6247fa0982`
Source: real FFmpeg-generated 1280×720 H.264 High / AAC stereo 48 kHz, 30 seconds. It is real decodable media, not a mocked test response.

The workflow used the actual local app at `127.0.0.1:2000/2001`, one real native `<video>`, the production Studio controls, accepted project operations, local workspace preferences and the real export service. Edge used a disposable extensions-disabled profile and CDP only to drive the same DOM events a user drives; project operations were not injected behind the UI.

## Accepted project history

The real project ended at revision **13**. On-disk accepted history records this exact sequence:

1. add generic video track: **0 → 1**
2. add generic audio track: **1 → 2**
3. add second caption track: **2 → 3**
4. rename generic video track to `Cutaways T5`: **3 → 4**
5. reorder generic video track: **4 → 5**
6. turn Sync Lock off for that stable video track: **5 → 6**
7. set A1 track gain to `-3 dB`: **6 → 7**
8. set A1 track pan to `+20%` / canonical `+2000`: **7 → 8**
9. mute A1: **8 → 9**
10. unmute A1: **9 → 10**
11. disable A1 output: **10 → 11**
12. enable A1 output: **11 → 12**
13. delete the empty second caption track: **12 → 13**

The browser also drove Lock/Unlock, Target, collapse/expand, row height and A1 `Separate L/R` waveform mode. Those are workspace/presentation interactions where required and did not create project revisions. The generic video track finished unlocked but targeted, with Sync Lock off.

## Reload/reopen persistence

A forced page reload returned to Home. The workflow reopened `sanverse-t5-primary-30s.mp4` from Recent projects, re-entered Studio and verified:

- revision remained **13**;
- exactly one native `<video>` remained;
- the renamed stable generic video track survived as `Cutaways T5`;
- its stable ID remained `track_jm7ujufeju3e`;
- Sync Lock remained off;
- Targeting remained on;
- A1 waveform presentation remained `Separate L/R`;
- A1 gain remained `-3 dB`;
- A1 pan remained `+20%`;
- track counts were 3 video, 1 caption and 3 audio after deleting the extra caption track;
- Export remained enabled.

## Responsive evidence

Real Edge screenshots were captured at:

- 1440×900
- 1024×768
- 390×844

The workflow asserted one native video and no horizontal page overflow at each size. The desktop and mobile captures were visually inspected. Evidence is under `t5-browser-screenshots/`.

## Browser errors

The final reopen/export observation recorded:

- runtime exceptions: **0**
- console errors: **0**
- HTTP responses >=400: **0**
- three `net::ERR_ABORTED` loading failures, all marked canceled, caused by navigation/media teardown rather than failed HTTP responses.

Machine-readable final state: `t5-browser-screenshots/t5-browser-report.json`.

## Evidence-runner corrections

Three evidence-runner assumptions were corrected without changing product behavior:

- the newly inserted generic video track was already at the top of its reorderable section, so `Move up` correctly did nothing; the workflow used the legal `Move down` direction instead;
- waveform canvases live in Timeline lane bodies rather than track-header DOM, so the evidence selector was corrected to the lane-body canvas;
- reload truthfully returns to Home, so the final persistence proof reopens the Recent project before entering Studio.

These were evidence-driver corrections, not application failures.
