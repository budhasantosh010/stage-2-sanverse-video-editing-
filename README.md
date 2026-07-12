# Stage 2 Sanverse Video Editing

An AI-native video editing product for people who are not professional video editors.

The intended experience is simple: upload a cleaned talking-head video, point or draw on the frame, explain the desired change in chat, preview the proposed edit, approve it, and export a polished video in minutes rather than hours.

## Current status

**G0: foundation and continuity** is complete. The project is at **G1: runnable web UX validation and renderer feasibility**. A runnable frontend Home-to-Studio shell now exists on strict local port 2000, and its controlled automated workflow has E3 evidence. It is not a working video editor: backend, upload, persistence, AI, real editing, rendering, and export do not exist. G1-01B remains in progress until the owner completes the real-video walkthrough and records feedback.

Start every new or compacted session with [START_HERE.md](START_HERE.md).

## Run the frontend

```powershell
cd "C:\Users\Lenovo\Music\Startups\YT Automations\A1 Talking Head Youtube Video\Sanverse YT Channel\Stage 2 Sanverse Editing Workflow"
npm run dev
```

Then open <http://localhost:2000>. `npm install` is not required on every run; use it only on the first setup or after dependency files change. See [DOCS/LOCAL_DEVELOPMENT.md](DOCS/LOCAL_DEVELOPMENT.md) for exact cases, port-conflict help, local-video privacy details, and the owner walkthrough.

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

These checks validate the governance foundation only. Frontend tests and a production build are separate evidence, and neither proves that a working video editor exists.
