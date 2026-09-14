# Independent audio and timeline workflow release — September 14, 2026

## Scope and completion truth

Branch: `timeline-t55-editor-confidence`. Implementation starts from `d8975c82bdb63cacd018e5bc2a4b6685eb299014`. This release adds independently extracted source audio and verifies a bounded real-browser editing/export workflow. It does not certify competitor parity, sustained interaction performance, a full human audio audition, or every existing timeline feature. Motion/2000 remains untouched.

## Delivered architecture and behavior

- Explicit typed `extract-clip-audio` operation; immutable source media and stable source asset identity. A canonical audio clip references its originating picture; the picture's linked sound is detached rather than played twice.
- UI extraction adds a dedicated audio track and extracts sound in one accepted change set/history entry. No video-to-fake-music conversion, second project, second revision/history, or alternate export path.
- Independent audio can be selected, moved sideways or between compatible audio tracks, trimmed, split/deleted, adjusted for gain/fades/pan, undone/redone and saved/reopened.
- Inspector resolves to the audio's own ID and suppresses misleading picture-only sections. Existing linked dialogue retains its behavior.
- Shared compiler emits audio-only source segments into the existing audio mixer and FFmpeg export. These nodes never enter the picture stack; picture source selection and source-anchored titles/captions ignore canonical sound tracks.
- Existing locks, pending-proposal/export guards, destination-kind validation and collision checks remain. Extraction from silent, already detached or frozen footage is refused.

## Focused verification

Selections overlap; do not add these figures into an invented whole-suite count.

| Evidence | Result |
|---|---|
| Domain suite before final review corrections | 572/572 PASS |
| Render-contract suite | 154/154 PASS |
| Affected web timeline/render/Studio selection | 732/732 PASS, 51 files |
| Final review-fix web selection | 48/48 PASS |
| Final extraction domain regression | 5/5 PASS, including long J/L window fades |
| Real synthetic FFmpeg extraction test | 1/1 PASS; 4-second output, 120 decoded picture frames |
| All-workspace production build after corrections | PASS September 14 |
| Independent re-review | PASS; no confirmed security/logic blockers; no tests rerun by reviewer |
| Added-line security scan and diff check | PASS; no secret/eval/shell/innerHTML matches |
| Editor ownership boundary | PASS; no protected Motion paths/imports |

Final web bundle: 314 modules, JS 1,024.62 kB / gzip 285.56; CSS 145.14 / gzip 24.42. Compared with 4c4b2973: JS +6.07 kB / gzip +1.73; CSS unchanged. Existing runtime-font and >500 kB bundle warnings remain, not new blockers.

The actual FFmpeg regression generates red footage with stereo tone, extracts its sound, trims to 1–3 seconds, sets -6 dB and hard-right pan, then renders and decodes. Assertions verify silent excluded intervals, near-silent left channel, bounded right-channel RMS (not doubled), full 4-second picture duration and red output. This is measured audio correctness, not listening to a human voice.

## Real-browser workflow ledger

Local saved project `project_e58e4bb1e9f088fa38801efbeb52b83b`, `test-30s.mp4`. Owner's pre-test content was saved at revision 70. No edits before that checkpoint may be undone.

| Revision | Action and observed result |
|---|---|
| 71 | More → Extract audio on V2 footage: independent A3 clip, original dialogue mirror removed. |
| 72 | Own audio gain changed to -1 dB. |
| 73–74 | Initial coordinate drag hit gain line instead of the name strip; immediately undone. Not counted as movement proof. |
| 75 | Real pointer drag from A3 name strip to A2 and sideways; start 1.678→3.716s, picture stayed unchanged. |
| 76 | Trim-end Shift+Left shortened audio 24.989→24.656s. |
| 77–79 | Split at 14.166s; Undo restored one clip; Redo restored independent halves (10.450s and 14.206s). |
| 79 reopened | Server/session restart, Home reopen, Assist→Studio: saved audio halves persisted. Playback advanced, then paused at 8.9s. |
| 80–81 | Delete selected first audio half left picture and other sound intact; Undo restored it. Inspector displayed its own -1 dB gain. |
| 81 export | Keyboard-activated Export reached Export ready, 1920×1080, 33s. MP4 fully decoded and representative 6.5s picture/title inspected. |
| 82 | Short V1 picture changed to 0.5x; visible duration 5.011→10.021s with linked sound. |
| 83 | Same picture changed to 2x; duration 2.505s. |
| 84 | Reverse enabled at 2x; labels reflected backwards timing. Playback advanced from 27:28 to 30:27 and stopped at the composition end. |
| 84 export | Export ready, 31s; final reverse/independent-audio MP4 fully decoded. |
| 85–92 | Eight UI Undos removed only this test's active extraction/gain/move/trim/split and three timing operations. Original picture/title/linked-sound content restored. Do not repeat these Undos. |

Revision-81 export: `export_c0208b9edc755bba224612c1d062573c.mp4`; 33.433333s; H.264 1920×1080 30fps, AAC stereo 48kHz; 16,528,597 bytes; SHA-256 `4b83e41506e128c891c1dfa3a1ad8039d390864f1ddf71e99aa85a9e6e8d2f92`. Full FFmpeg decode passed. Local artifacts remain under ignored `.sanverse-data`; no user media is committed.

Revision-84 export: `export_bd50af2375d46dbbd413d2c5dca0140e.mp4`; 30.933333s, 15,751,833 bytes; SHA-256 `269b0ef225e843d006f87058de837ad78e1e128b2aff616ed12e53849e4532b8`. Full FFmpeg decode passed. Both exports live under `.sanverse-data/projects/project_e58e4bb1e9f088fa38801efbeb52b83b/exports/` in the timeline checkout. Final restored owner project is revision92; final exported test revision84 is intentionally different.

## Failures and limits

- FAIL-096/097/098: wrong explicit target fallback, long-fade extraction rejection, missing/misleading Inspector. Reproduced before corrections; independent re-review passed after focused fixes.
- INFRA-022: usage interruptions stopped reviewer/server; wrong cwd invoked wrong Vitest; new synthetic test initially omitted required filtergraph file. Corrected without changing application dependency manifests or weakening assertions.
- Initial Export pointer click did not activate Export; keyboard focus/Enter did, opening visible export feedback. Do not infer a product export failure from the automation click. Existing screenshot/coordinate mismatch INFRA-007 prevents exact responsive/visual smoothness certification.
- Browser log captured one Vite websocket connection error during stopped-server recovery. This is not a render/export exception. No claim of exhaustive network monitoring.
- Git staging initially lacked access to linked-worktree metadata; repeated the same scoped staging with approved permissions, without deleting locks or switching branches.
- Independent review suggested non-default speed/reverse extraction coverage. The real workflow separately exercises extracted audio plus a reversed/retimed picture; extracting already-retimed sound is not covered by the new dedicated regression.

## Remaining high-impact acceptance, not hidden feature promises

1. Agent-assisted reliability/performance gate: sustained edge-hold/autoscroll, waveform readability/truth on representative media, and same-task recorded comparison. Fix only reproduced blockers; current tests do not measure subjective smoothness.
2. Owner acceptance: finish a real short edit, listen through exported sound and confirm trust in trim/drag/playback. Record exact failures with timestamp/action/expected/actual, not a percentage guessed from test totals.
3. Motion integration remains a separate, later authorized lane after timeline acceptance. Do not begin it as part of this release.

The bounded functional walkthrough is not the entire historical continuous/comparison checklist. Remaining items stay unchecked in the active plan. Fresh clones require local test media; the two historical untracked JPGs are intentionally excluded.
