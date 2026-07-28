# Current State

Last updated: 2026-07-28

## Active goal

**G5-B — cutting. The video can now be cut, sections removed, and the result
exported, with every edit anchored to the original footage so it survives the
cut. Built and verified on the owner's own recording (E4).**

What remains in G5-B is reach, not foundation: trim, reorder, and clip audio
work but have no button; only one frame rate has been exercised; and the owner
has not run it. `DOCS/plans/PLAN_CHECKLIST.md` has the exact split.

G4-B is finished except the first real API call, which is blocked on the owner's
keys. The chat box works: a sentence typed into it produces a pending proposal,
one short question, a plain "cannot do that", or a refusal — and nothing else.
The provider behind it is a deterministic fake that ships with the build, so no
network call is made and no data leaves the machine.

G1 remains partly open for the owner's final motion, native drag-and-drop, and
overall Studio UX acceptance. That owner-only evidence gate must not be silently
marked complete, but it does not erase the completed G2/G3/G4-A foundation.

## Completed foundation

- G0 foundation, governance, architecture decisions, anti-drift documents, Git
  baseline, and private remote are complete.
- The local web application runs at strict `http://localhost:2000`; its internal
  API binds only to `127.0.0.1:2001`.
- An uploaded MP4 is streamed into an immutable, project-owned local copy with
  an integrity manifest.
- **G4-A chassis (complete).** `sanverse.project/v2`: one fixed clock of
  1,440,000 ticks per second, half-open ranges, opaque storage references,
  clip-instance composition, a capability registry, atomic change sets with
  revision fencing, selective deactivation, and a lossless idempotent v1→v2
  migration that blocks rather than drops what it cannot express. ADR-002.
- **G4-A render contract (complete).** `@sanverse/render-contract` holds one
  description of a nameplate. Browser preview and FFmpeg export compile the same
  plan, and a parity test evaluates the exact FFmpeg placement expression
  numerically. The exporter's font is served to the browser. ADR-003.
- **G5-A captions (built end to end, on a transcript file).** A transcript is
  a per-asset sidecar, never inside the project, because it is evidence about
  footage rather than a decision the user made. Captions are one `add-captions`
  operation holding many cues, so "put captions on my video" is one Undo, and
  later corrections are small operations folded over it in history order. Line
  breaking is pure deterministic arithmetic in the domain, so a re-render cannot
  differ from what was approved. Every cue is anchored to the original footage,
  so cutting moves them with the words; cues whose footage is deleted simply do
  not draw, and only a set with nothing left surviving is blocked. ADR-006.
- **G5-A rendering.** A new `caption-overlay` node kind, one shared caption style
  contract read by both CSS and FFmpeg, and the filter graph moved out of the
  command line into a file so a fully captioned video cannot exceed the
  operating system's command-line limit.
- **G5-B cutting (complete in the domain, the renderer, and the screen).**
  Cuts are ordinary operations in ordinary change sets, so one cut is one Undo
  and a single cut in the middle of the history can be switched off on its own.
  Every edit drawn on the picture stores its timing against the ORIGINAL
  footage, so trimming the front moves a nameplate with the face it was placed
  on instead of leaving it at a wall-clock moment that now shows something else.
  Footage deleted outright blocks the edit and says so; it is never relocated.
  Project and operation schemas moved to v3 with a one-entry upgrade ladder.
  ADR-005.
- **G5-B render and playback.** The render plan now separates `segments` (what
  the video is made of) from `overlays` (what is drawn on it). FFmpeg trims and
  concatenates, filling deliberate holes with real black and real silence. The
  browser preview jumps between stretches so it shows the same video the export
  produces.
- **G4-B tasks 01–11 (complete, on a fake provider).** `@sanverse/intent-domain` holds a closed
  request shape, a closed untrusted candidate shape, six bounded clarification
  fields, and the evaluation contract. The API holds the provider port, the
  deterministic fake, the outbound allowlist, and the fixed 13-step intent
  service. The browser holds the chat composer, the by-hand repair panel, and
  provenance display. ADR-004.
- Editing is server-authoritative: the browser asks and adopts what it is told.
  Export compiles the stored project on the server and takes no edit list from
  the client.
- Accepted history persists under ignored `.sanverse-data/`; Home lists recent
  projects and reopening restores saved history.

## Test and build state

```
  edit-domain      198
  render-contract   35
  intent-domain     27
  api              198
  web              200
  ------------------------
  total            658 passing; all workspace builds clean
```

## Owner evidence still open

- Perform a native human drag-and-drop upload and decide whether the current
  interaction motion feels acceptable.
- Complete one final personal end-to-end acceptance run. Automated or scripted
  browser interaction cannot substitute for that judgment.

## Not built

- A call to any real AI provider. The adapter for one exists and is proved over
  real HTTP against a stub (G4B-12A/12B/13A, DEC-011), but **no packet has
  reached NVIDIA, opencode, OpenRouter, or LM Studio.** The fake remains the
  default and the only provider that runs. Blocked on the owner's API keys, and
  on verifying LiteLLM's request-body logging is off (G4B-12C).
- A control on screen for trim, reorder, or clip loudness and fades. All three
  are built, tested, and reach the export, but nothing offers them yet.
- Creating a deliberate hole from the screen. The remove button always closes
  the gap; holes exist in the domain, the preview, and the export only.
- A control on screen for rewording, retiming, or deleting one caption, or for
  changing the caption look. All four are built, tested, and reach the export.
- Automatic transcription against a real service. The boundary, its consent
  rule, and a refusing default adapter exist; nothing is wired.
- A verified Stage 1 transcript format. The importer follows the published
  Whisper word-timing shape and has never seen a real Stage 1 file.
- Transform, crop, scale, rotation, keyframes, easing, spring/bounce,
  transitions, or general effects
- Reusable versioned titles, callouts, subtitle components, B-roll, or templates
- Compound requests that produce more than one operation
- Background export jobs, percentage progress, or accelerated rendering
- Project portability, accounts, authentication, tenancy, billing, cloud
  storage/rendering, quotas, or production SaaS operations
- Advanced object tracking, segmentation, or a data/model flywheel

## Known limitations

- **The drawn background plate is about 10 px shorter vertically in the export
  than in the preview** at 1080p. Position is identical. Closing it needs the
  font's real ascent and descent read from the TTF. Recorded in ADR-003.
- A 30-second 1080p CPU export takes roughly 60–90 seconds and exposes no
  percentage or time estimate. Deprioritized by the owner.
- Only one frame rate has been exercised on real media: 30/1 constant. Variable
  frame rate and 30000/1001 fixtures are G5B-13 and have not been run.
- Captions have been proved with one English, synthetic transcript on one
  recording. Right-to-left scripts and CJK line breaking are untested; the
  segmentation rules (42 characters, 17 characters per second) are Latin-script
  assumptions.
- A transcript upload is capped at 1 MB by the shared JSON body limit, which is
  roughly a 20-minute transcript with word timings.
- A change set holding both a cut and an overlay can have the cut applied while
  being reported blocked for its overlay. No such change set exists today; G7
  must resolve it before compound requests ship. ADR-005.
- No colour or HDR handling; `-pix_fmt yuv420p` is forced. iPhones record HDR by
  default, so washed-out output is plausible and unproven.
- Parity was measured with Arial only, and by real export only for the
  `top-left` and `center` anchors.
- The fake provider's language understanding is deliberately crude. It is a test
  harness, not a feature.
- Recent-project presentation remains minimal, and the Home draft request is not
  restored when reopening a project.
- Free AI-provider schemas, quotas, latency, reliability, and commercial terms
  remain unverified. opencode's gateway shape and model list in particular are
  recorded from the owner's instruction, not from a test.

## Evidence boundary

The manual nameplate slice, the G4-A chassis, and the G4-B fake-provider loop
all have real-media and real-browser evidence, recorded with measured numbers in
`DOCS/evidence/`. Everything else is unimplemented. Historical detail belongs in
`PROJECT_LOG.md`, `FAILURE_REGISTRY.md`, and `changes/`; it must not be copied
back here as contradictory current state.
