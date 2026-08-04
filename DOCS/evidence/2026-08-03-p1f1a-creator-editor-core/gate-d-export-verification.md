# Gate D — the exported video is untouched by the timeline decorations

2026-08-04 · project `project_1ad7b832a52d6faf09da2390e97f729a`

## The claim being tested

Filmstrips and waveforms are decoration. They must not change one byte of the
finished video, one millisecond of its length, or one frame of its picture.

## Why that is true by construction

The exporter builds its plan from `EditProject`. Derived media is never written
into `EditProject` — it creates no operation, no change set, no revision and no
Undo entry, and it lives in a folder outside the project that can be deleted at
any moment. There is no path from a thumbnail to the render plan. Held by test in
`media-analysis-service.test.ts` ("never loads more than the project it was asked
about, and never saves") and in `TimelineDecorations.test.tsx` ("makes no edit,
takes no revision, and adds nothing to Undo").

## The real export

Project at revision 10: 30.033 s of footage with 3 s trimmed off the head, a real
picture laid on top from 4 s to 9 s, and a real 20 s piece of music laid under
from 2 s starting 6 s into the song. Derived media had already been produced for
all of it — hundreds of frames and blocks were sitting in
`derived-media/v1/` when Export was pressed.

```
  job              job_b9e900841f2c300121bfc08de818aadb
  status           succeeded
  file             13,278,186 bytes
  sha256           38627703af91e302abc8c093c7ff302ffafae310c4660ac4997eb110e67fab77
  duration         27.033008 s
  picture          1920 × 1080
  sound            present
```

**27.033 s is exactly 30.033 s minus the 3 s trimmed off the head.** Not
approximately — exactly. Nothing added, nothing lost.

Probed with FFmpeg:

| check | reading |
|---|---|
| real picture at 5 s (picture overlay showing) | average colour 131, 116, 114 |
| real picture at 20 s (footage only) | average colour 123, 107, 102 |
| loudness at 3 s, music playing | −12.68 dB |
| loudness at 20 s, music finished | −14.51 dB |

Real picture at both moments, and measurably louder while the music bed is
playing. The export contains the edit and nothing else.

## An unrelated problem found in passing — NOT a Gate D fault

With the **portrait 714×1280 second recording** switched on, the export fails:

```
  RENDER_FAILED — "The local renderer could not produce a verified MP4."
```

Switch that one clip off and the same project at the same moment exports
successfully, as above. So the failure is specific to a portrait source inside a
landscape composition.

This is a renderer limitation and Gate D changed nothing in the render graph.
It is recorded in `DOCS/FAILURE_REGISTRY.md` rather than fixed here, because the
program for this gate says to fix Gate D blockers only and record everything
else. **It is a real gap: a user filming on a phone in portrait and adding it to
a landscape project cannot currently export.** It should be the next render
task after this gate.
