# Current State

Last updated: 2026-07-27

## Active goal

**G4-B — first safe AI-operated nameplate. Tasks 01 through 09 are built and
verified. Task 10, connecting one real provider, has not started.**

The chat box works. A sentence typed into it produces a pending proposal, one
short question, a plain "cannot do that", or a refusal — and nothing else. The
provider behind it is a deterministic fake that ships with the build, so no
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
- **G4-B tasks 01–09 (complete).** `@sanverse/intent-domain` holds a closed
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
  edit-domain      103
  render-contract   22
  intent-domain     27
  api              103
  web              158
  ------------------------
  total            413 passing; all workspace builds clean
```

## Owner evidence still open

- Perform a native human drag-and-drop upload and decide whether the current
  interaction motion feels acceptable.
- Complete one final personal end-to-end acceptance run. Automated or scripted
  browser interaction cannot substitute for that judgment.

## Not built

- Any real AI provider (G4B-10). The fake is the only provider that exists.
- Cut, trim, split, ripple delete, reorder, or a general timeline
- Captions and audio editing primitives
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
- `-c:a copy` is correct only while nothing cuts the timeline. The first cut
  operation in G5-B must replace it with a real audio conform step.
- No colour or HDR handling; `-pix_fmt yuv420p` is forced. iPhones record HDR by
  default, so washed-out output is plausible and unproven.
- Parity was measured with Arial only, and by real export only for the
  `top-left` and `center` anchors.
- The fake provider's language understanding is deliberately crude. It is a test
  harness, not a feature.
- Recent-project presentation remains minimal, and the Home draft request is not
  restored when reopening a project.
- Free AI-provider schemas, quotas, latency, reliability, and commercial terms
  remain unverified.

## Evidence boundary

The manual nameplate slice, the G4-A chassis, and the G4-B fake-provider loop
all have real-media and real-browser evidence, recorded with measured numbers in
`DOCS/evidence/`. Everything else is unimplemented. Historical detail belongs in
`PROJECT_LOG.md`, `FAILURE_REGISTRY.md`, and `changes/`; it must not be copied
back here as contradictory current state.
