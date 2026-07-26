# Current State

Last updated: 2026-07-26

## Active goal

**G4 next — build the first AI-operated edit over the verified deterministic nameplate loop.**

G1 remains partly open for the owner's final motion, native drag-and-drop, and overall Studio UX acceptance. That owner-only evidence gate must not be silently marked complete, but it does not erase the completed G2/G3 technical foundation.

## Completed foundation

- G0 foundation, governance, architecture decisions, anti-drift documents, Git baseline, and private remote are complete.
- The local web application runs at strict `http://localhost:2000`; its internal API binds only to `127.0.0.1:2001`.
- An uploaded MP4 is streamed into an immutable, project-owned local copy with an integrity manifest.
- The canonical edit domain provides versioned point/nameplate actions, validation, proposal, accept/discard, undo/redo, and deterministic serialization.
- Studio supports point targeting, a bounded manual nameplate proposal, typed preview, accepted history, and explicit export states.
- Accepted history persists under ignored `.sanverse-data/`; Home lists recent projects and reopening restores saved history.
- The FFmpeg adapter renders accepted history to a controlled downloadable MP4 while preserving source media.
- A real-browser walkthrough completed upload, reopen, playback, point, proposal, preview, accept, undo, redo, persistence, export, download, and output inspection.
- The 2026-07-25 baseline passed 220/220 tests and all three workspace builds at `fcc41eb`.

## Cleanup gate

- Complete: the media repository now exposes an explicit idempotent `close()` contract. Full body iteration closes automatically, HTTP media/export routes close in `finally`, and callers that do not consume a body can release the handle directly.
- Complete: current roadmap/status documents have been reconciled around one current truth.
- Complete: the accidental empty `.sanverse-data/projects/projects` directory has been removed.
- Owner evidence still open: perform a native human drag-and-drop upload and decide whether the current interaction motion feels acceptable.
- Owner evidence still open: complete one final personal end-to-end acceptance run. Automated or scripted browser interaction cannot substitute for that judgment.

## Next implementation gate

G4 must support one narrow outcome first:

1. The user describes a nameplate change naturally, optionally after pointing at the video.
2. A provider-independent intent adapter returns an untrusted structured candidate.
3. Deterministic code validates capability, schema, timing, coordinates, and bounded text.
4. Ambiguous intent produces clarification; invalid or unsupported intent fails closed.
5. A valid result becomes a pending previewable proposal only.
6. Nothing enters accepted history or rendering until the user explicitly approves it.

No provider API key is required to establish this boundary; a deterministic fake provider should prove the contract before NVIDIA or OpenCode Zen is connected.

## Not built

- AI/chat interpretation
- Cut, trim, split, ripple delete, reorder, or a general timeline
- Captions and audio editing primitives
- Transform, crop, scale, rotation, keyframes, easing, spring/bounce, transitions, or general effects
- Reusable versioned titles, callouts, subtitle components, B-roll, or templates
- Background export jobs, percentage progress, or accelerated rendering
- Project portability, accounts, authentication, tenancy, billing, cloud storage/rendering, quotas, or production SaaS operations
- Advanced object tracking, segmentation, or a data/model flywheel

## Known limitations

- The current point is a provisional top-left nameplate anchor; near-edge placement semantics still need owner approval.
- A 30-second 1080p CPU export takes roughly 60–85 seconds and exposes no percentage or time estimate.
- Recent-project presentation remains minimal, and the Home draft request is not restored when reopening a project.
- The Studio still contains engineering-preview language and disabled chat controls.
- Free AI-provider schemas, quotas, latency, reliability, and commercial terms remain unverified.

## Evidence boundary

The complete manual nameplate slice has real-media and browser evidence. G4 and every later product capability remain unimplemented until their own tests and owner evidence exist. Historical detail belongs in `PROJECT_LOG.md`, `FAILURE_REGISTRY.md`, and `changes/`; it must not be copied back here as contradictory current state.
