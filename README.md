# Stage 2 Sanverse Video Editing

An AI-native video editing product for people who are not professional video editors.

The intended experience is simple: upload a cleaned talking-head video, point or draw on the frame, explain the desired change in chat, preview the proposed edit, approve it, and export a polished video in minutes rather than hours.

## Current status

**G0: foundation and continuity** is complete. The project is at **G1: interface design and renderer feasibility spike**. The Home-to-Studio workflow is owner-approved, and the first FFmpeg-native renderer fixture is measured; no working editor capability is claimed yet.

Start every new or compacted session with [START_HERE.md](START_HERE.md).

## Non-negotiable product principles

- Designed for non-editors; no professional NLE knowledge should be required.
- User intent enters through chat, pointing, drawing, and direct manipulation.
- AI proposes structured edit actions; deterministic code validates and executes them.
- Source media is immutable and every accepted change is reversible.
- The user sees a real preview before accepting consequential edits.
- Production-grade module boundaries begin on day one; full SaaS operations do not.
- The initial interface is calm, minimal, black, white, and grayscale.
- Claims of accuracy require evidence. Deterministic operations can be exact; semantic interpretation must fail closed when confidence is insufficient.

## Documents

The canonical documentation map is [DOCS/INDEX.md](DOCS/INDEX.md). The approved roadmap and the next gated implementation plan are under [DOCS/plans](DOCS/plans).

## Local verification

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File hooks/verify_project_setup.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File hooks/verify_governance.ps1
```

These checks validate the G0 governance foundation only. They are not evidence that the video editor itself exists or works.
